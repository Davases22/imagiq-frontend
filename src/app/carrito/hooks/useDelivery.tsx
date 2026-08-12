"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { addressesService } from "@/services/addresses.service";
import type { Address } from "@/types/address";
import { safeGetLocalStorage } from "@/lib/localStorage";
import type { FormattedStore } from "@/types/store";
import {
  productEndpoints,
  type CandidateStore,
  type CandidateStoresResponse,
  type ApiResponse,
} from "@/lib/api";
import { useCart } from "@/hooks/useCart";
import {
  buildGlobalCanPickUpKey,
  getFullCandidateStoresResponseFromCache,
  getGlobalCanPickUpFromCache,
  setGlobalCanPickUpCache,
  invalidateCacheOnAddressChange,
  clearGlobalCanPickUpCache,
} from "../utils/globalCanPickUpCache";

/**
 * Normaliza texto removiendo acentos y convirtiendo a minúsculas
 * Esto permite buscar "Bogota" y encontrar "Bogotá"
 */
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, ""); // Remueve diacríticos (acentos)
};

/**
 * Convierte CandidateStore a FormattedStore directamente desde el endpoint candidate-stores
 * NO valida con ningún otro endpoint, usa directamente los datos del endpoint
 */
const candidateStoreToFormattedStore = (
  candidateStore: CandidateStore,
  city: string
): FormattedStore => {
  // Convertir codDane a número
  let codDane: number;
  if (candidateStore.codDane) {
    if (typeof candidateStore.codDane === "string") {
      codDane = Number.parseInt(candidateStore.codDane, 10);
    } else {
      codDane = candidateStore.codDane;
    }
  } else {
    codDane = 0;
  }

  // Extraer código numérico del codBodega
  const codigo = Number.parseInt(candidateStore.codBodega.replaceAll(/\D/g, ''), 10) || 0;

  // Extraer teléfono y extensión si están disponibles
  const telefono = candidateStore.telefono || "";
  const extension = candidateStore.extension || "";

  // Crear FormattedStore directamente con los datos del endpoint
  return {
    codigo: codigo,
    descripcion: candidateStore.nombre_tienda.trim(),
    departamento: city, // Usar la ciudad como departamento
    ciudad: city, // IMPORTANTE: Usar el parámetro city (key del objeto) para consistencia en filtros
    direccion: candidateStore.direccion,
    place_ID: candidateStore.place_ID,
    ubicacion_cc: "", // No viene en el endpoint candidate-stores
    horario: candidateStore.horario,
    telefono: telefono,
    extension: extension,
    email: "", // No viene en el endpoint candidate-stores
    codBodega: candidateStore.codBodega,
    codDane: codDane,
    latitud: 0, // No viene en el endpoint candidate-stores
    longitud: 0, // No viene en el endpoint candidate-stores
    position: [0, 0], // No viene en el endpoint candidate-stores
    stock: candidateStore.stock, // Stock disponible en la tienda
  };
};

interface UseDeliveryConfig {
  /**
   * Controla si este hook puede hacer llamadas al endpoint candidate-stores
   * - true: Puede hacer llamadas (Step1, cambios de dirección)
   * - false: Solo lee del caché, nunca hace llamadas (Steps 2-6)
   * @default true
   */
  canFetchFromEndpoint?: boolean;

  /**
   * Si es true, solo lee del caché y no hace llamadas aunque canFetchFromEndpoint sea true
   * Útil para Steps 2-6 que solo necesitan leer datos precargados
   * @default false
   */
  onlyReadCache?: boolean;
}

/**
 * Helper para leer datos de tiendas del caché de forma sincrónica.
 * Se usa para inicializar estados cuando onlyReadCache=true.
 * Retorna null si no hay datos válidos en caché.
 */
interface CacheStoresData {
  stores: FormattedStore[];
  filteredStores: FormattedStore[];
  availableCities: string[];
  availableStoresWhenCanPickUpFalse: FormattedStore[];
  canPickUp: boolean;
}

function getInitialStoresFromCache(): CacheStoresData | null {
  if (typeof window === 'undefined') return null;

  try {
    // CRÍTICO: Limpiar el lock global al iniciar lectura de caché
    // Esto evita que Step3 se quede bloqueado por un lock de Step1 que no se limpió
    const globalState = window as unknown as { __imagiqIsFetching?: boolean; __imagiqLastFetchTime?: number };
    if (globalState.__imagiqIsFetching) {
      const timeSinceLastFetch = Date.now() - (globalState.__imagiqLastFetchTime || 0);
      // Si el lock tiene más de 2 segundos, limpiarlo
      if (timeSinceLastFetch > 2000) {
        globalState.__imagiqIsFetching = false;
      }
    }

    // Obtener userId
    const storedUser = localStorage.getItem("imagiq_user");
    let userId: string | undefined;
    if (storedUser) {
      const user = JSON.parse(storedUser);
      userId = user.id || user.user_id;
    }

    if (!userId) {
      return null;
    }

    // Obtener addressId
    let addressId: string | null = null;
    let savedAddress = localStorage.getItem("checkout-address");
    if (!savedAddress || savedAddress === "null" || savedAddress === "undefined") {
      savedAddress = localStorage.getItem("imagiq_default_address");
    }
    if (savedAddress && savedAddress !== "undefined" && savedAddress !== "null") {
      const parsed = JSON.parse(savedAddress);
      if (parsed?.id) {
        addressId = parsed.id;
      }
    }

    // Obtener productos del carrito
    const cartData = localStorage.getItem("imagiq_cart");
    if (!cartData) {
      return null;
    }

    const cart = JSON.parse(cartData);
    const products = cart.products || [];
    if (products.length === 0) {
      return null;
    }

    const productsToCheck = products.map((p: { sku: string; skuPostback?: string; quantity: number }) => ({
      sku: p.skuPostback || p.sku,
      quantity: p.quantity,
    }));

    // Construir clave y obtener caché
    const cacheKey = buildGlobalCanPickUpKey({
      userId,
      products: productsToCheck,
      addressId,
    });

    const cachedResponse = getFullCandidateStoresResponseFromCache(cacheKey);
    if (!cachedResponse) {
      return null;
    }

    // Procesar datos del caché
    const globalCanPickUp = cachedResponse.canPickUp;
    let physicalStores: FormattedStore[] = [];
    const cities: string[] = Object.keys(cachedResponse.stores || {}).filter(city => {
      const cityStores = cachedResponse.stores?.[city];
      return cityStores && cityStores.length > 0;
    });

    if (cachedResponse.stores) {
      const allStoresInOrder: Array<{ store: CandidateStore; city: string }> = [];
      for (const [city, cityStores] of Object.entries(cachedResponse.stores)) {
        if (cityStores && cityStores.length > 0) {
          for (const store of cityStores) {
            allStoresInOrder.push({ store, city });
          }
        }
      }

      if (allStoresInOrder.length > 0) {
        const validStores = allStoresInOrder.map(
          ({ store, city }) => candidateStoreToFormattedStore(store, city)
        );

        physicalStores = validStores.filter((store) => {
          const descripcion = normalizeText(store.descripcion);
          const codigo = store.codigo?.toString().trim() || "";
          return !descripcion.includes("centro de distribucion") &&
            !descripcion.includes("centro distribucion") &&
            !descripcion.includes("bodega") &&
            codigo !== "001";
        });
      }
    }

    const firstCity = cities.length > 0 ? cities[0] : null;
    const storesToShow = globalCanPickUp
      ? (firstCity ? physicalStores.filter(store => store.ciudad === firstCity) : physicalStores)
      : [];

    return {
      stores: storesToShow,
      filteredStores: [...storesToShow],
      availableCities: cities,
      availableStoresWhenCanPickUpFalse: globalCanPickUp ? storesToShow : physicalStores,
      canPickUp: globalCanPickUp,
    };
  } catch (error) {
    console.error('[getInitialStoresFromCache] Error:', error);
    return null;
  }
}

