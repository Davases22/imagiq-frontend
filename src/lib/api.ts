/**
 * Cliente API para comunicación con microservicios
 * - Configuración base de Axios o Fetch
 * - Interceptors para auth tokens
 * - Manejo centralizado de errores
 * - Retry logic para requests fallidos
 * - Rate limiting y caching
 * - TypeScript interfaces para requests/responses
 */

import type { ProductFilterParams } from "./sharedInterfaces";
import type { StoresApiResponse } from "@/types/store";

// API Client configuration
// Use relative URLs in the browser so requests go through Next.js rewrites.
// NEXT_PUBLIC_* vars are inlined at build time, so we can't conditionally check
// typeof window — instead we always use "" for client-side code.
const API_BASE_URL = "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

// Advertencia en desarrollo si no está configurada la API Key
if (!API_KEY && process.env.NODE_ENV === 'development') {
  console.warn(
    '⚠️ NEXT_PUBLIC_API_KEY no está configurada en .env.local\n' +
    'Las peticiones al API fallarán con error 401'
  );
}

// Generic API response type
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
  statusCode?: number; // Incluir statusCode para detectar errores HTTP como 429
}

// API Client class
export class ApiClient {
  private readonly baseURL: string;
  private headers: Record<string, string>;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
    this.headers = {
      "Content-Type": "application/json",
      // Agregar API Key automáticamente si está configurada
      ...(API_KEY && { "X-API-Key": API_KEY }),
    };
  }

  // Auth methods
  setAuthToken(token: string) {
    this.headers["Authorization"] = `Bearer ${token}`;
  }

  removeAuthToken() {
    delete this.headers["Authorization"];
  }

  // Generic request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      headers: this.headers,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const responseData = await response.json();

      // Extraer statusCode del responseData si existe (para errores como 429)
      const statusCode = responseData?.statusCode || response.status;

      // Si la respuesta tiene la estructura { success, data, message, errors }
      if (responseData && typeof responseData === 'object' && 'success' in responseData) {
        return {
          data: responseData.data as T,
          success: responseData.success && response.ok,
          message: responseData.message,
          errors: responseData.errors,
          statusCode: !response.ok ? statusCode : undefined, // Solo incluir si hay error
        };
      }

      // Fallback para respuestas que no siguen el formato estándar
      return {
        data: responseData as T,
        success: response.ok,
        message: responseData.message,
        errors: responseData.errors,
        statusCode: !response.ok ? statusCode : undefined, // Solo incluir si hay error
      };
    } catch (error) {
      // Silenciar errores de abort - son esperados cuando el usuario cambia de filtros rápidamente
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        return {
          data: {} as T,
          success: false,
          message: "Request aborted",
        };
      }

      console.error("API request failed:", error);
      return {
        data: {} as T,
        success: false,
        message: "Request failed",
      };
    }
  }

  // HTTP methods
  async get<T>(endpoint: string, init?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET", ...(init || {}) });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Re-export types used by this module
export type { ProductFilterParams } from "./sharedInterfaces";

// Product API endpoints
export const productEndpoints = {
  getAll: () => apiClient.get<ProductApiResponse>("/api/products"),
  getFiltered: (() => {
    const inFlightByKey: Record<string, Promise<ApiResponse<ProductApiResponse>> | undefined> = {};

    // Función para normalizar parámetros y crear clave de deduplicación
    // Ignora parámetros no críticos que no afectan qué productos se obtienen
    const DYNAMIC_FILTER_RE = /^[a-zA-Z0-9]+_(equal|not_equal|in|not_in|contains|starts_with|ends_with|greater_than|less_than|greater_than_or_equal|less_than_or_equal|range_min|range_max)$/;

    const normalizeParams = (params: ProductFilterParams): string => {
      const critical: Record<string, string> = {};

      // Solo incluir parámetros críticos que afectan qué productos se obtienen
      if (params.categoria) critical.categoria = String(params.categoria);
      if (params.subcategoria) critical.subcategoria = String(params.subcategoria);
      if (params.menuUuid) critical.menuUuid = String(params.menuUuid);
      if (params.submenuUuid) critical.submenuUuid = String(params.submenuUuid);
      if (params.precioMin !== undefined) critical.precioMin = String(params.precioMin);
      if (params.limit !== undefined) critical.limit = String(params.limit);
      if (params.lazyLimit !== undefined) critical.lazyLimit = String(params.lazyLimit);
      if (params.lazyOffset !== undefined) critical.lazyOffset = String(params.lazyOffset);

      // Incluir filtros dinámicos (ej: device_contains, precioeccommerce_range_min)
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '' && DYNAMIC_FILTER_RE.test(key)) {
          critical[key] = String(value);
        }
      }

      // Ignorar: sortBy, sortOrder, page (no afectan qué productos se obtienen)

      return Object.keys(critical).sort().map(k => `${k}:${critical[k]}`).join('|');
    };

    return (params: ProductFilterParams, init?: RequestInit) => {
      const normalizedKey = normalizeParams(params);

      // Construir URL completa para la petición real (con todos los parámetros)
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          // Detectar si el key tiene sintaxis extendida (column_operator o column_range_min/max)
          // Patrón: column_operator o column_range_min/max
          const hasExtendedSyntax = /^[a-zA-Z0-9]+_(equal|not_equal|in|not_in|contains|starts_with|ends_with|greater_than|less_than|greater_than_or_equal|less_than_or_equal|range_min|range_max)$/.test(key);

          if (hasExtendedSyntax) {
            // Sintaxis extendida: manejar arrays y valores simples
            if (typeof value === "string" && value.includes(",")) {
              // Si es string con comas, dividir y crear múltiples query params
              const values = value.split(",").map(v => v.trim()).filter(v => v);
              values.forEach(v => {
                searchParams.append(key, v);
              });
            } else {
              // Valor único con sintaxis extendida
              searchParams.append(key, String(value));
            }
          } else {
            // Formato antiguo (backward compatibility)
            const stringValue = String(value);

            // Campos que deben generar múltiples query params cuando tienen comas
            const multiValueFields = [
              "nombreColor",
              "color",
              "capacity",
              "memoriaram",
              "name",
              "modelo",
              "model",
            ];

            // Si el campo permite múltiples valores y el valor contiene comas, dividir
            if (multiValueFields.includes(key) && stringValue.includes(",")) {
              // Dividir por comas y crear múltiples query params
              const values = stringValue.split(",").map(v => v.trim()).filter(v => v);
              values.forEach(v => {
                searchParams.append(key, v);
              });
            } else {
              // Valor único, agregar normalmente
              searchParams.append(key, stringValue);
            }
          }
        }
      });
      const url = `/api/products/filtered?${searchParams.toString()}`;

      // Usar clave normalizada para deduplicación
      if (inFlightByKey[normalizedKey]) {
        return inFlightByKey[normalizedKey] as Promise<ApiResponse<ProductApiResponse>>;
      }

      const p = apiClient.get<ProductApiResponse>(url, init).finally(() => {
        // liberar inmediatamente al resolver/rechazar para no cachear respuestas
        delete inFlightByKey[normalizedKey];
      });
      inFlightByKey[normalizedKey] = p;
      return p;
    };
  })(),
  getFilteredV2: (() => {
    const inFlightByKey: Record<string, Promise<ApiResponse<ProductApiResponse>> | undefined> = {};

    // Función para normalizar parámetros y crear clave de deduplicación
    // Ignora parámetros no críticos que no afectan qué productos se obtienen
    const normalizeParams = (params: ProductFilterParams): string => {
      const critical: Record<string, string> = {};

      // Solo incluir parámetros críticos que afectan qué productos se obtienen
      if (params.categoria) critical.categoria = String(params.categoria);
      if (params.subcategoria) critical.subcategoria = String(params.subcategoria);
      if (params.menuUuid) critical.menuUuid = String(params.menuUuid);
      if (params.submenuUuid) critical.submenuUuid = String(params.submenuUuid);
      if (params.precioMin !== undefined) critical.precioMin = String(params.precioMin);
      if (params.precioMax !== undefined) critical.precioMax = String(params.precioMax);
      if (params.limit !== undefined) critical.limit = String(params.limit);
      if (params.lazyLimit !== undefined) critical.lazyLimit = String(params.lazyLimit);
      if (params.lazyOffset !== undefined) critical.lazyOffset = String(params.lazyOffset);

      // CORRECCIÓN: Incluir filtros dinámicos en la clave de deduplicación
      // Los filtros dinámicos tienen sintaxis extendida: column_operator o column_range_min/max
      Object.keys(params).forEach((key) => {
        if (
          !['categoria', 'subcategoria', 'menuUuid', 'submenuUuid', 'precioMin', 'precioMax',
            'lazyLimit', 'lazyOffset', 'sortBy', 'sortOrder', 'page', 'limit',
            'category', 'subcategory', 'color', 'nombreColor', 'capacity',
            'memoriaram', 'name', 'withDiscount', 'minStock', 'descriptionKeyword',
            'model', 'filterMode'].includes(key)
        ) {
          // Es un filtro dinámico o campo adicional
          const value = (params as Record<string, any>)[key];
          if (value !== undefined && value !== null && value !== '') {
            critical[key] = String(value);
          }
        }
      });

      // Ignorar: sortBy, sortOrder, page (no afectan qué productos se obtienen)

      return Object.keys(critical).sort().map(k => `${k}:${critical[k]}`).join('|');
    };

    return (params: ProductFilterParams, init?: RequestInit) => {
      const normalizedKey = normalizeParams(params);

      // Construir URL completa para la petición real (con todos los parámetros)
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          // Detectar si el key tiene sintaxis extendida (column_operator o column_range_min/max)
          // Patrón: column_operator o column_range_min/max
          const hasExtendedSyntax = /^[a-zA-Z0-9]+_(equal|not_equal|in|not_in|contains|starts_with|ends_with|greater_than|less_than|greater_than_or_equal|less_than_or_equal|range_min|range_max)$/.test(key);

          if (hasExtendedSyntax) {
            // Sintaxis extendida: manejar arrays y valores simples
            if (typeof value === "string" && value.includes(",")) {
              // Si es string con comas, dividir y crear múltiples query params
              const values = value.split(",").map(v => v.trim()).filter(v => v);
              values.forEach(v => {
                searchParams.append(key, v);
              });
            } else {
              // Valor único con sintaxis extendida
              searchParams.append(key, String(value));
            }
          } else {
            // Formato antiguo (backward compatibility)
            searchParams.append(key, String(value));
          }
        }
      });
      const url = `/api/products/v2/filtered?${searchParams.toString()}`;

      // Usar clave normalizada para deduplicación
      if (inFlightByKey[normalizedKey]) {
        return inFlightByKey[normalizedKey] as Promise<ApiResponse<ProductApiResponse>>;
      }

      const p = apiClient.get<ProductApiResponse>(url, init).finally(() => {
        // liberar inmediatamente al resolver/rechazar para no cachear respuestas
        delete inFlightByKey[normalizedKey];
      });
      inFlightByKey[normalizedKey] = p;
      return p;
    };
  })(),
  getById: (id: string) =>
    apiClient.get<ProductApiResponse>(`/api/products/${id}`),
  getByCategory: (category: string) =>
    apiClient.get<ProductApiResponse>(
      `/api/products/filtered?categoria=${category}`
    ),
  getBySubcategory: (subcategory: string) =>
    apiClient.get<ProductApiResponse>(
      `/api/products/filtered?subcategoria=${subcategory}`
    ),
  getByCodigoMarket: (codigoMarket: string) =>
    apiClient.get<ProductApiResponse>(
      `/api/products/filtered?codigoMarket=${codigoMarket}`
    ),
  search: (query: string, params?: { precioMin?: number; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('query', query);
    searchParams.append('precioMin', String(params?.precioMin ?? 1));
    searchParams.append('page', String(params?.page ?? 1));
    searchParams.append('limit', String(params?.limit ?? 15));

    return apiClient.get<ProductApiResponse>(`/api/products/search/grouped?${searchParams.toString()}`);
  },
  getOffers: () =>
    apiClient.get<ProductApiResponse>(
      "/api/products/filtered?conDescuento=true"
    ),
  getFavorites: (id: string, params?: FavoriteFilterParams) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, String(value));
        }
      });
    }

    const queryString = searchParams.toString();
    const url = queryString
      ? `/api/products/favorites/${id}?${queryString}`
      : `/api/products/favorites/${id}`;

    return apiClient.get<FavoriteApiResponse>(url);
  },
  addFavorite: (data: {
    productSKU: string;
    userInfo: {
      //userId?: string;
      id?: string;
      nombre?: string;
      apellido?: string;
      email?: string;
      telefono?: string;
      numero_documento?: string;
      rol?: string;
    };
  }) =>
    apiClient.post<{
      productSKU: string;
      userInfo: {
        id?: string;
        //userId?: string;
        nombre?: string;
        apellido?: string;
        email?: string;
        telefono?: string;
        numero_documento?: string | null;
        rol?: number;
      };
    }>(`/api/products/add-to-favorites`, data),
  removeFavorite: (id: string, productSKU: string) =>
    apiClient.delete<void>(
      `/api/products/remove-from-favorites/${id}?productSKU=${productSKU}`
    ),
  getCandidateStores: (data: { products: { sku: string; quantity: number }[]; user_id: string; cities?: string[]; addressId?: string }) =>
    apiClient.post<CandidateStoresResponse>('/api/products/candidate-stores', data),

  // Bundle-specific endpoints
  getBundleById: (baseCodigoMarket: string, codCampana: string, productSku: string) =>
    apiClient.get<BundleDirectResponse>(
      `/api/products/v2/bundles/${baseCodigoMarket}/${codCampana}/${productSku}`
    ),

  // Batch endpoint for multiple product requests
  // Maximum 100 queries per batch request (will split into multiple batches if needed)
  getBatch: async (queries: ProductFilterParams[]): Promise<ApiResponse<BatchProductResponse>> => {
    if (queries.length === 0) {
      return {
        success: false,
        data: { results: [] },
        message: 'No queries provided',
      };
    }

    const BATCH_SIZE = 100;

    // Si hay más de 100 queries, dividir en múltiples batches
    if (queries.length > BATCH_SIZE) {
      const batches: ProductFilterParams[][] = [];
      for (let i = 0; i < queries.length; i += BATCH_SIZE) {
        batches.push(queries.slice(i, i + BATCH_SIZE));
      }

      // Ejecutar todos los batches en paralelo
      const batchPromises = batches.map(batch =>
        apiClient.post<BatchProductResponse>('/api/products/v2/batch', { queries: batch })
      );

      const responses = await Promise.allSettled(batchPromises);

      // Combinar todos los resultados
      const allResults: BatchProductResult[] = [];
      let currentIndex = 0;

      responses.forEach((response, batchIndex) => {
        if (response.status === 'fulfilled' && response.value.success && response.value.data) {
          // Ajustar índices para que correspondan a la posición en el array original
          response.value.data.results.forEach((result) => {
            allResults.push({
              ...result,
              index: currentIndex + result.index,
            });
          });
          currentIndex += batches[batchIndex].length;
        } else {
          // Si un batch falla, agregar errores para cada query en ese batch
          batches[batchIndex].forEach((_, queryIndex) => {
            allResults.push({
              index: currentIndex + queryIndex,
              success: false,
              error: response.status === 'rejected' ? String(response.reason) : 'Batch request failed',
            });
          });
          currentIndex += batches[batchIndex].length;
        }
      });

      return {
        success: true,
        data: { results: allResults },
      };
    }

    // Si hay 100 o menos queries, hacer una sola petición
    return apiClient.post<BatchProductResponse>('/api/products/v2/batch', { queries });
  },
};

