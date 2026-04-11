"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { productEndpoints, type CandidateStoresResponse, type CandidateStore } from "@/lib/api";
import { apiDelete, apiPost, apiPut } from "@/lib/api-client";

// Interfaz para información del bundle
export interface BundleInfo {
  /** Código de la campaña del bundle */
  codCampana: string;
  /** SKU del producto principal del bundle */
  productSku: string;
  /** Array con todos los SKUs que componen el bundle */
  skusBundle: string[];
  /** Precio original del bundle (sin descuento) */
  bundlePrice: number;
  /** Precio con descuento del bundle */
  bundleDiscount: number;
  /** Fecha de expiración del bundle */
  fechaFinal: Date;
  /** Indica si el bundle aplica para entrega y estreno (1 = aplica, 0 = no aplica) */
  ind_entre_estre?: number;
}

export interface CartProduct {
  id: string;
  name: string;
  /** Nombre limpio para mostrar (desDetallada || name, sin colorName "0") */
  displayName?: string;
  image: string;
  price: number;
  quantity: number;
  sku: string;
  ean: string;
  /**
   * Puntos Q acumulables por producto (valor fijo por ahora)
   * Si no se especifica, se asume 4 por defecto.
   */
  puntos_q?: number;
  /** Stock disponible del producto (desde backend) */
  stock?: number;
  /** Precio original sin descuento */
  originalPrice?: number;
  /** Ubicación de envío (ej: "Bogotá")*/
  shippingFrom?: string;
  /** Ciudad de envío (ej: "BOGOTÁ") */
  shippingCity?: string;
  /** Nombre de la tienda (ej: "Ses Bogotá C.C. Andino") */
  shippingStore?: string;
  /** Color del producto (código hexadecimal) */
  color?: string;
  /** Nombre del color del producto */
  colorName?: string;
  /** Capacidad del producto (ej: "128GB", "256GB") */
  capacity?: string;
  /** Memoria RAM del producto (ej: "8GB", "12GB") */
  ram?: string;
  skuPostback?: string;
  desDetallada?: string;
  /** Modelo del producto (ej: "Galaxy S24", "Galaxy Watch") - usado para sugerencias relacionadas */
  modelo?: string;
  /** Categoría del producto (ej: "IT", "AV", "HA") */
  categoria?: string;
  /** Indica si el producto puede ser recogido en tienda (canPickUp) */
  canPickUp?: boolean;
  /** Indica si el producto aplica para retoma (indRetoma: 1 = aplica, 0 = no aplica) */
  indRetoma?: number;
  /** Información del bundle al que pertenece este producto (si aplica) */
  bundleInfo?: BundleInfo;
}

interface CartCalculations {
  productCount: number;
  subtotal: number;
  shipping: number;
  taxes: number;
  discount: number;
  total: number;
}

export interface CouponRequirements {
  eligibleIdentifiers: string[];
  requiredCompanionIdentifiers: string[];
}

interface UseCartReturn {
  // Estado
  products: CartProduct[];
  appliedDiscount: number;
  appliedCouponCode: string | null;
  isLoading: boolean;
  loadingShippingInfo: Record<string, boolean>;

  // Cálculos
  calculations: CartCalculations;

  // Acciones
  addProduct: (
    product: Omit<CartProduct, "quantity">,
    quantity?: number,
    userId?: string
  ) => Promise<void>;
  removeProduct: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  applyDiscount: (discount: number) => void;
  applyCoupon: (code: string, discount: number, requirements?: CouponRequirements) => void;
  removeCoupon: () => void;
  checkCouponInvalidation: (sku: string) => boolean;

  // Acciones de Bundle
  addBundleToCart: (
    items: Omit<CartProduct, "quantity">[],
    bundleInfo: BundleInfo,
    userId?: string
  ) => Promise<void>;
  updateBundleQuantity: (
    codCampana: string,
    productSku: string,
    quantity: number
  ) => Promise<void>;
  removeBundleProduct: (
    sku: string,
    keepOtherProducts: boolean
  ) => Promise<void>;

  // Utilidades
  isEmpty: boolean;
  formatPrice: (price: number) => string;
}

const STORAGE_KEYS = {
  CART_ITEMS: "cart-items",
  APPLIED_DISCOUNT: "applied-discount",
  COUPON_CODE: "coupon-code",
  COUPON_REQUIREMENTS: "coupon-requirements",
} as const;

function getStoredCouponRequirements(): CouponRequirements | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.COUPON_REQUIREMENTS);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Real shipping used in calculations is 0 (envío gratuito). Keep original value for marketing display.
export const ORIGINAL_SHIPPING_COST = 20000;
const SHIPPING_COST = 0;
const TAX_RATE = 0.09;

