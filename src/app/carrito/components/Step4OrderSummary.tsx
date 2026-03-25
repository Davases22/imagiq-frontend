"use client";
import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/hooks/useCart";
import CouponInput from "./CouponInput";
import { productEndpoints } from "@/lib/api";
import {
  buildGlobalCanPickUpKey,
  getGlobalCanPickUpFromCache,
  getFullCandidateStoresResponseFromCache,
  setGlobalCanPickUpCache,
} from "../utils/globalCanPickUpCache";

interface ShippingVerification {
  envio_imagiq: boolean;
  todos_productos_im_it: boolean;
  en_zona_cobertura: boolean;
  todos_productos_solo_im?: boolean;
  productos_no_im_tienen_remota?: boolean;
}

interface Step4OrderSummaryProps {
  readonly isProcessing?: boolean;
  readonly onFinishPayment: () => void;
  readonly buttonText?: string;
  readonly onBack?: () => void;
  readonly disabled?: boolean;
  readonly shippingVerification?: ShippingVerification | null;
  readonly deliveryMethod?: "delivery" | "pickup";
  readonly isSticky?: boolean;
  readonly isStep1?: boolean; // Indica si estamos en Step1 para calcular canPickUp global
  readonly onCanPickUpReady?: (isReady: boolean, isLoading: boolean) => void; // Callback para notificar cuando canPickUp está listo
  readonly error?: string | string[] | null;
  readonly shouldCalculateCanPickUp?: boolean; // Indica si debe calcular canPickUp (por defecto true en Steps 1-6, false en Step7)
  readonly products?: import("@/hooks/useCart").CartProduct[]; // Productos opcionales para reactividad inmediata
  readonly calculations?: {
    productCount: number;
    subtotal: number;
    shipping: number;
    taxes: number;
    discount: number;
    total: number;
  }; // Cálculos opcionales para reactividad inmediata
  readonly debugStoresInfo?: {
    availableStoresWhenCanPickUpFalse: number;
    stores: number;
    filteredStores: number;
    availableCities: number;
  }; // Información de debug sobre tiendas
  readonly buttonVariant?: "default" | "green"; // Variante de color del botón
  readonly hideButton?: boolean; // Ocultar el botón principal (útil para pasos intermedios como OTP)
  readonly shouldAnimateButton?: boolean; // Animación bounce cuando el botón se habilita
}