// Categories API endpoints
export const categoriesEndpoints = {
  getVisibleCategories: (() => {
    let cache: VisibleCategory[] | undefined;
    let inFlight: Promise<void> | null = null;
    let lastError: string | null = null;

    return async (): Promise<ApiResponse<VisibleCategory[]>> => {
      if (cache) {
        return { data: cache, success: true };
      }
      if (inFlight) {
        await inFlight;
        return { data: cache ?? [], success: !lastError, message: lastError || undefined };
      }

      inFlight = (async () => {
        const resp = await apiClient.get<VisibleCategory[]>('/api/categorias/visibles');
        if (resp.success && resp.data) {
          // Ordenar/filtrar activas aquí para que todos los consumidores lo reciban consistente
          cache = (resp.data as VisibleCategory[])
            .filter(c => (c as VisibleCategory).activo)
            .sort((a, b) => a.orden - b.orden);
          lastError = null;
        } else {
          cache = cache || [];
          lastError = resp.message || 'Error al cargar categorías visibles';
        }
      })();

      await inFlight;
      inFlight = null;
      return { data: cache ?? [], success: !lastError, message: lastError || undefined };
    };
  })(),

  getCompleteCategories: (() => {
    let cache: VisibleCategoryComplete[] | undefined;
    let inFlight: Promise<void> | null = null;
    let lastError: string | null = null;

    return async (): Promise<ApiResponse<VisibleCategoryComplete[]>> => {
      if (cache) {
        return { data: cache, success: true };
      }
      if (inFlight) {
        await inFlight;
        return { data: cache ?? [], success: !lastError, message: lastError || undefined };
      }

      inFlight = (async () => {
        const resp = await apiClient.get<VisibleCategoryComplete[]>('/api/categorias/visibles/completas');
        if (resp.success && resp.data) {
          cache = (resp.data as VisibleCategoryComplete[])
            .filter(c => c.activo)
            .sort((a, b) => a.orden - b.orden);
          lastError = null;
        } else {
          cache = cache || [];
          lastError = resp.message || 'Error al cargar categorías completas';
        }
      })();

      await inFlight;
      inFlight = null;
      return { data: cache ?? [], success: !lastError, message: lastError || undefined };
    };
  })(),
};