// Función para normalizar productos del localStorage
function normalizeCartProducts(rawProducts: unknown[]): CartProduct[] {
  if (!Array.isArray(rawProducts)) return [];

  const randId = () => Math.random().toString(36).slice(2, 10);

  const toId = (val: unknown): string => {
    if (typeof val === "string") return val;
    if (typeof val === "number") return String(val);
    if (val !== null && val !== undefined) {
      if (typeof val === "boolean" || typeof val === "bigint") return String(val);
    }
    return "";
  };

  const asString = (val: unknown, fallback = undefined as string | undefined) =>
    typeof val === "string" ? val : fallback;

  const asNumber = (val: unknown, fallback = 0) =>
    Number(val ?? fallback);

  const parseProduct = (p: Record<string, unknown>): CartProduct => {
    const id = toId(p.id);
    const name = asString(p.nombre, asString(p.name, "Producto")) || "Producto";
    const image = asString(p.imagen, asString(p.image, "/img/logo_imagiq.png")) || "/img/logo_imagiq.png";

    const sku =
      typeof p.sku === "string"
        ? p.sku
        : `SKU-${typeof p.id === "string" ? p.id : randId()}`;

    const ean =
      typeof p.ean === "string"
        ? p.ean
        : `EAN-${typeof p.id === "string" ? p.id : randId()}`;

    const skuPostback =
      typeof p.skuPostback === "string" && p.skuPostback.trim() !== ""
        ? p.skuPostback
        : undefined;

    const puntos_q = typeof p.puntos_q === "number" ? p.puntos_q : 4;
    const price = asNumber(p.precio ?? p.price ?? 0, 0);
    const quantity = Number(p.cantidad ?? p.quantity ?? 1);

    const stock = typeof p.stock === "number" ? p.stock : undefined;
    const originalPrice = typeof p.originalPrice === "number" ? p.originalPrice : undefined;
    const shippingFrom = asString(p.shippingFrom);
    const shippingCity = asString(p.shippingCity);
    const shippingStore = asString(p.shippingStore);
    const color = asString(p.color);
    const colorName = asString(p.colorName);
    const capacity = asString(p.capacity);
    const ram = asString(p.ram);
    const desDetallada = asString(p.desDetallada);
    const modelo = asString(p.modelo);
    const categoria = asString(p.categoria); // CRITICAL: Preserve category field
    const canPickUp = typeof p.canPickUp === "boolean" ? p.canPickUp : undefined;
    const indRetoma = typeof p.indRetoma === "number" ? p.indRetoma : undefined;

    // Parsear bundleInfo si existe
    let bundleInfo: BundleInfo | undefined = undefined;
    if (p.bundleInfo && typeof p.bundleInfo === "object") {
      const bi = p.bundleInfo as Record<string, unknown>;
      if (bi.codCampana && bi.productSku && Array.isArray(bi.skusBundle)) {
        bundleInfo = {
          codCampana: String(bi.codCampana),
          productSku: String(bi.productSku),
          skusBundle: bi.skusBundle.map((s: unknown) => String(s)),
          bundlePrice: Number(bi.bundlePrice) || 0,
          bundleDiscount: Number(bi.bundleDiscount) || 0,
          fechaFinal: new Date(bi.fechaFinal as string | number | Date),
          ind_entre_estre: typeof bi.ind_entre_estre === "number" ? bi.ind_entre_estre : undefined,
        };
      }
    }

    return {
      id,
      name,
      image,
      price,
      quantity,
      sku,
      ean,
      puntos_q,
      stock,
      originalPrice,
      shippingFrom,
      shippingCity,
      shippingStore,
      color,
      colorName,
      capacity,
      ram,
      skuPostback,
      desDetallada,
      modelo,
      categoria, // CRITICAL: Include category in return object
      canPickUp,
      indRetoma,
      bundleInfo,
    };
  };

  return rawProducts
    .filter(
      (p): p is Record<string, unknown> => typeof p === "object" && p !== null
    )
    .map(parseProduct)
    .filter((p) => p.id && p.price > 0); // Filtrar productos inválidos
}

// Función para obtener productos del localStorage
function getStoredProducts(): CartProduct[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CART_ITEMS);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return normalizeCartProducts(parsed);
  } catch (error) {
    console.warn("Error parsing cart items from localStorage:", error);
    return [];
  }
}

// Función para obtener descuento aplicado
function getStoredDiscount(): number {
  if (typeof window === "undefined") return 0;

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.APPLIED_DISCOUNT);
    return stored ? Number(stored) : 0;
  } catch (error) {
    console.warn("Error parsing discount from localStorage:", error);
    return 0;
  }
}

// Función para obtener cupón aplicado
function getStoredCouponCode(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(STORAGE_KEYS.COUPON_CODE) || null;
  } catch (error) {
    console.warn("Error reading coupon code from localStorage:", error);
    return null;
  }
}

// Función para formatear precios en COP
export const formatPrice = (price: number): string => {
  if (!isFinite(price) || isNaN(price)) return "$0";
  return price.toLocaleString("es-CO", { style: "currency", currency: "COP" });
};