export default function Step4OrderSummary({
  isProcessing = false,
  onFinishPayment,
  buttonText = "Continuar",
  onBack,
  disabled = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shippingVerification,
  deliveryMethod,
  isSticky = true,
  isStep1 = false,
  onCanPickUpReady,
  error,
  shouldCalculateCanPickUp = true, // Por defecto true (Steps 1-6)
  products: propProducts,
  calculations: propCalculations,
  debugStoresInfo,
  buttonVariant = "default",
  hideButton = false,
  shouldAnimateButton = false,
}: Step4OrderSummaryProps) {
  const router = useRouter();
  const {
    calculations: hookCalculations,
    formatPrice: cartFormatPrice,
    isEmpty: hookIsEmpty,
    products: hookProducts,
    applyCoupon,
    removeCoupon,
    appliedCouponCode,
    appliedDiscount,
  } = useCart();

  // Usar props si existen, sino usar hook (para reactividad inmediata en Step1)
  const products = propProducts || hookProducts;
  const calculations = propCalculations || hookCalculations;
  const isEmpty = propProducts ? propProducts.length === 0 : hookIsEmpty;

  // Detectar si estamos en Step 2 (para deshabilitar lógica de loading artificial)
  const isStep2 = typeof window !== 'undefined' && window.location.pathname.includes('/carrito/step2');

  // Obtener método de entrega desde localStorage - forzar lectura correcta
  const getDeliveryMethodFromStorage = React.useCallback(() => {
    if (globalThis.window === undefined) return "domicilio";
    try {
      const method = globalThis.window.localStorage.getItem("checkout-delivery-method");
      // Validar que el método sea válido
      if (method === "tienda" || method === "domicilio") {
        return method;
      }
      return "domicilio";
    } catch (error) {
      console.error("Error reading delivery method from localStorage:", error);
      return "domicilio";
    }
  }, []);

  const [localDeliveryMethod, setLocalDeliveryMethod] = React.useState<string>(
    () => getDeliveryMethodFromStorage()
  );

  // Actualizar el método de entrega cuando cambie
  React.useEffect(() => {
    if (globalThis.window === undefined) return;

    const updateDeliveryMethod = () => {
      const method = getDeliveryMethodFromStorage();
      setLocalDeliveryMethod((prev) => {
        // Solo actualizar si cambió para evitar re-renders innecesarios
        if (prev !== method) {
          return method;
        }
        return prev;
      });
    };

    // Actualizar inmediatamente al montar
    updateDeliveryMethod();

    // Escuchar cambios en localStorage (entre pestaanas)
    const handleStorageChange = () => {
      updateDeliveryMethod();
    };
    globalThis.window.addEventListener("storage", handleStorageChange);

    // Escuchar evento personalizado cuando cambia el método de entrega
    const handleDeliveryMethodChanged = () => {
      updateDeliveryMethod();
    };
    globalThis.window.addEventListener(
      "delivery-method-changed",
      handleDeliveryMethodChanged
    );

    // Verificar cambios más frecuentemente para detectar cambios en la misma pestaña
    const interval = setInterval(updateDeliveryMethod, 50);

    // También forzar actualización cuando el componente recibe foco
    const handleFocus = () => {
      updateDeliveryMethod();
    };
    globalThis.window.addEventListener("focus", handleFocus);

    return () => {
      globalThis.window.removeEventListener("storage", handleStorageChange);
      globalThis.window.removeEventListener(
        "delivery-method-changed",
        handleDeliveryMethodChanged
      );
      globalThis.window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [getDeliveryMethodFromStorage]);

  // Calcular ahorro total por descuentos de productos
  const productSavings = React.useMemo(() => {
    return products.reduce((total, product) => {
      if (product.originalPrice && product.originalPrice > product.price) {
        const saving =
          (product.originalPrice - product.price) * product.quantity;
        return total + saving;
      }
      return total;
    }, 0);
  }, [products]);

  // Estado para canPickUp global y debug
  const [globalCanPickUp, setGlobalCanPickUp] = React.useState<boolean | null>(() => {
    // Intentar leer sincrónicamente del caché al inicializar
    if (typeof window === 'undefined') return null;

    try {
      // 1. Obtener usuario
      // IMPORTANTE: Obtener userId de forma consistente usando la utilidad centralizada
      const storedUser = localStorage.getItem("imagiq_user");
      let userId: string | undefined;
      if (storedUser) {
        const user = JSON.parse(storedUser);
        userId = user.id || user.user_id;
      }

      // console.log('🔍 [Step4OrderSummary INIT globalCanPickUp] userId:', userId);

      if (!userId) return null;

      // 2. Obtener dirección - Intentar checkout-address primero, luego fallbacks
      let addressId: string | null = null;
      let savedAddress = localStorage.getItem("checkout-address");

      // Fallback 1: imagiq_default_address si checkout-address no existe
      if (!savedAddress || savedAddress === "undefined" || savedAddress === "null") {
        savedAddress = localStorage.getItem("imagiq_default_address");
      }

      // Fallback 2: defaultAddress dentro de imagiq_user
      if (!savedAddress || savedAddress === "undefined" || savedAddress === "null") {
        const userDataStr = localStorage.getItem("imagiq_user");
        if (userDataStr && userDataStr !== "null" && userDataStr !== "undefined") {
          const userData = JSON.parse(userDataStr);
          if (userData?.defaultAddress?.id) {
            savedAddress = JSON.stringify(userData.defaultAddress);
            // console.log('📍 [Step4OrderSummary INIT] Usando defaultAddress de imagiq_user:', userData.defaultAddress.id);
          }
        }
      }

      // console.log('🔍 [Step4OrderSummary INIT] savedAddress:', savedAddress?.substring(0, 50));

      if (savedAddress && savedAddress !== "undefined" && savedAddress !== "null") {
        const parsed = JSON.parse(savedAddress);
        if (parsed?.id) {
          addressId = parsed.id;
        }
      }

      // console.log('🔍 [Step4OrderSummary INIT] addressId:', addressId);

      // 3. Obtener productos
      if (!products || products.length === 0) {
        // console.log('🔍 [Step4OrderSummary INIT] No products');
        return null;
      }

      const productsToCheck = products.map((p) => ({
        sku: p.sku,
        quantity: p.quantity,
      }));

      // console.log('🔍 [Step4OrderSummary INIT] productsToCheck:', productsToCheck.length);

      // 4. Construir clave y buscar en caché
      const cacheKey = buildGlobalCanPickUpKey({
        userId,
        products: productsToCheck,
        addressId,
      });

      // console.log('🔍 [Step4OrderSummary INIT] cacheKey:', cacheKey.substring(0, 80) + '...');

      // Primero intentar obtener el valor simple
      const cachedValue = getGlobalCanPickUpFromCache(cacheKey);
      // console.log('🔍 [Step4OrderSummary INIT] cachedValue (simple):', cachedValue);

      if (cachedValue !== null) {
        return cachedValue;
      }

      // Si no hay valor simple, intentar obtener de fullResponse
      const fullResponse = getFullCandidateStoresResponseFromCache(cacheKey);
      // console.log('🔍 [Step4OrderSummary INIT] fullResponse:', {
//         exists: !!fullResponse,
//         canPickUp: fullResponse?.canPickUp
//       });

      if (fullResponse && typeof fullResponse.canPickUp === 'boolean') {
        // console.log('✅ [Step4OrderSummary INIT] Usando canPickUp de fullResponse:', fullResponse.canPickUp);
        return fullResponse.canPickUp;
      }

      return null;
    } catch (e) {
      console.error("Error reading cache synchronously in Step4OrderSummary:", e);
      return null;
    }
  });

  // Estado para datos de debug desde el caché (tiendas, ciudades, etc.)
  const [cachedDebugStoresInfo, setCachedDebugStoresInfo] = React.useState<{
    availableStoresWhenCanPickUpFalse: number;
    stores: number;
    filteredStores: number;
    availableCities: number;
  } | null>(null);

  const [isLoadingCanPickUp, setIsLoadingCanPickUp] = React.useState(() => {
    if (typeof window === 'undefined') return false;

    // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] shouldCalculateCanPickUp:', shouldCalculateCanPickUp, 'isStep1:', isStep1);

    // Si shouldCalculateCanPickUp es false (e.g. Step7), no mostrar loading
    if (!shouldCalculateCanPickUp) {
      // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] -> false (shouldCalculateCanPickUp=false)');
      return false;
    }

    try {
      // Repetir lógica para consistencia
      const storedUser = localStorage.getItem("imagiq_user");
      let userId: string | undefined;
      if (storedUser) {
        const user = JSON.parse(storedUser);
        userId = user.id || user.user_id;
      }

      if (!userId) {
        // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] -> false (no userId)');
        return false; // Sin usuario no podemos validar, no bloquear
      }

      if (!products || products.length === 0) {
        // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] -> false (no products)');
        return false;
      }

      // Verificar caché de nuevo - Intentar checkout-address primero, luego fallbacks
      let addressId: string | null = null;
      let savedAddress = localStorage.getItem("checkout-address");

      // Fallback 1: imagiq_default_address si checkout-address no existe
      if (!savedAddress || savedAddress === "undefined" || savedAddress === "null") {
        savedAddress = localStorage.getItem("imagiq_default_address");
      }

      // Fallback 2: defaultAddress dentro de imagiq_user (ya lo tenemos parseado arriba)
      if (!savedAddress || savedAddress === "undefined" || savedAddress === "null") {
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          if (userData?.defaultAddress?.id) {
            savedAddress = JSON.stringify(userData.defaultAddress);
            // console.log('📍 [Step4OrderSummary INIT isLoadingCanPickUp] Usando defaultAddress de imagiq_user');
          }
        }
      }

      if (savedAddress && savedAddress !== "undefined" && savedAddress !== "null") {
        const parsed = JSON.parse(savedAddress);
        if (parsed?.id) {
          addressId = parsed.id;
        }
      }

      // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] addressId:', addressId);

      // Si no tenemos dirección válida y estamos en Steps 1-6 (shouldCalculateCanPickUp=true),
      // NO mostrar loading porque setGlobalCanPickUp pondrá null automáticamente más tarde
      // A MENOS QUE sea Step1, donde useDelivery maneja la lógica.
      // Pero aquí solo VALIDAMOS si ya tenemos un valor en caché.
      if (!addressId && !isStep1) {
        // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] -> false (no addressId and not Step1)');
        return false;
      }

      const productsToCheck = products.map((p) => ({
        sku: p.sku,
        quantity: p.quantity,
      }));

      const cacheKey = buildGlobalCanPickUpKey({
        userId,
        products: productsToCheck,
        addressId,
      });

      // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] cacheKey:', cacheKey.substring(0, 80) + '...');

      const cachedValue = getGlobalCanPickUpFromCache(cacheKey);
      // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] cachedValue:', cachedValue);

      // Si tenemos valor en caché, NO estamos cargando
      if (cachedValue !== null) {
        // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] -> false (cache hit)');
        return false;
      }

      // NUEVO: También verificar fullResponse
      const fullResponse = getFullCandidateStoresResponseFromCache(cacheKey);
      if (fullResponse && typeof fullResponse.canPickUp === 'boolean') {
        // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] -> false (fullResponse cache hit)');
        return false;
      }

      // Si no tenemos valor en caché y shouldCalculateCanPickUp es true, estamos cargando
      // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] -> true (no cache, shouldCalculate=true)');
      return true;
    } catch {
      // console.log('🔍 [Step4OrderSummary INIT isLoadingCanPickUp] -> false (error)');
      return false; // Ante error, no bloquear
    }
  });
  // Estado para rastrear si el usuario hizo clic en el botón mientras está cargando
  const [userClickedWhileLoading, setUserClickedWhileLoading] = React.useState(false);
  // Estado para loading artificial (visual) en el botón, separado de la lógica de auto-advance
  const [isArtificialLoading, setIsArtificialLoading] = React.useState(false);
  // Estado para saber si el usuario está logueado (para optimizar lógica del botón)
  const [isUserLoggedIn, setIsUserLoggedIn] = React.useState<boolean | null>(null);
  // Estado para saber si el usuario tiene dirección predeterminada
  const [hasDefaultAddress, setHasDefaultAddress] = React.useState<boolean | null>(null);

  // Verificar si el usuario está logueado y es rol 2/3 al montar el componente
  React.useEffect(() => {
    const checkUserLoggedIn = async () => {
      try {
        const { getUserId } = await import('@/app/carrito/utils/getUserId');
        const userId = getUserId();

        if (!userId) {
          setIsUserLoggedIn(false);
          return;
        }

        // Verificar el rol del usuario
        let userRole = null;
        try {
          if (typeof globalThis.window !== "undefined") {
            const userDataStr = globalThis.window.localStorage.getItem("imagiq_user");
            if (userDataStr && userDataStr !== "null" && userDataStr !== "undefined") {
              const userData = JSON.parse(userDataStr);
              userRole = userData?.role ?? userData?.rol;
            }
          }
        } catch (error) {
          console.error('Error checking user role:', error);
        }

        // Solo considerar "logueado" si es rol 2, 3 o 4 (que necesitan candidate stores)
        const requiresCalculation = userRole === 2 || userRole === 3 || userRole === 4;
        setIsUserLoggedIn(requiresCalculation);

        // console.log(`👤 [Step4OrderSummary] User check: userId=${!!userId}, role=${userRole}, requiresCalculation=${requiresCalculation}`);
      } catch (error) {
        console.error('Error checking user login status:', error);
        setIsUserLoggedIn(false);
      }
    };

    checkUserLoggedIn();
  }, []);

  // Verificar si el usuario tiene dirección predeterminada
  React.useEffect(() => {
    const checkDefaultAddress = () => {
      if (typeof globalThis.window === "undefined") {
        setHasDefaultAddress(false);
        return;
      }

      try {
        // Verificar checkout-address o imagiq_default_address
        let savedAddress = globalThis.window.localStorage.getItem("checkout-address");
        const defaultAddress = globalThis.window.localStorage.getItem("imagiq_default_address");

        // Si hay imagiq_default_address, usarla
        if (defaultAddress && defaultAddress !== "null" && defaultAddress !== "undefined") {
          savedAddress = defaultAddress;
        }

        if (savedAddress && savedAddress !== "null" && savedAddress !== "undefined") {
          const parsed = JSON.parse(savedAddress);
          // Verificar que tenga ciudad y línea_uno como mínimo
          // Soportar tanto camelCase (lineaUno) como snake_case (linea_uno) o direccionFormateada
          const lineaUnoValue = parsed?.lineaUno || parsed?.linea_uno || parsed?.direccionFormateada;
          if (parsed?.ciudad && lineaUnoValue) {
            setHasDefaultAddress(true);
            return;
          }
        }

        setHasDefaultAddress(false);
      } catch (error) {
        console.error('Error checking default address:', error);
        setHasDefaultAddress(false);
      }
    };

    checkDefaultAddress();

    // Escuchar cambios de dirección
    const handleAddressChange = () => checkDefaultAddress();
    globalThis.window?.addEventListener("address-changed", handleAddressChange);
    globalThis.window?.addEventListener("storage", handleAddressChange);

    return () => {
      globalThis.window?.removeEventListener("address-changed", handleAddressChange);
      globalThis.window?.removeEventListener("storage", handleAddressChange);
    };
  }, []);

  // Ref para guardar la función onFinishPayment y evitar ejecuciones múltiples
  const onFinishPaymentRef = React.useRef(onFinishPayment);

  // Ref para evitar múltiples ejecuciones del auto-advance
  const autoAdvanceTriggered = React.useRef(false);

  // Ref para controlar race conditions en fetchGlobalCanPickUp
  const lastRequestIdRef = React.useRef<number>(0);

  // Actualizar la ref cuando cambie la función
  React.useEffect(() => {
    onFinishPaymentRef.current = onFinishPayment;
  }, [onFinishPayment]);

  // Ref estable para fetchGlobalCanPickUp (evita stale closures en event listener)
  const fetchGlobalCanPickUpRef = React.useRef<(() => Promise<void>) | null>(null);

  // Función para leer el valor de `canPickUp` desde el caché (solo lectura, no fetching)
  // Se ejecuta cuando el componente se monta Y cuando el caché se actualiza desde useDelivery
  // IMPORTANTE: Esta función SOLO lee del caché, NO hace llamadas al endpoint
  const fetchGlobalCanPickUp = React.useCallback(async () => {
    // Generar ID único para esta ejecución y actualizar ref para evitar race conditions
    const requestId = Date.now();
    lastRequestIdRef.current = requestId;

    // VERIFICACIÓN TEMPRANA: Solo proceder para usuarios rol 2 o 3
    // Esta verificación debe ser lo PRIMERO para evitar cálculos innecesarios
    let shouldCalculateForUser = false;
    let userId = null;

    try {
      const { getUserId } = await import('@/app/carrito/utils/getUserId');
      userId = getUserId();

      if (!userId) {
        setIsLoadingCanPickUp(false);
        setGlobalCanPickUp(null);
        return;
      }

      if (typeof globalThis.window !== "undefined") {
        const userDataStr = globalThis.window.localStorage.getItem("imagiq_user");
        if (userDataStr && userDataStr !== "null" && userDataStr !== "undefined") {
          const userData = JSON.parse(userDataStr);
          const userRole = userData?.role ?? userData?.rol;

          // Permitir cálculo para:
          // - rol 2 (registrado), rol 3 (invitado), rol 4
          // - O si el rol es undefined pero hay userId (usuario en proceso de registro/checkout)
          if (userRole === 2 || userRole === 3 || userRole === 4 || (userRole === undefined && userId)) {
            shouldCalculateForUser = true;
          }
        } else {
          // Si no hay userData pero hay userId (usuario invitado sin datos completos), permitir
          if (userId) {
            shouldCalculateForUser = true;
          }
        }
      }
    } catch (error) {
      console.error('Error checking user role in fetchGlobalCanPickUp:', error);
    }

    if (!shouldCalculateForUser) {
      setIsLoadingCanPickUp(false);
      setGlobalCanPickUp(null);
      return;
    }

    // Si no hay productos, no hacer nada
    if (products.length === 0) {
      setGlobalCanPickUp(null);
      setIsLoadingCanPickUp(false);
      return;
    }

    // CORRECCIÓN CRÍTICA: Si estamos en Step1, NUNCA hacer fetch desde aquí
    // useDelivery.tsx se encarga de todo el ciclo de vida en Step1

    // IMPORTANTE: Obtener userId de forma consistente usando la utilidad centralizada
    // (Ya lo tenemos de la verificación anterior)



    // Preparar TODOS los productos del carrito para construir la clave del caché
    // IMPORTANTE: Usar SKU regular (NO skuPostback) para coincidir con useDelivery
    const productsToCheck = products.map((p) => ({
      sku: p.sku, // Siempre usar sku para coincidir con la clave de useDelivery
      quantity: p.quantity,
    }));

    // IMPORTANTE: Verificar que haya dirección válida antes de intentar leer del caché
    // Esto evita mostrar "loading" cuando el usuario se registra como invitado pero aún no ha agregado dirección
    let hasValidAddress = false;
    let addressId: string | null = null;
    // IMPORTANTE: Usar la misma lógica que useDelivery.tsx para obtener addressId
    // Esto asegura que las claves de caché coincidan exactamente
    if (typeof globalThis.window !== "undefined") {
      try {
        // Leer de checkout-address primero
        let savedAddress = globalThis.window.localStorage.getItem("checkout-address");

        // Fallback 1: imagiq_default_address
        if (!savedAddress || savedAddress === "undefined" || savedAddress === "null") {
          savedAddress = globalThis.window.localStorage.getItem("imagiq_default_address");
        }

        // Fallback 2: defaultAddress dentro de imagiq_user
        if (!savedAddress || savedAddress === "undefined" || savedAddress === "null") {
          const userDataStr = globalThis.window.localStorage.getItem("imagiq_user");
          if (userDataStr && userDataStr !== "null" && userDataStr !== "undefined") {
            const userData = JSON.parse(userDataStr);
            if (userData?.defaultAddress?.id) {
              savedAddress = JSON.stringify(userData.defaultAddress);
              // console.log('📍 [fetchGlobalCanPickUp] Usando defaultAddress de imagiq_user:', userData.defaultAddress.id);
            }
          }
        }

        if (savedAddress && savedAddress !== "undefined" && savedAddress !== "null") {
          const parsed = JSON.parse(savedAddress) as { id?: string; ciudad?: string; linea_uno?: string; lineaUno?: string; direccionFormateada?: string };
          // Verificar que la dirección tenga al menos los campos mínimos (ciudad y línea_uno)
          // Soportar tanto camelCase (lineaUno) como snake_case (linea_uno) o direccionFormateada
          const lineaUnoValue = parsed.lineaUno || parsed.linea_uno || parsed.direccionFormateada;
          if (parsed.ciudad && lineaUnoValue) {
            hasValidAddress = true;
            if (parsed?.id) {
              addressId = parsed.id;
            }
          }
        }
      } catch (error) {
        console.error(
          "Error leyendo checkout-address para clave de canPickUp global:",
          error
        );
      }
    }

    // Si no hay dirección válida, NO bloquear el flujo
    // Simplemente establecer canPickUp como false y permitir que el usuario continúe
    // Esto es crítico para usuarios recién registrados que aún no tienen direcciones
    if (!hasValidAddress) {
      setGlobalCanPickUp(false); // Permitir continuar - no hay dirección = no puede recoger en tienda
      setIsLoadingCanPickUp(false);
      return;
    }

    // OPTIMIZACIÓN: SOLO leer desde el caché, NO hacer petición al endpoint
    const cacheKey = buildGlobalCanPickUpKey({
      userId: userId!, // Ya verificamos que no es null
      products: productsToCheck,
      addressId,
    });

    const cachedValue = getGlobalCanPickUpFromCache(cacheKey);

    if (cachedValue !== null) {
      setGlobalCanPickUp(cachedValue);
      setIsLoadingCanPickUp(false);
      return;
    }

    // NUEVO: Si no hay valor simple en caché, intentar obtener de fullResponse
    // Esto es crítico para Steps 4-7 donde el caché ya fue poblado por useDelivery
    const fullResponse = getFullCandidateStoresResponseFromCache(cacheKey);
    if (fullResponse && typeof fullResponse.canPickUp === 'boolean') {
      setGlobalCanPickUp(fullResponse.canPickUp);
      setIsLoadingCanPickUp(false);
      return;
    }

    // CRÍTICO: En Step7, NUNCA dejar globalCanPickUp en null
    // SIEMPRE debe mostrar true o false después de calcular

    // Si shouldCalculateCanPickUp es true (Steps 1-6): establecer loading=true
    // Si es false (Step 7): hacer fetch OBLIGATORIO y establecer loading=true
    setIsLoadingCanPickUp(true);

    // CORRECCIÓN: En Step1-6, NO hacer fetch propio - solo leer del caché
    // useDelivery.tsx se encarga de calcular y guardar en caché
    // Solo Step7 (shouldCalculateCanPickUp=false) puede hacer fetch de respaldo
    if (typeof window !== 'undefined') {
      // Si es Step1, NO hacer fetch de respaldo (ya lo hace useDelivery)
      if (isStep1) {
        setGlobalCanPickUp(null);
        setIsLoadingCanPickUp(false);
        return;
      }

      // NUEVO: Si shouldCalculateCanPickUp es true (Steps 2-6), NO hacer fetch
      // Solo mostrar loading y esperar a que useDelivery actualice el caché
      if (shouldCalculateCanPickUp) {
        // Mantener loading en true para indicar que estamos esperando
        // El evento 'canPickUpCache-updated' disparará fetchGlobalCanPickUp cuando el caché esté listo
        setIsLoadingCanPickUp(true);
        setGlobalCanPickUp(null);
        return;
      }

      // Solo Step7 (shouldCalculateCanPickUp=false) hace fetch de respaldo
      // console.log('🔄 [Step4OrderSummary] Step7: No hay caché disponible, haciendo fetch obligatorio...');

      // Hacer la petición inmediatamente - CRÍTICO para Step7
      productEndpoints.getCandidateStores({
        products: productsToCheck,
        user_id: userId!,  // El ! es seguro porque ya verificamos que no es null
        addressId: addressId || undefined
      })
        .then((response) => {
          // Verificar race condition
          if (requestId !== lastRequestIdRef.current) {
            // console.log(`🚫 [Step4OrderSummary] Ignorando respuesta obsoleta (reqId: ${requestId}, last: ${lastRequestIdRef.current})`);
            return;
          }

          if (response.data) {
            // console.log('✅ [Step4OrderSummary] Fetch completado, canPickUp:', response.data.canPickUp);

            // Guardar en caché
            setGlobalCanPickUpCache(cacheKey, response.data.canPickUp, response.data, addressId);

            // CRÍTICO: Actualizar globalCanPickUp SIEMPRE (tanto en Steps 1-6 como en Step7)
            setGlobalCanPickUp(response.data.canPickUp ?? false);
            setIsLoadingCanPickUp(false);
          } else {
            // console.warn('⚠️ [Step4OrderSummary] Respuesta sin data, usando false por defecto');
            setGlobalCanPickUp(false);
            setIsLoadingCanPickUp(false);
          }
        })
        .catch(() => {
          // Verificar race condition
          if (requestId !== lastRequestIdRef.current) {
            // console.log(`🚫 [Step4OrderSummary] Ignorando error de solicitud obsoleta (reqId: ${requestId}, last: ${lastRequestIdRef.current})`);
            return;
          }

          // console.error('❌ [Step4OrderSummary] Error en fetch de respaldo:', error);
          // CRÍTICO: Incluso en error, establecer un valor concreto (false) en lugar de null
          setGlobalCanPickUp(false);
          setIsLoadingCanPickUp(false);
        });
    }
  }, [products, isStep1, shouldCalculateCanPickUp]);

  // Safety timeout para evitar que se quede cargando indefinidamente
  // IMPORTANTE: Solo detener el loading, NO cambiar el valor de canPickUp
  // Si el endpoint ya respondió con un valor, ese valor debe prevalecer
  React.useEffect(() => {
    if (isLoadingCanPickUp) {
      const timer = setTimeout(() => {
        if (isLoadingCanPickUp) {
          console.warn('⚠️ [Step4OrderSummary] Safety timeout triggered - Forcing stop loading');
          setIsLoadingCanPickUp(false);
          // NO cambiar globalCanPickUp - si el endpoint respondió, su valor debe mantenerse
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoadingCanPickUp]);

  // Safety timeout para isArtificialLoading - si el processing falla silenciosamente
  // (ej: processOrder retorna temprano sin setIsProcessing), re-habilitar el botón
  React.useEffect(() => {
    if (isArtificialLoading) {
      const timer = setTimeout(() => {
        // Solo resetear si isProcessing no tomó el control (procesamiento real no inició)
        if (!isProcessing) {
          setIsArtificialLoading(false);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isArtificialLoading, isProcessing]);

  // Actualizar la ref cada vez que cambie la función
  React.useEffect(() => {
    fetchGlobalCanPickUpRef.current = fetchGlobalCanPickUp;
  }, [fetchGlobalCanPickUp]);

  // Escuchar actualizaciones del caché de canPickUp (disparadas por useDelivery)
  // Esto es CRÍTICO para que Step4 se actualice cuando useDelivery termina de cargar (Step 1)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCacheUpdate = async () => {
      // Usar la ref para evitar stale closures
      if (fetchGlobalCanPickUpRef.current) {
        await fetchGlobalCanPickUpRef.current();
      }
    };

    window.addEventListener('canPickUpCache-updated', handleCacheUpdate);

    return () => {
      window.removeEventListener('canPickUpCache-updated', handleCacheUpdate);
    };
  }, []); // ✅ Sin dependencias, listener estable

  // Leer datos de debug desde el caché completo (para mostrar info de tiendas en panel DEBUG)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateDebugInfoFromCache = () => {
      // console.log('🔍 [Step4OrderSummary] updateDebugInfoFromCache llamada');
      try {
        // Obtener userId
        const storedUser = localStorage.getItem("imagiq_user");
        let userId: string | undefined;
        if (storedUser) {
          const user = JSON.parse(storedUser);
          userId = user.id || user.user_id;
        }
        // console.log('🔍 [Step4OrderSummary] userId:', userId);
        if (!userId) {
          // console.log('🔍 [Step4OrderSummary] No userId, saliendo');
          return;
        }

        // Obtener dirección - Intentar checkout-address primero, luego imagiq_default_address como fallback
        let addressId: string | null = null;
        let savedAddress = localStorage.getItem("checkout-address");

        // Fallback 1: imagiq_default_address si checkout-address no existe
        if (!savedAddress || savedAddress === "undefined" || savedAddress === "null") {
          savedAddress = localStorage.getItem("imagiq_default_address");
        }

        // Fallback 2: defaultAddress dentro de imagiq_user
        if (!savedAddress || savedAddress === "undefined" || savedAddress === "null") {
          const userDataStr = localStorage.getItem("imagiq_user");
          if (userDataStr && userDataStr !== "null" && userDataStr !== "undefined") {
            const userData = JSON.parse(userDataStr);
            if (userData?.defaultAddress?.id) {
              savedAddress = JSON.stringify(userData.defaultAddress);
              // console.log('📍 [updateDebugInfoFromCache] Usando defaultAddress de imagiq_user:', userData.defaultAddress.id);
            }
          }
        }

        // console.log('🔍 [Step4OrderSummary] savedAddress raw:', savedAddress?.substring(0, 100));
        if (savedAddress && savedAddress !== "undefined" && savedAddress !== "null") {
          const parsed = JSON.parse(savedAddress);
          if (parsed?.id) {
            addressId = parsed.id;
          }
        }
        // console.log('🔍 [Step4OrderSummary] addressId:', addressId);

        if (!products || products.length === 0) {
          // console.log('🔍 [Step4OrderSummary] No products, saliendo');
          return;
        }

        const productsToCheck = products.map((p) => ({
          sku: p.sku,
          quantity: p.quantity,
        }));
        // console.log('🔍 [Step4OrderSummary] productsToCheck:', productsToCheck.length, 'productos');

        const cacheKey = buildGlobalCanPickUpKey({
          userId,
          products: productsToCheck,
          addressId,
        });
        // console.log('🔍 [Step4OrderSummary] cacheKey construida:', cacheKey.substring(0, 80) + '...');

        // Obtener respuesta completa del caché
        const fullResponse = getFullCandidateStoresResponseFromCache(cacheKey);
        // console.log('🔍 [Step4OrderSummary] fullResponse del caché:', {
//           exists: !!fullResponse,
//           hasStores: !!fullResponse?.stores,
//           canPickUp: fullResponse?.canPickUp,
//           storesKeys: fullResponse?.stores ? Object.keys(fullResponse.stores) : []
//         });

        if (fullResponse && fullResponse.stores) {
          // stores es Record<string, CandidateStore[]> - necesitamos aplanar todas las tiendas
          const allStores = Object.values(fullResponse.stores).flat();
          const totalStores = allStores.length;
          const availableCitiesCount = Object.keys(fullResponse.stores).length;

          // console.log('🔍 [Step4OrderSummary] Datos de tiendas:', {
//             totalStores,
//             availableCitiesCount,
//             canPickUp: fullResponse.canPickUp
//           });

          // Según la lógica de useDelivery:
          // - Si canPickUp es true: stores = todas las tiendas, availableStoresWhenCanPickUpFalse = 0
          // - Si canPickUp es false: stores = 0, availableStoresWhenCanPickUpFalse = todas las tiendas
          const storesCanPickUpTrue = fullResponse.canPickUp ? totalStores : 0;
          const storesCanPickUpFalse = fullResponse.canPickUp ? 0 : totalStores;

          setCachedDebugStoresInfo({
            stores: storesCanPickUpTrue,
            availableStoresWhenCanPickUpFalse: storesCanPickUpFalse,
            filteredStores: storesCanPickUpTrue,
            availableCities: availableCitiesCount,
          });

          // CRÍTICO: También actualizar globalCanPickUp desde el caché completo
          // Esto asegura que el panel DEBUG muestre el valor correcto
          // console.log('🔍 [Step4OrderSummary] fullResponse.canPickUp tipo:', typeof fullResponse.canPickUp, 'valor:', fullResponse.canPickUp);
          if (typeof fullResponse.canPickUp === 'boolean') {
            // console.log('✅ [Step4OrderSummary] Actualizando globalCanPickUp a:', fullResponse.canPickUp);
            setGlobalCanPickUp(fullResponse.canPickUp);
            setIsLoadingCanPickUp(false);
          } else {
            // console.log('⚠️ [Step4OrderSummary] fullResponse.canPickUp NO es boolean, no actualizo globalCanPickUp');
          }
        } else {
          // console.log('⚠️ [Step4OrderSummary] No hay fullResponse o no tiene stores');
        }
      } catch (e) {
        console.error("Error reading full cache for debug info:", e);
      }
    };

    // Leer al montar
    updateDebugInfoFromCache();

    // También actualizar cuando cambie el caché
    const handleCacheUpdate = () => {
      updateDebugInfoFromCache();
    };
    window.addEventListener('canPickUpCache-updated', handleCacheUpdate);

    // También escuchar cambios de dirección para re-leer el caché
    const handleAddressChange = () => {
      // Pequeño delay para asegurar que localStorage se actualizó
      setTimeout(updateDebugInfoFromCache, 100);
    };
    window.addEventListener('address-changed', handleAddressChange);

    return () => {
      window.removeEventListener('canPickUpCache-updated', handleCacheUpdate);
      window.removeEventListener('address-changed', handleAddressChange);
    };
  }, [products]);

  // OPTIMIZACIÓN: En Steps 4-7, NO recalcular automáticamente
  // SOLO recalcular cuando se cambia la dirección desde el navbar
  // En Step1-3, sí se calcula automáticamente
  // IMPORTANTE: En Step7 (shouldCalculateCanPickUp=false), también ejecutar fetchGlobalCanPickUp
  // para leer del caché y mostrar el valor de canPickUp
  React.useEffect(() => {
    // Si shouldCalculateCanPickUp es false (Step7), solo leer del caché sin hacer peticiones
    if (!shouldCalculateCanPickUp) {
      // Ejecutar fetchGlobalCanPickUp para leer del caché (no hará peticiones porque shouldFetch será false)
      if (products.length > 0) {

        fetchGlobalCanPickUp();
      }
      return;
    }

    // Si isStep1 es true, calcular normalmente (flujo original)
    if (isStep1) {
      // Verificar si viene desde "Entrego y Estreno" (hay un flag en localStorage)
      const isFromTradeIn = typeof window !== "undefined" &&
        localStorage.getItem("open_trade_in_modal_sku") !== null;

      // Si viene desde Trade-In, esperar un poco más para asegurar que los productos estén cargados
      // También esperar si los productos aún no tienen SKUs válidos (pueden estar cargándose)
      const hasValidProducts = products.length > 0 &&
        products.every(p => p.sku && p.sku.trim() !== "");

      // Si no hay productos válidos, esperar más tiempo
      // Reducido a mínimos absolutos por solicitud de cero latencia
      const baseDelay = isFromTradeIn ? 50 : 0;
      const delay = hasValidProducts ? baseDelay : baseDelay + 100;

      // Esperar un delay para asegurar que los productos estén completamente cargados
      // especialmente cuando se viene desde "Entrego y Estreno" (los productos se agregan justo antes de navegar)
      const timer = setTimeout(() => {
        // Verificar que haya productos antes de calcular canPickUp
        if (products.length > 0) {
          // Verificar también que los productos tengan los datos necesarios (sku válido)
          const allProductsValid = products.every(p => p.sku && p.sku.trim() !== "");

          if (allProductsValid) {
            // NO resetear userClickedWhileLoading aquí - solo cuando cambian los productos o shouldCalculateCanPickUp
            // Llamar a fetch (la lógica de si debe ejecutarse está dentro de fetchGlobalCanPickUp)
            fetchGlobalCanPickUp();
          }
        } else {

        }
      }, delay);

      return () => clearTimeout(timer);
    }

    // Si NO es Step1 (Steps 4-7), SOLO leer del caché inmediatamente
    // NO esperar delays, NO recalcular automáticamente

    // CRÍTICO: En Step1, NO leer el caché aquí porque useDelivery maneja todo el flujo
    // y disparará el evento 'canPickUpCache-updated' cuando esté listo.
    // Leer aquí causaría un race condition donde leemos null antes de que se escriba.
    if (!isStep1) {
      // console.log('🔔 [Step4] EFFECT directo (línea 908) - llamando fetchGlobalCanPickUp');
      fetchGlobalCanPickUp();
    }
  }, [
    fetchGlobalCanPickUp,
    isStep1,
    shouldCalculateCanPickUp,
    products,
  ]);

  // Escuchar cuando el caché se actualiza para volver a leer
  React.useEffect(() => {
    const handleCacheUpdate = () => {
      // console.log('🔔 [Step4] LISTENER #2 (línea 926) - canPickUpCache-updated disparado');
      // Ejecutar inmediatamente para máxima fluidez
      fetchGlobalCanPickUp();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('canPickUpCache-updated', handleCacheUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('canPickUpCache-updated', handleCacheUpdate);
      }
    };
  }, [fetchGlobalCanPickUp]);

  // Resetear userClickedWhileLoading cuando cambian los productos, shouldCalculateCanPickUp, o cuando canPickUp termina de cargar
  React.useEffect(() => {
    setUserClickedWhileLoading(false);
    autoAdvanceTriggered.current = false;
  }, [products.length, shouldCalculateCanPickUp]);

  // COMENTADO: Este useEffect interfiere con nuestro loading visual inmediato
  // Resetear userClickedWhileLoading cuando canPickUp termina de cargar (para evitar bloqueos)
  // React.useEffect(() => {
  //   if (!isLoadingCanPickUp && userClickedWhileLoading) {
  //     // Si canPickUp ya terminó de cargar y userClickedWhileLoading está en true, resetearlo
  //     // Esto permite que el usuario pueda hacer clic normalmente si canPickUp ya cargó
  //     setUserClickedWhileLoading(false);
  //   }
  // }, [isLoadingCanPickUp, userClickedWhileLoading]);

  // REMOVED: Polling periódico eliminado - los event listeners son suficientes
  // El polling cada segundo causaba bucles infinitos y llamadas excesivas
  // Los event listeners 'canPickUpCache-updated' manejan las actualizaciones del caché
  // Si después de 30 segundos no hay caché, el fallback fetch en fetchGlobalCanPickUp ya lo maneja

  // Notificar cuando canPickUp está listo (no está cargando)
  // IMPORTANTE: Notificar en todos los pasos, no solo en Step1, para que Step3 pueda usar el valor
  React.useEffect(() => {
    if (onCanPickUpReady) {
      // Solo notificar si tenemos un valor concreto (true/false) o si está cargando
      if (globalCanPickUp !== null) {
        // Tenemos un valor concreto, notificar
        onCanPickUpReady(globalCanPickUp, isLoadingCanPickUp);
      } else if (isLoadingCanPickUp) {
        // Si está cargando y globalCanPickUp es null, sí notificar (para mostrar loading)
        onCanPickUpReady(false, isLoadingCanPickUp);
      }
      // Si globalCanPickUp es null y NO está cargando (timeout), NO notificar
      // para evitar sobrescribir un valor previo válido con false
    }
  }, [globalCanPickUp, isLoadingCanPickUp, onCanPickUpReady]);

  // Ejecutar onFinishPayment automáticamente cuando termine de cargar canPickUp
  // y el usuario había hecho clic mientras estaba cargando
  React.useEffect(() => {
    // console.log(`🔍 [Step4OrderSummary] Auto-advance effect - userClickedWhileLoading: ${userClickedWhileLoading}, isLoadingCanPickUp: ${isLoadingCanPickUp}, globalCanPickUp: ${globalCanPickUp}, shouldCalculateCanPickUp: ${shouldCalculateCanPickUp}`);

    // Solo avanzar si:
    // 1. El usuario hizo clic mientras estaba cargando (userClickedWhileLoading === true)
    // 2. Ya terminó de cargar (isLoadingCanPickUp === false)
    // 3. En steps que calculan canPickUp: debe tener un valor concreto (globalCanPickUp !== null) O el usuario no está logueado
    //    En steps que NO calculan: puede avanzar sin valor
    const canAdvance = userClickedWhileLoading &&
      !isLoadingCanPickUp &&
      (shouldCalculateCanPickUp ? (globalCanPickUp !== null || isUserLoggedIn === false) : true);

    if (canAdvance && !autoAdvanceTriggered.current) {
      // console.log(`🚀 [Step4OrderSummary] Auto-advancing! Conditions met - executing onFinishPayment`);

      // Marcar como ejecutado para evitar múltiples llamadas
      autoAdvanceTriggered.current = true;

      // NO resetear userClickedWhileLoading para mantener el spinner visible hasta que cambie la página
      // setUserClickedWhileLoading(false);

      // Ejecutar con pequeño delay para que la UI se actualice
      setTimeout(() => {
        try {
          // console.log(`🎯 [Step4OrderSummary] Executing onFinishPayment via auto-advance`);
          onFinishPaymentRef.current();
        } catch (error) {
          console.error('❌ Error al ejecutar onFinishPayment:', error);
          // En caso de error, permitir reintentar y quitar loading
          autoAdvanceTriggered.current = false;
          setUserClickedWhileLoading(false);
        }
      }, 50); // Delay más corto que antes
    }
  }, [userClickedWhileLoading, isLoadingCanPickUp, globalCanPickUp, shouldCalculateCanPickUp, isUserLoggedIn]);

  // Escuchar cambios en la dirección para recalcular canPickUp
  // IMPORTANTE: En Steps 4-7, SOLO recalcular cuando viene del navbar (fromHeader: true)
  React.useEffect(() => {
    const handleAddressChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const fromHeader = customEvent.detail?.fromHeader;

      // En Steps 4-7 (cuando NO es Step1), SOLO recalcular si viene del navbar
      // CORRECCIÓN: Usar shouldCalculateCanPickUp para determinar si debemos recalcular
      // Esto permite que Step3 (que tiene shouldCalculateCanPickUp=true) procese cambios de dirección locales
      if (!isStep1 && !shouldCalculateCanPickUp && !fromHeader) {
        // console.log('📖 [Step4-7] Cambio de dirección NO viene del navbar y no se requiere cálculo, ignorando');
        return;
      }

      // En Step1, Steps 2-3 (shouldCalculateCanPickUp=true), o cuando viene del navbar, recalcular

      // Invalidar caché antes de recalcular (usando import dinámico)
      // NOTE: No necesitamos usar addressId aquí ya que useDelivery maneja el ciclo de vida del caché

      // NO invalidar caché manualmente aquí.
      // useDelivery.tsx es el encargado de gestionar el ciclo de vida del caché.
      // Si useDelivery decide hacer fetch, limpiará el caché. Si no (debounce),
      // el caché actual sigue siendo válido y evitamos el loop infinito.
      // Ejecutar inmediatamente para máxima fluidez
      fetchGlobalCanPickUp();
    };

    globalThis.window.addEventListener("address-changed", handleAddressChange as EventListener);
    globalThis.window.addEventListener("checkout-address-changed", handleAddressChange as EventListener);

    // También escuchar cambios en localStorage (pero aplicar misma lógica)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "checkout-address") {
        // Los eventos storage no tienen detail, así que no sabemos si vienen del header
        // En Steps 4-7, NO recalcular automáticamente por eventos storage
        if (!isStep1) {

          return;
        }

        fetchGlobalCanPickUp();
      }
    };
    globalThis.window.addEventListener("storage", handleStorageChange);

    // Escuchar cambios en el caché de candidate stores
    const handleCacheUpdate = () => {
      // console.log('🔔 [Step4] LISTENER #3 (línea 1062) - canPickUpCache-updated disparado');
      fetchGlobalCanPickUp();
    };
    globalThis.window.addEventListener("canPickUpCache-updated", handleCacheUpdate);

    return () => {
      globalThis.window.removeEventListener("address-changed", handleAddressChange as EventListener);
      globalThis.window.removeEventListener("checkout-address-changed", handleAddressChange as EventListener);
      globalThis.window.removeEventListener("storage", handleStorageChange);
      globalThis.window.removeEventListener("canPickUpCache-updated", handleCacheUpdate);
    };
  }, [fetchGlobalCanPickUp, isStep1, shouldCalculateCanPickUp]);

  const baseContainerClasses =
    "bg-white rounded-2xl p-6 shadow flex flex-col gap-4 h-fit border border-[#E5E5E5]";
  const stickyClasses = isSticky ? " sticky top-40" : "";
  const containerClasses = `${baseContainerClasses}${stickyClasses}`;

  // Reutilizar lógica de deshabilitado para el botón primario
  const isPrimaryDisabled =
    isProcessing || disabled || (!isStep2 && (userClickedWhileLoading || isArtificialLoading));

  const primaryButtonBaseClasses =
    "flex-1 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all duration-200 flex items-center justify-center";

  const primaryButtonVariantClasses =
    buttonVariant === "green"
      ? isPrimaryDisabled
        ? "bg-gray-400 border-2 border-gray-300"
        : "bg-green-600 border-2 border-green-500 hover:bg-green-700 hover:border-green-600 shadow-lg shadow-green-500/40 hover:shadow-xl hover:shadow-green-500/50"
      : "bg-black hover:bg-gray-900";

  if (isEmpty) {
    return (
      <aside className={containerClasses}>
        <h2 className="font-bold text-lg">Resumen de compra</h2>
        <div className="flex flex-col items-center justify-center py-6">
          <p className="text-gray-500 text-center">Tu carrito está vacío</p>
          <button
            type="button"
            className="w-full bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg mt-4 hover:bg-gray-300 focus-visible:ring-2 focus-visible:ring-blue-600 transition cursor-pointer"
            onClick={() => router.push("/")}
          >
            Volver a comprar
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={containerClasses}>
      <div className="flex flex-col gap-2">
        {/* Productos: mostrar precio ANTES del descuento para que el usuario vea el impacto */}
        <div className="flex justify-between text-sm">
          <span>Productos ({calculations.productCount})</span>
          <span className="font-semibold">
            {cartFormatPrice(calculations.subtotal + productSavings)}
          </span>
        </div>

        {/* Descuento por productos */}
        {productSavings > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-green-600 font-medium">
              Descuento
            </span>
            <span className="text-green-600 font-semibold">
              -{cartFormatPrice(productSavings)}
            </span>
          </div>
        )}

        {/* Cupón aplicado - línea integrada en el resumen */}
        {appliedCouponCode && calculations.discount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-medium">
                Bono {appliedCouponCode}
              </span>
              {isStep1 && (
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Eliminar
                </button>
              )}
            </div>
            <span className="text-green-600 font-semibold">
              -{cartFormatPrice(calculations.discount)}
            </span>
          </div>
        )}

        {/* Input de cupón (solo en Step1, sin cupón aplicado) */}
        {isStep1 && !appliedCouponCode && (
          <CouponInput
            onApply={applyCoupon}
            cartProducts={products}
          />
        )}

        {/* Envío - Ocultar en Step1 */}
        {!isStep1 && (
          <div className="flex justify-between text-sm">
            <span>
              {(() => {
                // Prefer prop value, fallback to local state or localStorage
                let currentMethod: string;
                if (deliveryMethod === "pickup") {
                  currentMethod = "tienda";
                } else if (deliveryMethod === "delivery") {
                  currentMethod = "domicilio";
                } else if (localDeliveryMethod === "tienda") {
                  currentMethod = "tienda";
                } else {
                  currentMethod = getDeliveryMethodFromStorage();
                }
                return currentMethod === "tienda"
                  ? "Recoger en tienda"
                  : "Envío a domicilio";
              })()}
            </span>
            {calculations.shipping > 0 && (
              <span className="font-semibold">
                {cartFormatPrice(calculations.shipping)}
              </span>
            )}
          </div>
        )}

        {/* Total: siempre string */}
        <div className="flex justify-between text-base font-bold mt-2">
          <span>Total</span>
          <span>{cartFormatPrice(calculations.total)}</span>
        </div>
      </div>

      {/* Mostrar error si existe */}
      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {/* Botones: Volver y Acción en la misma fila */}
      <div className="flex gap-3">
        {/* Botón de volver (opcional) */}
        {onBack && (
          <button
            type="button"
            className="flex-1 bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-300 focus-visible:ring-2 focus-visible:ring-blue-600 transition cursor-pointer"
            onClick={onBack}
          >
            Volver
          </button>
        )}

        {!hideButton && (
          <button
            type="button"
            className={`${primaryButtonBaseClasses} ${primaryButtonVariantClasses} ${isPrimaryDisabled ? "cursor-not-allowed" : "cursor-pointer"} ${shouldAnimateButton ? "animate-buttonBounce" : ""}`}
            disabled={isPrimaryDisabled}
            data-testid="checkout-finish-btn"
            data-button-text={buttonText}
            aria-busy={isProcessing || userClickedWhileLoading || isArtificialLoading}
            onClick={async () => {
            // console.log(`🎯 [Step4OrderSummary] Button clicked - isLoadingCanPickUp: ${isLoadingCanPickUp}, globalCanPickUp: ${globalCanPickUp}, shouldCalculateCanPickUp: ${shouldCalculateCanPickUp}, userClickedWhileLoading: ${userClickedWhileLoading}`);

            // Usar loading artificial para feedback visual inmediato SIN activar el auto-advance del useEffect
            setIsArtificialLoading(true);

            // Dar tiempo para que se vea el loading en la UI
            await new Promise(resolve => setTimeout(resolve, 100));

            // CASO 1: Verificar si realmente necesitamos esperar al cálculo
            // Solo esperar si es un usuario rol 2/3 Y está calculando
            if (isLoadingCanPickUp && shouldCalculateCanPickUp) {
              // Verificar si es un usuario que realmente necesita candidate stores
              const { getUserId } = await import('@/app/carrito/utils/getUserId');
              const userId = getUserId();

              if (!userId) {
                // console.log(`👤 [Step4OrderSummary] No user logged in, proceeding after short loading`);
                setTimeout(() => {
                  // setUserClickedWhileLoading(false);
                  onFinishPayment();
                }, 300);
                return;
              }

              // Verificar el rol del usuario
              let userRole = null;
              try {
                if (typeof globalThis.window !== "undefined") {
                  const userDataStr = globalThis.window.localStorage.getItem("imagiq_user");
                  if (userDataStr && userDataStr !== "null" && userDataStr !== "undefined") {
                    const userData = JSON.parse(userDataStr);
                    userRole = userData?.role ?? userData?.rol;
                  }
                }
              } catch (error) {
                console.error('Error checking user role in onClick:', error);
              }

              // Si NO es rol 2, 3 o 4, proceder después de mostrar loading
              if (userRole !== 2 && userRole !== 3 && userRole !== 4) {
                // console.log(`👤 [Step4OrderSummary] User role ${userRole} does not need candidate stores, proceeding after short loading`);
                setTimeout(() => onFinishPayment(), 300); // Mostrar loading por un momento
                return;
              }

              // Solo si es rol 2/3/4, entonces sí esperar al cálculo real
              // console.log(`⏳ [Step4OrderSummary] User rol ${userRole} needs candidate stores and it's loading, waiting for real calculation...`);

              // AHORA activamos el flag para que el useEffect se encargue cuando termine
              setUserClickedWhileLoading(true);
              return; // El useEffect de auto-advance se encargará
            }

            // CASO 2: Si canPickUp es null y deberíamos calcularlo, verificar si el usuario está logueado y es rol 2/3
            if (globalCanPickUp === null && shouldCalculateCanPickUp) {
              // Si ya sabemos que el usuario no está logueado, proceder después de mostrar loading
              if (isUserLoggedIn === false) {
                // console.log(`👤 [Step4OrderSummary] User not logged in (cached), proceeding after short loading`);
                setTimeout(() => onFinishPayment(), 300);
                return;
              }

              // Si aún no sabemos o el usuario está logueado, verificar dinámicamente
              const { getUserId } = await import('@/app/carrito/utils/getUserId');
              const userId = getUserId();

              if (!userId) {
                // console.log(`👤 [Step4OrderSummary] No user logged in (dynamic check), proceeding after short loading`);
                setIsUserLoggedIn(false); // Actualizar cache para próximas veces
                setTimeout(() => onFinishPayment(), 300);
                return;
              }

              // Verificar el rol del usuario
              let userRole = null;
              try {
                if (typeof globalThis.window !== "undefined") {
                  const userDataStr = globalThis.window.localStorage.getItem("imagiq_user");
                  if (userDataStr && userDataStr !== "null" && userDataStr !== "undefined") {
                    const userData = JSON.parse(userDataStr);
                    userRole = userData?.role ?? userData?.rol;
                  }
                }
              } catch (error) {
                console.error('Error checking user role in onClick:', error);
              }

              // Si no es rol 2, 3 o 4, proceder después de mostrar loading
              if (userRole !== 2 && userRole !== 3 && userRole !== 4) {
                // console.log(`👤 [Step4OrderSummary] User role ${userRole} does not require candidate stores, proceeding after short loading`);
                setTimeout(() => onFinishPayment(), 300);
                return;
              }

              // console.log(`⏳ [Step4OrderSummary] User logged in with rol ${userRole}, canPickUp is null, setting userClickedWhileLoading=true and triggering calculation...`);

              // AHORA activamos el flag para que el useEffect se encargue
              setUserClickedWhileLoading(true);

              // Forzar cálculo si no está ya cargando
              if (!isLoadingCanPickUp) {
                // console.log(`🔄 [Step4OrderSummary] Forcing fetchGlobalCanPickUp because canPickUp is null...`);
                fetchGlobalCanPickUp();
              }
              return; // El useEffect de auto-advance se encargará cuando termine el cálculo
            }

            // CASO 3: Si llegamos aquí, podemos proceder después de mostrar loading brevemente
            // console.log(`✅ [Step4OrderSummary] Ready to proceed after short loading`);
            setTimeout(() => onFinishPayment(), 300);
          }}
        >
          {(isProcessing || userClickedWhileLoading) ? (
            <span
              className="flex gap-2 items-center justify-center"
              aria-live="polite"
            >
              <svg
                className="animate-spin h-5 w-5 text-white"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              <span>{buttonText}</span>
            </span>
          ) : (
            buttonText
          )}
          </button>
        )}
      </div>

      {/* Términos y Condiciones */}
      <p className="text-[10px] text-gray-600 leading-tight">
        Al continuar con tu compra, aceptas los{" "}
        <a
          href="/soporte/politicas-generales"
          target="_blank"
          className="text-blue-600 underline hover:text-blue-700"
        >
          Términos y Condiciones
        </a>{" "}
        y utilizaremos tus datos personales de acuerdo a nuestra{" "}
        <a
          href="/soporte/tratamiento-datos-personales"
          target="_blank"
          className="text-blue-600 underline hover:text-blue-700"
        >
          política de privacidad
        </a>.
      </p>

      {/* Información de compra - financiamiento y envío */}
      <div className="flex flex-col gap-2 text-[10px] leading-relaxed mt-3">

        {/* Contenedor con padding lateral para información de financiamiento y envío */}
        <div className="flex flex-col gap-2 px-1">
          {/* Información de Financiamiento */}
          <div className="flex gap-2 items-start">
            <div className="shrink-0">
              <svg
                width="28"
                height="28"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 14C8 12.3431 9.34315 11 11 11H29C30.6569 11 32 12.3431 32 14V26C32 27.6569 30.6569 29 29 29H11C9.34315 29 8 27.6569 8 26V14Z"
                  stroke="#222"
                  strokeWidth="1.5"
                />
                <path d="M8 17H32" stroke="#222" strokeWidth="1.5" />
                <rect x="13" y="23" width="7" height="2.5" rx="1.25" fill="#222" />
              </svg>
            </div>
            <p className="text-black">
              Compra sin interés a 3, 6, 12 o 24 cuotas pagando con tarjetas de
              nuestros bancos aliados: Bancolombia y Davivienda. Aplican{" "}
              <a
                href="/soporte/tyc-bancolombia"
                target="_blank"
                className="text-blue-600 underline hover:text-blue-700"
              >
                T&C Bancolombia
              </a>{" "}
              y{" "}
              <a
                href="/soporte/tyc-davivienda"
                target="_blank"
                className="text-blue-600 underline hover:text-blue-700"
              >
                T&C Davivienda
              </a>
              .
            </p>
          </div>

          {/* Información de Envío */}
          <div className="flex gap-2 items-start">
            <div className="shrink-0">
              <svg
                width="28"
                height="28"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Camión de envío */}
                <path
                  d="M9 16C9 14.8954 9.89543 14 11 14H21C22.1046 14 23 14.8954 23 16V29H9V16Z"
                  stroke="#222"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M23 21H26.5858C27.1162 21 27.6249 21.2107 28 21.5858L30.4142 24C30.7893 24.3751 31 24.8838 31 25.4142V29H23V21Z"
                  stroke="#222"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="14" cy="29" r="2.5" stroke="#222" strokeWidth="1.5" />
                <circle cx="27" cy="29" r="2.5" stroke="#222" strokeWidth="1.5" />
                <path d="M9 19H23" stroke="#222" strokeWidth="1.5" />
              </svg>
            </div>
            <p className="text-black">
              Envío gratis a toda Colombia. Si compras en Bogotá antes de las
              11:00 am productos de la categoría Smartphones y Accesorios,
              recibirás tu pedido el mismo día
            </p>
          </div>

          {/* Información de Addi */}
          <div className="flex gap-2 items-start">
            <div className="shrink-0">
              <div className="w-8 h-8 flex items-center justify-center">
                <Image
                  src="https://res.cloudinary.com/dzi2p0pqa/image/upload/v1764650798/acd66fce-b218-4a0d-95e9-559410496596.png"
                  alt="Addi"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            </div>
            <p className="text-black">
              Paga a crédito con <span className="font-semibold">addi</span>. Compra ahora y paga después en cuotas flexibles sin necesidad de tarjeta de crédito
            </p>
          </div>
        </div>

        {/* Debug Info - Solo visible cuando NEXT_PUBLIC_SHOW_PRODUCT_CODES=true */}
        {process.env.NEXT_PUBLIC_SHOW_PRODUCT_CODES === "true" && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
            {/* Log de debug para consola */}
            {(() => {
              // console.log('🎨 [Step4OrderSummary DEBUG RENDER]', {
//                 globalCanPickUp,
//                 isLoadingCanPickUp,
//                 shouldCalculateCanPickUp,
//                 hasDefaultAddress,
//                 debugStoresInfo,
//                 cachedDebugStoresInfo,
//                 productCount: products.length
//               });
              return null;
            })()}
            <p className="text-[10px] font-bold text-yellow-900 mb-1">
              🔍 DEBUG - Candidate Stores Info
            </p>
            <div className="text-[9px] text-yellow-800 space-y-0.5">
              <div className="flex justify-between">
                <span>canPickUp (endpoint):</span>
                <span className="font-mono font-bold">
                  {isLoadingCanPickUp && shouldCalculateCanPickUp ? (
                    <span className="text-blue-600 animate-pulse">⏳ calculando...</span>
                  ) : globalCanPickUp === null ? (
                    // Mostrar "no aplica" solo cuando no tiene dirección
                    hasDefaultAddress === false ? (
                      <span className="text-gray-500">➖ no aplica</span>
                    ) : (
                      <span className="text-orange-600">🔄 calculando...</span>
                    )
                  ) : globalCanPickUp ? (
                    <span className="text-green-600">✅ true</span>
                  ) : (
                    <span className="text-red-600">❌ false</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>User clicked while loading:</span>
                <span className="font-mono font-bold">
                  {userClickedWhileLoading ? (
                    <span className="text-orange-600 animate-pulse">
                      🔄 esperando...
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </span>
              </div>
              {/* Usar debugStoresInfo (prop) si existe, sino usar cachedDebugStoresInfo (del caché) */}
              {(debugStoresInfo || cachedDebugStoresInfo) && (
                <>
                  <div className="flex justify-between">
                    <span>Stores (canPickUp=true):</span>
                    <span className="font-mono">{(debugStoresInfo || cachedDebugStoresInfo)?.stores ?? '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stores (canPickUp=false):</span>
                    <span className="font-mono">{(debugStoresInfo || cachedDebugStoresInfo)?.availableStoresWhenCanPickUpFalse ?? '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cities available:</span>
                    <span className="font-mono">{(debugStoresInfo || cachedDebugStoresInfo)?.availableCities ?? '-'}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>Products count:</span>
                <span className="font-mono">{products.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