export const useDelivery = (config?: UseDeliveryConfig) => {
  const canFetchFromEndpoint = config?.canFetchFromEndpoint ?? true;
  const onlyReadCache = config?.onlyReadCache ?? false;

  const { products } = useCart();

  // OPTIMIZACIÓN: Cuando onlyReadCache=true, inicializar estados directamente desde el caché
  // para evitar el "flash" de estados vacíos antes de que se lean del caché
  const initialCacheData = onlyReadCache ? getInitialStoresFromCache() : null;

  // Ref para marcar si ya teníamos datos del caché al montar
  // Esto evita que fetchCandidateStores sobrescriba los estados inicializados
  const hadInitialCacheDataRef = useRef(!!initialCacheData);

  const [address, setAddress] = useState<Address | null>(null);
  const [addressEdit, setAddressEdit] = useState(false);
  const [storeEdit, setStoreEdit] = useState(false);
  const [storeQuery, setStoreQuery] = useState("");
  const [stores, setStores] = useState<FormattedStore[]>(() => initialCacheData?.stores ?? []);
  const [filteredStores, setFilteredStores] = useState<FormattedStore[]>(() => initialCacheData?.filteredStores ?? []);
  const [selectedStore, setSelectedStore] = useState<FormattedStore | null>(
    null
  );
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [canPickUp, setCanPickUp] = useState<boolean | undefined>(() => initialCacheData?.canPickUp ?? true); // Estado para saber si se puede recoger en tienda
  const [addressLoading, setAddressLoading] = useState(false); // Estado para mostrar skeleton al recargar dirección
  const [availableCities, setAvailableCities] = useState<string[]>(() => initialCacheData?.availableCities ?? []); // Ciudades donde hay tiendas disponibles
  const [availableStoresWhenCanPickUpFalse, setAvailableStoresWhenCanPickUpFalse] = useState<FormattedStore[]>(() => initialCacheData?.availableStoresWhenCanPickUpFalse ?? []); // Tiendas disponibles cuando canPickUp es false
  const [lastResponse, setLastResponse] = useState<ApiResponse<CandidateStoresResponse> | null>(null); // DEBUG: Estado para guardar la última respuesta

  // Ref para contar llamadas y prevenir bucles infinitos
  const fetchCountRef = useRef(0);
  const fetchCountResetTimeRef = useRef(Date.now());

  // Ref para prevenir llamadas infinitas a fetchCandidateStores
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const lastAddressIdRef = useRef<string | null>(null); // Para rastrear última dirección procesada
  const lastAddressIdProcessedRef = useRef<string | null>(null); // Última dirección para la que se hizo petición
  const lastAddressFetchTimeRef = useRef<number>(0); // Tiempo de última petición por dirección
  const lastAddressForStoreSelectionRef = useRef<string | null>(null); // Última dirección cuando se seleccionó la tienda
  const isRemovingTradeInRef = useRef(false); // Para prevenir llamadas durante eliminación de trade-in
  const failedRequestHashRef = useRef<string | null>(null); // Hash de la última petición que falló
  const lastSuccessfulHashRef = useRef<string | null>(null); // Hash de la última petición exitosa
  const retryCountRef = useRef<Map<string, number>>(new Map()); // Contador de reintentos por hash de petición
  const processingAddressChangeRef = useRef<string | null>(null); // Dirección que se está procesando actualmente
  const lastAddressChangeProcessedTimeRef = useRef<number>(0); // Timestamp del último cambio de dirección procesado
  const retry429CountRef = useRef(0); // Contador de reintentos por error 429
  const allowFetchOnAddressChangeRef = useRef(false); // Flag para permitir peticiones cuando cambia dirección (aunque onlyReadCache=true)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout para reintentar peticiones bloqueadas

  // Ref para siempre tener la versión más reciente de fetchCandidateStores
  // IMPORTANTE: Declarada antes de fetchCandidateStores para evitar referencias indefinidas
  // Se actualiza en cada render para que los reintentos usen el closure más reciente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchCandidateStoresRef = useRef<((explicitAddressId?: string) => Promise<void>) | null>(null);

  // Flag global compartido para evitar procesar el mismo cambio desde múltiples listeners
  // Se usa en window para que sea compartido entre todos los componentes
  if (typeof globalThis.window !== 'undefined' && !(globalThis.window as unknown as { __imagiqAddressProcessing?: string }).__imagiqAddressProcessing) {
    (globalThis.window as unknown as { __imagiqAddressProcessing?: string }).__imagiqAddressProcessing = undefined;
  }

  // Cargar método de entrega desde localStorage al inicio
  const [deliveryMethod, setDeliveryMethodState] = useState<string>(() => {
    if (globalThis.window === undefined) return "domicilio";
    return globalThis.window.localStorage.getItem("checkout-delivery-method") || "domicilio";
  });

  // Wrapper para setDeliveryMethod que también guarda en localStorage
  const setDeliveryMethod = (method: string) => {
    // Validar que el método sea válido
    if (method !== "tienda" && method !== "domicilio") {
      console.error(`⚠️ Método de entrega inválido: ${method}. Usando "domicilio" por defecto.`);
      method = "domicilio";
    }

    setDeliveryMethodState(method);

    // Guardar en localStorage inmediatamente (importante para usuarios invitados)
    if (typeof globalThis.window !== "undefined") {
      try {
        globalThis.window.localStorage.setItem("checkout-delivery-method", method);
        // Disparar evento personalizado para notificar cambios
        globalThis.window.dispatchEvent(
          new CustomEvent("delivery-method-changed", { detail: { method } })
        );
        // También disparar evento storage para compatibilidad
        globalThis.window.dispatchEvent(new Event("storage"));
      } catch (error) {
        console.error("Error al guardar método de entrega en localStorage:", error);
      }
    }
  };

  const [storesLoading, setStoresLoading] = useState(() => {
    // Si tenemos datos iniciales del caché, no necesitamos loading
    if (initialCacheData) {
      return false;
    }
    // Si la configuración es solo leer del caché pero no hay datos, no mostrar loading
    // (ya se intentó leer y no había nada)
    if (onlyReadCache) {
      return false;
    }
    return canFetchFromEndpoint;
  });
  // const { products } = useCart(); // Moved to top

  // Cargar método de entrega desde localStorage cuando se monta el componente
  // También escuchar cambios en localStorage para sincronizar entre componentes
  useEffect(() => {
    if (globalThis.window === undefined) return;

    const updateFromStorage = () => {
      const savedMethod = globalThis.window.localStorage.getItem("checkout-delivery-method");
      if (
        savedMethod &&
        (savedMethod === "tienda" || savedMethod === "domicilio")
      ) {
        setDeliveryMethodState((current) => {
          // Solo actualizar si el valor cambió
          if (current !== savedMethod) {
            return savedMethod;
          }
          return current;
        });
      }
    };

    // Cargar al montar
    updateFromStorage();

    // Escuchar cambios en localStorage (solo entre pestañas, no en la misma pestaña)
    const handleStorageChange = (e: StorageEvent) => {
      // Solo actualizar si el cambio viene de otra pestaña
      if (e.key === "checkout-delivery-method") {
        updateFromStorage();
      }
    };
    globalThis.window.addEventListener("storage", handleStorageChange);

    // Escuchar evento personalizado (para cambios en la misma pestaña)
    const handleDeliveryMethodChanged = () => {
      updateFromStorage();
    };
    globalThis.window.addEventListener("delivery-method-changed", handleDeliveryMethodChanged);

    return () => {
      globalThis.window?.removeEventListener("storage", handleStorageChange);
      globalThis.window?.removeEventListener("delivery-method-changed", handleDeliveryMethodChanged);
    };
  }, []);

  // Ref para controlar la última petición activa de fetchCandidateStores
  // IMPORTANTE: Usar useRef para que persista entre renders y SIEMPRE tome la última llamada
  const lastFetchRequestIdRef = useRef(0);

  // Función para cargar tiendas candidatas
  // Llama al endpoint con TODOS los productos agrupados para obtener canPickUp global y sus tiendas
  // Acepta addressId opcional para evitar lecturas de localStorage desactualizadas (race conditions)
  const fetchCandidateStores = useCallback(async (explicitAddressId?: string) => {
    // Incrementar el requestId para esta llamada
    const thisRequestId = ++lastFetchRequestIdRef.current;

    // CRÍTICO: Cancelar cualquier timeout de reintento pendiente INMEDIATAMENTE
    // Esto asegura que solo la llamada más reciente se ejecute
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Obtener estado global para verificar si hay fetch en curso
    const globalState = globalThis.window as unknown as {
      __imagiqLastFetchTime?: number;
      __imagiqIsFetching?: boolean;
    };

    // PROTECCIÓN: Si ya hay un fetch global en curso, verificar si está bloqueado
    if (globalState.__imagiqIsFetching) {
      const timeSinceLastFetch = Date.now() - (globalState.__imagiqLastFetchTime || 0);
      // Si han pasado más de 3 segundos, liberar el lock (algo falló)
      if (timeSinceLastFetch > 3000) {
        console.warn('⚠️ [fetchCandidateStores] Lock global bloqueado por >3s, liberando...');
        globalState.__imagiqIsFetching = false;
      } else {
        // Programar reintento para después de que termine el fetch actual
        // CRÍTICO: Usar fetchCandidateStoresRef.current para evitar stale closures
        if (!retryTimeoutRef.current) {
          retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null;
            // Usar la referencia actualizada para tomar los productos más recientes
            fetchCandidateStoresRef.current?.(explicitAddressId);
          }, 500);
        }
        // CRÍTICO: NO dejar storesLoading en true cuando programamos un reintento
        // El reintento se encargará de activarlo de nuevo si es necesario
        // Esto evita que el loading se quede atascado si hay múltiples componentes
        // tratando de hacer fetch al mismo tiempo
        setStoresLoading(false);
        return;
      }
    }

    // PROTECCIÓN CONTRA BUCLES INFINITOS
    const nowCall = Date.now();
    if (nowCall - fetchCountResetTimeRef.current > 10000) {
      // Resetear contador cada 10 segundos
      fetchCountRef.current = 0;
      fetchCountResetTimeRef.current = nowCall;
    }

    if (fetchCountRef.current >= 10) {
      console.warn('⚠️ [fetchCandidateStores] Protección contra bucles activada (>10 llamadas/10s)');
      setStoresLoading(false);

      // CRÍTICO: Escribir en caché para desbloquear Step4OrderSummary si nos rendimos
      // Si no hacemos esto, Step4 se queda "loading" esperando una respuesta que nunca llegará
      const userStr = safeGetLocalStorage("imagiq_user", null) as string | null;
      let userIdForCache = null;
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          userIdForCache = user.id || user.user_id;
        } catch (e) { console.error(e); }
      }

      if (userIdForCache) {
        const currentAddressId = explicitAddressId ||
          (typeof globalThis.window !== 'undefined'
            ? (JSON.parse(globalThis.window.localStorage.getItem("checkout-address") || "{}").id || null)
            : null);

        // Usar los productos del scope actual (que causaron el bucle)
        const fallbackKey = buildGlobalCanPickUpKey({
          userId: userIdForCache,
          products: products,
          addressId: currentAddressId
        });

        console.warn('⚠️ [fetchCandidateStores] Escribiendo fallback en caché por Loop Protection:', fallbackKey);
        setGlobalCanPickUpCache(fallbackKey, false, {
          canPickUp: false,
          stores: {},
          success: false,
          hasData: false,
          message: 'Loop protection triggered',
          default_direction: null
        } as unknown as CandidateStoresResponse, currentAddressId);
      }

      return;
    }

    fetchCountRef.current++;

    // OPTIMIZACIÓN: Si onlyReadCache es true, SOLO leer del caché y retornar inmediatamente
    // EXCEPCIÓN: Si allowFetchOnAddressChangeRef es true, permitir petición (cambio de dirección)
    if (onlyReadCache && !allowFetchOnAddressChangeRef.current) {
      // Intentar leer del caché
      const user = safeGetLocalStorage<{ id?: string; user_id?: string }>(
        "imagiq_user",
        {}
      );
      let userId = user?.id || user?.user_id;

      // Si no hay userId en imagiq_user, intentar obtenerlo de checkout-address o imagiq_default_address
      if (!userId) {
        try {
          const savedAddress = globalThis.window?.localStorage.getItem("checkout-address");
          if (savedAddress) {
            const parsed = JSON.parse(savedAddress);
            if (parsed.usuario_id) {
              userId = parsed.usuario_id;
            }
          }

          if (!userId) {
            const defaultAddress = globalThis.window?.localStorage.getItem("imagiq_default_address");
            if (defaultAddress) {
              const parsed = JSON.parse(defaultAddress);
              if (parsed.usuario_id) {
                userId = parsed.usuario_id;
              }
            }
          }
        } catch (e) {
          console.error('Error recuperando user_id de direcciones (onlyReadCache):', e);
        }
      }

      if (!userId || products.length === 0) {

        return;
      }

      const productsToCheck = products.map((p) => ({
        sku: p.sku,
        quantity: p.quantity,
      }));

      let currentAddressId = lastAddressIdRef.current || '';
      let savedAddress: string | null = null;
      try {
        savedAddress = globalThis.window?.localStorage.getItem("checkout-address") || null;

        // Fallback a imagiq_default_address si checkout-address no existe (para usuarios invitados)
        if (!savedAddress || savedAddress === 'null' || savedAddress === 'undefined') {
          savedAddress = globalThis.window?.localStorage.getItem("imagiq_default_address") || null;
        }

        if (savedAddress && savedAddress !== 'null' && savedAddress !== 'undefined') {
          const parsed = JSON.parse(savedAddress) as Address;
          if (parsed.id) {
            currentAddressId = parsed.id;
            if (lastAddressIdRef.current !== parsed.id) {
              lastAddressIdRef.current = parsed.id;
            }
          }
        }
      } catch (error) {
        console.error('Error al leer dirección para caché:', error);
      }

      // IMPORTANTE: Verificar que haya dirección guardada antes de intentar leer del cache
      // Esto evita intentar leer del cache cuando el usuario se registra como invitado pero aún no ha agregado dirección
      let hasAddress = false;
      const addressCheckDetails: { savedAddressExists: boolean; hasCiudad: boolean; hasLineaUno: boolean } = { savedAddressExists: false, hasCiudad: false, hasLineaUno: false };
      try {
        if (savedAddress && savedAddress !== 'null' && savedAddress !== 'undefined') {
          addressCheckDetails.savedAddressExists = true;
          const parsed = JSON.parse(savedAddress) as Address & { linea_uno?: string };
          addressCheckDetails.hasCiudad = !!parsed.ciudad;
          // Soportar tanto camelCase (lineaUno) como snake_case (linea_uno)
          const lineaUnoValue = parsed.lineaUno || parsed.linea_uno;
          addressCheckDetails.hasLineaUno = !!lineaUnoValue;

          // Verificar que la dirección tenga al menos los campos mínimos (ciudad y línea_uno)
          // Aceptar tanto camelCase como snake_case para compatibilidad
          if (parsed.ciudad && lineaUnoValue) {
            hasAddress = true;
          }
        }
      } catch (error: unknown) {
        console.error('Error al verificar dirección en onlyReadCache:', error);
      }

      // IMPORTANTE: Solo requerir dirección cuando es onlyReadCache
      // En Step1 (canFetchFromEndpoint=true), permitir cálculo básico sin dirección
      if (!hasAddress) {
        setStores([]);
        setFilteredStores([]);
        setCanPickUp(false);
        setStoresLoading(false);
        return;
      }



      const cacheKey = buildGlobalCanPickUpKey({
        userId,
        products: productsToCheck,
        addressId: currentAddressId || null,
      });

      const cachedResponse = getFullCandidateStoresResponseFromCache(cacheKey);

      if (cachedResponse) {
        // Procesar respuesta cacheada (código existente)
        const responseData = cachedResponse;
        const globalCanPickUp = responseData.canPickUp;

        let physicalStores: FormattedStore[] = [];
        const cities: string[] = Object.keys(responseData.stores || {}).filter(city => {
          const cityStores = responseData.stores?.[city];
          return cityStores && cityStores.length > 0;
        });

        if (responseData.stores) {
          const allStoresInOrder: Array<{ store: CandidateStore; city: string }> = [];
          for (const [city, cityStores] of Object.entries(responseData.stores)) {
            if (cityStores && cityStores.length > 0) {
              for (const store of cityStores) {
                allStoresInOrder.push({ store, city: city });
              }
            }
          }

          if (allStoresInOrder.length > 0) {
            const validStores = allStoresInOrder.map(
              ({ store, city }) => candidateStoreToFormattedStore(store, city)
            );

            physicalStores = validStores.filter((store) => {
              const descripcion = normalizeText(store.descripcion);
              const codigo = store.codigo?.toString().trim() || "";
              const isValid = !descripcion.includes("centro de distribucion") &&
                !descripcion.includes("centro distribucion") &&
                !descripcion.includes("bodega") &&
                codigo !== "001";
              return isValid;
            });
          }
        }

        // Establecer estados inmediatamente desde caché (sin skeleton)
        // Solo actualizar si es la última petición
        if (thisRequestId === lastFetchRequestIdRef.current) {
          const firstCity = cities.length > 0 ? cities[0] : null;
          const storesToShow = globalCanPickUp
            ? (firstCity ? physicalStores.filter(store => store.ciudad === firstCity) : physicalStores)
            : [];

          setCanPickUp(globalCanPickUp);
          setAvailableCities(cities);

          if (globalCanPickUp) {
            setStores(storesToShow);
            setFilteredStores([...storesToShow]);
            setAvailableStoresWhenCanPickUpFalse(storesToShow);
          } else {
            setAvailableStoresWhenCanPickUpFalse(physicalStores);
            setStores([]);
            setFilteredStores([]);
          }

          // CRÍTICO: Desactivar loading cuando se lee del caché
          setStoresLoading(false);
        }
        return; // Salir sin hacer petición al endpoint
      } else {
        // No hay caché disponible con onlyReadCache
        // IMPORTANTE: Si el usuario tiene rol 2, 3 o 4 y tiene dirección, FORZAR recálculo
        const user = safeGetLocalStorage<{ id?: string; user_id?: string; rol?: number }>(
          "imagiq_user",
          {}
        );
        const userRol = user?.rol;
        const shouldForceRecalculate = hasAddress && (userRol === 2 || userRol === 3 || userRol === 4);

        if (shouldForceRecalculate) {
          allowFetchOnAddressChangeRef.current = true;
          // No retornar aquí, continuar para hacer la petición
        } else {
          setStoresLoading(false);
          return;
        }
      }
    }

    // PROTECCIÓN: Si canFetchFromEndpoint es false, NO hacer petición
    // EXCEPCIÓN: Si allowFetchOnAddressChangeRef es true (cambio de dirección o forzado por rol)
    if (!canFetchFromEndpoint && !allowFetchOnAddressChangeRef.current) {
      setStoresLoading(false); // Asegurar que loading se apague
      return;
    }

    // PROTECCIÓN CRÍTICA: NO hacer peticiones durante eliminación de trade-in
    if (isRemovingTradeInRef.current) {
      setStoresLoading(false); // Asegurar que loading se apague
      return;
    }

    // Prevenir llamadas locales simultáneas
    if (isFetchingRef.current) {
      const timeSinceLastLocal = Date.now() - lastFetchTimeRef.current;
      // Si han pasado más de 3 segundos, liberar el lock local (algo falló)
      if (timeSinceLastLocal > 3000) {
        console.warn('⚠️ [fetchCandidateStores] Lock local bloqueado por >3s, liberando...');
        isFetchingRef.current = false;
      } else {
        // Programar reintento para después de que termine el fetch actual
        // CRÍTICO: Usar fetchCandidateStoresRef.current para evitar stale closures
        if (!retryTimeoutRef.current) {
          retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null;
            // Usar la referencia actualizada para tomar los productos más recientes
            fetchCandidateStoresRef.current?.(explicitAddressId);
          }, 500);
        }
        // CRÍTICO: NO dejar storesLoading en true cuando programamos un reintento
        // El reintento se encargará de activarlo de nuevo si es necesario
        setStoresLoading(false);
        return;
      }
    }

    // Prevenir llamadas muy frecuentes (debounce global de 300ms)
    const now = Date.now();
    const lastGlobalFetch = globalState.__imagiqLastFetchTime || 0;

    if (now - lastGlobalFetch < 300) {
      setStoresLoading(false);
      // Solo programar reintento si no hay uno pendiente
      // CRÍTICO: Usar fetchCandidateStoresRef.current para evitar stale closures
      if (!retryTimeoutRef.current) {
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          // Usar la referencia actualizada para tomar los productos más recientes
          fetchCandidateStoresRef.current?.(explicitAddressId);
        }, 300);
      }
      return;
    }

    // Actualizar timestamp global y local
    globalState.__imagiqLastFetchTime = now;
    lastFetchTimeRef.current = now;

    // Marcar inicio de fetch global
    globalState.__imagiqIsFetching = true;
    isFetchingRef.current = true;



    // Obtener user_id PRIMERO (antes de activar loading)
    // IMPORTANTE: Usar getUserId() para consistencia con el resto del código
    let userId: string | null = null;
    try {
      const { getUserId } = await import('@/app/carrito/utils/getUserId');
      userId = getUserId();
    } catch (e) {
      console.error('❌ [fetchCandidateStores] Error obteniendo userId:', e);
    }

    // Fallback al método anterior si getUserId() falla
    if (!userId) {
      const user = safeGetLocalStorage<{ id?: string; user_id?: string }>(
        "imagiq_user",
        {}
      );
      userId = user?.id || user?.user_id || null;
    }

    // Si no hay userId en imagiq_user, intentar obtenerlo de checkout-address o imagiq_default_address
    if (!userId) {
      try {
        const savedAddress = globalThis.window?.localStorage.getItem("checkout-address");
        if (savedAddress) {
          const parsed = JSON.parse(savedAddress);
          if (parsed.usuario_id) {
            userId = parsed.usuario_id;
          }
        }

        if (!userId) {
          const defaultAddress = globalThis.window?.localStorage.getItem("imagiq_default_address");
          if (defaultAddress) {
            const parsed = JSON.parse(defaultAddress);
            if (parsed.usuario_id) {
              userId = parsed.usuario_id;
            }
          }
        }
      } catch (e) {
        console.error('Error recuperando user_id de direcciones:', e);
      }
    }

    if (!userId || products.length === 0) {
      setStores([]);
      setFilteredStores([]);
      setCanPickUp(false);
      setStoresLoading(false);
      isFetchingRef.current = false;

      // CRÍTICO: Liberar el lock global antes de retornar
      if (typeof globalThis.window !== 'undefined') {
        (globalThis.window as unknown as { __imagiqIsFetching?: boolean }).__imagiqIsFetching = false;

      }

      return;
    }

    // IMPORTANTE: Candidate stores solo necesita userId + productos SKU
    // NO necesita dirección para calcular qué tiendas tienen stock


    // Preparar TODOS los productos del carrito para una sola petición
    const productsToCheck = products.map((p) => ({
      sku: p.sku,
      quantity: p.quantity,
    }));

    // Obtener dirección actual
    // Prioridad: Argumento explícito (de evento) > localStorage
    // Esto evita condiciones de carrera donde localStorage aún no se ha actualizado al recibir el evento
    let currentAddressId = explicitAddressId || lastAddressIdRef.current || '';

    // Si no vino explícito, intentar leer de localStorage
    if (!explicitAddressId) {
      try {
        let savedAddress = globalThis.window?.localStorage.getItem("checkout-address");

        // Fallback a imagiq_default_address si checkout-address no existe (para usuarios invitados)
        if (!savedAddress || savedAddress === 'null' || savedAddress === 'undefined') {
          savedAddress = globalThis.window?.localStorage.getItem("imagiq_default_address") || null;
        }

        if (savedAddress && savedAddress !== 'null' && savedAddress !== 'undefined') {
          const parsed = JSON.parse(savedAddress) as Address & { usuario_id?: string };
          if (parsed.id) {
            currentAddressId = parsed.id;
            // Actualizar lastAddressIdRef si cambió
            if (lastAddressIdRef.current !== parsed.id) {
              lastAddressIdRef.current = parsed.id;
            }
          }
        }
      } catch (error) {
        console.error('Error al leer dirección para hash:', error);
      }
    } else {
      // Si vino explícito, actualizar referencia
      lastAddressIdRef.current = explicitAddressId;
    }



    // CRÍTICO: Intentar leer del caché ANTES de activar storesLoading
    // Esto evita skeleton cuando se cambia a "recoger en tienda"
    const cacheKey = buildGlobalCanPickUpKey({
      userId,
      products: productsToCheck,
      addressId: currentAddressId || null,
    });



    const cachedResponse = getFullCandidateStoresResponseFromCache(cacheKey);

    // Si hay datos en caché, usarlos INMEDIATAMENTE sin activar skeleton
    if (cachedResponse) {
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;
      // NO activar setStoresLoading(true) aquí - los datos ya están listos

      // Procesar respuesta cacheada exactamente igual que si viniera del endpoint
      const responseData = cachedResponse;
      const globalCanPickUp = responseData.canPickUp;

      // Procesar tiendas desde la respuesta cacheada
      let physicalStores: FormattedStore[] = [];
      const cities: string[] = Object.keys(responseData.stores || {}).filter(city => {
        const cityStores = responseData.stores?.[city];
        return cityStores && cityStores.length > 0;
      });

      if (responseData.stores) {
        const allStoresInOrder: Array<{ store: CandidateStore; city: string }> = [];
        for (const [city, cityStores] of Object.entries(responseData.stores)) {
          if (cityStores && cityStores.length > 0) {
            for (const store of cityStores) {
              allStoresInOrder.push({ store, city: city });
            }
          }
        }

        if (allStoresInOrder.length > 0) {
          const validStores = allStoresInOrder.map(
            ({ store, city }) => candidateStoreToFormattedStore(store, city)
          );

          // Filtrar centros de distribución y bodegas
          physicalStores = validStores.filter((store) => {
            const descripcion = normalizeText(store.descripcion);
            const codigo = store.codigo?.toString().trim() || "";
            const isValid = !descripcion.includes("centro de distribucion") &&
              !descripcion.includes("centro distribucion") &&
              !descripcion.includes("bodega") &&
              codigo !== "001";
            return isValid;
          });
        }
      }

      // Establecer estados inmediatamente desde caché (sin skeleton)
      // Solo actualizar si es la última petición
      if (thisRequestId === lastFetchRequestIdRef.current) {
        setCanPickUp(globalCanPickUp);
        setAvailableCities(cities);

        if (globalCanPickUp) {
          const firstCity = cities.length > 0 ? cities[0] : null;
          const storesToShow = firstCity
            ? physicalStores.filter(store => store.ciudad === firstCity)
            : physicalStores;
          
          setStores(storesToShow);
          setFilteredStores([...storesToShow]);
          setAvailableStoresWhenCanPickUpFalse(storesToShow);
        } else {
          setAvailableStoresWhenCanPickUpFalse(physicalStores);
          setStores([]);
          setFilteredStores([]);
        }

        setStoresLoading(false);
        isFetchingRef.current = false;
        setLastResponse({ success: true, data: cachedResponse });

        // CRÍTICO: Liberar el lock global cuando leemos del caché
        if (typeof globalThis.window !== 'undefined') {
          (globalThis.window as unknown as { __imagiqIsFetching?: boolean }).__imagiqIsFetching = false;
        }

        // CRÍTICO: Disparar evento para que Step4OrderSummary se sincronice
        // Aunque leímos del caché (no escribimos), Step4OrderSummary necesita saber
        // que los datos están listos para actualizar su estado interno
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('canPickUpCache-updated', {
            detail: { key: cacheKey, value: globalCanPickUp, addressId: currentAddressId }
          }));
        }
      }
      return; // Salir sin hacer petición al endpoint
    }

    // ⚠️ CRÍTICO: Si onlyReadCache es true y NO hay caché, NO hacer la petición
    // EXCEPCIÓN: Si allowFetchOnAddressChangeRef es true (cambio de dirección), SÍ hacer petición
    // Esto es importante para Step3 que viene desde Step1 donde ya se calculó
    if (onlyReadCache && !allowFetchOnAddressChangeRef.current) {
      setStoresLoading(false);
      isFetchingRef.current = false;
      
      // CRÍTICO: Liberar el lock global
      if (typeof globalThis.window !== 'undefined') {
        (globalThis.window as unknown as { __imagiqIsFetching?: boolean }).__imagiqIsFetching = false;
      }
      
      return; // Salir SIN hacer petición cuando onlyReadCache=true
    }
    
    // Si NO hay datos en caché, entonces SÍ hacer la petición al endpoint
    // Ahora SÍ activar storesLoading porque vamos a hacer una petición real
    try {
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;
      setStoresLoading(true);

      // Crear hash único de la petición (productos + userId + dirección)
      const requestHash = JSON.stringify({
        products: productsToCheck,
        userId,
        addressId: currentAddressId,
      });

      // Si el hash es el mismo que la última petición exitosa, no hacer nada
      // PERO solo si la dirección no cambió recientemente
      if (lastSuccessfulHashRef.current === requestHash) {
        // Verificar si la dirección cambió desde la última petición exitosa
        const addressChanged = lastAddressIdRef.current !== lastAddressIdProcessedRef.current;
        if (!addressChanged) {
          setStoresLoading(false);
          isFetchingRef.current = false;
          return;
        }
        // Si la dirección cambió, limpiar el hash exitoso para forzar nueva petición
        lastSuccessfulHashRef.current = null;
      }

      // NO enviar cities desde frontend - el backend obtiene la ciudad automáticamente
      // desde la dirección predeterminada del usuario en getDefaultDirectionFromUser
      // parsed.ciudad contiene el CÓDIGO (ej: "0101800") no el NOMBRE (ej: "BOGOTÁ")

      // Llamar al endpoint con TODOS los productos agrupados




      const response = await productEndpoints.getCandidateStores({
        products: productsToCheck,
        user_id: userId,
        addressId: currentAddressId || undefined,
      });

      setLastResponse(response); // DEBUG: Guardar respuesta cruda



      // Log completo en formato legible


      if (response.success && response.data) {
        const responseData = response.data;

        // DEBUG SOLICITADO POR USUARIO: Ver respuesta exacta del endpoint
        /* console.log('🔥🔥🔥 [candidate-stores] RESPUESTA EXACTA DEL SERVIDOR:', {
          canPickUp: responseData.canPickUp,
          canPickUpType: typeof responseData.canPickUp,
          stores: responseData.stores,
          fullResponse: responseData
        }); */




        // Obtener canPickUp global de la respuesta
        // IMPORTANTE: Usar el valor exacto del endpoint sin conversiones
        const globalCanPickUp = responseData.canPickUp;



        // Procesar tiendas INMEDIATAMENTE (sin delays) - PRESERVAR ORDEN EXACTO DEL ENDPOINT
        let physicalStores: FormattedStore[] = [];
        const cities: string[] = Object.keys(responseData.stores || {}).filter(city => {
          const cityStores = responseData.stores?.[city];
          return cityStores && cityStores.length > 0;
        });



        if (responseData.stores) {
          // IMPORTANTE: Preservar el orden exacto de las tiendas como vienen del endpoint
          // Recorrer las ciudades en el orden que vienen del endpoint
          const allStoresInOrder: Array<{ store: CandidateStore; city: string }> = [];

          for (const [city, cityStores] of Object.entries(responseData.stores)) {
            if (cityStores && cityStores.length > 0) {

              // Agregar las tiendas en el orden exacto que vienen del endpoint
              for (const store of cityStores) {
                // IMPORTANTE: Usar la ciudad de la KEY del objeto, no store.ciudad
                // Porque store.ciudad puede tener formato diferente
                allStoresInOrder.push({ store, city: city });

              }
            }
          }



          if (allStoresInOrder.length > 0) {
            // Convertir CandidateStore a FormattedStore directamente (sin validar con otro endpoint)
            // PRESERVAR EL ORDEN EXACTO
            const validStores = allStoresInOrder.map(
              ({ store, city }) => candidateStoreToFormattedStore(store, city)
            );



            // Filtrar centros de distribución y bodegas (pero mantener el orden)
            physicalStores = validStores.filter((store) => {
              const descripcion = normalizeText(store.descripcion);
              const codigo = store.codigo?.toString().trim() || "";

              // Excluir centros de distribución, bodegas, y código "001"
              const isValid = !descripcion.includes("centro de distribucion") &&
                !descripcion.includes("centro distribucion") &&
                !descripcion.includes("bodega") &&
                codigo !== "001";



              return isValid;
            });


          } else {
            // IMPORTANTE: Si stores existe pero está vacío o no hay tiendas, physicalStores ya está como []

          }
        } else {
          // IMPORTANTE: Si responseData.stores no existe o es undefined, también procesar
          physicalStores = [];
        }

        // IMPORTANTE: Establecer canPickUp y tiendas AL MISMO TIEMPO (sin delays)
        // CRÍTICO: Solo actualizar si es la última petición (evita race conditions)
        if (thisRequestId !== lastFetchRequestIdRef.current) {
          return;
        }

        // Establecer canPickUp primero
        setCanPickUp(globalCanPickUp);
        setAvailableCities(cities);

        // IMPORTANTE: SIEMPRE guardar las tiendas, independientemente de canPickUp
        // Si canPickUp es true, mostrar tiendas normalmente
        if (globalCanPickUp) {
          // IMPORTANTE: Cuando canPickUp es true, solo mostrar tiendas de la PRIMERA ciudad
          // La primera ciudad es la ciudad del usuario (la más cercana)
          const firstCity = cities.length > 0 ? cities[0] : null;
          const storesToShow = firstCity
            ? physicalStores.filter(store => store.ciudad === firstCity)
            : physicalStores;

          // IMPORTANTE: Establecer stores y filteredStores al mismo tiempo
          setStores(storesToShow);
          // Asegurar que filteredStores se actualice inmediatamente
          setFilteredStores([...storesToShow]);
          // También guardar en availableStoresWhenCanPickUpFalse por si acaso
          setAvailableStoresWhenCanPickUpFalse(storesToShow);
        } else {
          // Si canPickUp global es false, guardar tiendas en availableStoresWhenCanPickUpFalse
          // IMPORTANTE: Estas son las tiendas que vienen de candidate-stores y se mostrarán en el mensaje
          setAvailableStoresWhenCanPickUpFalse(physicalStores);
          // Limpiar stores normales cuando canPickUp es false
          setStores([]);
          setFilteredStores([]);
        }

        // IMPORTANTE: Guardar respuesta completa en caché para evitar skeleton al cambiar a "tienda"
        setGlobalCanPickUpCache(cacheKey, globalCanPickUp, responseData, currentAddressId);

        // Si la petición fue exitosa, marcar el hash como exitoso DESPUÉS de procesar
        lastSuccessfulHashRef.current = requestHash;
        // Resetear contador de reintentos 429
        retry429CountRef.current = 0;
        // Limpiar el hash de fallo si existía
        if (failedRequestHashRef.current === requestHash) {
          failedRequestHashRef.current = null;
          retryCountRef.current.delete(requestHash);
        }

        // IMPORTANTE: NO agregar delays - React procesará los estados de inmediato
        // Las tiendas ya están establecidas en el estado arriba
      } else {
        // Si falla la petición, verificar si es 429 (Too Many Requests)
        const is429Error = response.message?.includes('429') || response.message?.includes('Too Many Requests') || response.message?.includes('ThrottleException');

        // Si es 429, reintentar después de 3 segundos (máximo 2 reintentos)
        if (is429Error && retry429CountRef.current < 2) {
          retry429CountRef.current += 1;
          setTimeout(() => {
            // Limpiar flags para permitir el reintento
            isFetchingRef.current = false;
            lastFetchTimeRef.current = 0;
            // Limpiar flag global para permitir reintento
            if (typeof globalThis.window !== 'undefined') {
              (globalThis.window as unknown as { __imagiqIsFetching?: boolean }).__imagiqIsFetching = false;
            }
            // Reintentar
            fetchCandidateStores();
          }, 3000);
          return; // No establecer estados aún
        } else if (is429Error) {
          retry429CountRef.current = 0; // Resetear contador
        }

        // Para otros errores, establecer estados vacíos
        // CRÍTICO: Solo actualizar si es la última petición
        if (thisRequestId === lastFetchRequestIdRef.current) {
          setCanPickUp(false);
          setStores([]);
          setFilteredStores([]);
          setAvailableStoresWhenCanPickUpFalse([]);

          // CRÍTICO: Escribir caché de error también en fallos no-429.
          // ApiClient nunca lanza (convierte 400/500/red en {success:false}), así que el
          // catch de abajo es inalcanzable y esta rama era la única sin escritura de caché:
          // el guard de step3 (checkCandidateStoresCache) no encontraba la clave y rebotaba
          // a step1 en bucle hasta que el usuario limpiaba localStorage. Con esta entrada
          // el guard pasa y el checkout continúa con canPickUp=false (solo domicilio).
          console.error(`[useDelivery] candidate-stores falló (${response.message || 'sin mensaje'}); cacheando canPickUp=false`);
          setGlobalCanPickUpCache(cacheKey, false, {
            canPickUp: false,
            stores: {},
            success: false,
            hasData: false,
            message: response.message || 'candidate-stores request failed',
            default_direction: null
          } as unknown as CandidateStoresResponse, currentAddressId);
        }
      }
    } // Cierra el bloque try
    catch (error) {
      // Si hay un error, no hay pickup disponible

      // Verificar si es error de red o 429
      const errorMessage = error instanceof Error ? error.message : String(error);
      const is429Error = errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('ThrottleException');

      if (is429Error && retry429CountRef.current < 2) {
        retry429CountRef.current += 1;
        setTimeout(() => {
          // Limpiar flags para permitir el reintento
          isFetchingRef.current = false;
          lastFetchTimeRef.current = 0;
          // Limpiar flag global para permitir reintento
          if (typeof globalThis.window !== 'undefined') {
            (globalThis.window as unknown as { __imagiqIsFetching?: boolean }).__imagiqIsFetching = false;
          }
          // Reintentar
          fetchCandidateStores();
        }, 3000);
        return; // No establecer estados aún
      } else if (is429Error) {
        retry429CountRef.current = 0; // Resetear contador
      }

      // CRÍTICO: Solo actualizar si es la última petición
      if (thisRequestId === lastFetchRequestIdRef.current) {
        setStores([]);
        setFilteredStores([]);
        setAvailableStoresWhenCanPickUpFalse([]);
        setCanPickUp(false);
      }

      // CRÍTICO: Escribir en caché incluso en error para desbloquear Step4OrderSummary
      // Si no escribimos en caché, Step4 se queda esperando indefinidamente
      const currentAddressId = explicitAddressId ||
        (typeof globalThis.window !== 'undefined'
          ? (JSON.parse(globalThis.window.localStorage.getItem("checkout-address") || "{}").id || null)
          : null);

      const errorCacheKey = buildGlobalCanPickUpKey({
        userId: userId!,
        products: products, // Usar products directamente ya que incluye quantity
        addressId: currentAddressId
      });



      setGlobalCanPickUpCache(errorCacheKey, false, {
        canPickUp: false,
        stores: {},
        success: false,
        hasData: false,
        message: errorMessage,
        default_direction: null
      } as unknown as CandidateStoresResponse, currentAddressId);
    } finally {
      // CRÍTICO: SIEMPRE desactivar loading en el finally block
      // La lógica anterior solo desactivaba si thisRequestId === lastFetchRequestIdRef.current
      // Esto causaba que el skeleton quedara pegado cuando se abandonaban peticiones
      //
      // Nueva lógica: Desactivar SIEMPRE si no hay otra petición en progreso
      // Si hay una petición más reciente, ella se encargará de setStoresLoading(false)
      // pero si la última petición terminó (aunque sea obsoleta), debemos asegurar que loading sea false
      const isLastRequest = thisRequestId === lastFetchRequestIdRef.current;
      const hasPendingRequest = isFetchingRef.current && !isLastRequest;

      if (isLastRequest) {
        setStoresLoading(false);
      } else if (!hasPendingRequest) {
        // Si no hay petición pendiente, forzar storesLoading = false para evitar skeleton pegado
        setStoresLoading(false);
      }
      isFetchingRef.current = false;

      // CRÍTICO: Resetear allowFetchOnAddressChangeRef después de cualquier fetch
      // Esto evita que quede en true indefinidamente después de un recálculo forzado
      setTimeout(() => {
        allowFetchOnAddressChangeRef.current = false;
      }, 1500);

      // CRÍTICO: Liberar el lock global INMEDIATAMENTE
      // El cooldown artificial de 200ms estaba bloqueando peticiones rápidas consecutivas
      if (typeof globalThis.window !== 'undefined') {
        const globalState = globalThis.window as unknown as { __imagiqIsFetching?: boolean };
        globalState.__imagiqIsFetching = false;
      }
    }

    // Limpiar timeout de seguridad si existía
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

  }, [products]);

  // Actualizar ref de fetchCandidateStores cuando cambia
  useEffect(() => {
    fetchCandidateStoresRef.current = fetchCandidateStores;
  }, [fetchCandidateStores]);

  // Ref para siempre tener la versión más reciente de products
  // Esto soluciona el problema donde handleAddressChange ve un array vacío
  const productsRef = useRef(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Cargar tiendas desde candidate-stores (solo donde se puede recoger el producto)
  // Si no hay pickup disponible, cargar TODAS las tiendas
  // PROTECCIÓN: Solo ejecutar una vez al montar o cuando cambian los productos significativamente
  const productsHashRef = useRef<string>('');
  // Debounce timer para cambios de productos (evita llamadas múltiples cuando se agregan varios productos rápido)
  const productsChangeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Si no hay productos, no hacer nada
    if (products.length === 0) {
      return;
    }

    // IMPORTANTE: Candidate stores solo necesita userId + productos
    // Ya NO verificamos dirección aquí porque no es necesaria para calcular candidate stores

    // Crear un hash de los productos para detectar cambios reales
    // IMPORTANTE: Incluir skuPostback en el hash Y ordenar para consistencia
    const productsHash = JSON.stringify(products.map(p => ({
      sku: (p.skuPostback || p.sku).trim(), // Trim para evitar diferencias por espacios
      quantity: p.quantity
    })).sort((a, b) => a.sku.localeCompare(b.sku))); // Ordenar para consistencia

    // Solo ejecutar si realmente cambiaron los productos O es la primera vez
    if (productsHashRef.current === '' || productsHashRef.current !== productsHash) {
      // OPTIMIZACIÓN CRÍTICA: Si es la primera vez Y ya teníamos datos del caché,
      // NO llamar a fetchCandidateStores porque ya inicializamos los estados con esos datos.
      // Esto evita el "flash" donde los estados se resetean y después se vuelven a llenar.
      const isFirstTime = productsHashRef.current === '';
      if (isFirstTime && hadInitialCacheDataRef.current) {
        productsHashRef.current = productsHash;
        // Marcar que ya procesamos el primer render
        hadInitialCacheDataRef.current = false;
        return;
      }

      // IMPORTANTE: NO limpiar el caché aquí porque causa race conditions
      // cuando se cambian múltiples cantidades rápidamente.
      // fetchCandidateStores sobrescribirá el caché con el nuevo valor automáticamente.

      productsHashRef.current = productsHash;

      // Verificar que NO estemos eliminando trade-in
      if (!isRemovingTradeInRef.current) {
        // CAMBIO CRÍTICO: Ejecutar inmediatamente en lugar de debounce
        // El debounce de 400ms causaba problemas con React StrictMode porque:
        // 1. StrictMode desmonta y remonta componentes
        // 2. El cleanup cancela el timeout antes de que se ejecute
        // 3. El segundo montaje tiene el hash ya guardado, así que salta el fetch
        //
        // La protección contra llamadas múltiples ya está en fetchCandidateStores:
        // - isFetchingRef (lock local)
        // - __imagiqIsFetching (lock global)
        // - debounce global de 300ms
        fetchCandidateStoresRef.current?.();
      }
    }
    // No necesitamos cleanup porque ya no usamos debounce aquí
    // La protección está en fetchCandidateStores
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]); // IMPORTANTE: Solo depender de products - canFetchFromEndpoint y onlyReadCache son config, no cambian

  // NUEVO: Escuchar cuando imagiq_user se establece en localStorage
  // Esto soluciona el race condition donde products se cargan antes que la autenticación
  useEffect(() => {
    if (globalThis.window === undefined) return;
    if (!canFetchFromEndpoint || onlyReadCache) return;

    const handleUserChange = (e: StorageEvent) => {
      if (e.key === 'imagiq_user' && e.newValue) {
        // Verificar si hay productos pero aún no se ha hecho el fetch
        if (products.length > 0 && stores.length === 0 && !isFetchingRef.current) {
          // Reset the products hash to force a new fetch
          productsHashRef.current = '';
          setTimeout(() => {
            fetchCandidateStoresRef.current?.();
          }, 200);
        }
      }
    };

    const handleLocalStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string }>;
      if (customEvent.detail?.key === 'imagiq_user') {

        if (products.length > 0 && stores.length === 0 && !isFetchingRef.current) {
          productsHashRef.current = '';
          setTimeout(() => {
            fetchCandidateStoresRef.current?.();
          }, 200);
        }
      }
    };

    globalThis.window.addEventListener('storage', handleUserChange);
    globalThis.window.addEventListener('localStorageChange', handleLocalStorageChange);

    return () => {
      globalThis.window?.removeEventListener('storage', handleUserChange);
      globalThis.window?.removeEventListener('localStorageChange', handleLocalStorageChange);
    };
  }, [products, stores.length, canFetchFromEndpoint, onlyReadCache, fetchCandidateStores]);

  // SAFETY TIMEOUT: Si storesLoading se queda en true por más de 20 segundos, forzar reset
  // IMPORTANTE: 20 segundos > 15 segundos de Step1 para no interferir con el safety timeout del checkout
  useEffect(() => {
    let safetyTimeout: NodeJS.Timeout | null = null;

    if (storesLoading) {
      safetyTimeout = setTimeout(() => {
        console.warn("🚨 [useDelivery] Safety timeout reached (20s). Forcing storesLoading=false");
        setStoresLoading(false);
        // También limpiar flags internos por si acaso
        if (isFetchingRef.current) {
          isFetchingRef.current = false;
        }
        if (globalThis.window) {
          const globalState = globalThis.window as unknown as { __imagiqIsFetching?: boolean };
          if (globalState.__imagiqIsFetching) {
            globalState.__imagiqIsFetching = false;
          }
        }
      }, 20000); // 20 segundos > 15 segundos de Step1
    }

    return () => {
      if (safetyTimeout) clearTimeout(safetyTimeout);
    };
  }, [storesLoading]);

  // Escuchar cambios de dirección (desde header O desde checkout)
  // Escuchar cambios de dirección (desde header O desde checkout)
  // NUEVO: Timer de debounce para prevenir múltiples llamadas cuando llegan eventos en ráfaga
  const addressChangeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Escuchar cambios de dirección (desde header O desde checkout)
  useEffect(() => {
    const handleAddressChange = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const isFromHeader = customEvent.detail?.fromHeader === true;
      
      // PROTECCIÓN CRÍTICA: Solo procesar eventos de dirección en la instancia PRIMARIA del hook
      // PERO: SIEMPRE procesar si viene fromHeader (cambio explícito del usuario en el header)
      if (!canFetchFromEndpoint && !isFromHeader) {
        console.warn('⚠️ [handleAddressChange] Bloqueado - canFetchFromEndpoint=false y NO viene fromHeader');
        return;
      }

      // SEMÁFORO GLOBAL DE HIERRO:
      // Usar una propiedad global en window para bloquear ABSOLUTAMENTE cualquier concurrencia
      // Si ya hay un procesamiento en curso (incluyendo el debounce), RECHAZAR inmediatamente
      // EXCEPCIÓN: Si viene fromHeader, FORZAR procesamiento (tiene prioridad absoluta)
      const globalState = globalThis.window as unknown as { __imagiqProcessingAddressChange?: boolean };

      if (globalState.__imagiqProcessingAddressChange && !isFromHeader) {
        console.warn('⚠️ [handleAddressChange] Bloqueado por semáforo - pero NO es fromHeader');
        return;
      }

      // Tomar el semáforo inmediatamente
      globalState.__imagiqProcessingAddressChange = true;

      // Ejecutar con debounce, pero manteniendo el semáforo tomado
      if (addressChangeDebounceTimerRef.current) {
        clearTimeout(addressChangeDebounceTimerRef.current);
      }

      addressChangeDebounceTimerRef.current = setTimeout(async () => {
        try {
          await handleAddressChangeInternal(event);
        } finally {
          // Liberar semáforo SOLO cuando termine todo el proceso
          // Cooldown reducido de 2s a 500ms para mejor respuesta
          setTimeout(() => {
            globalState.__imagiqProcessingAddressChange = false;
          }, 200); // Reducido de 500ms a 200ms para máxima fluidez

          addressChangeDebounceTimerRef.current = null;
        }
      }, 100); // Reducido de 500ms a 100ms para respuesta inmediata
    };

    const handleAddressChangeInternal = async (event: Event) => {
      // Prevenir llamadas durante eliminación de trade-in
      if (isRemovingTradeInRef.current) {
        console.warn('⚠️ [handleAddressChangeInternal] Bloqueado - isRemovingTradeIn');
        return;
      }

      // Verificar si el evento es realmente de cambio de dirección
      const customEvent = event as CustomEvent;
      const eventType = event.type;
      // Nota: La validación de eventos de storage se hace ahora en handleAddressChange (antes del debounce)
      // para evitar operaciones innecesarias de timer para eventos inválidos


      // Ignorar eventos que no son de dirección
      if (eventType === 'delivery-method-changed') {
        return;
      }

      let explicitAddressId: string | undefined = undefined;
      // Intentar extraer el ID de la dirección del evento
      if (customEvent.detail) {
        if (customEvent.detail.id && typeof customEvent.detail.id === 'string') {
          explicitAddressId = customEvent.detail.id;
        } else if (customEvent.detail.address && customEvent.detail.address.id) {
          explicitAddressId = customEvent.detail.address.id;
        }
      }

      // Verificar si realmente cambió la dirección
      const currentAddress = localStorage.getItem('checkout-address');
      let addressChanged = false;
      let newAddressId: string | null = null;

      if (currentAddress) {
        try {
          const parsed = JSON.parse(currentAddress) as Address;
          newAddressId = parsed.id || null;
          
          // Si la dirección no cambió realmente, no hacer nada
          if (newAddressId === lastAddressIdRef.current) {
            console.warn('⚠️ [handleAddressChange] Dirección NO cambió - RETORNANDO');
            return;
          }
          addressChanged = true;
        } catch {
          // Si no se puede parsear, no hacer nada
          return;
        }
      } else {
        // Si no hay dirección, no hacer nada
        return;
      }

      // PROTECCIÓN CRÍTICA: Evitar procesar el mismo cambio múltiples veces
      // Cuando se disparan múltiples eventos (address-changed, checkout-address-changed, storage)
      // para el mismo cambio de dirección, solo procesar una vez
      const now = Date.now();
      const isProcessingSameAddress = processingAddressChangeRef.current === newAddressId;
      const recentlyProcessed = now - lastAddressChangeProcessedTimeRef.current < 3000; // 3 segundos

      // Verificar flag global compartido
      const globalProcessing = typeof globalThis.window !== 'undefined'
        ? (globalThis.window as unknown as { __imagiqAddressProcessing?: string }).__imagiqAddressProcessing
        : null;
      const isGloballyProcessing = globalProcessing === newAddressId;

      // Si viene del header, forzar procesamiento (ignorar checks de concurrencia)
      // Esto asegura que los cambios explícitos del usuario siempre se procesen
      const isFromHeader = customEvent.detail?.fromHeader === true;

      // Solo bloquear si NO viene del header
      if (!isFromHeader && (isProcessingSameAddress || isGloballyProcessing || (recentlyProcessed && lastAddressIdProcessedRef.current === newAddressId))) {
        // Ya se está procesando este cambio o se procesó recientemente, ignorar
        return;
      }

      // Marcar que estamos procesando este cambio (local y global)
      processingAddressChangeRef.current = newAddressId;
      lastAddressChangeProcessedTimeRef.current = now;
      if (typeof globalThis.window !== 'undefined' && newAddressId !== null) {
        (globalThis.window as unknown as { __imagiqAddressProcessing?: string }).__imagiqAddressProcessing = newAddressId;
      }

      // Verificar si el cambio viene del header
      const fromHeader = customEvent.detail?.fromHeader;

      if (fromHeader) {
        // Mostrar skeleton
        setAddressLoading(true);

        // REMOVED: Esperar un momento para mostrar el skeleton
        // Eliminado para máxima fluidez - que el usuario vea los datos INMEDIATAMENTE
        // await new Promise(resolve => setTimeout(resolve, 300));

        // Leer la nueva dirección de localStorage
        try {
          const saved = JSON.parse(
            globalThis.window.localStorage.getItem("checkout-address") || "{}"
          ) as Address;

          if (saved?.id) {
            setAddress(saved);
            lastAddressIdRef.current = saved.id;
            newAddressId = saved.id;
          }
        } catch (error) {
          // Error silenciosamente
        } finally {
          // Ocultar skeleton
          setAddressLoading(false);
        }
      }

      // PROTECCIÓN CRÍTICA: Verificar que NO estemos eliminando trade-in antes de llamar
      if (isRemovingTradeInRef.current) {
        processingAddressChangeRef.current = null;
        return;
      }

      // IMPORTANTE: Solo actualizar lastAddressIdRef si realmente cambió
      if (addressChanged && newAddressId !== null) {
        // PROTECCIÓN CRÍTICA: Solo hacer petición si:
        // 1. Es una dirección diferente a la última procesada
        // 2. O si pasaron más de 2 segundos desde la última petición para esta dirección
        const isDifferentAddress = lastAddressIdProcessedRef.current !== newAddressId;
        const enoughTimePassed = now - lastAddressFetchTimeRef.current > 2000;

        // ACTUALIZAR INMEDIATAMENTE para evitar que otros eventos procesen la misma dirección
        if (isDifferentAddress) {
          lastAddressIdRef.current = newAddressId;
          lastAddressIdProcessedRef.current = newAddressId;
          lastAddressFetchTimeRef.current = now;

          // IMPORTANTE: Limpiar el hash de la última petición exitosa para forzar nueva petición
          // cuando cambia la dirección
          lastSuccessfulHashRef.current = null;

          // IMPORTANTE: Limpiar la tienda seleccionada cuando cambia la dirección
          // porque las tiendas disponibles pueden cambiar
          setSelectedStore(null);
          // También limpiar del localStorage
          if (globalThis.window) {
            globalThis.window.localStorage.removeItem("checkout-store");
            globalThis.window.localStorage.removeItem("checkout-store-address-id");
          }
          // Actualizar el ref para indicar que la dirección cambió
          lastAddressForStoreSelectionRef.current = null;

          // CRÍTICO: Verificar caché ANTES de limpiarlo para obtener datos instantáneos
          const user = safeGetLocalStorage<{ id?: string; user_id?: string }>("imagiq_user", {});
          const userId = user?.id || user?.user_id;

          // IMPORTANTE: Usar productsRef.current para obtener la lista más reciente
          const currentProducts = productsRef.current || [];

          if (userId && currentProducts.length > 0) {
            const productsToCheck = currentProducts.map((p) => ({
              sku: p.sku,
              quantity: p.quantity,
            }));

            // Construir clave de caché con la NUEVA dirección
            const cacheKey = buildGlobalCanPickUpKey({
              userId,
              products: productsToCheck,
              addressId: newAddressId,
            });

            // IMPORTANTE: Verificar caché ANTES de limpiarlo
            const cachedResponse = getFullCandidateStoresResponseFromCache(cacheKey);

            if (cachedResponse) {
              // ✅ HAY DATOS EN CACHÉ - Usarlos directamente sin llamar al endpoint

              // Procesar respuesta cacheada directamente
              const responseData = cachedResponse;
              const globalCanPickUp = responseData.canPickUp;

              // Procesar tiendas desde la respuesta cacheada
              let physicalStores: FormattedStore[] = [];
              const cities: string[] = Object.keys(responseData.stores || {}).filter(city => {
                const cityStores = responseData.stores?.[city];
                return cityStores && cityStores.length > 0;
              });

              if (responseData.stores) {
                const allStoresInOrder: Array<{ store: CandidateStore; city: string }> = [];
                for (const [city, cityStores] of Object.entries(responseData.stores)) {
                  if (cityStores && cityStores.length > 0) {
                    for (const store of cityStores) {
                      allStoresInOrder.push({ store, city: city });
                    }
                  }
                }

                if (allStoresInOrder.length > 0) {
                  const validStores = allStoresInOrder.map(
                    ({ store, city }) => candidateStoreToFormattedStore(store, city)
                  );

                  // Filtrar centros de distribución y bodegas
                  physicalStores = validStores.filter((store) => {
                    const descripcion = normalizeText(store.descripcion);
                    const codigo = store.codigo?.toString().trim() || "";
                    const isValid = !descripcion.includes("centro de distribucion") &&
                      !descripcion.includes("centro distribucion") &&
                      !descripcion.includes("bodega") &&
                      codigo !== "001";
                    return isValid;
                  });
                }
              }

              // Establecer estados inmediatamente desde caché
              setCanPickUp(globalCanPickUp);
              setAvailableCities(cities);

              if (globalCanPickUp) {
                const firstCity = cities.length > 0 ? cities[0] : null;
                const storesToShow = firstCity
                  ? physicalStores.filter(store => store.ciudad === firstCity)
                  : physicalStores;
                setStores(storesToShow);
                setFilteredStores([...storesToShow]);
                setAvailableStoresWhenCanPickUpFalse(storesToShow);
              } else {
                setAvailableStoresWhenCanPickUpFalse(physicalStores);
                setStores([]);
                setFilteredStores([]);
              }

              setStoresLoading(false);
              // NO limpiar caché ni llamar al endpoint
              return; // Salir aquí - datos ya aplicados desde caché
            } else {
              // ❌ NO hay datos en caché - Limpiar caché viejo y llamar al endpoint
              clearGlobalCanPickUpCache();
              invalidateCacheOnAddressChange(newAddressId);
            }


            // IMPORTANTE: Permitir petición aunque onlyReadCache=true cuando cambia la dirección
            allowFetchOnAddressChangeRef.current = true;

            // Extraer ID explícito del evento nuevamente si es necesario, o usar newAddressId
            const explicitId = newAddressId;

            // Recalcular canPickUp global y tiendas cuando cambia la dirección
            // IMPORTANTE: Usar fetchCandidateStoresRef.current para siempre llamar a la versión más reciente
            fetchCandidateStoresRef.current?.(explicitId)?.finally(() => {
              setTimeout(() => {
                allowFetchOnAddressChangeRef.current = false;
              }, 1500);
            });
          } else {
            console.warn('⚠️ [handleAddressChange] NO se cumplen condiciones:', {
              hasUserId: !!userId,
              productsCount: currentProducts.length
            });
          }
        } else if (enoughTimePassed) {
          // Si es la misma dirección pero pasó suficiente tiempo, actualizar tiempo pero no hacer petición
          // (ya se hizo una petición recientemente para esta dirección)
          lastAddressFetchTimeRef.current = now;
        }
      }

      // Limpiar el flag de procesamiento después de un delay para permitir que otros cambios se procesen
      setTimeout(() => {
        if (processingAddressChangeRef.current === newAddressId) {
          processingAddressChangeRef.current = null;
        }
        if (typeof globalThis.window !== 'undefined' &&
          (globalThis.window as unknown as { __imagiqAddressProcessing?: string }).__imagiqAddressProcessing === newAddressId) {
          (globalThis.window as unknown as { __imagiqAddressProcessing?: string }).__imagiqAddressProcessing = undefined;
        }
      }, 5000);
    };

    const handleStorageChange = (e: StorageEvent) => {
      // IMPORTANTE: Solo procesar eventos storage REALES (entre tabs)
      // Los eventos storage disparados manualmente desde syncAddress NO tienen newValue/oldValue
      // y NO deben procesarse aquí porque ya se procesaron con los eventos personalizados
      if (e.key === 'checkout-address' || e.key === 'imagiq_default_address') {
        // Solo procesar si es un evento storage REAL (tiene newValue y oldValue)
        // Los eventos storage disparados manualmente no tienen estas propiedades
        if (e.newValue !== undefined && e.oldValue !== undefined) {
          handleAddressChange(e);
        }
      }
    };

    // Escuchar evento de eliminación de trade-in
    const handleRemovingTradeIn = (event: Event) => {
      const customEvent = event as CustomEvent;
      isRemovingTradeInRef.current = customEvent.detail?.removing || false;
    };
    globalThis.window.addEventListener('removing-trade-in', handleRemovingTradeIn as EventListener);

    // DESHABILITAR event listeners redundantes que causan peticiones múltiples
    // Solo mantener 'address-changed' desde el header
    // Los eventos 'checkout-address-changed' y 'storage' están causando duplicados

    // Escuchar evento storage (para cambios entre tabs) - DESHABILITADO
    // globalThis.window.addEventListener('storage', handleStorageChange);

    // Escuchar eventos personalizados desde header - ÚNICO LISTENER ACTIVO
    globalThis.window.addEventListener('address-changed', handleAddressChange as EventListener);

    // Escuchar eventos personalizados desde checkout - DESHABILITADO
    // globalThis.window.addEventListener('checkout-address-changed', handleAddressChange as EventListener);

    // Escuchar delivery-method-changed pero solo si NO viene con skipFetch
    const handleDeliveryMethodChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      // Si viene con skipFetch, no hacer nada (viene de eliminación de trade-in)
      if (customEvent.detail?.skipFetch) {
        return;
      }
      // Si no viene skipFetch, puede ser un cambio legítimo, pero no llamar fetchCandidateStores
      // porque no es un cambio de dirección
    };
    globalThis.window.addEventListener('delivery-method-changed', handleDeliveryMethodChanged as EventListener);

    // DESHABILITAR POLLING - Los event listeners son suficientes para detectar cambios
    // El polling causaba storm de peticiones porque verificaba cambios cada 5s
    // Los eventos 'address-changed', 'checkout-address-changed', y 'storage' manejan todos los casos

    // Mantener la variable para compatibilidad con cleanup
    const intervalId: NodeJS.Timeout | null = null;

    return () => {
      globalThis.window?.removeEventListener('removing-trade-in', handleRemovingTradeIn as EventListener);
      globalThis.window?.removeEventListener('storage', handleStorageChange);
      globalThis.window?.removeEventListener('address-changed', handleAddressChange as EventListener);
      globalThis.window?.removeEventListener('checkout-address-changed', handleAddressChange as EventListener);
      globalThis.window?.removeEventListener('delivery-method-changed', handleDeliveryMethodChanged as EventListener);
      if (intervalId) clearInterval(intervalId);
    };
  }, []); // IMPORTANTE: Array vacío - solo ejecutar al montar. fetchCandidateStores es estable via useCallback

  // Cargar direcciones del usuario usando AddressesService.
  // Un invitado (rol 3) NO debe ver las direcciones guardadas de la cuenta (con
  // solo el email se accedería a datos de un tercero). Solo usuarios rol 2.
  useEffect(() => {
    const userInfo = safeGetLocalStorage<{
      id?: string;
      email?: string;
      rol?: number;
      role?: number;
    }>("imagiq_user", {});
    const rol =
      typeof userInfo?.rol === "number"
        ? userInfo.rol
        : typeof userInfo?.role === "number"
          ? userInfo.role
          : null;
    if (rol === 2 && userInfo && (userInfo.id || userInfo.email)) {
      addressesService
        .getUserAddresses()
        .then((addresses: Address[]) => {
          setAddresses(addresses);
        })
        .catch((error) => {
          console.error("Error loading addresses:", error);
          setAddresses([]);
        });
    } else {
      setAddresses([]);
    }
  }, []);

  // Filtrar tiendas según búsqueda (con normalización de acentos)
  useEffect(() => {
    if (storeQuery.trim() === "") {
      setFilteredStores(stores);
    } else {
      const normalizedQuery = normalizeText(storeQuery);
      setFilteredStores(
        stores.filter(
          (s) =>
            normalizeText(s.descripcion).includes(normalizedQuery) ||
            normalizeText(s.direccion).includes(normalizedQuery) ||
            normalizeText(s.ciudad).includes(normalizedQuery) ||
            normalizeText(s.departamento).includes(normalizedQuery) ||
            (s.ubicacion_cc &&
              normalizeText(s.ubicacion_cc).includes(normalizedQuery))
        )
      );
    }
  }, [storeQuery, stores]);

  // Autocompletar dirección si está guardada
  useEffect(() => {
    if (deliveryMethod === "domicilio" && globalThis.window !== undefined) {
      const savedAddress = globalThis.window.localStorage.getItem("checkout-address");
      if (savedAddress && savedAddress !== "undefined") {
        try {
          const saved = JSON.parse(savedAddress) as Address;
          if (saved.id) {
            // Verificar si la dirección tiene campos completos
            // Si no tiene localidad/barrio/complemento, buscar en addresses la versión completa
            const needsEnrichment = !saved.localidad && !saved.barrio && !saved.complemento;

            if (needsEnrichment && addresses.length > 0) {
              // Buscar la dirección completa en la lista de direcciones
              const completeAddress = addresses.find(a => a.id === saved.id);
              if (completeAddress) {
                // Usar la dirección completa del backend
                setAddress(completeAddress);
                lastAddressIdRef.current = completeAddress.id;

                // Actualizar localStorage con la versión completa
                const enrichedAddress = {
                  ...saved,
                  localidad: completeAddress.localidad || '',
                  barrio: completeAddress.barrio || '',
                  complemento: completeAddress.complemento || '',
                  instruccionesEntrega: completeAddress.instruccionesEntrega || '',
                  direccionFormateada: completeAddress.direccionFormateada || saved.lineaUno || '',
                  tipoDireccion: completeAddress.tipoDireccion || '',
                  nombreDireccion: completeAddress.nombreDireccion || '',
                  // Coordenadas y Google URL
                  latitud: completeAddress.latitud || 0,
                  longitud: completeAddress.longitud || 0,
                  googleUrl: completeAddress.googleUrl || '',
                  googlePlaceId: completeAddress.googlePlaceId || '',
                };
                globalThis.window.localStorage.setItem('checkout-address', JSON.stringify(enrichedAddress));
                globalThis.window.localStorage.setItem('imagiq_default_address', JSON.stringify(enrichedAddress));
              } else {
                setAddress(saved);
                lastAddressIdRef.current = saved.id;
              }
            } else {
              setAddress(saved);
              lastAddressIdRef.current = saved.id;
            }

            // Disparar recarga para asegurar que se use la dirección cargada
            setTimeout(() => {
              // Forzar recarga limpiando flags de fetch en curso
              isFetchingRef.current = false;
              lastFetchTimeRef.current = 0;
              fetchCandidateStoresRef.current?.();
            }, 50);
          }
        } catch (error) {
          console.error("Error parsing saved address:", error);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryMethod, addresses]);

  // Cargar tienda seleccionada desde localStorage o seleccionar la primera por defecto
  // IMPORTANTE: Solo restaurar si la dirección no cambió desde que se guardó
  useEffect(() => {
    if (globalThis.window !== undefined && stores.length > 0) {
      const savedStore = globalThis.window.localStorage.getItem("checkout-store");
      const savedAddressId = globalThis.window.localStorage.getItem("checkout-store-address-id");
      const currentAddressId = lastAddressIdRef.current;

      let restored = false;

      // Solo restaurar la tienda si la dirección no cambió desde que se guardó
      if (savedStore && savedAddressId === currentAddressId && currentAddressId !== null) {
        try {
          const parsed = JSON.parse(savedStore) as FormattedStore;
          // Verificar que la tienda guardada existe en la lista actual
          const foundStore = stores.find((s) => s.codigo === parsed.codigo);

          if (foundStore) {
            // Solo actualizar si es diferente para evitar loops infinitos
            // Comparar por código es seguro
            if (selectedStore?.codigo !== foundStore.codigo) {
              setSelectedStore(foundStore);
            }
            lastAddressForStoreSelectionRef.current = currentAddressId;
            restored = true;
          }
        } catch (error) {
          console.error("Error parsing saved store:", error);
        }
      }

      // Si la dirección cambió, limpiar datos viejos
      if (!restored && savedAddressId !== currentAddressId && currentAddressId !== null) {
        if (globalThis.window) {
          globalThis.window.localStorage.removeItem("checkout-store");
          globalThis.window.localStorage.removeItem("checkout-store-address-id");
        }
      }

      // AUTO-SELECCIÓN: Si el método es tienda y no tenemos una tienda válida seleccionada,
      // seleccionar la primera automáticamente.
      if (deliveryMethod === 'tienda') {
        // Verificar si la tienda seleccionada actual es válida (existe en la lista)
        const isCurrentStoreValid = selectedStore && stores.some(s => s.codigo === selectedStore.codigo);

        if (!restored && !isCurrentStoreValid) {
          const firstStore = stores[0];
          setSelectedStore(firstStore);

          // Guardar en localStorage para persistencia
          if (globalThis.window) {
            globalThis.window.localStorage.setItem("checkout-store", JSON.stringify(firstStore));
            if (currentAddressId) {
              globalThis.window.localStorage.setItem("checkout-store-address-id", currentAddressId);
            }
          }

          if (currentAddressId) {
            lastAddressForStoreSelectionRef.current = currentAddressId;
          }
        }
      }
    }
  }, [stores, selectedStore, deliveryMethod]);

  // Validar si se puede continuar
  const canContinue =
    (deliveryMethod === "domicilio" && address !== null) ||
    (deliveryMethod === "tienda" && selectedStore !== null);

  // Función para refrescar direcciones después de agregar una nueva
  const addAddress = async (newAddress?: Address): Promise<void> => {
    // Esta función refresca la lista de direcciones y opcionalmente
    // dispara la consulta de candidate stores si se proporciona la nueva dirección
    try {
      // Invitado (rol 3): NO traer las direcciones guardadas de la cuenta; solo la
      // dirección nueva que agregó en esta sesión. Solo rol 2 ve las guardadas.
      const userInfo = safeGetLocalStorage<{ rol?: number; role?: number }>(
        "imagiq_user",
        {}
      );
      const rol =
        typeof userInfo?.rol === "number"
          ? userInfo.rol
          : typeof userInfo?.role === "number"
            ? userInfo.role
            : null;
      let addresses: Address[] =
        rol === 2 ? await addressesService.getUserAddresses() : [];

      // FIX: Asegurar que la nueva dirección esté en la lista (manejar lag de replicación/DB)
      if (newAddress && newAddress.id) {
        const found = addresses.find(a => a.id === newAddress.id);
        if (!found) {
          // Agregar al principio ya que es la más reciente
          addresses = [newAddress, ...addresses];
        }

        // Visualmente asegurar consistencia de predeterminada
        if (newAddress.esPredeterminada) {
          addresses = addresses.map(a => ({
            ...a,
            esPredeterminada: a.id === newAddress.id
          }));
        }
      }

      setAddresses(addresses);

      // Si se proporcionó la nueva dirección, disparar consulta de candidate stores
      if (newAddress) {
        // Actualizar estado
        setAddress(newAddress);

        // IMPORTANTE: Disparar fetchCandidateStores para actualizar el caché
        // y que Step4OrderSummary se entere
        allowFetchOnAddressChangeRef.current = true;

        // Actualizar refs para forzar fetch
        if (newAddress.id) {
          lastAddressIdRef.current = newAddress.id;
          invalidateCacheOnAddressChange(newAddress.id);
        }

        // CRÍTICO: Pasar el addressId explícitamente para evitar race conditions
        // donde localStorage aún no se ha actualizado con la nueva dirección
        fetchCandidateStoresRef.current?.(newAddress.id);
      }
    } catch (error) {
      console.error("Error refreshing addresses:", error);
      // Fallback: si falla el fetch, al menos agregar la nueva dirección si existe
      if (newAddress) {
        setAddresses(prev => {
          // Verificar si ya existe para no duplicar
          if (prev.some(a => a.id === newAddress.id)) return prev;
          return [newAddress, ...prev];
        });
        setAddress(newAddress);
      } else {
        setAddresses([]);
      }
    }
  };

  // Función para forzar recarga de tiendas ignorando protecciones
  // Útil cuando canPickUp global es true pero las tiendas no se cargaron
  // IMPORTANTE: Aún respeta el debounce para evitar 429
  // CRÍTICO: Respeta onlyReadCache - si está en modo cache-only, NO hace peticiones al endpoint
  const forceRefreshStores = useCallback(() => {
    // CRÍTICO: Si estamos en modo onlyReadCache, NO permitir fetch al endpoint
    // Esto previene que Step3 haga peticiones cuando solo debe leer del caché
    if (onlyReadCache) {
      // Intentar leer del caché de nuevo sin hacer fetch
      fetchCandidateStores(); // Esto solo leerá del caché debido a onlyReadCache=true
      return;
    }

    // Verificar flag global para evitar forzar recarga si ya se está procesando un cambio
    const globalProcessing = typeof globalThis.window !== 'undefined'
      ? (globalThis.window as unknown as { __imagiqAddressProcessing?: string }).__imagiqAddressProcessing
      : null;

    // Si hay un cambio de dirección en proceso, NO forzar recarga (useDelivery ya lo está manejando)
    if (globalProcessing) {
      return;
    }

    // Verificar debounce de 2 segundos
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 2000) {
      return;
    }

    // IMPORTANTE: Permitir petición solo si canFetchFromEndpoint=true
    allowFetchOnAddressChangeRef.current = true;

    // Limpiar refs de protección para forzar la recarga
    lastSuccessfulHashRef.current = null;
    lastFetchTimeRef.current = 0;
    isFetchingRef.current = false;
    // Llamar a fetchCandidateStores
    fetchCandidateStores().finally(() => {
      // Resetear el flag después de la petición
      setTimeout(() => {
        allowFetchOnAddressChangeRef.current = false;
      }, 1500);
    });
  }, [fetchCandidateStores, onlyReadCache, canFetchFromEndpoint]);

  return {
    address,
    setAddress,
    addressEdit,
    setAddressEdit,
    storeEdit,
    setStoreEdit,
    storeQuery,
    setStoreQuery,
    filteredStores,
    selectedStore,
    setSelectedStore,
    addresses,
    setAddresses,
    addAddress,
    deliveryMethod,
    setDeliveryMethod,
    canContinue,
    storesLoading,
    canPickUp,
    stores,
    refreshStores: fetchCandidateStores,
    forceRefreshStores, // Nueva función para forzar recarga
    addressLoading, // Exportar estado de loading para mostrar skeleton
    availableCities,
    availableStoresWhenCanPickUpFalse, // Tiendas disponibles cuando canPickUp es false
    lastResponse, // Exportar respuesta cruda para debugging
  };
};
