"use client";
import { TradeInCompletedSummary } from "@/app/productos/dispositivos-moviles/detalles-producto/estreno-y-entrego";
import TradeInModal from "@/app/productos/dispositivos-moviles/detalles-producto/estreno-y-entrego/TradeInModal";
import { useCart, type CartProduct, type BundleInfo } from "@/hooks/useCart";
import { CouponRemovalWarningModal } from "./components/CouponRemovalWarningModal";
import { useAnalyticsWithUser } from "@/lib/analytics";
import { tradeInEndpoints } from "@/lib/api";
import { apiDelete, apiPost, apiPut } from "@/lib/api-client";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import Step4OrderSummary from "./components/Step4OrderSummary";
import ProductCard from "./ProductCard";
import Sugerencias from "./Sugerencias";
import {
  getTradeInValidationMessage,
  validateTradeInProducts,
} from "./utils/validateTradeIn";
import { safeGetLocalStorage } from "@/lib/localStorage";
import { CartBundleGroup } from "./components/CartBundleGroup";
import { useTradeInPrefetch } from "@/hooks/useTradeInPrefetch";
import { useDelivery } from "./hooks/useDelivery";
import { useTradeInVerification } from "@/hooks/useTradeInVerification";

/**
 * Paso 1 del carrito de compras
 * - Muestra productos guardados en localStorage
 * - Resumen de compra
 * - Código limpio, escalable y fiel al diseño Samsung
 */
/**
 * Paso 1 del carrito de compras
 * Recibe onContinue para avanzar al paso 2
 */