// Menus API endpoints
// Simple in-memory caches and in-flight maps to dedupe requests
const menusByCategoryCache: Record<string, Menu[] | undefined> = {};
const menusByCategoryInFlight: Record<string, Promise<void> | undefined> = {};

const submenusByMenuCache: Record<string, Submenu[] | undefined> = {};
const submenusByMenuInFlight: Record<string, Promise<void> | undefined> = {};

/**
 * Función helper para poblar el caché de submenús desde la respuesta completa
 * Esto evita múltiples peticiones HTTP al backend
 * Guarda tanto arrays con submenús como arrays vacíos para evitar futuras peticiones
 */
export const populateSubmenusCache = (completeCategories: VisibleCategoryComplete[]): void => {
  completeCategories.forEach((category) => {
    category.menus?.forEach((menu) => {
      if (menu.uuid && menu.submenus !== undefined) {
        // Poblar el caché de submenús directamente (incluyendo arrays vacíos)
        // Esto evita futuras peticiones incluso para menús sin submenús
        submenusByMenuCache[menu.uuid] = menu.submenus;
      }
    });
  });
};

/**
 * Obtiene los submenús desde el caché sin hacer petición HTTP
 * Retorna undefined si no están en caché
 */
export const getSubmenusFromCache = (menuUuid: string): Submenu[] | undefined => {
  return submenusByMenuCache[menuUuid];
};