export function useCart(): UseCartReturn {
  const [products, setProducts] = useState<CartProduct[]>(() => getStoredProducts());
  const [appliedDiscount, setAppliedDiscount] = useState(() => getStoredDiscount());
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(() => getStoredCouponCode());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingShippingInfo, setLoadingShippingInfo] = useState<Record<string, boolean>>({});

  // Ref para prevenir múltiples clics del mismo producto en un corto período
  const addProductTimeoutRef = useRef<Record<string, number>>({});
  // Ref para evitar duplicidad de alertas (toast)
  const toastActiveRef = useRef<Record<string, boolean>>({});
  // Skip the coupon auto-check on the render cycle right after applyCoupon
  // (the backend just validated it — no need to re-check immediately)
  const couponJustAppliedRef = useRef(false);

  // Función helper para obtener userId
  const getUserId = useCallback((): string | undefined => {
    try {
      const userStr = localStorage.getItem("imagiq_user");
      if (!userStr) return undefined;
      const user = JSON.parse(userStr);
      return user?.id || user?.user_id;
    } catch {
      return undefined;
    }
  }, []);

  // Función para cargar información de envío de un producto
  const loadShippingInfoForProduct = useCallback(async (sku: string, userId: string, quantity: number) => {
    setLoadingShippingInfo((prev) => ({ ...prev, [sku]: true }));

    try {
      // Obtener addressId de la dirección predeterminada
      let addressId: string | undefined = undefined;
      try {
        const savedAddress = localStorage.getItem("checkout-address");
        if (savedAddress) {
          const parsed = JSON.parse(savedAddress);
          addressId = parsed.id;
        }
      } catch (error) {
        console.error("Error al leer dirección:", error);
      }

      const response = await productEndpoints.getCandidateStores({
        products: [{ sku: sku, quantity }],
        user_id: userId,
        ...(addressId && { addressId }),
      });

      if (response.success && response.data) {
        const { stores, default_direction, canPickUp } = response.data;

        let shippingCity = default_direction?.ciudad || "BOGOTÁ";
        let shippingStore = "";

        const storeEntries = Object.entries(stores);
        if (storeEntries.length > 0) {
          const [firstCity, firstCityStores] = storeEntries[0];
          shippingCity = firstCity;
          if (firstCityStores.length > 0) {
            shippingStore = firstCityStores[0].nombre_tienda.trim();
          }
        }

        console.log('✅ [loadShippingInfoForProduct] Resultado:', {
          canPickUp,
          shippingCity,
          storesCount: Object.keys(stores || {}).length
        });

        setProducts((currentProducts) => {
          const updatedProducts = currentProducts.map(p =>
            p.sku === sku ? { ...p, shippingCity, shippingStore, canPickUp } : p
          );

          try {
            localStorage.setItem(
              STORAGE_KEYS.CART_ITEMS,
              JSON.stringify(updatedProducts)
            );
          } catch (error) {
            console.error("Error saving updated shipping location:", error);
          }

          return updatedProducts;
        });
      }
    } catch (error) {
      console.error('Error al obtener tienda candidata:', error);
    } finally {
      setLoadingShippingInfo((prev) => {
        const newState = { ...prev };
        delete newState[sku];
        return newState;
      });
    }
  }, []);

  // Inicializar datos del carrito - YA NO ES NECESARIO (se hace en useState)
  // useEffect(() => {
  //   setProducts(getStoredProducts());
  //   setAppliedDiscount(getStoredDiscount());
  //   setIsLoading(false);
  // }, []);

  // Cargar información de envío para productos sin ella al montar
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    const storedProducts = getStoredProducts();
    const productsWithoutShipping = storedProducts.filter(p => !p.shippingCity);

    if (productsWithoutShipping.length > 0) {
      // Cargar shipping info para cada producto que no la tenga
      productsWithoutShipping.forEach(product => {
        loadShippingInfoForProduct(product.sku, userId, product.quantity);
      });
    }
  }, [getUserId, loadShippingInfoForProduct]);

  // Recargar shipping info cuando cambia la dirección
  useEffect(() => {
    const handleAddressChanged = () => {
      const userId = getUserId();
      if (!userId) return;

      const storedProducts = getStoredProducts();
      if (storedProducts.length > 0) {
        storedProducts.forEach(product => {
          loadShippingInfoForProduct(product.sku, userId, product.quantity);
        });
      }
    };

    window.addEventListener('address-changed', handleAddressChanged);
    return () => {
      window.removeEventListener('address-changed', handleAddressChanged);
    };
  }, [getUserId, loadShippingInfoForProduct]);

  // Sincronizar cambios en localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setProducts(getStoredProducts());
      setAppliedDiscount(getStoredDiscount());
      setAppliedCouponCode(getStoredCouponCode());
    };
    // Escuchar tanto el evento 'storage' nativo (entre tabs) como el evento personalizado (mismo tab)
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("localStorageChange", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("localStorageChange", handleStorageChange);
    };
  }, []);

  // Función para guardar productos en localStorage
  const saveProducts = useCallback(
    (newProducts: CartProduct[], skipStorageEvent = false) => {
      try {
        // Si el carrito está vacío, mejor eliminar el ítem completamente
        if (newProducts.length === 0) {
          localStorage.removeItem(STORAGE_KEYS.CART_ITEMS);
        } else {
          localStorage.setItem(
            STORAGE_KEYS.CART_ITEMS,
            JSON.stringify(newProducts)
          );
        }

        // Solo actualizar el estado si no está siendo llamado desde removeProduct
        if (!skipStorageEvent) {
          // Actualizar el estado local (de manera asincrónica para evitar problemas de renderizado)
          // Esto evita el error "Cannot update a component while rendering a different component"
          setTimeout(() => {
            setProducts(newProducts);

            // Disparar evento storage para otros tabs/componentes después de actualizar el estado
            // Esto asegura que otros componentes se actualicen incluso dentro de la misma tab
            try {
              window.dispatchEvent(new Event("storage"));
            } catch (error) {
              // Fallback para navegadores antiguos
              console.debug(
                "Manual storage event dispatch failed, relying on natural events",
                error
              );
            }
          }, 0);
        }
      } catch (error) {
        console.error("Error saving products to localStorage:", error);
      }
    },
    []
  );

  // Función para guardar descuento en localStorage
  const saveDiscount = useCallback((discount: number) => {
    try {
      localStorage.setItem(STORAGE_KEYS.APPLIED_DISCOUNT, String(discount));
      setAppliedDiscount(discount);
      // Sincronizar con otras instancias de useCart() en la misma tab
      setTimeout(() => {
        window.dispatchEvent(new Event("storage"));
      }, 0);
    } catch (error) {
      console.error("Error saving discount to localStorage:", error);
    }
  }, []);

  /**
   * Agrega un producto al carrito y muestra una alerta única por acción.
   * Evita duplicidad de toasts usando un flag temporal por producto.
   * Si se proporciona userId, obtiene la ubicación de envío del backend en segundo plano.
   */
  const addProduct = useCallback(
    async (product: Omit<CartProduct, "quantity">, quantity: number = 1, userId?: string) => {
      const now = Date.now();
      const productId = product.id;
      // Prevenir múltiples clics del mismo producto en 300ms
      const lastAddTime = addProductTimeoutRef.current[productId] || 0;
      if (now - lastAddTime < 300) {
        return;
      }
      addProductTimeoutRef.current[productId] = now;

      // IMPORTANTE: NO limpiar caché aquí - useDelivery lo maneja automáticamente
      // cuando detecta cambios en los productos. Limpiar aquí causa race conditions.

      // Obtener userId automáticamente si no se proporciona
      const effectiveUserId = userId || getUserId();

      // Variable para capturar la cantidad final que quedará en el carrito
      let totalQuantityInCart = quantity;

      // Sanitizar producto: computar displayName y limpiar colorName "0"
      const cleanColorName = product.colorName != null && String(product.colorName) !== '0' && product.colorName !== '' ? String(product.colorName) : undefined;
      const displayName = product.desDetallada || product.name;
      const sanitizedProduct = { ...product, displayName, colorName: cleanColorName };

      // Agregar producto inmediatamente sin bloquear
      setProducts((currentProducts) => {
        // Solo buscar productos individuales (sin bundleInfo) para evitar mezclar con bundles
        const existingIndex = currentProducts.findIndex(
          (p) => p.sku === product.sku && !p.bundleInfo
        );
        let newProducts: CartProduct[];
        let wasUpdated = false;
        let finalQuantity = quantity;
        if (existingIndex >= 0) {
          newProducts = [...currentProducts];
          const currentQuantity = newProducts[existingIndex].quantity;
          finalQuantity = currentQuantity + quantity;
          newProducts[existingIndex] = {
            ...newProducts[existingIndex],
            quantity: finalQuantity,
          };
          wasUpdated = true;
        } else {
          newProducts = [...currentProducts, { ...sanitizedProduct, quantity, shippingFrom: product.shippingFrom, }];
          finalQuantity = quantity;
        }

        // Capturar la cantidad final para usarla fuera del setProducts
        totalQuantityInCart = finalQuantity;

        // Guardar productos en localStorage
        try {
          localStorage.setItem(
            STORAGE_KEYS.CART_ITEMS,
            JSON.stringify(newProducts)
          );
        } catch (error) {
          console.error("Error saving products to localStorage:", error);
        }
        // Mostrar alerta solo si no está activa para este producto
        if (!toastActiveRef.current[productId]) {
          toastActiveRef.current[productId] = true;
          toast(
            wasUpdated ? `Cantidad actualizada` : `Producto añadido al carrito`,
            {
              description: `${displayName} - Cantidad: ${finalQuantity}`,
              duration: 4000,
              className: "toast-cart-added",
              action: {
                label: "Ir al carrito",
                onClick: () => {
                  window.location.href = "/carrito";
                },
              },
              onAutoClose: () => {
                toastActiveRef.current[productId] = false;
              },
              onDismiss: () => {
                toastActiveRef.current[productId] = false;
              },
            }
          );
        }
        return newProducts;
      });

      // Disparar evento de storage para sincronizar otras instancias del hook
      // (Step1 usa useCart() directo, SuggestionCard usa useCartContext/CartProvider)
      setTimeout(() => {
        try {
          window.dispatchEvent(new Event("storage"));
        } catch { /* ignore */ }
      }, 0);

      // Obtener ubicación de envío en segundo plano si tenemos userId
      if (effectiveUserId) {
        // Marcar este SKU específico como cargando
        setLoadingShippingInfo((prev) => ({ ...prev, [product.sku]: true }));

        setTimeout(async () => {
          try {
            // Obtener addressId de la dirección predeterminada
            let addAddressId: string | undefined = undefined;
            try {
              const savedAddress = localStorage.getItem("checkout-address");
              if (savedAddress) {
                const parsed = JSON.parse(savedAddress);
                addAddressId = parsed.id;
              }
            } catch (error) {
              console.error("Error al leer dirección:", error);
            }

            const response = await productEndpoints.getCandidateStores({
              products: [{ sku: product.sku, quantity: totalQuantityInCart }],
              user_id: effectiveUserId,
              ...(addAddressId && { addressId: addAddressId }),
            });

            if (response.success && response.data) {
              const responseData = response.data as CandidateStoresResponse & { canPickup?: boolean };
              const { stores, default_direction } = responseData;
              // Manejar ambos casos: canPickUp (mayúscula) y canPickup (minúscula)
              const canPickUp = responseData.canPickUp ??
                responseData.canPickup ??
                false;

              // Obtener la primera ciudad y tienda disponible
              let shippingCity = default_direction?.ciudad || "BOGOTÁ";
              let shippingStore = "";

              // Si stores no está vacío, obtener la primera ciudad y su primera tienda
              const storeEntries = Object.entries(stores);
              if (storeEntries.length > 0) {
                const [firstCity, firstCityStores] = storeEntries[0];
                shippingCity = firstCity;
                if (firstCityStores.length > 0) {
                  shippingStore = firstCityStores[0].nombre_tienda.trim();
                }
              }

              // Actualizar el producto con ciudad y tienda por separado
              setProducts((currentProducts) => {
                const updatedProducts = currentProducts.map(p =>
                  p.sku === product.sku ? { ...p, shippingCity, shippingStore, canPickUp } : p
                );

                // Guardar en localStorage
                try {
                  localStorage.setItem(
                    STORAGE_KEYS.CART_ITEMS,
                    JSON.stringify(updatedProducts)
                  );
                } catch (error) {
                  console.error("Error saving updated shipping location:", error);
                }

                return updatedProducts;
              });

              // Sincronizar shipping info con otras instancias
              try {
                window.dispatchEvent(new Event("storage"));
              } catch { /* ignore */ }
            }
          } catch (error) {
            console.error('Error al obtener tienda candidata:', error);
            // No hacer nada si falla, el producto ya está en el carrito
          } finally {
            // Marcar este SKU como ya no cargando
            setLoadingShippingInfo((prev) => {
              const newState = { ...prev };
              delete newState[product.sku];
              return newState;
            });
          }
        }, 0);
      }

      // Limpiar el timeout después de 500ms
      setTimeout(() => {
        if (addProductTimeoutRef.current[productId] === now) {
          delete addProductTimeoutRef.current[productId];
        }
      }, 500);
    },
    [getUserId, loadShippingInfoForProduct]
  );

  /**
   * Elimina un producto del carrito y muestra alerta única.
   * Implementación optimizada para evitar notificaciones duplicadas.
   */
  const removeProduct = useCallback(
    (productId: string) => {
      // Prevenir múltiples eliminaciones del mismo producto
      const productToRemove = products.find((p) => p.sku === productId);
      if (!productToRemove) return; // Producto ya no existe

      // Usar una flag temporal para evitar notificaciones duplicadas
      const removeKey = `remove_${productId}`;
      if (toastActiveRef.current[removeKey]) return; // Ya se está procesando
      toastActiveRef.current[removeKey] = true;

      const productName = productToRemove.displayName || productToRemove.desDetallada || productToRemove.name;

      // IMPORTANTE: NO limpiar caché aquí - useDelivery lo maneja automáticamente
      // cuando detecta cambios en los productos. Limpiar aquí causa race conditions.

      // ✅ Eliminar trade-in del cache si existe para este SKU
      try {
        const stored = localStorage.getItem("imagiq_trade_in");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            const newStored = { ...parsed };
            delete newStored[productId];
            if (Object.keys(newStored).length === 0) {
              localStorage.removeItem("imagiq_trade_in");
            } else {
              localStorage.setItem("imagiq_trade_in", JSON.stringify(newStored));
            }
            // Disparar evento para que Step1 actualice el estado
            window.dispatchEvent(new CustomEvent("trade-in-removed", { detail: { sku: productId } }));
          }
        }
      } catch (e) {
        console.error("Error removing trade-in from storage", e);
      }

      // Actualizar productos localmente
      const newProducts = products.filter((p) => p.sku !== productId);

      // Actualizar estado inmediatamente para UI responsiva
      setProducts(newProducts);

      // Guardar en localStorage de manera asíncrona
      setTimeout(() => {
        try {
          if (newProducts.length === 0) {
            localStorage.removeItem(STORAGE_KEYS.CART_ITEMS);
          } else {
            apiDelete(`/api/cart/items/${productId}`);
            localStorage.setItem(
              STORAGE_KEYS.CART_ITEMS,
              JSON.stringify(newProducts)
            );
          }

          // Disparar evento de storage para sincronizar entre pestañas
          try {
            window.dispatchEvent(new Event("storage"));
          } catch (error) {
            console.debug("Error dispatching storage event", error);
          }

          // Mostrar notificación única después de guardar
          if (productName) {
            toast.info(`Producto eliminado`, {
              description: `${productName} se quitó del carrito`,
              duration: 2500,
              className: "toast-info",
              onAutoClose: () => {
                toastActiveRef.current[removeKey] = false;
              },
              onDismiss: () => {
                toastActiveRef.current[removeKey] = false;
              },
            });
          }

          // Limpiar flag después de mostrar toast
          setTimeout(() => {
            toastActiveRef.current[removeKey] = false;
          }, 100);
        } catch (error) {
          console.error("Error removing product from localStorage:", error);
          toastActiveRef.current[removeKey] = false;
        }
      }, 0);
    },
    [products]
  );

  /**
   * Actualiza la cantidad de un producto en el carrito.
   */
  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeProduct(productId);
        return;
      }

      // NOTA: NO limpiar caché aquí - useDelivery lo detecta automáticamente
      // y limpia el caché cuando los productos cambian. Limpiar aquí causa
      // condiciones de carrera donde Step4 lee null antes de que useDelivery
      // escriba el nuevo valor.

      // Actualizar productos localmente
      const newProducts = products.map((p) =>
        p.sku === productId ? { ...p, quantity } : p
      );

      // Actualizar estado inmediatamente
      setProducts(newProducts);

      // Obtener userId para actualizar información de envío
      const userId = getUserId();

      // Guardar en localStorage de manera asíncrona
      setTimeout(() => {
        try {
          localStorage.setItem(
            STORAGE_KEYS.CART_ITEMS,
            JSON.stringify(newProducts)
          );

          // Disparar evento de storage para sincronizar entre pestañas
          try {
            window.dispatchEvent(new Event("storage"));
          } catch (error) {
            console.debug("Error dispatching storage event", error);
          }

          // Recargar información de envío con la nueva cantidad si tenemos userId
          if (userId) {
            loadShippingInfoForProduct(productId, userId, quantity);
          }
        } catch (error) {
          console.error(
            "Error updating product quantity in localStorage:",
            error
          );
        }
      }, 0);
    },
    [products, removeProduct, getUserId, loadShippingInfoForProduct]
  );

  /**
   * Vacía el carrito y reinicia el contador global en tiempo real.
   * Muestra alerta única de carrito vacío.
   */
  const clearCart = useCallback(() => {
    try {
      // Prevenir múltiples notificaciones de limpiar carrito
      const clearKey = "clear_cart";
      if (toastActiveRef.current[clearKey]) return;
      toastActiveRef.current[clearKey] = true;

      // Actualizar estado local inmediatamente
      setProducts([]);

      // Guardar en localStorage sin disparar eventos storage
      setTimeout(() => {
        apiDelete(`/api/cart/items/clear`);
        localStorage.removeItem(STORAGE_KEYS.CART_ITEMS);
        // Limpiar también el trade-in y cupón al vaciar el carrito
        localStorage.removeItem("imagiq_trade_in");
        localStorage.removeItem(STORAGE_KEYS.COUPON_CODE);
        localStorage.removeItem(STORAGE_KEYS.COUPON_REQUIREMENTS);
        setAppliedCouponCode(null);
        saveDiscount(0);

        // Disparar evento de storage para sincronizar entre pestañas
        try {
          window.dispatchEvent(new Event("storage"));
        } catch (error) {
          console.debug("Error dispatching storage event", error);
        }

        // Notificar al usuario
        toast.info("Carrito vacío", {
          description: "Todos los productos fueron eliminados",
          duration: 2500,
          className: "toast-info",
          onAutoClose: () => {
            toastActiveRef.current[clearKey] = false;
          },
          onDismiss: () => {
            toastActiveRef.current[clearKey] = false;
          },
        });

        // Limpiar flag después de mostrar toast
        setTimeout(() => {
          toastActiveRef.current[clearKey] = false;
        }, 100);
      }, 0);
    } catch (error) {
      console.error("Error clearing cart:", error);
      toastActiveRef.current["clear_cart"] = false;
    }
  }, []);

  /**
   * Aplica descuento al carrito.
   */
  const applyDiscount = useCallback(
    (discount: number) => {
      const validDiscount = Math.max(0, discount);
      saveDiscount(validDiscount);
    },
    [saveDiscount]
  );

  const applyCoupon = useCallback(
    (code: string, discount: number, requirements?: CouponRequirements) => {
      const normalizedCode = code.trim().toUpperCase();
      try {
        localStorage.setItem(STORAGE_KEYS.COUPON_CODE, normalizedCode);
        if (requirements) {
          localStorage.setItem(STORAGE_KEYS.COUPON_REQUIREMENTS, JSON.stringify(requirements));
        }
      } catch (error) {
        console.error("Error saving coupon code to localStorage:", error);
      }
      couponJustAppliedRef.current = true;
      setAppliedCouponCode(normalizedCode);
      saveDiscount(Math.max(0, discount));
    },
    [saveDiscount]
  );

  const removeCoupon = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.COUPON_CODE);
      localStorage.removeItem(STORAGE_KEYS.COUPON_REQUIREMENTS);
    } catch (error) {
      console.error("Error removing coupon code from localStorage:", error);
    }
    setAppliedCouponCode(null);
    saveDiscount(0);
  }, [saveDiscount]);

  // Checks if removing a product (by SKU) would invalidate the active coupon
  const checkCouponInvalidation = useCallback(
    (skuToRemove: string): boolean => {
      if (!appliedCouponCode) return false;
      const requirements = getStoredCouponRequirements();
      if (!requirements) return false;
      // Can't validate without identifiers — assume no invalidation
      if (requirements.eligibleIdentifiers.length === 0 && requirements.requiredCompanionIdentifiers.length === 0) return false;

      // Build identifier set for products that would REMAIN after removal
      const remainingIdentifiers = new Set<string>();
      for (const product of products) {
        if (product.sku === skuToRemove) continue;
        if (product.sku) remainingIdentifiers.add(product.sku);
        if (product.skuPostback) remainingIdentifiers.add(product.skuPostback);
        if (product.id) remainingIdentifiers.add(product.id);
      }

      const hasEligible =
        requirements.eligibleIdentifiers.length === 0 ||
        requirements.eligibleIdentifiers.some(id => remainingIdentifiers.has(id));
      const hasCompanion =
        requirements.requiredCompanionIdentifiers.length === 0 ||
        requirements.requiredCompanionIdentifiers.some(id => remainingIdentifiers.has(id));

      return !hasEligible || !hasCompanion;
    },
    [appliedCouponCode, products]
  );

  // Auto-remove coupon if required products are no longer in cart
  useEffect(() => {
    if (!appliedCouponCode) return;
    if (products.length === 0) return;
    // Skip the check right after applyCoupon — the backend just validated it
    if (couponJustAppliedRef.current) {
      couponJustAppliedRef.current = false;
      return;
    }

    const requirements = getStoredCouponRequirements();
    const hasLocalRequirements = requirements &&
      (requirements.eligibleIdentifiers.length > 0 || requirements.requiredCompanionIdentifiers.length > 0);

    if (hasLocalRequirements) {
      // Fast path: validate locally
      const cartIdentifiers = new Set<string>();
      for (const p of products) {
        if (p.sku) cartIdentifiers.add(p.sku);
        if (p.skuPostback) cartIdentifiers.add(p.skuPostback);
        if (p.id) cartIdentifiers.add(p.id);
      }

      const hasEligible =
        requirements.eligibleIdentifiers.length === 0 ||
        requirements.eligibleIdentifiers.some(id => cartIdentifiers.has(id));
      const hasCompanion =
        requirements.requiredCompanionIdentifiers.length === 0 ||
        requirements.requiredCompanionIdentifiers.some(id => cartIdentifiers.has(id));

      if (!hasEligible || !hasCompanion) {
        removeCoupon();
        toast.info("Bono eliminado", {
          description: `El bono ${appliedCouponCode} fue removido porque los productos requeridos ya no están en el carrito.`,
          duration: 4000,
        });
      }
    } else {
      // Fallback: re-validate with backend (requirements not available locally)
      const items = products.map(p => ({
        sku: p.sku,
        skupostback: p.skuPostback || p.sku,
        id: p.id,
      }));
      apiPost("/api/payments/validate-coupon", { couponCode: appliedCouponCode, items })
        .catch(() => {
          // Backend rejected — coupon no longer valid with current products
          removeCoupon();
          toast.info("Bono eliminado", {
            description: `El bono ${appliedCouponCode} fue removido porque los productos requeridos ya no están en el carrito.`,
            duration: 4000,
          });
        });
    }
  }, [products, appliedCouponCode, removeCoupon]);

  // ==================== MÉTODOS DE BUNDLE ====================

  /**
   * Añade un bundle al carrito.
   * Guarda los productos individuales pero usa el SKU del bundle como identificador principal.
   * Cada producto individual se guarda con su SKU original pero con bundleInfo que incluye el productSku del bundle.
   */
  const addBundleToCart = useCallback(
    async (
      items: Omit<CartProduct, "quantity">[],
      bundleInfo: BundleInfo,
      userId?: string
    ) => {
      const effectiveUserId = userId || getUserId();

      // Preparar items con bundleInfo y quantity = 1
      // IMPORTANTE: Usar los SKUs del bundle (skusBundle) en lugar de los SKUs individuales de los items
      console.log("Adding bundle to cart:", items, bundleInfo);

      // Mapear cada item con el SKU correspondiente de skusBundle
      // El orden de los items debe coincidir con el orden de los SKUs en skusBundle
      const itemsWithBundle: CartProduct[] = items.map((item, index) => {
        // bundleInfo.skusBundle contiene los SKUs POSTBACK (ej: F-SM-S731BDBKL)
        // item.sku contiene el SKU INTERNO (ej: SM-S731BDBKLTC)
        const bundlePostbackSku = bundleInfo.skusBundle[index];

        // Usar el ID original (codigoMarket) como ID único, solicitado por requerimiento de negocio
        // Anteriormente se generaba un ID compuesto, pero ahora se requiere identifiación por código de mercado
        const uniqueId = item.id;

        // IMPORTANTE: Mantener consistencia con productos individuales:
        // - sku: SKU interno del producto (item.sku o item.skuPostback si no hay interno)
        // - skuPostback: SKU postback del bundle (bundleInfo.skusBundle[])
        return {
          ...item,
          quantity: 1,
          bundleInfo,
          // Mantener el SKU interno del producto (desde item.sku que viene de productos[].sku)
          sku: item.sku, // SKU interno (SM-S731BDBKLTC, SM-R420NZKALTA, etc.)
          // El skuPostback es el que viene de bundleInfo.skusBundle (F-SM-S731BDBKL, SM-R420NZKAOBQ, etc.)
          skuPostback: bundlePostbackSku || item.skuPostback || item.sku,
          // ID único para identificar cada producto del bundle
          id: uniqueId,
        };
      });

      // Actualizar estado local
      setProducts((currentProducts) => {
        const newProducts = [...currentProducts];

        for (const item of itemsWithBundle) {
          // Buscar productos que pertenezcan al MISMO bundle (mismo codCampana y productSku)
          // Usar el ID compuesto para identificar productos del mismo bundle
          const existingIndex = newProducts.findIndex(
            (p) =>
              p.id === item.id &&
              p.bundleInfo?.codCampana === bundleInfo.codCampana &&
              p.bundleInfo?.productSku === bundleInfo.productSku
          );

          if (existingIndex >= 0) {
            console.log("Product already in bundle, updating quantity:", item.sku);
            // Si el producto ya existe en el mismo bundle, actualizar cantidad
            newProducts[existingIndex] = {
              ...newProducts[existingIndex],
              quantity: newProducts[existingIndex].quantity + 1,
            };
          } else {
            // Si no existe o es un producto individual/de otro bundle, agregar como nuevo
            newProducts.push(item);
          }
        }

        // Guardar en localStorage
        try {
          localStorage.setItem(
            STORAGE_KEYS.CART_ITEMS,
            JSON.stringify(newProducts)
          );
        } catch (error) {
          console.error("Error saving bundle to localStorage:", error);
        }

        return newProducts;
      });

      // Mostrar toast
      toast.success("Bundle añadido al carrito", {
        description: `${items.length} productos del bundle añadidos`,
        duration: 4000,
        className: "toast-cart-added",
        action: {
          label: "Ir al carrito",
          onClick: () => {
            window.location.href = "/carrito";
          },
        },
      });

      // Llamar al backend
      try {
        await apiPost("/api/cart/bundle/add", {
          items: itemsWithBundle,
          bundleInfo,
        });
      } catch (error) {
        console.error("Error adding bundle to cart:", error);
      }

      // Disparar evento de storage
      setTimeout(() => {
        window.dispatchEvent(new Event("storage"));
      }, 0);
    },
    [getUserId]
  );

  /**
   * Actualiza la cantidad de todos los productos de un bundle.
   */
  const updateBundleQuantity = useCallback(
    async (codCampana: string, productSku: string, quantity: number) => {
      if (quantity <= 0) {
        // Eliminar todo el bundle
        setProducts((currentProducts) => {
          const newProducts = currentProducts.filter(
            (p) =>
              !(
                p.bundleInfo?.codCampana === codCampana &&
                p.bundleInfo?.productSku === productSku
              )
          );

          try {
            if (newProducts.length === 0) {
              localStorage.removeItem(STORAGE_KEYS.CART_ITEMS);
            } else {
              localStorage.setItem(
                STORAGE_KEYS.CART_ITEMS,
                JSON.stringify(newProducts)
              );
            }
          } catch (error) {
            console.error("Error removing bundle from localStorage:", error);
          }

          return newProducts;
        });

        toast.info("Bundle eliminado del carrito", {
          duration: 2500,
        });
      } else {
        // Actualizar cantidad de todos los productos del bundle
        setProducts((currentProducts) => {
          const newProducts = currentProducts.map((p) => {
            if (
              p.bundleInfo?.codCampana === codCampana &&
              p.bundleInfo?.productSku === productSku
            ) {
              return { ...p, quantity };
            }
            return p;
          });

          try {
            localStorage.setItem(
              STORAGE_KEYS.CART_ITEMS,
              JSON.stringify(newProducts)
            );
          } catch (error) {
            console.error("Error updating bundle quantity:", error);
          }

          return newProducts;
        });
      }

      // Llamar al backend
      try {
        await apiPut("/api/cart/bundle/quantity", {
          codCampana,
          productSku,
          quantity,
        });
      } catch (error) {
        console.error("Error updating bundle quantity:", error);
      }

      // Disparar evento de storage
      setTimeout(() => {
        window.dispatchEvent(new Event("storage"));
      }, 0);
    },
    []
  );

  /**
   * Elimina un producto de un bundle.
   * El parámetro sku puede ser el SKU del bundle o cualquier SKU individual del bundle.
   * Si keepOtherProducts es true, los demás productos pierden el bundleInfo y vuelven a precio original.
   * Si keepOtherProducts es false, se eliminan todos los productos del bundle.
   */
  const removeBundleProduct = useCallback(
    async (sku: string, keepOtherProducts: boolean) => {
      // Variables para el toast (fuera de setProducts para evitar duplicados)
      let shouldShowBundleLostToast = false;
      let shouldShowBundleRemovedToast = false;

      setProducts((currentProducts) => {
        // Buscar el producto por SKU (puede ser el SKU del bundle o un SKU individual)
        let productToRemove = currentProducts.find((p) => p.sku === sku || p.id.includes(sku));

        // Si no se encuentra por SKU directo, buscar si el SKU está en algún bundle
        if (!productToRemove) {
          productToRemove = currentProducts.find(
            (p) => p.bundleInfo?.skusBundle?.includes(sku) || p.bundleInfo?.productSku === sku
          );
        }

        if (!productToRemove?.bundleInfo) {
          // No tiene bundleInfo, eliminar normalmente
          return currentProducts.filter((p) => p.sku !== sku && !p.id.includes(sku));
        }

        const { codCampana, productSku } = productToRemove.bundleInfo;

        let newProducts: CartProduct[];

        if (keepOtherProducts) {
          // Eliminar el producto específico y quitar bundleInfo de los demás
          newProducts = currentProducts
            .filter((p) => p.id !== productToRemove!.id)
            .map((p) => {
              if (
                p.bundleInfo?.codCampana === codCampana &&
                p.bundleInfo?.productSku === productSku
              ) {
                // Volver al precio original y quitar bundleInfo
                return {
                  ...p,
                  price: p.originalPrice ?? p.price,
                  bundleInfo: undefined,
                };
              }
              return p;
            });

          // ✅ Verificar si aún quedan productos con este productSku del bundle
          const remainingBundleProducts = newProducts.filter(
            (p) => p.bundleInfo?.productSku === productSku
          );

          // Si no quedan productos con este productSku, eliminar el trade-in asociado
          if (remainingBundleProducts.length === 0) {
            try {
              const stored = localStorage.getItem("imagiq_trade_in");
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') {
                  const newStored = { ...parsed };
                  delete newStored[productSku];
                  if (Object.keys(newStored).length === 0) {
                    localStorage.removeItem("imagiq_trade_in");
                  } else {
                    localStorage.setItem("imagiq_trade_in", JSON.stringify(newStored));
                  }
                  // Disparar evento para que Step1 actualice el estado
                  window.dispatchEvent(new CustomEvent("trade-in-removed", { detail: { sku: productSku } }));
                }
              }
            } catch (e) {
              console.error("Error removing trade-in from storage", e);
            }
          }

          // Marcar para mostrar toast DESPUÉS de actualizar el estado
          shouldShowBundleLostToast = true;
        } else {
          // Eliminar todos los productos del bundle
          newProducts = currentProducts.filter(
            (p) =>
              !(
                p.bundleInfo?.codCampana === codCampana &&
                p.bundleInfo?.productSku === productSku
              )
          );

          // ✅ Eliminar el trade-in asociado al productSku del bundle
          try {
            const stored = localStorage.getItem("imagiq_trade_in");
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed && typeof parsed === 'object') {
                const newStored = { ...parsed };
                delete newStored[productSku];
                if (Object.keys(newStored).length === 0) {
                  localStorage.removeItem("imagiq_trade_in");
                } else {
                  localStorage.setItem("imagiq_trade_in", JSON.stringify(newStored));
                }
                // Disparar evento para que Step1 actualice el estado
                window.dispatchEvent(new CustomEvent("trade-in-removed", { detail: { sku: productSku } }));
              }
            }
          } catch (e) {
            console.error("Error removing trade-in from storage", e);
          }

          // Marcar para mostrar toast DESPUÉS de actualizar el estado
          shouldShowBundleRemovedToast = true;
        }

        try {
          if (newProducts.length === 0) {
            localStorage.removeItem(STORAGE_KEYS.CART_ITEMS);
          } else {
            localStorage.setItem(
              STORAGE_KEYS.CART_ITEMS,
              JSON.stringify(newProducts)
            );
          }
        } catch (error) {
          console.error("Error removing bundle product:", error);
        }

        return newProducts;
      });

      // Mostrar toasts DESPUÉS de actualizar el estado (solo una vez)
      // Usar ref para evitar duplicados si hay re-renders
      const toastKey = keepOtherProducts ? "bundle-lost" : "bundle-removed";

      if (shouldShowBundleLostToast && !toastActiveRef.current[toastKey]) {
        toastActiveRef.current[toastKey] = true;
        toast.warning("Descuento de bundle perdido", {
          description:
            "Al eliminar un producto del bundle, los demás productos vuelven a su precio original.",
          duration: 4000,
          onDismiss: () => {
            delete toastActiveRef.current[toastKey];
          },
          onAutoClose: () => {
            delete toastActiveRef.current[toastKey];
          },
        });
      } else if (shouldShowBundleRemovedToast && !toastActiveRef.current[toastKey]) {
        toastActiveRef.current[toastKey] = true;
        toast.info("Bundle eliminado del carrito", {
          duration: 2500,
          onDismiss: () => {
            delete toastActiveRef.current[toastKey];
          },
          onAutoClose: () => {
            delete toastActiveRef.current[toastKey];
          },
        });
      }

      // Llamar al backend
      try {
        await apiDelete(`/api/cart/bundle/product?sku=${encodeURIComponent(sku)}&keepOtherProducts=${keepOtherProducts}`);
      } catch (error) {
        console.error("Error removing bundle product:", error);
      }

      // Disparar evento de storage
      setTimeout(() => {
        window.dispatchEvent(new Event("storage"));
      }, 0);
    },
    []
  );

  // Cálculos derivados
  const calculations: CartCalculations = {
    productCount: products.reduce((acc, p) => {
      const qty = Number(p.quantity);
      return acc + (isNaN(qty) ? 0 : qty);
    }, 0),
    subtotal: products.reduce((acc, p) => {
      const price = Number(p.price);
      const quantity = Number(p.quantity);
      const safePrice = isNaN(price) ? 0 : price;
      const safeQuantity = isNaN(quantity) ? 0 : quantity;
      return acc + safePrice * safeQuantity;
    }, 0),
    shipping: SHIPPING_COST,
    discount: Math.max(0, appliedDiscount),
    get taxes() {
      return Math.round(this.subtotal * TAX_RATE);
    },
    get total() {
      return Math.max(0, this.subtotal - this.discount + this.shipping);
    },
  };

  const isEmpty = products.length === 0;

  return {
    // Estado
    products,
    appliedDiscount,
    appliedCouponCode,
    isLoading,
    loadingShippingInfo,

    // Cálculos
    calculations,

    // Acciones
    addProduct,
    removeProduct,
    updateQuantity,
    clearCart,
    applyDiscount,
    applyCoupon,
    removeCoupon,
    checkCouponInvalidation,

    // Acciones de Bundle
    addBundleToCart,
    updateBundleQuantity,
    removeBundleProduct,

    // Utilidades
    isEmpty,
    formatPrice,
  };
}