export default function Step1({
  onContinue,
}: {
  readonly onContinue: () => void;
}) {
  // IMPORTANTE: En Step1, useDelivery hace la llamada inicial a candidate-stores
  // Esto llena el caché para que los demás steps solo lean de él
  const { storesLoading } = useDelivery({
    canFetchFromEndpoint: true,  // Permitir llamadas en Step1
    onlyReadCache: false,         // NO solo lectura, debe hacer llamada inicial
  });

  const { trackBeginCheckout } = useAnalyticsWithUser();

  // Estado para evitar hydration mismatch (localStorage solo existe en cliente)
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Estado para Trade-In
  // Estado para Trade-In (Mapa de SKU -> Datos)
  const [tradeInData, setTradeInData] = useState<Record<string, {
    deviceName: string;
    value: number;
    completed: boolean;
    detalles?: unknown; // Detalles opcionales del Trade-In (se preservan en localStorage)
  }>>({});

  // Estado para controlar el modal de Trade-In
  const [isTradeInModalOpen, setIsTradeInModalOpen] = useState(false);

  // Estado para rastrear el SKU del producto para el cual se está completando el trade-in
  const [currentTradeInSku, setCurrentTradeInSku] = useState<string | null>(null);
  const [currentTradeInProductName, setCurrentTradeInProductName] = useState<string | null>(null);
  const [currentTradeInSkuPostback, setCurrentTradeInSkuPostback] = useState<string | null>(null);

  // Usar el hook centralizado useCart
  const {
    products: cartProducts,
    updateQuantity,
    removeProduct,
    addProduct,
    calculations,
    loadingShippingInfo,
    formatPrice,
    appliedCouponCode,
    appliedDiscount,
    removeCoupon,
    checkCouponInvalidation,
    // Métodos de Bundle
    updateBundleQuantity,
    removeBundleProduct,
  } = useCart();

  // Agrupar productos por bundle
  const { bundleGroups, nonBundleProducts } = useMemo(() => {
    const groups = new Map<string, { bundleInfo: BundleInfo; items: CartProduct[] }>();
    const standalone: CartProduct[] = [];

    for (const product of cartProducts) {
      if (product.bundleInfo) {
        const key = `${product.bundleInfo.codCampana}-${product.bundleInfo.productSku}`;
        if (!groups.has(key)) {
          groups.set(key, { bundleInfo: product.bundleInfo, items: [] });
        }
        groups.get(key)!.items.push(product);
      } else {
        standalone.push(product);
      }
    }

    return {
      bundleGroups: Array.from(groups.values()),
      nonBundleProducts: standalone,
    };
  }, [cartProducts]);

  // Estado para rastrear qué productos están cargando indRetoma
  const [loadingIndRetoma, setLoadingIndRetoma] = useState<Set<string>>(
    new Set()
  );

  // Estado para rastrear cambios de dirección
  const [lastAddressChange, setLastAddressChange] = useState<number>(0);

  // Escuchar cambios de dirección desde el header
  useEffect(() => {
    const handleAddressChange = () => {

      setLastAddressChange(Date.now());

      // Limpiar caches de verificación para forzar nueva verificación


      // Mostrar skeleton inmediatamente para todos los productos
      if (cartProducts.length > 0) {
        setLoadingIndRetoma(new Set(cartProducts.map(p => p.sku)));
      }
    };

    window.addEventListener('address-changed', handleAddressChange);
    return () => {
      window.removeEventListener('address-changed', handleAddressChange);
    };
  }, [cartProducts]);

  // ✅ Escuchar cuando se elimina un trade-in (cuando se elimina un producto)
  useEffect(() => {
    const handleTradeInRemoved = (event: CustomEvent<{ sku: string }>) => {
      const removedSku = event.detail.sku;


      // Actualizar el estado del trade-in eliminando el SKU
      setTradeInData(prev => {
        const newState = { ...prev };
        delete newState[removedSku];
        return newState;
      });
    };

    window.addEventListener('trade-in-removed', handleTradeInRemoved as EventListener);
    return () => {
      window.removeEventListener('trade-in-removed', handleTradeInRemoved as EventListener);
    };
  }, []);

  // 🚀 Prefetch automático de datos de Trade-In
  useTradeInPrefetch();

  // Función para cargar Trade-Ins desde localStorage
  const loadTradeInFromStorage = useCallback(() => {
    try {
      const storedTradeIn = localStorage.getItem("imagiq_trade_in");
      if (!storedTradeIn) {
        setTradeInData({});
        return;
      }

      const parsed = JSON.parse(storedTradeIn);

      // Verificar si es el formato nuevo (objeto de objetos) o antiguo
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Si tiene deviceName directamente, es el formato antiguo
        if ('deviceName' in parsed) {
          // Formato antiguo: convertir al nuevo formato cuando haya productos
          if (cartProducts.length > 0) {
            const newTradeInData: Record<string, typeof parsed> = {};

            // Buscar el primer producto o bundle
            for (const product of cartProducts) {
              if (product.bundleInfo?.productSku) {
                // Es un bundle, usar productSku
                newTradeInData[product.bundleInfo.productSku] = parsed;
                break;
              } else if (product.sku) {
                // Es un producto individual, usar sku
                newTradeInData[product.sku] = parsed;
                break;
              }
            }

            if (Object.keys(newTradeInData).length > 0) {
              // Guardar en el formato nuevo
              const tradeInString = JSON.stringify(newTradeInData);
              localStorage.setItem("imagiq_trade_in", tradeInString);
              setTradeInData(newTradeInData);

            }
          }
        } else {
          // Formato nuevo: cargar directamente
          setTradeInData(parsed);

        }
      }
    } catch (error) {
      console.error("❌ Error al cargar datos de Trade-In:", error);
      setTradeInData({});
    }
  }, [cartProducts]);

  // Cargar datos de Trade-In desde localStorage INMEDIATAMENTE al montar (sin esperar productos)
  // IMPORTANTE: Esto asegura que el Trade-In se cargue antes de cualquier validación
  useEffect(() => {
    // Cargar inmediatamente al montar, incluso si no hay productos aún
    try {
      const storedTradeIn = localStorage.getItem("imagiq_trade_in");
      if (storedTradeIn) {
        const parsed = JSON.parse(storedTradeIn);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (!('deviceName' in parsed)) {
            // Formato nuevo: cargar directamente
            setTradeInData(parsed);

          }
        }
      }
    } catch (error) {
      console.error("❌ Error al cargar Trade-In al montar:", error);
    }
  }, []); // Solo ejecutar una vez al montar

  // Sincronizar Trade-Ins con productos cuando estén disponibles
  useEffect(() => {
    if (cartProducts.length > 0) {
      // Cargar cuando hay productos disponibles para asegurar que se asocien correctamente
      loadTradeInFromStorage();
    }
  }, [cartProducts.length, loadTradeInFromStorage]); // Ejecutar cuando cambie el número de productos

  // Escuchar cambios en localStorage para sincronizar cuando se recarga la página
  useEffect(() => {
    const handleStorageChange = () => {
      // Recargar Trade-Ins cuando cambia localStorage (entre tabs o recargas)
      if (cartProducts.length > 0) {
        loadTradeInFromStorage();
      }
    };

    // Escuchar eventos de storage (entre tabs y recargas)
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("localStorageChange", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("localStorageChange", handleStorageChange);
    };
  }, [cartProducts.length, loadTradeInFromStorage]);

  // Sincronizar Trade-Ins con los productos del carrito cuando cambian
  // IMPORTANTE: Esto asegura que los Trade-Ins se mantengan cuando se recarga la página
  useEffect(() => {
    if (cartProducts.length === 0) {
      // Si no hay productos, no limpiar Trade-Ins automáticamente (pueden estar cargándose)
      return;
    }

    // Verificar que los Trade-Ins guardados correspondan a productos en el carrito
    const storedTradeIn = localStorage.getItem("imagiq_trade_in");
    if (!storedTradeIn) {
      // Si no hay Trade-In guardado, no hacer nada
      return;
    }

    try {
      const parsed = JSON.parse(storedTradeIn);

      // Solo validar si es formato nuevo (objeto de objetos)
      if (parsed && typeof parsed === 'object' && !('deviceName' in parsed) && !Array.isArray(parsed)) {
        const validTradeIns: Record<string, {
          deviceName: string;
          value: number;
          completed: boolean;
          detalles?: unknown;
        }> = {};
        const allSkus = new Set<string>();

        // Obtener todos los SKUs válidos (productos individuales y bundles)
        cartProducts.forEach(product => {
          if (product.bundleInfo?.productSku) {
            // Para bundles, usar productSku
            allSkus.add(product.bundleInfo.productSku);
          } else {
            // Para productos individuales, usar sku
            allSkus.add(product.sku);
          }
        });

        // Filtrar Trade-Ins que correspondan a productos en el carrito
        Object.entries(parsed).forEach(([sku, tradeInData]) => {
          if (allSkus.has(sku)) {
            // Validar que el tradeInData tenga la estructura correcta
            const tradeIn = tradeInData as {
              deviceName?: string;
              value?: number;
              completed?: boolean;
              detalles?: unknown;
            };

            if (tradeIn && typeof tradeIn === 'object' &&
              tradeIn.deviceName &&
              typeof tradeIn.value === 'number' &&
              typeof tradeIn.completed === 'boolean') {
              validTradeIns[sku] = {
                deviceName: tradeIn.deviceName,
                value: tradeIn.value,
                completed: tradeIn.completed,
                ...(tradeIn.detalles !== undefined && { detalles: tradeIn.detalles }),
              };
            }
          }
        });

        // Actualizar estado si hay cambios o si el estado está vacío pero hay Trade-Ins válidos
        const currentTradeInsString = JSON.stringify(tradeInData);
        const validTradeInsString = JSON.stringify(validTradeIns);

        if (currentTradeInsString !== validTradeInsString) {
          if (Object.keys(validTradeIns).length > 0) {
            setTradeInData(validTradeIns);
            // Guardar de nuevo para asegurar que esté sincronizado y persistente
            const tradeInString = JSON.stringify(validTradeIns);
            localStorage.setItem("imagiq_trade_in", tradeInString);

            // Verificar que se guardó correctamente
            const verifySave = localStorage.getItem("imagiq_trade_in");
            if (!verifySave || verifySave !== tradeInString) {
              console.error("❌ ERROR: Trade-In NO se guardó correctamente al sincronizar");
              // Reintentar
              localStorage.setItem("imagiq_trade_in", tradeInString);
            } else {

            }

            // Disparar eventos de storage
            try {
              globalThis.dispatchEvent(new CustomEvent("localStorageChange", {
                detail: { key: "imagiq_trade_in" },
              }));
              globalThis.dispatchEvent(new Event("storage"));
            } catch (eventError) {
              console.error("Error disparando eventos de storage:", eventError);
            }
          } else {
            // No hay Trade-Ins válidos, pero no los eliminamos automáticamente

          }
        }
      }
    } catch (error) {
      console.error("❌ Error al sincronizar Trade-Ins:", error);
    }
  }, [cartProducts, tradeInData]); // Ejecutar cuando cambian los productos

  // Abrir modal automáticamente si viene desde el botón "Entrego y Estreno"
  useEffect(() => {
    // Verificar el flag inmediatamente y también después de un delay
    const checkAndOpenModal = () => {
      const targetSku = localStorage.getItem("open_trade_in_modal_sku");
      if (targetSku && cartProducts.length > 0) {
        // Buscar producto individual o producto perteneciente a un bundle con ese productSku
        const targetProduct =
          cartProducts.find((p) => p.sku === targetSku) ||
          cartProducts.find((p) => p.bundleInfo?.productSku === targetSku);

        const bundleApplies =
          targetProduct?.bundleInfo?.productSku === targetSku &&
          targetProduct?.bundleInfo?.ind_entre_estre === 1;
        const productApplies =
          targetProduct?.bundleInfo === undefined &&
          targetProduct?.indRetoma === 1;

        // Verificar que el producto/bundle existe y aplica para Trade-In
        if (targetProduct && (bundleApplies || productApplies)) {
          // Limpiar el flag
          localStorage.removeItem("open_trade_in_modal_sku");
          // Guardar el SKU del producto o bundle para el cual se abre el modal
          setCurrentTradeInSku(targetSku);
          setCurrentTradeInProductName(targetProduct.name);
          setCurrentTradeInSkuPostback(targetProduct.skuPostback || null);
          // Abrir el modal para este producto específico
          setIsTradeInModalOpen(true);
          return true; // Indicar que se abrió
        } else {
          // Si no aplica o no existe, limpiar el flag de todas formas
          localStorage.removeItem("open_trade_in_modal_sku");
        }
      }
      return false;
    };

    // Intentar abrir inmediatamente si los productos ya están cargados
    if (cartProducts.length > 0) {
      const opened = checkAndOpenModal();
      // Si no se pudo abrir, intentar después de un delay
      if (!opened) {
        const timer = setTimeout(() => {
          checkAndOpenModal();
        }, 500);
        return () => clearTimeout(timer);
      }
    } else {
      // Si no hay productos aún, esperar a que se carguen
      const timer = setTimeout(() => {
        checkAndOpenModal();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [cartProducts]);

  // El canPickUp global se calcula en Step4OrderSummary con todos los productos del carrito

  // =========================================================================================
  // OPTIMIZACIÓN: NUEVA LÓGICA DE VERIFICACIÓN CENTRALIZADA CON CACHÉ (useTradeInVerification)
  // Reemplaza la lógica anterior lenta y secuencial
  // =========================================================================================

  const { loadingSkus: loadingIndRetomaHook, forceVerify } = useTradeInVerification({
    products: cartProducts
  });

  // Sincronizar el estado del hook con el estado local para loading
  useEffect(() => {
    if (loadingIndRetomaHook.size > 0 || cartProducts.length === 0) {
      // Si hay SKUs cargando o no hay productos, actualizar
      setLoadingIndRetoma(loadingIndRetomaHook);
    } else {
      // Si terminó de cargar, limpiar
      setLoadingIndRetoma(new Set());
    }
  }, [loadingIndRetomaHook, cartProducts.length]);

  // Escuchar cambios de dirección desde el header para re-verificar
  useEffect(() => {
    const handleAddressChange = () => {

      setLastAddressChange(Date.now());
      // Forzar verificación
      forceVerify();
    };

    window.addEventListener('address-changed', handleAddressChange);
    return () => {
      window.removeEventListener('address-changed', handleAddressChange);
    };
  }, [forceVerify]);

  // =========================================================================================
  // FIN LÓGICA DE VERIFICACIÓN CENTRALIZADA
  // =========================================================================================

  // Usar cálculos del hook centralizado
  const total = calculations.total;

  // Calcular ahorro total por descuentos de productos (para mostrar en sticky bar mobile)
  const productSavings = useMemo(() => {
    return cartProducts.reduce((acc, product) => {
      if (product.originalPrice && product.originalPrice > product.price) {
        const saving = (product.originalPrice - product.price) * product.quantity;
        return acc + saving;
      }
      return acc;
    }, 0);
  }, [cartProducts]);

  // Cambiar cantidad de producto usando el hook
  const handleQuantityChange = (idx: number, cantidad: number) => {
    const product = cartProducts[idx];
    if (product) {
      // Actualizar cantidad usando el hook
      // El canPickUp global se recalculará automáticamente en Step4OrderSummary
      updateQuantity(product.sku, cantidad);

      apiPut(`/api/cart/items/${product.sku}`, {
        quantity: cantidad,
      }).catch(err => {
        console.error('❌ Error actualizando cantidad en backend:', err);
        // Opcional: Revertir cantidad si falla
        // updateQuantity(product.sku, product.quantity); 
      });
    }
  };

  // Estado para el modal de advertencia de cupón
  const [couponWarning, setCouponWarning] = useState<{
    productIdx: number;
    productName: string;
  } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  /**
   * Checks if the coupon would still be valid with the remaining products.
   * Uses local identifiers if available, otherwise calls the backend.
   */
  const wouldRemovalInvalidateCoupon = useCallback(
    async (skuToRemove: string): Promise<boolean> => {
      if (!appliedCouponCode) return false;

      // Try local check first (fast path — works when backend returns identifiers)
      const localResult = checkCouponInvalidation(skuToRemove);
      if (localResult) return true;

      // If local check says "no invalidation", verify: do we actually have identifiers?
      // If requirements are empty, we need to ask the backend
      const storedReqs = localStorage.getItem("coupon-requirements");
      if (storedReqs) {
        try {
          const reqs = JSON.parse(storedReqs);
          if (reqs.eligibleIdentifiers?.length > 0 || reqs.requiredCompanionIdentifiers?.length > 0) {
            // We have real requirements and local check said OK
            return false;
          }
        } catch { /* fall through to backend */ }
      }

      // Fallback: call backend with the products that would remain
      const remainingProducts = cartProducts.filter(p => p.sku !== skuToRemove);
      if (remainingProducts.length === 0) return true; // No products left = coupon invalid

      try {
        const items = remainingProducts.map(p => ({
          sku: p.sku,
          skupostback: p.skuPostback || p.sku,
          id: p.id,
        }));
        await apiPost("/api/payments/validate-coupon", {
          couponCode: appliedCouponCode,
          items,
        });
        // Backend says OK — coupon would still be valid
        return false;
      } catch {
        // Backend rejected — coupon would be invalid without this product
        return true;
      }
    },
    [appliedCouponCode, checkCouponInvalidation, cartProducts]
  );

  // Eliminar producto usando el hook
  const handleRemove = async (idx: number) => {
    const product = cartProducts[idx];
    if (!product) return;

    // If there's an active coupon, check if removal would invalidate it
    if (appliedCouponCode) {
      setCheckingCoupon(true);
      try {
        const wouldInvalidate = await wouldRemovalInvalidateCoupon(product.sku);
        if (wouldInvalidate) {
          setCouponWarning({
            productIdx: idx,
            productName: product.name,
          });
          return;
        }
      } finally {
        setCheckingCoupon(false);
      }
    }

    // No coupon impact — proceed with removal
    const productId = product.sku;
    apiDelete(`/api/cart/items/${productId}`);
    setTimeout(() => {
      removeProduct(product.sku);
    }, 0);
  };

  const handleConfirmCouponRemoval = () => {
    if (!couponWarning) return;
    const product = cartProducts[couponWarning.productIdx];
    if (product) {
      apiDelete(`/api/cart/items/${product.sku}`);
      setTimeout(() => {
        removeProduct(product.sku);
        removeCoupon();
      }, 0);
    }
    setCouponWarning(null);
  };

  // ...existing code...

  // Estado para validación de Trade-In
  const [tradeInValidation, setTradeInValidation] = React.useState<{
    isValid: boolean;
    productsWithoutRetoma: typeof cartProducts;
    hasMultipleProducts: boolean;
    errorMessage?: string;
  }>({ isValid: true, productsWithoutRetoma: [], hasMultipleProducts: false });

  // Estado para mostrar skeleton del mensaje de error inicialmente
  const [showErrorSkeleton, setShowErrorSkeleton] = React.useState(false);

  // Validar Trade-In cuando cambian los productos o el trade-in
  React.useEffect(() => {
    const validation = validateTradeInProducts(cartProducts);
    setTradeInValidation(validation);

    // Si el producto ya no aplica (indRetoma === 0), quitar banner inmediatamente y mostrar notificación
    if (
      validation.isValid === false &&
      validation.errorMessage !== undefined &&
      validation.errorMessage.includes("Te removimos")
    ) {
      // Limpiar localStorage inmediatamente
      localStorage.removeItem("imagiq_trade_in");

      // Quitar el banner inmediatamente
      setTradeInData({});

      // Mostrar notificación toast
      toast.error("Cupón removido", {
        description:
          "El producto seleccionado ya no aplica para el beneficio Estreno y Entrego",
        duration: 5000,
      });
    } else {
      setShowErrorSkeleton(false);
    }
  }, [cartProducts, tradeInData]);

  // Estado para saber si canPickUp global está cargando y su valor
  const [isLoadingCanPickUpGlobal, setIsLoadingCanPickUpGlobal] =
    React.useState(false);
  const [canPickUpGlobalValue, setCanPickUpGlobalValue] = React.useState<boolean | null>(null);
  // Estado para rastrear si el usuario hizo clic mientras se calculaba
  const [userClickedWhileLoading, setUserClickedWhileLoading] = React.useState(false);

  // Callback para recibir el estado de canPickUp desde Step4OrderSummary
  // Guarda tanto el valor como el estado de loading
  const handleCanPickUpReady = React.useCallback(
    (isReady: boolean, isLoading: boolean) => {
      setIsLoadingCanPickUpGlobal(isLoading);
      setCanPickUpGlobalValue(isReady); // Guardar el valor de canPickUp
      
      // Si el usuario hizo clic mientras se calculaba y ya terminó el loading, avanzar automáticamente
      if (userClickedWhileLoading && !isLoading) {
        setUserClickedWhileLoading(false); // Resetear la bandera
        
        // Validar Trade-In antes de continuar
        const validation = validateTradeInProducts(cartProducts);
        if (validation.isValid) {
          // Track del evento begin_checkout para analytics
          trackBeginCheckout(
            cartProducts.map((p) => ({
              item_id: p.sku,
              item_name: p.name,
              price: Number(p.price),
              quantity: p.quantity,
            })),
            total
          );
          
          onContinue();
        }
      }
    },
    [userClickedWhileLoading, cartProducts, total, onContinue, trackBeginCheckout]
  );

  // Función para manejar el click en continuar pago
  const handleContinue = async () => {
    if (cartProducts.length === 0) {
      return;
    }

    // Validar Trade-In antes de continuar
    const validation = validateTradeInProducts(cartProducts);
    if (!validation.isValid) {
      const message = getTradeInValidationMessage(validation);
      alert(message);
      return;
    }

    // Si canPickUp global está cargando, marcar que el usuario hizo clic
    // y el avance automático se hará cuando termine el cálculo
    if (isLoadingCanPickUpGlobal) {
      setUserClickedWhileLoading(true);
      return;
    }

    // Si ya se calculó o no está cargando, continuar normalmente
    trackBeginCheckout(
      cartProducts.map((p) => ({
        item_id: p.sku,
        item_name: p.name,
        price: Number(p.price),
        quantity: p.quantity,
      })),
      total
    );

    onContinue();
  };

  // Handler para remover plan de Trade-In (usado en el banner mobile)
  const handleRemoveTradeIn = (skuToRemove: string) => {
    setTradeInData(prev => {
      const newState = { ...prev };
      delete newState[skuToRemove];
      return newState;
    });

    // Actualizar localStorage
    try {
      const stored = localStorage.getItem("imagiq_trade_in");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          const newStored = { ...parsed };
          delete newStored[skuToRemove];
          if (Object.keys(newStored).length === 0) {
            localStorage.removeItem("imagiq_trade_in");
          } else {
            localStorage.setItem("imagiq_trade_in", JSON.stringify(newStored));
          }
        }
      }
    } catch (e) {
      console.error("Error removing trade-in from storage", e);
    }

    // FORZAR cambio a "domicilio" si el método está en "tienda" (sin importar si está autenticado o no)
    if (typeof globalThis.window !== "undefined") {
      const currentMethod = globalThis.window.localStorage.getItem(
        "checkout-delivery-method"
      );
      if (currentMethod === "tienda") {
        // Forzar cambio inmediatamente
        globalThis.window.localStorage.setItem(
          "checkout-delivery-method",
          "domicilio"
        );
        globalThis.window.dispatchEvent(
          new CustomEvent("delivery-method-changed", {
            detail: { method: "domicilio" },
          })
        );
        globalThis.window.dispatchEvent(new Event("storage"));

      }
    }

    // Si el producto aplica (indRetoma === 1), mostrar el banner guía SIEMPRE
    // Sin importar canPickUp o si el usuario está logueado
    // Limpiar caches de verificación para este SKU para forzar un chequeo fresco


    // Si el SKU eliminado es el que se estaba editando, limpiarlo
    if (currentTradeInSku === skuToRemove) {
      setCurrentTradeInSku(null);
    }

    // Forzar re-verificación actualizando el timestamp
    setLastAddressChange(Date.now());

    // Si el producto aplica (indRetoma === 1), mostrar el banner guía SIEMPRE
    // Sin importar canPickUp o si el usuario está logueado
    const product = cartProducts.find(p => p.sku === skuToRemove);
    if (product && product.indRetoma === 1) {
      // Mostrar banner siempre si el producto tiene indRetoma === 1
      setTradeInData(prev => ({
        ...prev,
        [skuToRemove]: {
          deviceName: product.name,
          value: 0,
          completed: false, // No está completado, solo es una guía
        }
      }));
    }
  };

  // Handler para abrir el modal de Trade-In
  const handleOpenTradeInModal = () => {
    setIsTradeInModalOpen(true);
  };

  // Handler para cuando se completa el Trade-In
  const handleCompleteTradeIn = (deviceName: string, value: number) => {
    // IMPORTANTE: Guardar el trade-in asociado al SKU específico
    if (!currentTradeInSku) {
      console.error("❌ No hay SKU seleccionado para guardar el trade-in");
      return;
    }

    try {
      // Cargar trade-ins existentes
      const raw = localStorage.getItem("imagiq_trade_in");
      let tradeIns: Record<string, { deviceName: string; value: number; completed: boolean; detalles?: unknown; sku?: string; name?: string; skuPostback?: string }> = {};

      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // Si es el formato antiguo (objeto único), convertirlo al nuevo formato
          if (parsed?.deviceName && typeof parsed === 'object' && !Array.isArray(parsed)) {
            // Formato antiguo detectado, no hacer nada por ahora
            tradeIns = {};
          } else if (typeof parsed === 'object') {
            // Formato nuevo (objeto con SKUs como claves)
            tradeIns = parsed as Record<string, { deviceName: string; value: number; completed: boolean; detalles?: unknown }>;
          }
        } catch (parseError) {
          console.error("❌ Error al parsear trade-ins:", parseError);
        }
      }

      // Agregar/actualizar el trade-in para este SKU
      // Incluir sku, name y skuPostback del producto que se está comprando
      tradeIns[currentTradeInSku] = {
        deviceName,
        value,
        completed: true,
        sku: currentTradeInSku,
        name: currentTradeInProductName || undefined,
        skuPostback: currentTradeInSkuPostback || undefined,
      };

      // FORZAR guardado en localStorage como respaldo (el modal también guarda, pero esto asegura persistencia)
      // IMPORTANTE: El modal guarda con 'detalles', así que intentamos preservar esos detalles
      try {
        const existingRaw = localStorage.getItem("imagiq_trade_in");
        if (existingRaw) {
          try {
            const existing = JSON.parse(existingRaw);
            // Si ya existe un trade-in para este SKU con detalles u otros campos, preservarlos
            if (existing[currentTradeInSku]) {
              const existingTradeIn = existing[currentTradeInSku];
              tradeIns[currentTradeInSku] = {
                ...tradeIns[currentTradeInSku],
                // Preservar detalles si existen
                ...(existingTradeIn.detalles && { detalles: existingTradeIn.detalles as unknown }),
                // Preservar sku, name, skuPostback si existen y no fueron establecidos
                ...(existingTradeIn.sku && !tradeIns[currentTradeInSku].sku && { sku: existingTradeIn.sku }),
                ...(existingTradeIn.name && !tradeIns[currentTradeInSku].name && { name: existingTradeIn.name }),
                ...(existingTradeIn.skuPostback && !tradeIns[currentTradeInSku].skuPostback && { skuPostback: existingTradeIn.skuPostback }),
              };
            }
          } catch {
            // Ignorar errores de parseo
          }
        }

        const tradeInString = JSON.stringify(tradeIns);
        localStorage.setItem("imagiq_trade_in", tradeInString);

        // Verificar que se guardó correctamente
        const verifySave = localStorage.getItem("imagiq_trade_in");
        if (!verifySave || verifySave !== tradeInString) {
          console.error("❌ ERROR: Trade-In NO se guardó correctamente en Step1");
          // Reintentar
          localStorage.setItem("imagiq_trade_in", tradeInString);
        } else {

        }

        // Disparar eventos de storage para sincronizar
        try {
          globalThis.dispatchEvent(new CustomEvent("localStorageChange", {
            detail: { key: "imagiq_trade_in" },
          }));
          globalThis.dispatchEvent(new Event("storage"));
        } catch (eventError) {
          console.error("Error disparando eventos de storage:", eventError);
        }
      } catch (backupError) {
        console.error("❌ Error en guardado de respaldo en Step1:", backupError);
      }

      // Actualizar el estado
      setTradeInData(prev => ({
        ...prev,
        [currentTradeInSku]: {
          deviceName,
          value,
          completed: true,
        }
      }));
    } catch (error) {
      console.error("❌ Error al guardar trade-in:", error);
    }
    setIsTradeInModalOpen(false);
  };

  // Handler para cancelar sin completar
  const handleCancelWithoutCompletion = () => {
    setIsTradeInModalOpen(false);
  };

  // Verificar si el usuario está logueado (se recalcula en cada render para estar actualizado)
  const user = safeGetLocalStorage<{
    id?: string;
    user_id?: string;
    email?: string;
  }>("imagiq_user", {});
  const isUserLoggedIn = !!(user?.id || user?.user_id || user?.email);



  return (
    <main className="min-h-screen py-2 md:py-8 px-2 md:px-0 pb-40 md:pb-8">
      {/* Grid principal: productos y resumen de compra */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        {/* Productos */}
        <section id="carrito-productos" className="p-0">

          {/* Skeleton mientras se hidrata el cliente */}
          {!isClient ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-200 rounded-xl" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : cartProducts.length === 0 ? (
            <div className="text-gray-500 text-center py-16 text-lg" data-nosnippet>
              No hay productos en el carrito.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bundles agrupados */}
              {bundleGroups.map((group) => {
                // Obtener datos de Trade-In para el bundle usando el productSku
                const bundleTradeInData = tradeInData[group.bundleInfo.productSku] || null;
                // Obtener shippingCity del primer producto del bundle
                const bundleShippingCity = group.items[0]?.shippingCity;
                // Verificar canPickUp del primer producto
                const bundleCanPickUp = group.items[0]?.canPickUp;
                const showCanPickUpMessage = isUserLoggedIn && bundleCanPickUp === false;

                return (
                  <CartBundleGroup
                    key={`${group.bundleInfo.codCampana}-${group.bundleInfo.productSku}`}
                    bundleInfo={group.bundleInfo}
                    items={group.items}
                    onUpdateQuantity={updateBundleQuantity}
                    onRemoveProduct={removeBundleProduct}
                    formatPrice={formatPrice}
                    tradeInData={bundleTradeInData}
                    onOpenTradeInModal={() => {
                      setCurrentTradeInSku(group.bundleInfo.productSku);
                      // Para bundles, usar el nombre del primer item o el nombre del bundle
                      const bundleMainProduct = group.items[0];
                      setCurrentTradeInProductName(bundleMainProduct?.name || null);
                      setCurrentTradeInSkuPostback(bundleMainProduct?.skuPostback || null);
                      handleOpenTradeInModal();
                    }}
                    onRemoveTradeIn={() => handleRemoveTradeIn(group.bundleInfo.productSku)}
                    shippingCity={bundleShippingCity}
                    showCanPickUpMessage={showCanPickUpMessage}
                  />
                );
              })}

              {/* Productos individuales (sin bundle) */}
              {nonBundleProducts.length > 0 && (
                <div className="flex flex-col bg-white rounded-lg overflow-hidden divide-y divide-gray-200">
                  {nonBundleProducts.map((product) => {
                    const idx = cartProducts.findIndex((p) => p.sku === product.sku);
                    // Obtener datos de Trade-In para este producto específico
                    const productTradeInData = tradeInData[product.sku] || null;

                    return (
                      <ProductCard
                        key={product.sku}
                        nombre={product.displayName || product.desDetallada || product.name}
                        imagen={product.image}
                        precio={product.price}
                        precioOriginal={product.originalPrice}
                        cantidad={product.quantity}
                        stock={product.stock}
                        shippingCity={product.shippingCity}
                        shippingStore={product.shippingStore}
                        color={product.color}
                        colorName={product.colorName}
                        capacity={product.capacity}
                        ram={product.ram}
                        desDetallada={product.desDetallada}
                        isLoadingShippingInfo={
                          loadingShippingInfo[product.sku] || false
                        }
                        isLoadingIndRetoma={loadingIndRetoma.has(product.sku)}
                        indRetoma={product.indRetoma}
                        onQuantityChange={(cantidad) =>
                          handleQuantityChange(idx, cantidad)
                        }
                        onRemove={() => handleRemove(idx)}
                        onOpenTradeInModal={() => {
                          setCurrentTradeInSku(product.sku);
                          setCurrentTradeInProductName(product.name);
                          setCurrentTradeInSkuPostback(product.skuPostback || null);
                          handleOpenTradeInModal();
                        }}
                        onRemoveTradeIn={() => handleRemoveTradeIn(product.sku)}
                        tradeInData={productTradeInData}
                      />
                    );
                  })}
                </div>
              )}

              {/* Sugerencias: dentro del gate isClient + cartProducts > 0 para evitar fetch con data vacía */}
              <div className="mt-4 mb-4 md:mb-0">
                <Sugerencias cartProducts={cartProducts} />
              </div>
            </div>
          )}
        </section>
        {/* Resumen de compra - Solo Desktop */}
        <aside className="hidden md:block space-y-4 self-start sticky top-40">
          {!isClient ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                </div>
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between">
                    <div className="h-5 bg-gray-200 rounded w-1/4" />
                    <div className="h-5 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              </div>
              <div className="h-12 bg-gray-200 rounded w-full mt-6" />
            </div>
          ) : (
          <Step4OrderSummary
            onFinishPayment={() => {
              // Validar Trade-In antes de continuar
              const validation = validateTradeInProducts(cartProducts);
              if (!validation.isValid) {
                const message = getTradeInValidationMessage(validation);
                alert(message);
                return;
              }

              // Track del evento begin_checkout para analytics
              trackBeginCheckout(
                cartProducts.map((p) => ({
                  item_id: p.sku,
                  item_name: p.name,
                  price: Number(p.price),
                  quantity: p.quantity,
                })),
                total
              );

              onContinue();
            }}
            buttonText="Continuar"
            disabled={cartProducts.length === 0 || !tradeInValidation.isValid}
            isSticky={true}
            isStep1={true}
            onCanPickUpReady={handleCanPickUpReady}
            shouldCalculateCanPickUp={true}
            products={cartProducts}
            calculations={calculations}
            buttonVariant="green"
          />
          )}
        </aside>
      </div>

      {/* Sticky Bottom Bar - Solo Mobile */}
      {isClient && cartProducts.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="p-4 pb-8 flex items-center justify-between gap-4">
            {/* Izquierda: Total y descuentos */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500">
                Total ({cartProducts.reduce((acc, p) => acc + p.quantity, 0)}{" "}
                productos)
              </p>
              <p className="text-2xl font-bold text-gray-900">
                $ {Number(total).toLocaleString()}
              </p>
              {/* Mostrar descuento si existe */}
              {productSavings > 0 && (
                <p className="text-sm text-green-600 font-medium">
                  -{formatPrice(productSavings)} desc.
                </p>
              )}
            </div>

            {/* Derecha: Botón continuar - destacado con sombra y glow */}
            <button
              className={`flex-shrink-0 font-bold py-4 px-8 rounded-xl text-lg transition-all duration-200 text-white border-2 ${!tradeInValidation.isValid
                ? "bg-gray-400 border-gray-300 cursor-not-allowed"
                : userClickedWhileLoading
                ? "bg-gray-500 border-gray-400 cursor-not-allowed"
                : "bg-green-600 border-green-500 hover:bg-green-700 hover:border-green-600 cursor-pointer shadow-lg shadow-green-500/40 hover:shadow-xl hover:shadow-green-500/50"
                }`}
              onClick={handleContinue}
              disabled={!tradeInValidation.isValid || userClickedWhileLoading}
            >
              {userClickedWhileLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                  Continuar
                </span>
              ) : (
                "Continuar"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Trade-In */}
      {isTradeInModalOpen && (
        <TradeInModal
          isOpen={isTradeInModalOpen}
          onClose={() => setIsTradeInModalOpen(false)}
          onContinue={() => setIsTradeInModalOpen(false)}
          onCancelWithoutCompletion={handleCancelWithoutCompletion}
          onCompleteTradeIn={handleCompleteTradeIn}
          productSku={currentTradeInSku}
          productName={currentTradeInProductName}
          skuPostback={currentTradeInSkuPostback}
        />
      )}

      {couponWarning && (
        <CouponRemovalWarningModal
          isOpen={true}
          couponCode={appliedCouponCode || ""}
          discountAmount={appliedDiscount}
          productName={couponWarning.productName}
          onConfirm={handleConfirmCouponRemoval}
          onCancel={() => setCouponWarning(null)}
        />
      )}

    </main>
  );
}