export const menusEndpoints = {
  getSubmenus: async (menuUuid: string): Promise<ApiResponse<Submenu[]>> => {
    // Return from cache if present
    if (submenusByMenuCache[menuUuid]) {
      return { data: submenusByMenuCache[menuUuid] as Submenu[], success: true };
    }

    // Deduplicate concurrent calls
    if (submenusByMenuInFlight[menuUuid]) {
      await submenusByMenuInFlight[menuUuid];
      return { data: submenusByMenuCache[menuUuid] ?? [], success: true };
    }

    submenusByMenuInFlight[menuUuid] = (async () => {
      const resp = await apiClient.get<Submenu[]>(`/api/menus/visibles/${menuUuid}/submenus`);
      if (resp.success && resp.data) {
        // sort/filter handled by consumers; store as-is
        submenusByMenuCache[menuUuid] = resp.data;
      } else {
        submenusByMenuCache[menuUuid] = [];
      }
    })();

    await submenusByMenuInFlight[menuUuid];
    submenusByMenuInFlight[menuUuid] = undefined;
    return { data: submenusByMenuCache[menuUuid] ?? [], success: true };
  },

  getMenusByCategory: async (categoryUuid: string): Promise<ApiResponse<Menu[]>> => {
    // Return from cache if present
    if (menusByCategoryCache[categoryUuid]) {
      return { data: menusByCategoryCache[categoryUuid] as Menu[], success: true };
    }

    // Deduplicate concurrent calls
    if (menusByCategoryInFlight[categoryUuid]) {
      await menusByCategoryInFlight[categoryUuid];
      return { data: menusByCategoryCache[categoryUuid] ?? [], success: true };
    }

    menusByCategoryInFlight[categoryUuid] = (async () => {
      const resp = await apiClient.get<Menu[]>(`/api/categorias/visibles/${categoryUuid}/menus`);
      if (resp.success && resp.data) {
        menusByCategoryCache[categoryUuid] = resp.data;
      } else {
        menusByCategoryCache[categoryUuid] = [];
      }
    })();

    await menusByCategoryInFlight[categoryUuid];
    menusByCategoryInFlight[categoryUuid] = undefined;
    return { data: menusByCategoryCache[categoryUuid] ?? [], success: true };
  }
};

