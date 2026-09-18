/**
 * 🖥️ API Server - Funciones de fetch para Server Components
 *
 * Este archivo contiene funciones que SOLO se ejecutan en el servidor.
 * Usan la opción `next: { revalidate: 60 }` para ISR de 60 segundos.
 *
 * IMPORTANTE: No importar este archivo en componentes con "use client"
 */

import type {
  SearchBundlesResult,
  SearchProductsGroupedResult,
  ProductGrouped,
  ProductBundle,
  CategoriaCompleta,
  Campaign,
} from "./types/api-types";
import type { FormattedStore, Store } from "@/types/store";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://imagiq-backend-production.up.railway.app";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

// Headers por defecto con autenticación
const defaultHeaders: HeadersInit = {
  "Content-Type": "application/json",
  ...(API_KEY && { "X-API-Key": API_KEY }),
};

// Opciones por defecto para ISR de 60 segundos
const defaultFetchOptions: RequestInit = {
  headers: defaultHeaders,
  next: { revalidate: 60 },
};

/**
 * Helper para hacer fetch con manejo de errores
 */
async function serverFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...defaultFetchOptions,
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      console.error(
        `[API Server] Error ${res.status}: ${res.statusText} - ${endpoint}`
      );
      throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    // Si la respuesta tiene estructura { success, data }, extraer data
    if (
      data &&
      typeof data === "object" &&
      "success" in data &&
      "data" in data
    ) {
      if (!data.success) {
        throw new Error(data.message || "API returned success: false");
      }
      return data.data as T;
    }

    return data as T;
  } catch (error) {
    console.error(`[API Server] Fetch failed for ${endpoint}:`, error);
    throw error;
  }
}

// ============================================
// PRODUCTOS
// ============================================

/**
 * Obtiene productos para la página principal
 */
export async function getHomeProducts(
  limit = 20
): Promise<SearchBundlesResult> {
  const params = new URLSearchParams({
    page: "1",
    limit: String(limit),
    precioMin: "1",
  });

  return serverFetch<SearchBundlesResult>(
    `/api/products/v2/filtered?${params}`
  );
}

/**
 * Obtiene los top 10 productos más vendidos
 */
export async function getTop10Products(): Promise<SearchProductsGroupedResult> {
  return serverFetch<SearchProductsGroupedResult>("/api/products/top10");
}

/**
 * Obtiene productos por categoría con filtros opcionales
 */
export async function getProductsByCategory(
  categoria: string,
  menuUuid?: string,
  submenuUuid?: string,
  page = 1,
  limit = 20,
  sortBy?: 'precio' | 'nombre' | 'stock',
  sortOrder?: 'asc' | 'desc'
): Promise<SearchBundlesResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    precioMin: "1",
    categoria,
  });

  if (menuUuid) params.append("menuUuid", menuUuid);
  if (submenuUuid) params.append("submenuUuid", submenuUuid);
  if (sortBy) params.append("sortBy", sortBy);
  if (sortOrder) params.append("sortOrder", sortOrder);

  return serverFetch<SearchBundlesResult>(
    `/api/products/v2/filtered?${params}`
  );
}

/**
 * Obtiene un producto específico por su codigoMarketBase
 */
export async function getProductById(
  codigoMarket: string
): Promise<SearchBundlesResult> {
  const params = new URLSearchParams({
    codigoMarketBase: codigoMarket,
    precioMin: "1",
    limit: "10", // Incluir variantes relacionadas
  });

  return serverFetch<SearchBundlesResult>(
    `/api/products/v2/filtered?${params}`
  );
}

/**
 * Obtiene varios productos por codigoMarketBase, conservando el orden pedido.
 * Los que no existan o no tengan precio se omiten.
 */