// Trade-in (Entrego y Estreno) API endpoints
export const tradeInEndpoints = {
  getHierarchy: () => apiClient.get<TradeInCategory[]>('/api/benefits/trade-in/hierarchy'),
  calculateValue: (data: TradeInValueRequest) =>
    apiClient.post<TradeInValueResponse>('/api/benefits/trade-in/value', data),
  checkSkuForTradeIn: (data: { sku: string }) =>
    apiClient.post<TradeInCheckResult>('/api/benefits/trade-in/check-sku', data)
};

// Stores API endpoints
export const storesEndpoints = {
  getAll: (() => {
    let cache: StoresApiResponse | undefined;
    let inFlight: Promise<void> | null = null;
    let lastError: string | null = null;

    return async (): Promise<ApiResponse<StoresApiResponse>> => {
      // Return from cache if available
      if (cache) {
        return { data: cache, success: true };
      }

      // Deduplicate concurrent calls
      if (inFlight) {
        await inFlight;
        return { data: cache ?? [], success: !lastError, message: lastError || undefined };
      }

      inFlight = (async () => {
        const resp = await apiClient.get<StoresApiResponse>('/api/stores');
        if (resp.success && resp.data) {
          cache = resp.data;
          lastError = null;
        } else {
          cache = cache || [];
          lastError = resp.message || 'Error al cargar tiendas';
        }
      })();

      await inFlight;
      inFlight = null;
      return { data: cache ?? [], success: !lastError, message: lastError || undefined };
    };
  })()
};