export async function getProductsByCodigoMarketBase(
  codigosMarket: string[]
): Promise<SearchBundlesResult["products"]> {
  const unique = Array.from(new Set(codigosMarket.filter(Boolean)));
  if (unique.length === 0) return [];

  // El endpoint filtra por `codigoMarket`; con `codigoMarketBase` ignora el
  // filtro y devuelve el listado general. Por seguridad se verifica además
  // que el producto devuelto sea el pedido.
  const results = await Promise.all(
    unique.map(async (codigo) => {
      try {
        const params = new URLSearchParams({
          codigoMarket: codigo,
          precioMin: "1",
          limit: "10",
        });
        const r = await serverFetch<SearchBundlesResult>(
          `/api/products/v2/filtered?${params}`
        );
        const match = (r?.products ?? []).find((p) => {
          const base =
            "codigoMarketBase" in p
              ? p.codigoMarketBase
              : "baseCodigoMarket" in p
                ? p.baseCodigoMarket
                : undefined;
          return base === codigo;
        });
        return match ?? null;
      } catch {
        return null;
      }
    })
  );

  return results.filter(
    (p): p is SearchBundlesResult["products"][number] => p !== null
  );
}

export async function getProductBySku(
  sku: string
): Promise<SearchBundlesResult> {
  const params = new URLSearchParams({
    sku,
    limit: "5",
  });

  return serverFetch<SearchBundlesResult>(
    `/api/products/v2/filtered?${params}`
  );
}

/**
 * Busca productos por texto (usa Elasticsearch)
 */
export async function searchProducts(
  query: string,
  page = 1,
  limit = 20
): Promise<SearchBundlesResult> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    limit: String(limit),
    precioMin: "1",
  });

  const response = await serverFetch<{ data: SearchBundlesResult }>(
    `/api/products/search/grouped?${params}`
  );

  return response.data;
}

// ============================================
// CATEGORÍAS
// ============================================

/**
 * Obtiene todas las categorías con sus menús y submenús
 */
export async function getCategories(): Promise<CategoriaCompleta[]> {
  return serverFetch<CategoriaCompleta[]>(
    "/api/categorias/visibles/completas"
  );
}

/**
 * Obtiene categorías versión 2
 */
export async function getCategoriesV2(): Promise<CategoriaCompleta[]> {
  return serverFetch<CategoriaCompleta[]>(
    "/api/categorias/v2/visibles/completas"
  );
}

// ============================================
// TIENDAS
// ============================================

/**
 * Obtiene todas las tiendas físicas y las formatea
 */
export async function getStores(): Promise<FormattedStore[]> {
  const stores = await serverFetch<Store[]>("/api/stores");

  // Formatear stores para que tengan el campo position y coordenadas como números
  return stores.map(store => {
    const lat = typeof store.latitud === 'string' ? parseFloat(store.latitud) : store.latitud;
    const lng = typeof store.longitud === 'string' ? parseFloat(store.longitud) : store.longitud;

    const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

    return {
      ...store,
      latitud: hasValidCoords ? lat : 0,
      longitud: hasValidCoords ? lng : 0,
      position: [hasValidCoords ? lat : 0, hasValidCoords ? lng : 0] as [number, number],
    };
  });
}

// ============================================
// CAMPAÑAS / BANNERS
// ============================================

/**
 * Obtiene la campaña activa actual (para banners)
 * Retorna null si no hay campaña activa
 */
export async function getActiveCampaign(): Promise<Campaign | null> {
  try {
    return await serverFetch<Campaign>("/api/campaigns/active-now");
  } catch {
    // Si no hay campaña activa o hay error, retornar null silenciosamente
    return null;
  }
}

/**
 * Obtiene lista de campañas activas
 */
export async function getActiveCampaigns(): Promise<Campaign[]> {
  try {
    return await serverFetch<Campaign[]>("/api/campaigns/active");
  } catch {
    return [];
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Mapeo de slugs de URL a nombres de API
 */
export const slugToApiName: Record<string, string> = {
  "dispositivos-moviles": "Dispositivos Móviles",
  electrodomesticos: "Electrodomésticos",
  "tv-y-audio": "TV y Audio",
  computadores: "Computadores",
  accesorios: "Accesorios",
  // Agregar más según sea necesario
};

/**
 * Encuentra una categoría por su slug de URL
 */
export function findCategoryBySlug(
  categories: CategoriaCompleta[],
  slug: string
): CategoriaCompleta | null {
  const apiName = slugToApiName[slug];
  if (!apiName) {
    // Intentar buscar directamente por nombre o nombreVisible
    return (
      categories.find(
        (c) =>
          c.nombre.toLowerCase() === slug.toLowerCase() ||
          c.nombreVisible?.toLowerCase() === slug.toLowerCase()
      ) || null
    );
  }
  return categories.find((c) => c.nombre === apiName) || null;
}