// Favorite filter
export interface FavoriteFilterParams {
  page?: number;
  limit?: number;
}

// API Response types
export interface ProductApiResponse {
  products: ProductOrBundleApiData[]; // Ahora acepta tanto productos como bundles
  totalItems: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  hasMoreInPage?: boolean; // Indica si hay más productos en la página actual (para lazy loading)
  lazyOffset?: number; // Offset actual usado en la petición
  lazyLimit?: number; // Límite de productos por carga lazy
}

// Producto individual dentro de un bundle
export interface BundleProduct {
  sku: string;
  codigoMarket: string;
  modelo: string;
  imagePreviewUrl?: string;
  imageDetailsUrls?: string[]; // Array de todas las imágenes del producto
  product_original_price: number;
  product_discount_price: number;
  ean?: string;
  color?: string;
  nombreColor?: string;
  capacidad?: string;
  memoriaram?: string;
  stockTotal?: number;
  bundle_price: number;
  bundle_discount: number;
  categoria?: string;
}

// Opción individual dentro de un bundle (variante)
export interface BundleOption {
  product_sku: string; // SKU de esta variante del bundle
  modelo: string; // Nombre del bundle con productos concatenados
  bundle_price: number; // Precio normal del bundle
  bundle_discount: number; // Precio con descuento del bundle
  ind_entre_estre: number;
  skus_bundle: string[]; // SKUs de los productos incluidos en el bundle
  imagePreviewUrl?: string[]; // URLs de las imágenes de preview de los productos del bundle
  productos?: BundleProduct[]; // Array de productos del bundle con detalles completos
  // Campos de variante del producto padre
  colorProductSku?: string; // Color hex del producto (ej: "#3C5B8A")
  nombreColorProductSku?: string; // Nombre del color (ej: "Azul Marino")
  capacidadProductSku?: string; // Capacidad (ej: "256GB")
  memoriaRamProductSku?: string; // RAM (ej: "12GB")
  stockTotal?: number; // Stock disponible para esta variante
}

// Bundle agrupado con múltiples opciones/variantes
export interface BundleApiData {
  isBundle: true;
  baseCodigoMarket: string; // Código base del producto principal
  codCampana: string; // Código de la campaña (ej: "BF001")
  categoria: string | string[]; // Puede venir como string o array
  menu: string | string[]; // Puede venir como string o array
  submenu: string | string[]; // Puede venir como string o array
  fecha_inicio: string;
  fecha_final: string;
  hora_inicio: string;
  hora_final: string;
  opciones: BundleOption[]; // Array de variantes del bundle
  imagePreviewUrl?: string | string[]; // Imagen preview del bundle (puede venir como string o array)
}

export interface ProductApiData {
  isBundle?: false; // Indicador para distinguir de bundles
  codigoMarketBase: string;
  codigoMarket: string[];
  nombreMarket: string[];
  categoria: string;
  subcategoria: string;
  modelo: string[];
  segmento?: string[]; // Campo para identificar productos premium (array)
  color: string[];
  nombreColor?: string[]; // Nombre del color para mostrar (ej: "Negro Medianoche")
  capacidad: string[];
  memoriaram: string[];
  descGeneral: string[];
  sku: string[];
  ean: string[];
  desDetallada: string[];
  stockTotal: number[];
  cantidadTiendas: number[];
  cantidadTiendasReserva: number[];
  urlImagenes: string[];
  urlRender3D: string[];
  imagePreviewUrl: string[];
  imageDetailsUrls: string[][];
  imagenPremium?: string[][]; // Campo para imágenes premium (array de arrays, uno por cada variante)
  videoPremium?: string[][]; // Campo para videos premium (array de arrays, uno por cada variante)
  imagen_premium?: string[][]; // Alias para compatibilidad
  video_premium?: string[][]; // Alias para compatibilidad
  precioNormal: number[];
  precioeccommerce: number[];
  fechaInicioVigencia: string[];
  fechaFinalVigencia: string[];
  indRetoma?: number[]; // Indicador de retoma (0 o 1 por cada variante)
  skuPostback?: string[];
  indcerointeres?: number[];
  ancho?: number[];
  alto?: number[];
  largo?: number[];
  peso?: number[];
  device?: string[]; // Dispositivo al que está dirigido el accesorio (ej: "Galaxy S24", "Galaxy Watch")
  skuflixmedia?: string[]; // SKU para Flixmedia
  visibleStaging?: boolean[]; // Visibilidad en staging (por variante)
  visibleProduction?: boolean[]; // Visibilidad en producción (por variante)
  gama?: string[]; // Gama del producto (ej: "Nuevo", "Linea", "N-1")
  agrupamiento?: string[]; // Campo de agrupamiento alternativo para accesorios (categoría IM)
}

// Tipo unión para productos y bundles
export type ProductOrBundleApiData = ProductApiData | BundleApiData;

// Respuesta directa del endpoint de bundle individual
export interface BundleDirectResponse {
  baseCodigoMarket: string;
  codCampana: string;
  product_sku: string;
  productos: BundleProduct[];
  isBlackFriday?: boolean;
}

export interface FavoriteApiResponse {
  products: ProductApiData[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Batch endpoint types
export interface BatchProductRequest {
  queries: ProductFilterParams[];
}

export interface BatchProductResult {
  index: number;
  success: boolean;
  data?: ProductApiResponse;
  error?: string;
}

export interface BatchProductResponse {
  results: BatchProductResult[];
}

// Visible Categories types (legacy - deprecated)
export interface Subcategoria {
  uuid: string;
  nombre: string;
  nombreVisible: string;
  descripcion: string;
  imagen: string;
  activo: boolean;
  categoriasVisiblesId: string;
  createdAt: string;
  updatedAt: string;
}

export interface VisibleCategory {
  uuid: string;
  nombre: string;
  nombreVisible: string;
  descripcion: string | null;
  imagen: string | null;
  activo: boolean;
  orden: number;
  createdAt: string;
  updatedAt: string;
  totalProducts: number;
  // Legado: subcategorias ya no vienen en el endpoint ligero
  subcategorias?: Subcategoria[];
}

// Complete Visible Categories types (new structure)
export interface Submenu {
  uuid: string;
  nombre: string;
  nombreVisible: string;
  descripcion: string;
  imagen: string;
  activo: boolean;
  orden: number;
  menusVisiblesId: string;
  createdAt: string;
  updatedAt: string;
  totalProducts: number;
}

export interface Menu {
  uuid: string;
  nombre: string;
  nombreVisible: string;
  descripcion: string;
  imagen: string;
  activo: boolean;
  orden: number;
  categoriasVisiblesId: string;
  createdAt: string;
  updatedAt: string;
  submenus: Submenu[];
}

export interface VisibleCategoryComplete {
  uuid: string;
  nombre: string;
  nombreVisible: string;
  descripcion: string;
  imagen: string;
  activo: boolean;
  orden: number;
  createdAt: string;
  updatedAt: string;
  menus: Menu[];
}

// Trade-in (Entrego y Estreno) types
export interface TradeInModel {
  codModelo: string;
  modelo: string;
  capacidad: string;
}

export interface TradeInBrand {
  codMarca: string;
  marca: string;
  maxPrecio: number;
  models: TradeInModel[];
}

export interface TradeInCategory {
  categoria: string;
  maxPrecio: number;
  brands: TradeInBrand[];
}

export interface TradeInValueRequest {
  sku: string; // SKU del producto a comprar
  codMarca: string; // Del dispositivo a entregar
  codModelo: string; // Del dispositivo a entregar
  grado: 'A' | 'B' | 'C'; // Estado del dispositivo a entregar
}

export interface TradeInValueResponse {
  codMarca: string;
  marca: string;
  codModelo: string;
  modelo: string;
  capacidad: string;
  categoria: string;
  grado: 'A' | 'B' | 'C';
  valorRetoma: number;
}

export interface TradeInCheckResult {
  aplica: boolean;
  sku: string;
  indRetoma?: number;
  mensaje?: string;
}

// Candidate stores types
export interface CandidateStore {
  codBodega: string;
  nombre_tienda: string;
  direccion: string;
  place_ID: string;
  distance: number;
  horario: string;
  stock?: number;  // Stock disponible en esta tienda
  ciudad?: string;  // Ciudad de la tienda (puede venir en la respuesta)
  codDane?: string | number;  // Código DANE (puede venir en la respuesta)
  telefono?: string;  // Teléfono de la tienda (puede venir en la respuesta)
  extension?: string;  // Extensión del teléfono (puede venir en la respuesta)
}

export interface DefaultDirection {
  id: string;
  google_place_id: string;
  linea_uno: string;
  ciudad: string;
}

export interface CandidateStoresResponse {
  stores: Record<string, CandidateStore[]>;
  canPickUp: boolean;
  default_direction: DefaultDirection;
}

// Delivery API endpoints
export const deliveryEndpoints = {
  quoteNationalMultiOrigin: (data: MultiOriginQuoteRequest) =>
    apiClient.post<MultiOriginQuoteResponse[]>('/api/deliveries/coordinadora/cotizar-nacional-multi', data),
};

export interface MultiOriginQuoteRequest {
  ciudades_origen: string[];
  ciudad_destino: string;
  cuenta: string;
  producto: string;
  valoracion: string;
  nivel_servicio: number[];
  detalle: {
    ubl: number;
    alto: number;
    ancho: number;
    largo: number;
    peso: number;
    unidades: number;
  }[];
}

export interface MultiOriginQuoteResponse {
  ciudad_origen: string;
  nombre_ciudad: string;
  flete_total: number;
  dias_entrega: number;
  detalles: {
    peso_liquidado: number;
    producto: number;
    ubl: number;
    volumen: number;
    peso_real: number;
  };
}

/**
 * Helper function: Fetch product by codigoMarket
 * Used by ChatProductCard to load full product data
 */
export async function fetchProductByCodigoMarket(codigoMarketBase: string): Promise<ProductOrBundleApiData | null> {
  try {
    const response = await productEndpoints.getByCodigoMarket(codigoMarketBase);

    if (!response.success || !response.data?.products || response.data.products.length === 0) {
      console.warn(`[fetchProductByCodigoMarket] No product found for: ${codigoMarketBase}`);
      return null;
    }

    // Return first product (can be ProductApiData or BundleApiData)
    return response.data.products[0];
  } catch (error) {
    console.error(`[fetchProductByCodigoMarket] Error fetching product:`, error);
    return null;
  }
}
