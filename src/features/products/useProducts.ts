/**
 * Hooks para manejo de productos
 * - Obtener lista de productos con filtros
 * - Búsqueda de productos
 * - Obtener detalles de producto individual
 * - Manejo de favoritos
 * - Recomendaciones personalizadas
 * - Tracking de visualizaciones de productos
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  productEndpoints,
  ProductFilterParams,
  FavoriteFilterParams,
} from "@/lib/api";
import {
  mapApiProductsToFrontend,
  groupProductsByCategory,
  mapApiProductsAndBundles,
  mapDirectBundleResponseToFrontend,
  BundleCardProps,
  MixedProductItem,
} from "@/lib/productMapper";
import { ProductCardProps } from "@/app/productos/components/ProductCard";
import type { FrontendFilterParams } from "@/lib/sharedInterfaces";
import { productCache } from "@/lib/productCache";
import { connectSocket } from "@/lib/socket";

type ProductFilters = FrontendFilterParams;


type UserInfo = {
  id?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  numero_documento?: string | null;
  rol?: number;
};

interface UseProductsReturn {
  products: ProductCardProps[];
  bundles: BundleCardProps[]; // Nuevo: lista de bundles
  orderedItems: MixedProductItem[]; // Nuevo: items en orden original del API
  groupedProducts: Record<string, ProductCardProps[]>;
  loading: boolean;
  isLoadingMore: boolean; // Estado de carga para lazy loading (append)
  error: string | null;
  totalItems: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  searchProducts: (query: string, page?: number) => Promise<void>;
  filterProducts: (filters: ProductFilters) => Promise<void>;
  loadMore: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  refreshProducts: () => Promise<void>;
  hasMore: boolean; // Hay más productos en la página actual (lazy scroll)
  hasMorePages: boolean; // Hay más páginas disponibles (paginación)
}
interface FavoriteFilters {
  page?: number;
  limit?: number;
}

interface UseFavoritesReturn {
  favorites: string[]; // solo ids
  favoritesAPI: ProductCardProps[]; // productos completos
  loading: boolean;
  error: string | null;
  totalItems: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;

  // acciones con ids
  addToFavorites: (
    id: string,

    guestUserData?: {
      id?:string,
      nombre: string;
      apellido: string;
      email: string;
      telefono: string;
    }
  ) => Promise<UserInfo | undefined>;
  removeFromFavorites: (id: string, guestUserData?: {
      id?:string,
      nombre: string;
      apellido: string;
      email: string;
      telefono: string;
    }) => Promise<void>;
  isFavorite: (id: string) => boolean;

  // acciones con API
  filterFavorites: (filters: FavoriteFilters) => Promise<void>;
  loadMore: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  refreshFavorites: () => Promise<void>;

  hasMore: boolean;
}

export const useProducts = (
  initialFilters?: ProductFilters | (() => ProductFilters) | null
): UseProductsReturn => {
  const [products, setProducts] = useState<ProductCardProps[]>([]);
  const [bundles, setBundles] = useState<BundleCardProps[]>([]); // Nuevo: estado para bundles
  const [orderedItems, setOrderedItems] = useState<MixedProductItem[]>([]); // Nuevo: items en orden original del API
  const [groupedProducts, setGroupedProducts] = useState<
    Record<string, ProductCardProps[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Estado separado para lazy loading
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<ProductFilters>(
    typeof initialFilters === "function"
      ? initialFilters()
      : initialFilters || {}
  );
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string | null>(null);
  // requestId se usa internamente para invalidar peticiones anteriores
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [requestId, setRequestId] = useState(0);
  const [lazyOffset, setLazyOffset] = useState(0);
  const [hasMoreInCurrentPage, setHasMoreInCurrentPage] = useState(true);
  const [hasMoreInPageFromApi, setHasMoreInPageFromApi] = useState<boolean | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const productsRef = useRef<ProductCardProps[]>([]); // Ref para acceder a productos actuales sin causar re-renders
  const previousMenuUuidRef = useRef<string | undefined>(undefined);
  const previousSubmenuUuidRef = useRef<string | undefined>(undefined);
  const previousPageRef = useRef<number | undefined>(undefined);
  const previousFiltersRef = useRef<string | null>(null); // Para detectar cambios en filtros
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true); // Para detectar el primer montaje

  // Función para obtener la ubicación guardada en localStorage
  const getSavedLocation = useCallback(() => {
    try {
      const saved = localStorage.getItem("imagiq_last_location");
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error("Error reading saved location:", error);
      return null;
    }
  }, []);

  // Función para guardar la ubicación actual en localStorage
  const saveLocation = useCallback((categoria?: string, menuUuid?: string, submenuUuid?: string, page?: number) => {
    try {
      const location = {
        categoria,
        menuUuid,
        submenuUuid,
        page: page || 1,
      };
      localStorage.setItem("imagiq_last_location", JSON.stringify(location));
    } catch (error) {
      console.error("Error saving location:", error);
    }
  }, []);

  // Función para verificar si la ubicación cambió
  const hasLocationChanged = useCallback((
    savedLocation: { categoria?: string; menuUuid?: string; submenuUuid?: string; page?: number } | null,
    currentCategoria?: string,
    currentMenuUuid?: string,
    currentSubmenuUuid?: string
  ) => {
    if (!savedLocation) return true;

    return (
      savedLocation.categoria !== currentCategoria ||
      savedLocation.menuUuid !== currentMenuUuid ||
      savedLocation.submenuUuid !== currentSubmenuUuid
    );
  }, []);

  // Función para convertir filtros del frontend a parámetros de API
  const convertFiltersToApiParams = useCallback(
    (filters: ProductFilters, offset?: number): ProductFilterParams => {
      const params: ProductFilterParams = {
        page: filters.page || currentPage,
        limit: filters.limit || 20,
        precioMin: 1, // Siempre filtrar productos con precio mayor a 0 por defecto
      };

      // Agregar parámetros de lazy loading si están definidos
      if (filters.lazyLimit !== undefined) {
        params.lazyLimit = filters.lazyLimit;
      }
      if (offset !== undefined) {
        params.lazyOffset = offset;
      } else if (filters.lazyOffset !== undefined) {
        params.lazyOffset = filters.lazyOffset;
      }

      // Aplicar filtros específicos (pueden sobrescribir el precioMin por defecto)
      if (filters.category) params.categoria = filters.category;
      if (filters.subcategory) params.subcategoria = filters.subcategory;
      if (filters.menuUuid) params.menuUuid = filters.menuUuid;
      if (filters.submenuUuid) params.submenuUuid = filters.submenuUuid;

      // Manejar filtros de precio usando precioMin/precioMax
      if (filters.precioMin !== undefined) {
        params.precioMin = filters.precioMin;
      }

      if (filters.precioMax !== undefined) {
        params.precioMax = filters.precioMax;
      }

      if (filters.color) params.color = filters.color;
      if (filters.nombreColor) params.nombreColor = filters.nombreColor;
      if (filters.capacity) params.capacidad = filters.capacity;
      if (filters.memoriaram) params.memoriaram = filters.memoriaram;
      if (filters.name) params.nombre = filters.name;
      if (filters.withDiscount !== undefined)
        params.conDescuento = filters.withDiscount;
      if (filters.minStock !== undefined) params.stockMinimo = filters.minStock;
      if (filters.descriptionKeyword) {
        // Usar el campo desDetallada para buscar en la descripción detallada
        params.desDetallada = filters.descriptionKeyword;
      }
      if (filters.model) params.modelo = filters.model;
      if (filters.filterMode) params.filterMode = filters.filterMode;

      // Añadir parámetros de ordenamiento
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;

      // CRÍTICO: Copiar todos los campos adicionales que no están mapeados explícitamente
      // Esto incluye los nuevos filtros dinámicos con sintaxis extendida (nombrecolor_equal, etc.)
      const dynamicFilterKeys: string[] = [];
      Object.keys(filters).forEach((key) => {
        // Solo copiar campos que no hayan sido mapeados ya
        if (
          ![
            'page', 'limit', 'lazyLimit', 'lazyOffset',
            'category', 'subcategory', 'menuUuid', 'submenuUuid',
            'precioMin', 'precioMax', 'color', 'nombreColor',
            'capacity', 'memoriaram', 'name', 'withDiscount',
            'minStock', 'descriptionKeyword', 'model', 'filterMode',
            'sortBy', 'sortOrder'
          ].includes(key)
        ) {
          // Copiar el campo directamente (incluye filtros dinámicos con sintaxis extendida)
          const value = (filters as Record<string, string | number | boolean | undefined>)[key];
          // CORRECCIÓN: Filtrar valores null y empty strings para evitar enviar parámetros inválidos
          if (value !== undefined && value !== null && value !== '') {
            (params as ProductFilterParams & Record<string, string | number | boolean>)[key] = value as string | number | boolean;
            dynamicFilterKeys.push(key);
          }
        }
      });

      // Debug: Log para verificar que los filtros dinámicos se están copiando
      if (dynamicFilterKeys.length > 0) {
        console.log('[useProducts] convertFiltersToApiParams - Filtros dinámicos copiados:', {
          dynamicFilterKeys,
          dynamicFilterValues: dynamicFilterKeys.reduce((acc, key) => {
            acc[key] = (filters as Record<string, any>)[key];
            return acc;
          }, {} as Record<string, any>)
        });
      }

      return params;
    },
    [currentPage]
  );

  // Función principal para obtener productos
  const fetchProducts = useCallback(
    async (filters: ProductFilters = {}, append = false, customOffset?: number) => {
      // Incrementar el ID de la petición para invalidar peticiones anteriores
      const currentRequestId = Date.now();
      setRequestId(currentRequestId);

      // Si no es append (carga inicial o cambio de filtros), resetear lazyOffset
      if (!append && customOffset === undefined) {
        setLazyOffset(0);
        setHasMoreInCurrentPage(true);
        setHasMoreInPageFromApi(undefined); // Resetear el estado del API
      }

      const apiParams = convertFiltersToApiParams(filters, customOffset);
        
        // Detectar cambios en menuUuid o submenuUuid para invalidación selectiva de caché
      const currentMenuUuid = apiParams.menuUuid;
      const currentSubmenuUuid = apiParams.submenuUuid;

      // SIMPLIFICADO: Comparación directa para detectar CUALQUIER cambio
      const menuUuidChangedForCache = previousMenuUuidRef.current !== currentMenuUuid;
      const submenuUuidChangedForCache = previousSubmenuUuidRef.current !== currentSubmenuUuid;
      
      if (!append && (menuUuidChangedForCache || submenuUuidChangedForCache)) {
        // Invalidar caché de combinaciones menu+submenu anteriores
        if (previousMenuUuidRef.current) {
          productCache.invalidatePattern((key) => {
            // Invalidar entradas que tengan el menuUuid anterior con cualquier submenuUuid
            const keyParams = productCache.parseCacheKey(key);
            if (!keyParams) return false;
            return keyParams.menuUuid === previousMenuUuidRef.current &&
                   keyParams.submenuUuid !== undefined;
          });
        }
      }

      // CRÍTICO: Actualizar referencias SIEMPRE, no solo cuando se invalida caché
      // Esto asegura que la próxima vez detectemos cambios correctamente
      if (!append) {
        previousMenuUuidRef.current = currentMenuUuid;
        previousSubmenuUuidRef.current = currentSubmenuUuid;
      }
      
      // Verificar caché solo para carga inicial (no para lazy loading)
      // El caché mejora la velocidad percibida al mostrar datos inmediatamente
      let hasCachedData = false;
      
      try {
        if (!append) {
          // Crear una clave única para los filtros (excluyendo page, limit, lazyLimit, lazyOffset)
          // Incluir todos los campos conocidos y también los filtros dinámicos con sintaxis extendida
          const knownFields: Record<string, string | number | boolean | undefined> = {
            categoria: apiParams.categoria,
            menuUuid: apiParams.menuUuid,
            submenuUuid: apiParams.submenuUuid,
            precioMin: apiParams.precioMin,
            precioMax: apiParams.precioMax,
            nombreColor: apiParams.nombreColor,
            capacidad: apiParams.capacidad,
            memoriaram: apiParams.memoriaram,
            nombre: apiParams.nombre,
            desDetallada: apiParams.desDetallada,
            modelo: apiParams.modelo,
            color: apiParams.color,
            conDescuento: apiParams.conDescuento,
            stockMinimo: apiParams.stockMinimo,
          };

          // CRÍTICO: Incluir todos los campos adicionales (filtros dinámicos con sintaxis extendida)
          // Esto asegura que cambios en filtros dinámicos se detecten correctamente
          Object.keys(apiParams).forEach((key) => {
            if (![
              'page', 'limit', 'lazyLimit', 'lazyOffset', 'sortBy', 'sortOrder',
              'categoria', 'menuUuid', 'submenuUuid', 'precioMin', 'precioMax',
              'nombreColor', 'capacidad', 'memoriaram', 'nombre', 'desDetallada',
              'modelo', 'color', 'conDescuento', 'stockMinimo'
            ].includes(key)) {
              const value = (apiParams as Record<string, string | number | boolean | undefined>)[key];
              if (value !== undefined) {
                knownFields[key] = value;
              }
            }
          });

          const filterKey = JSON.stringify(knownFields);
          
          // Debug: Log para verificar que los filtros de rango se incluyen en filterKey
          const hasRangeFilters = Object.keys(knownFields).some(key => key.includes('_range_min') || key.includes('_range_max'));
          if (hasRangeFilters) {
            console.log('[useProducts] filterKey incluye filtros de rango:', {
              filterKey,
              rangeFields: Object.keys(knownFields).filter(key => key.includes('_range_min') || key.includes('_range_max')),
              knownFields
            });
          }
          
          // Detectar cambio de página: comparar filters.page con currentPage
          const isPageChange = filters.page !== undefined && filters.page !== currentPage;

          // Detectar cambio de filtros (no solo página)
          const filtersChanged = previousFiltersRef.current !== null && previousFiltersRef.current !== filterKey;

          // CRÍTICO: Detectar cambios en menuUuid/submenuUuid para limpiar productos inmediatamente
          // Esto previene que se muestren productos de una sección cuando navegas a otra
          const menuSubmenuChanged = menuUuidChangedForCache || submenuUuidChangedForCache;

          // OPTIMIZACIÓN: Verificar caché ANTES de limpiar productos
          // Esto evita mostrar skeletons innecesariamente cuando hay datos en caché disponibles
          const cachedResponse = productCache.get(apiParams);
          const hasValidCache = cachedResponse && cachedResponse.success && cachedResponse.data;

          if (isPageChange || filtersChanged || menuSubmenuChanged) {
            // Si cambian los filtros (no solo la página), siempre mostrar skeletons
            // El caché solo se usa cuando solo cambia la página (sin cambiar filtros)
            if (filtersChanged && !isPageChange) {
              // Cambio de filtros: siempre limpiar productos y mostrar skeletons
              setProducts([]);
              setBundles([]);
              setOrderedItems([]);
              productsRef.current = [];
              setLoading(true);
              setError(null);
              hasCachedData = false;
              // Actualizar referencia de filtros
              previousFiltersRef.current = filterKey;
            } else if (isPageChange && !filtersChanged) {
              // Solo cambio de página (sin cambio de filtros): verificar caché
              if (hasValidCache) {
                // Hay caché disponible: usar datos del caché inmediatamente sin limpiar productos
                hasCachedData = true;
                const apiData = cachedResponse.data;
                const { products: mappedProducts, bundles: mappedBundles, orderedItems: mappedOrderedItems } = mapApiProductsAndBundles(apiData.products);

                // Establecer todos los estados de forma síncrona
                setError(null);
                setProducts(mappedProducts);
                setBundles(mappedBundles);
                setOrderedItems(mappedOrderedItems);
                productsRef.current = mappedProducts;
                setGroupedProducts(groupProductsByCategory(mappedProducts));
                setTotalItems(apiData.totalItems);
                setTotalPages(apiData.totalPages);
                setCurrentPage(apiData.currentPage);
                setHasNextPage(apiData.hasNextPage);
                setHasPreviousPage(apiData.hasPreviousPage);
                if (apiData.hasMoreInPage !== undefined) {
                  setHasMoreInPageFromApi(apiData.hasMoreInPage);
                }
                
                if (!filters.lazyOffset && customOffset === undefined) {
                  setLazyOffset(0);
                  setHasMoreInCurrentPage(true);
                }
                
                setLoading(false);
                // Actualizar referencia de filtros
                previousFiltersRef.current = filterKey;
              } else {
                // No hay caché: limpiar productos, bundles, orderedItems y mostrar skeletons
                setProducts([]);
                setBundles([]);
                setOrderedItems([]);
                productsRef.current = [];
                setLoading(true);
                setError(null);
                hasCachedData = false;
                // Actualizar referencia de filtros
                previousFiltersRef.current = filterKey;
              }
            } else if (menuSubmenuChanged) {
              // Cambio de menú/submenú: siempre limpiar productos y mostrar skeletons
              setProducts([]);
              setBundles([]);
              setOrderedItems([]);
              productsRef.current = [];
              setLoading(true);
              setError(null);
              hasCachedData = false;
              // Actualizar referencia de filtros
              previousFiltersRef.current = filterKey;
            } else {
              // Caso combinado (página + filtros): siempre mostrar skeletons
              setProducts([]);
              setBundles([]);
              setOrderedItems([]);
              productsRef.current = [];
              setLoading(true);
              setError(null);
              hasCachedData = false;
              // Actualizar referencia de filtros
              previousFiltersRef.current = filterKey;
            }
          } else {
            // Primera carga: usar caché si existe
            if (hasValidCache) {
              hasCachedData = true;
              // Usar datos del caché inmediatamente para respuesta rápida (stale-while-revalidate)
              const apiData = cachedResponse.data;
              const { products: mappedProducts, bundles: mappedBundles, orderedItems: mappedOrderedItems } = mapApiProductsAndBundles(apiData.products);

              // IMPORTANTE: Establecer todos los estados de forma síncrona
              // React batch automáticamente los setState en el mismo render,
              // pero establecer loading en false primero asegura que no se muestren skeletons
              setError(null);

              // Establecer productos, bundles, orderedItems y metadatos de forma síncrona
              setProducts(mappedProducts);
              setBundles(mappedBundles); // Nuevo: establecer bundles
              setOrderedItems(mappedOrderedItems); // Nuevo: establecer orderedItems (orden original del API)
              productsRef.current = mappedProducts; // Actualizar ref
              setGroupedProducts(groupProductsByCategory(mappedProducts));
              setTotalItems(apiData.totalItems);
              setTotalPages(apiData.totalPages);
              setCurrentPage(apiData.currentPage);
              setHasNextPage(apiData.hasNextPage);
              setHasPreviousPage(apiData.hasPreviousPage);
              // Guardar hasMoreInPage del API si está disponible
              if (apiData.hasMoreInPage !== undefined) {
                setHasMoreInPageFromApi(apiData.hasMoreInPage);
              }
              
              // Resetear estados
              if (!filters.lazyOffset && customOffset === undefined) {
                setLazyOffset(0);
                setHasMoreInCurrentPage(true);
              }
              
              // IMPORTANTE: Establecer loading en false AL FINAL para que React
              // actualice todos los estados juntos, evitando mostrar skeletons
              setLoading(false);
              
              // Si hay datos en caché, aún así hacer la llamada API en background
              // para actualizar datos frescos (stale-while-revalidate)
              // Pero NO limpiar productos ni mostrar loading
            } else {
              // No hay caché, mostrar loading normalmente
              // Limpiar productos, bundles y orderedItems para mostrar skeletons
              setLoading(true);
              setError(null);
              setProducts([]);
              setBundles([]); // Limpiar bundles también
              setOrderedItems([]); // Limpiar orderedItems también
              productsRef.current = []; // Actualizar ref
              // Actualizar referencia de filtros
              previousFiltersRef.current = filterKey;
            }
          }
        } else {
          // Para lazy loading, mostrar loading normalmente
          setIsLoadingMore(true);
          setError(null);
        }

        // No abortar peticiones anteriores - permitir que se completen
        // La verificación de requestId asegura que solo se procesen respuestas de peticiones recientes
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await productEndpoints.getFilteredV2(apiParams, { signal: controller.signal });

        // Capturar el valor de hasCachedData para usar en el callback
        const wasCached = hasCachedData;

        // Verificar si esta petición sigue siendo válida comparando con el ID más reciente
        setRequestId((latestRequestId) => {
          // Si hay una petición más nueva, ignorar esta respuesta
          if (currentRequestId < latestRequestId) {
            return latestRequestId;
          }

          // Esta es la petición más reciente, procesar la respuesta
          if (response.success && response.data) {
            // Guardar en caché solo para carga inicial (no para lazy loading)
            // El lazy loading es incremental y no debería cacharse individualmente
            if (!append) {
              productCache.set(apiParams, response);
            }
            
            const apiData = response.data;
            const { products: mappedProducts, bundles: mappedBundles, orderedItems: mappedOrderedItems } = mapApiProductsAndBundles(apiData.products);

            if (append) {
              // Append para lazy loading
              setProducts((prev) => {
                // Crear un Set con los IDs existentes para evitar duplicados
                const existingIds = new Set(prev.map(p => p.id));
                // Filtrar solo los productos nuevos que no existen
                const newProducts = mappedProducts.filter(p => !existingIds.has(p.id));
                const updatedProducts = [...prev, ...newProducts];
                productsRef.current = updatedProducts; // Actualizar ref

                // Verificar si todavía hay más productos que cargar
                const lazyLimit = filters.lazyLimit || 6;
                const limit = filters.limit || 50; // Usar el limit real de los filtros (no fallback a 20)
                const currentOffset = customOffset !== undefined ? customOffset : (filters.lazyOffset || 0);
                const nextOffset = currentOffset + lazyLimit;
                
                // Calcular el total de productos cargados hasta ahora (incluyendo los nuevos)
                const totalLoaded = updatedProducts.length;

                // Usar hasMoreInPage del API como fuente principal de verdad
                // Si está disponible, usarlo directamente; si no, usar la lógica de fallback
                const shouldStop = apiData.hasMoreInPage !== undefined
                  ? !apiData.hasMoreInPage // Si el API dice que no hay más, detener
                  : (newProducts.length === 0 || 
                     totalLoaded >= limit || 
                     nextOffset >= limit || 
                     (apiData.totalItems > 0 && nextOffset >= apiData.totalItems));

                if (shouldStop) {
                  setHasMoreInCurrentPage(false);
                }

                return updatedProducts;
              });

              // Append bundles también
              setBundles((prev) => {
                const existingIds = new Set(prev.map(b => b.id));
                const newBundles = mappedBundles.filter(b => !existingIds.has(b.id));
                return [...prev, ...newBundles];
              });

              // Append orderedItems también (preserva el orden del API)
              setOrderedItems((prev) => {
                const existingIds = new Set(prev.map(item => item.id));
                const newItems = mappedOrderedItems.filter(item => !existingIds.has(item.id));
                return [...prev, ...newItems];
              });
            } else {
              // Solo actualizar productos si no había datos del caché o si los datos son diferentes
              // Esto evita "parpadeo" cuando los datos del caché ya están mostrados
              if (!wasCached) {
                setProducts(mappedProducts);
                setBundles(mappedBundles); // Actualizar bundles también
                setOrderedItems(mappedOrderedItems); // Actualizar orderedItems (orden original del API)
                productsRef.current = mappedProducts; // Actualizar ref
                setGroupedProducts(groupProductsByCategory(mappedProducts));
                // Resetear offset y estado cuando no es append
                if (!filters.lazyOffset && customOffset === undefined) {
                  setLazyOffset(0);
                  setHasMoreInCurrentPage(true);
                }
              } else {
                // Si había caché, solo actualizar si los datos son realmente diferentes
                // Comparar por cantidad de productos o IDs para evitar actualizaciones innecesarias
                setProducts((prev) => {
                  // Si los productos son diferentes, actualizar
                  const prevIds = new Set(prev.map(p => p.id));
                  const newIds = new Set(mappedProducts.map(p => p.id));
                  const areDifferent =
                    prev.length !== mappedProducts.length ||
                    !Array.from(prevIds).every(id => newIds.has(id)) ||
                    !Array.from(newIds).every(id => prevIds.has(id));

                  if (areDifferent) {
                    productsRef.current = mappedProducts; // Actualizar ref
                    return mappedProducts;
                  }
                  return prev; // Mantener productos actuales si son los mismos
                });

                // Actualizar bundles también si son diferentes
                setBundles((prev) => {
                  const prevIds = new Set(prev.map(b => b.id));
                  const newIds = new Set(mappedBundles.map(b => b.id));
                  const areDifferent =
                    prev.length !== mappedBundles.length ||
                    !Array.from(prevIds).every(id => newIds.has(id)) ||
                    !Array.from(newIds).every(id => prevIds.has(id));

                  return areDifferent ? mappedBundles : prev;
                });

                // Actualizar orderedItems también si son diferentes
                setOrderedItems((prev) => {
                  const prevIds = new Set(prev.map(item => item.id));
                  const newIds = new Set(mappedOrderedItems.map(item => item.id));
                  const areDifferent =
                    prev.length !== mappedOrderedItems.length ||
                    !Array.from(prevIds).every(id => newIds.has(id)) ||
                    !Array.from(newIds).every(id => prevIds.has(id));

                  return areDifferent ? mappedOrderedItems : prev;
                });

                // Siempre actualizar metadatos (totalItems, paginación, etc.)
                setGroupedProducts(groupProductsByCategory(mappedProducts));
                if (!filters.lazyOffset && customOffset === undefined) {
                  setLazyOffset(0);
                  setHasMoreInCurrentPage(true);
                }
              }
            }

            setTotalItems(apiData.totalItems);
            setTotalPages(apiData.totalPages);
            setCurrentPage(apiData.currentPage);
            setHasNextPage(apiData.hasNextPage);
            setHasPreviousPage(apiData.hasPreviousPage);
            // Guardar hasMoreInPage del API si está disponible
            if (apiData.hasMoreInPage !== undefined) {
              setHasMoreInPageFromApi(apiData.hasMoreInPage);
            }
          } else {
            setError(response.message || "Error al cargar productos");
          }

          // Resetear el estado de carga correspondiente
          if (append) {
            setIsLoadingMore(false);
          } else {
            // Solo poner loading en false si no había caché (si había caché, ya se puso en false antes)
            if (!wasCached) {
              setLoading(false);
            }
          }
          return currentRequestId;
        });
      } catch (err) {
        // Ignorar aborts como errores visibles
        // @ts-expect-error 'name' puede existir si es AbortError
        if (err?.name === 'AbortError' || (err instanceof Error && err.message.includes('aborted'))) {
          // Silenciar errores de abort - son esperados cuando el usuario cambia de filtros rápidamente
          // Resetear isLoadingMore si estaba en true para evitar que los skeletons queden cargando
          if (append) {
            setIsLoadingMore(false);
          }
          return;
        }
        console.error("Error fetching products:", err);
        setRequestId((latestRequestId) => {
          if (currentRequestId >= latestRequestId) {
            setError("Error de conexión al cargar productos");
            // Resetear el estado de carga correspondiente
            if (append) {
              setIsLoadingMore(false);
            } else {
              setLoading(false);
            }
            return currentRequestId;
          }
          return latestRequestId;
        });
      }
    },
    [convertFiltersToApiParams]
  );

  // Función para buscar productos
  const searchProducts = useCallback(
    async (query: string, page: number = 1) => {
      setLoading(true);
      setError(null);
      setCurrentSearchQuery(query);
      setCurrentPage(page);
      // Limpiar productos para mostrar skeletons
      setProducts([]);

      try {
        const searchParams = {
          precioMin: 1,
          page: page,
          limit: 50,
        };

        const response = await productEndpoints.search(query, searchParams);

        if (response.success && response.data) {
          const apiData = response.data;
          const mappedProducts = mapApiProductsToFrontend(apiData.products);

          setProducts(mappedProducts);
          setGroupedProducts(groupProductsByCategory(mappedProducts));
          setTotalItems(apiData.totalItems);
          setTotalPages(apiData.totalPages);
          setCurrentPage(apiData.currentPage);
          setHasNextPage(apiData.hasNextPage);
          setHasPreviousPage(apiData.hasPreviousPage);
        } else {
          setError(response.message || "Error al buscar productos");
        }
      } catch (err) {
        console.error("Error searching products:", err);
        setError("Error de conexión al buscar productos");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Función para filtrar productos
  const filterProducts = useCallback(
    async (filters: ProductFilters) => {
      setCurrentFilters(filters);
      // Solo resetear a página 1 si no se especifica una página en los filtros
      if (!filters.page) {
        setCurrentPage(1);
      }
      // Resetear offset y estado cuando se cambian filtros
      setLazyOffset(0);
      setHasMoreInCurrentPage(true);
      setHasMoreInPageFromApi(undefined); // Resetear el estado del API
      await fetchProducts(filters, false, 0);
    },
    [fetchProducts]
  );

  // Función para cargar más productos (paginación con lazy loading)
  const loadMore = useCallback(async () => {
    if (!loading && !isLoadingMore) {
      if (currentSearchQuery) {
        // Si estamos en modo búsqueda, usar paginación tradicional
        if (hasNextPage) {
          const nextPage = currentPage + 1;
          await searchProducts(currentSearchQuery, nextPage);
        }
      } else {
        // Si usamos lazy loading dentro de la página actual
        const lazyLimit = currentFilters.lazyLimit || 6;
        const limit = currentFilters.limit; // Usar el limit real de los filtros (sin fallback a 20)

        // Si no hay limit definido, no podemos hacer lazy loading
        if (!limit) {
          return;
        }

        // Calcular el nuevo offset
        const newOffset = lazyOffset + lazyLimit;
        
        // Calcular cuántos productos ya están cargados
        const currentProductsCount = productsRef.current.length;

        // Verificar si podemos cargar más productos:
        // 1. El nuevo offset debe ser menor (estricto) al límite de la página
        // 2. No debemos haber cargado ya todos los productos de la página (currentProductsCount < limit, estricto)
        // 3. Si hay totalItems, el nuevo offset debe ser menor que totalItems
        // 4. Si el API dice que hay más productos (hasMoreInPageFromApi), respetarlo
        const canLoadMore = 
          newOffset < limit && 
          currentProductsCount < limit &&
          (totalItems === 0 || newOffset < totalItems) &&
          (hasMoreInPageFromApi === undefined || hasMoreInPageFromApi === true);

        if (canLoadMore) {
          // Continuar en la misma página con nuevo offset
          setLazyOffset(newOffset);
          await fetchProducts(currentFilters, true, newOffset);
        } else {
          // Ya no hay más productos en la página actual
          setHasMoreInCurrentPage(false);
          setIsLoadingMore(false); // Resetear el estado de carga para ocultar skeletons
        }
      }
    }
  }, [hasNextPage, loading, isLoadingMore, currentPage, currentSearchQuery, currentFilters, lazyOffset, totalItems, hasMoreInPageFromApi, fetchProducts, searchProducts]);

  // Función para ir a una página específica
  const goToPage = useCallback(
    async (page: number) => {
      if (page >= 1 && page <= totalPages && !loading) {
        if (currentSearchQuery) {
          // Si estamos en modo búsqueda, usar searchProducts
          await searchProducts(currentSearchQuery, page);
        } else {
          // Resetear offset y estado al cambiar de página manualmente
          setLazyOffset(0);
          setHasMoreInCurrentPage(true);
          setHasMoreInPageFromApi(undefined); // Resetear el estado del API
          setIsLoadingMore(false); // Resetear el estado de carga al cambiar de página
          const filtersWithPage = { ...currentFilters, page };
          setCurrentFilters(filtersWithPage);
          await fetchProducts(filtersWithPage, false, 0);
        }
      }
    },
    [totalPages, loading, currentSearchQuery, currentFilters, fetchProducts, searchProducts]
  );

  // Función para refrescar productos con filtros dinámicos
  const refreshProducts = useCallback(async () => {
    if (currentSearchQuery) {
      // Si estamos en modo búsqueda, refrescar la búsqueda actual
      await searchProducts(currentSearchQuery, currentPage);
    } else {
      // Resetear offset y estado al refrescar
      setLazyOffset(0);
      setHasMoreInCurrentPage(true);
      setHasMoreInPageFromApi(undefined); // Resetear el estado del API
      setIsLoadingMore(false); // Resetear el estado de carga al refrescar
      const filtersToUse =
        typeof initialFilters === "function" ? initialFilters() : currentFilters;
      
      // Invalidar caché para los filtros actuales para forzar actualización fresca
      const apiParams = convertFiltersToApiParams(filtersToUse, 0);
      productCache.invalidate(apiParams);
      
      await fetchProducts(filtersToUse, false, 0);
    }
  }, [initialFilters, currentFilters, currentSearchQuery, currentPage, fetchProducts, searchProducts, convertFiltersToApiParams]);

  // Keep a stable ref to refreshProducts so the socket listener doesn't re-register
  const refreshProductsRef = useRef(refreshProducts);
  refreshProductsRef.current = refreshProducts;

  // Listen for real-time product updates (e.g. visibility changes from dashboard)
  // When received, clear the in-memory cache and refetch fresh data
  useEffect(() => {
    const socket = connectSocket('products');

    const handleProductsUpdated = (data?: { codigoMarketBase?: string; visibleProduction?: boolean; visibleStaging?: boolean }) => {
      const env = process.env.NEXT_PUBLIC_ENVIRONMENT || 'production';
      const visibilityField = env === 'staging' ? 'visibleStaging' : 'visibleProduction';
      const newVisibility = data?.[visibilityField];
      const codigoMarketBase = data?.codigoMarketBase;

      console.log('[useProducts] products_updated received', {
        rawData: data,
        env,
        visibilityField,
        newVisibility,
        codigoMarketBase,
        currentProductCount: products.length,
      });

      productCache.clear();

      if (codigoMarketBase !== undefined && newVisibility !== undefined) {
        if (newVisibility === false) {
          // HIDE: Remove product from current state immediately (instant, no HTTP request)
          console.log(`[useProducts] HIDING product ${codigoMarketBase} instantly`);
          setProducts(prev => {
            const filtered = prev.filter(p => {
              // Match by product base ID (codigoMarketBase)
              if (p.id === codigoMarketBase) return false;
              // Also match if the value is a variant SKU (check against all color SKUs)
              if (p.colors?.some(c => c.sku === codigoMarketBase)) return false;
              return true;
            });
            console.log(`[useProducts] Products: ${prev.length} -> ${filtered.length}`);
            return filtered;
          });
          setTotalItems(prev => Math.max(0, prev - 1));
        } else {
          // SHOW: Product data not in state, refetch to get it
          console.log(`[useProducts] SHOWING product ${codigoMarketBase}, refetching...`);
          refreshProductsRef.current();
        }
      } else {
        // Fallback: no visibility details, just refetch
        console.log('[useProducts] No visibility details in payload, falling back to refetch');
        refreshProductsRef.current();
      }
    };

    socket.on('products_updated', handleProductsUpdated);

    return () => {
      socket.off('products_updated', handleProductsUpdated);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar productos iniciales y cuando cambien los filtros
  useEffect(() => {
    // Si initialFilters es null, no hacer fetch inicial
    if (initialFilters === null) {
      return;
    }

    // Limpiar timer de debounce anterior si existe
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce para evitar múltiples peticiones cuando cambian filtros rápidamente
    debounceTimerRef.current = setTimeout(() => {
      let filtersToUse =
        typeof initialFilters === "function"
          ? initialFilters()
          : initialFilters || {};

      // En el primer montaje, verificar si debemos restaurar la página guardada
      if (isInitialMount.current) {
        const savedLocation = getSavedLocation();
        const currentCategoria = filtersToUse.category;
        const currentMenuUuid = filtersToUse.menuUuid;
        const currentSubmenuUuid = filtersToUse.submenuUuid;

        // Verificar si la ubicación cambió
        const locationChanged = hasLocationChanged(
          savedLocation,
          currentCategoria,
          currentMenuUuid,
          currentSubmenuUuid
        );

        if (locationChanged) {
          // Si cambió la ubicación, empezar desde página 1
          filtersToUse = { ...filtersToUse, page: 1 };
          saveLocation(currentCategoria, currentMenuUuid, currentSubmenuUuid, 1);
        } else if (savedLocation?.page && !filtersToUse.page) {
          // Si no cambió y no se especificó página, usar la página guardada
          filtersToUse = { ...filtersToUse, page: savedLocation.page };
        } else {
          // Guardar la ubicación actual
          saveLocation(currentCategoria, currentMenuUuid, currentSubmenuUuid, filtersToUse.page || 1);
        }

        isInitialMount.current = false;
      }

      // Detectar si cambian parámetros críticos (menuUuid, submenuUuid)
      const apiParams = convertFiltersToApiParams(filtersToUse);
      const currentMenuUuid = apiParams.menuUuid;
      const currentSubmenuUuid = apiParams.submenuUuid;
      const currentCategoria = apiParams.categoria;
      const requestedPage = filtersToUse.page || 1;

      // Guardar la ubicación actual cuando cambia cualquier parámetro
      if (!isInitialMount.current) {
        saveLocation(currentCategoria, currentMenuUuid, currentSubmenuUuid, requestedPage);
      }

      // Detectar cambio de página
      const pageChanged = previousPageRef.current !== undefined && previousPageRef.current !== requestedPage;
      
      // Detectar si seccion cambia a vacía (navegación a categoría base)
      // Cuando menuUuid y submenuUuid cambian a undefined, significa que navegamos de menu/submenu a categoría base
      // Esto es crítico porque necesitamos reemplazar los filtros completamente
      const seccionBecameEmpty = 
        previousMenuUuidRef.current !== undefined && 
        currentMenuUuid === undefined;
      
      // Detectar cambios críticos usando comparación estricta que maneja undefined correctamente
      // Necesitamos detectar cuando cambia de valor a undefined, o de undefined a valor, o entre valores diferentes
      const menuUuidChanged = 
        (previousMenuUuidRef.current === undefined) !== (currentMenuUuid === undefined) ||
        (previousMenuUuidRef.current !== undefined && currentMenuUuid !== undefined && previousMenuUuidRef.current !== currentMenuUuid);
      
      const submenuUuidChanged = 
        (previousSubmenuUuidRef.current === undefined) !== (currentSubmenuUuid === undefined) ||
        (previousSubmenuUuidRef.current !== undefined && currentSubmenuUuid !== undefined && previousSubmenuUuidRef.current !== currentSubmenuUuid);
      
      // Si seccion se vuelve vacía (navegación a categoría base), también es un cambio crítico
      const criticalParamsChanged = menuUuidChanged || submenuUuidChanged || seccionBecameEmpty;
      
      if (criticalParamsChanged) {
        // Reemplazar completamente los filtros cuando cambian parámetros críticos
        setCurrentFilters(filtersToUse);
      } else {
        // Para cambios menores (paginación, ordenamiento, filtros), hacer merge
        setCurrentFilters((prevFilters) => ({
          ...prevFilters,
          ...filtersToUse,
        }));
      }
      
      // Actualizar referencias siempre después de procesar
      // Esto asegura que la próxima vez detectemos cambios correctamente, incluso cuando cambia a undefined
      previousMenuUuidRef.current = currentMenuUuid;
      previousSubmenuUuidRef.current = currentSubmenuUuid;
      previousPageRef.current = requestedPage;
      
      // Llamar fetchProducts - este limpiará productos y mostrará skeletons si cambian los filtros
      fetchProducts(filtersToUse, false);
    }, 300); // Debounce de 300ms para cambios de filtros

    // Cleanup: limpiar timer si el componente se desmonta o cambian las dependencias
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [initialFilters, fetchProducts, convertFiltersToApiParams, getSavedLocation, hasLocationChanged, saveLocation]);

  return {
    products,
    bundles, // Retornar bundles separados
    orderedItems, // Retornar items en orden original del API
    groupedProducts,
    loading,
    isLoadingMore,
    error,
    totalItems,
    totalPages,
    currentPage,
    hasNextPage,
    hasPreviousPage,
    searchProducts,
    filterProducts,
    loadMore,
    goToPage,
    refreshProducts,
    hasMore: hasMoreInCurrentPage, // Hay más productos en la página actual (para lazy scroll)
    hasMorePages: hasNextPage, // Hay más páginas (para paginación)
  };
};

export const useProduct = (productId: string) => {
  const [product, setProduct] = useState<ProductCardProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductCardProps[]>([]);

  // Reset sincrónico durante el render: useEffect corre DESPUÉS del render,
  // así que sin esto los componentes ven product/loading stale del producto anterior
  // durante el primer render tras SPA navigation → MPN incorrecto para Flixmedia.
  const [currentProductId, setCurrentProductId] = useState(productId);
  if (currentProductId !== productId) {
    setCurrentProductId(productId);
    setProduct(null);
    setLoading(true);
    setError(null);
    setRelatedProducts([]);
  }

  useEffect(() => {
    // Flag para evitar actualizaciones después de unmount
    let isMounted = true;

    // Resetear estado inmediatamente
    setProduct(null);
    setLoading(true);
    setError(null);
    setRelatedProducts([]);

    const fetchProduct = async () => {
      if (!productId) {
        if (isMounted) {
          setLoading(false);
          setError("ID de producto no válido");
        }
        return;
      }

      // Verificar si hay datos en cache primero
      const cachedResponse = productCache.getSingleProduct(productId);

      if (cachedResponse && cachedResponse.success && cachedResponse.data) {
        // Usar datos del cache inmediatamente
        const apiData = cachedResponse.data;
        
        // La API puede devolver los productos en 'products' o en 'allGroupedProducts'
        const cachedProducts = apiData.products || (apiData as { allGroupedProducts?: typeof apiData.products })?.allGroupedProducts;
        
        // Validar que products exista
        if (!cachedProducts || !Array.isArray(cachedProducts)) {
          console.warn('[useProduct] Cache inválido, limpiando...');
          productCache.clear();
          // Continuar con la petición normal
        } else {
          const mappedProducts = mapApiProductsToFrontend(cachedProducts);

          if (mappedProducts.length > 0) {
            const foundProduct = mappedProducts[0];
            setProduct(foundProduct);
            setError(null);

            // Obtener productos relacionados
            const modelBase =
              foundProduct.name.split(" ")[1] ||
              foundProduct.name.split(" ")[0];
            const related = mappedProducts
              .filter(
                (p) => p.name.includes(modelBase) && p.id !== foundProduct.id
              )
              .slice(0, 4);
            setRelatedProducts(related);

            // Mostrar datos del cache inmediatamente
            setLoading(false);

            // Actualizar en background (stale-while-revalidate)
            // No bloquear la UI, solo actualizar los datos si cambiaron
            productEndpoints.getByCodigoMarket(productId)
              .then(response => {
                const freshProducts = response.data?.products || (response.data as { allGroupedProducts?: typeof response.data.products })?.allGroupedProducts;
                if (response.success && response.data && freshProducts && freshProducts.length > 0) {
                  const freshMappedProducts = mapApiProductsToFrontend(freshProducts);

                  if (freshMappedProducts.length > 0) {
                    const freshProduct = freshMappedProducts[0];

                    // Solo actualizar si los datos son diferentes
                    setProduct(prev => {
                      if (!prev || JSON.stringify(prev) !== JSON.stringify(freshProduct)) {
                        return freshProduct;
                      }
                      return prev;
                    });

                    // Actualizar cache con datos frescos
                    productCache.setSingleProduct(productId, response, 10 * 60 * 1000);

                    // Actualizar productos relacionados
                    const modelBase = freshProduct.name.split(" ")[1] || freshProduct.name.split(" ")[0];
                    const related = freshMappedProducts
                      .filter((p) => p.name.includes(modelBase) && p.id !== freshProduct.id)
                      .slice(0, 4);
                    setRelatedProducts(related);
                  }
                }
              })
              .catch(err => {
                console.debug('[useProduct] Error al actualizar producto en background:', err);
                // No mostrar error, ya tenemos datos del cache
              });

            return; // Salir temprano, ya mostramos los datos del cache
          }
        }
      }

      // No hay cache, hacer petición normal con loading
      setLoading(true);
      setError(null);

      try {
        const codigoMarketBase = productId;

        // Primer load vía proxy cacheado server-side (/api/pcache/product):
        // el Data Cache de Next comparte la respuesta entre TODOS los usuarios,
        // así que tras el primer visitante de un producto la respuesta llega en
        // ~20-80ms en vez de pagar Railway completo (~0.3-1.5s). Si falla por
        // cualquier razón, fallback transparente al endpoint directo.
        // La frescura (precio/stock) la corrige el refresh en background de abajo.
        let cameFromPcache = false;
        const fetchViaPcache = async (): Promise<Awaited<ReturnType<typeof productEndpoints.getByCodigoMarket>> | null> => {
          try {
            const res = await fetch(`/api/pcache/product?codigoMarket=${encodeURIComponent(codigoMarketBase)}`);
            if (!res.ok) return null;
            const raw = await res.json();
            // Replicar la normalización de ApiClient.request: el backend puede
            // devolver { success, data, ... } o el payload directo
            if (raw && typeof raw === "object" && "success" in raw) {
              return { data: raw.data, success: !!raw.success, message: raw.message, errors: raw.errors };
            }
            return { data: raw, success: true };
          } catch {
            return null;
          }
        };

        const pcacheResponse = await fetchViaPcache();
        cameFromPcache = pcacheResponse !== null && pcacheResponse.success;
        const response = cameFromPcache && pcacheResponse
          ? pcacheResponse
          : await productEndpoints.getByCodigoMarket(codigoMarketBase);

        // La API puede devolver los productos en 'products' o en 'allGroupedProducts'
        const productsArray = response.data?.products || (response.data as { allGroupedProducts?: typeof response.data.products })?.allGroupedProducts;

        if (response.success && response.data && productsArray && productsArray.length > 0) {
          const mappedProducts = mapApiProductsToFrontend(productsArray);

          if (mappedProducts.length > 0) {
            const foundProduct = mappedProducts[0]; // Tomar el primer producto encontrado
            if (isMounted) setProduct(foundProduct);

            // Guardar en cache
            productCache.setSingleProduct(productId, response, 10 * 60 * 1000);

            // Obtener productos relacionados (otros productos con el mismo modelo base)
            const modelBase =
              foundProduct.name.split(" ")[1] ||
              foundProduct.name.split(" ")[0];
            const related = mappedProducts
              .filter(
                (p) => p.name.includes(modelBase) && p.id !== foundProduct.id
              )
              .slice(0, 4);
            if (isMounted) setRelatedProducts(related);

            // Si vino del proxy cacheado (hasta 2 min de antigüedad), refrescar
            // en background contra el endpoint directo — mismo patrón SWR que el
            // camino de cache in-memory de arriba
            if (cameFromPcache) {
              productEndpoints.getByCodigoMarket(codigoMarketBase)
                .then((fresh) => {
                  const freshProducts = fresh.data?.products || (fresh.data as { allGroupedProducts?: typeof fresh.data.products })?.allGroupedProducts;
                  if (!fresh.success || !freshProducts || freshProducts.length === 0) return;
                  const freshMapped = mapApiProductsToFrontend(freshProducts);
                  if (freshMapped.length === 0) return;
                  productCache.setSingleProduct(productId, fresh, 10 * 60 * 1000);
                  if (isMounted) {
                    setProduct((prev) => {
                      if (!prev || JSON.stringify(prev) !== JSON.stringify(freshMapped[0])) {
                        return freshMapped[0];
                      }
                      return prev;
                    });
                  }
                })
                .catch(() => { /* ya tenemos datos del proxy cacheado */ });
            }
          } else {
            if (isMounted) setError("Producto no encontrado");
          }
        } else {
          if (isMounted) setError("Error al obtener datos del producto");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        if (isMounted) setError("Error al cargar el producto");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  return {
    product,
    loading,
    error,
    relatedProducts,
  };
};

/**
 * Hook para obtener un bundle específico por sus 3 parámetros
 * @param baseCodigoMarket - Código base del producto principal
 * @param codCampana - Código de la campaña
 * @param productSku - SKU de la opción del bundle
 * @returns Bundle, loading state, y error state
 */
export const useBundle = (baseCodigoMarket: string, codCampana: string, productSku: string) => {
  const [bundle, setBundle] = useState<BundleCardProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBundle = async () => {
      // No hay cache, hacer petición normal con loading
      setLoading(true);
      setError(null);

      try {
        // Buscar el bundle por sus 3 parámetros
        const response = await productEndpoints.getBundleById(baseCodigoMarket, codCampana, productSku);

        if (response.success && response.data) {
          const apiData = response.data;
          const mappedBundle = mapDirectBundleResponseToFrontend(apiData);

          setBundle(mappedBundle);
          setError(null);
        } else {
          setError("Bundle no encontrado");
        }
      } catch (err) {
        console.error("Error fetching bundle:", err);
        setError("Error al cargar el bundle");
      } finally {
        setLoading(false);
      }
    };

    if (baseCodigoMarket && codCampana && productSku) {
      fetchBundle();
    } else {
      setLoading(false);
      setError("Parámetros de bundle no válidos");
    }
  }, [baseCodigoMarket, codCampana, productSku]);

  return {
    bundle,
    loading,
    error,
  };
};

export const useFavorites = (userId?: string,
  initialFilters?: FavoriteFilters | (() => FavoriteFilters)
): UseFavoritesReturn => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [favoritesAPI, setFavoritesAPI] = useState<ProductCardProps[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  const [currentFilters, setCurrentFilters] = useState<FavoriteFilters>(
    typeof initialFilters === "function"
      ? initialFilters()
      : initialFilters || {}
  );

  // Convertir filtros a API
  const convertFiltersToApiParams = useCallback(
    (filters: FavoriteFilters): FavoriteFilterParams => {
      return {
        page: filters.page || currentPage,
        limit: filters.limit || 12,
      };
    },
    [currentPage]
  );

  // Cargar favoritos desde localStorage y sincronizar cambios
  useEffect(() => {
    const loadFavorites = () => {
      try {
        const savedFavorites = localStorage.getItem("imagiq_favorites");
        if (savedFavorites) {
          const parsed = JSON.parse(savedFavorites);
          if (Array.isArray(parsed)) {
            setFavorites(parsed);
          } else {
            setFavorites([]);
          }
        } else {
          setFavorites([]);
        }
      } catch (error) {
        console.error("Error loading favorites from localStorage:", error);
        setFavorites([]);
      }
    };
    
    // Cargar favoritos al montar
    loadFavorites();
    
    // Escuchar cambios en el localStorage (para sincronización entre pestañas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "imagiq_favorites") {
        if (e.newValue === null) {
          setFavorites([]);
        } else {
          loadFavorites();
        }
      }
    };
    
    // Escuchar eventos personalizados de favoritos actualizados (misma pestaña)
    const handleFavoritesUpdated = () => {
      requestAnimationFrame(() => {
        loadFavorites();
      });
    };
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("favorites-updated", handleFavoritesUpdated);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("favorites-updated", handleFavoritesUpdated);
    };
  }, []);

  const fetchFavorites = useCallback(
    async (filters: FavoriteFilters = {}, append = false) => {
      if (userId) { //userInfo?.id
        setLoading(true);
        setError(null);
        try {
          const apiParams = convertFiltersToApiParams(filters);
      
          const response = await productEndpoints.getFavorites(
           userId, //userInfo?.id
            apiParams
          );

          if (response.success && response.data) {
           
            const apiData = response.data;
            const mapped = mapApiProductsToFrontend(apiData.products);

            if (append) {
              setFavoritesAPI((prev) => [...prev, ...mapped]);
            } else {
              setFavoritesAPI(mapped);
            }

            setTotalItems(apiData.totalItems);
            setTotalPages(apiData.totalPages);
            setCurrentPage(apiData.currentPage);
            setHasNextPage(apiData.hasNextPage);
            setHasPreviousPage(apiData.hasPreviousPage);
          } else {
            setError(response.message || "Error al cargar favoritos");
          }
        } catch (err) {
          console.error("Error fetching favorites:", err);
          setError("Error de conexión al cargar favoritos");
        } finally {
          setLoading(false);
        }
      }
    },
    [convertFiltersToApiParams, userId] //userInfo
  );
  // API: filtrar
  const filterFavorites = useCallback(
    async (filters: FavoriteFilters) => {
      setCurrentFilters(filters);
      if (!filters.page) setCurrentPage(1);
      await fetchFavorites(filters, false);
    },
    [fetchFavorites]
  );

  // API: load more
  const loadMore = useCallback(async () => {
    if (hasNextPage && !loading) {
      const nextPage = currentPage + 1;
      const filtersWithPage = { ...currentFilters, page: nextPage };
      setCurrentFilters(filtersWithPage);
      await fetchFavorites(filtersWithPage, true);
    }
  }, [hasNextPage, loading, currentPage, currentFilters, fetchFavorites]);

  // API: ir a página
  const goToPage = useCallback(
    async (page: number) => {
      if (page >= 1 && page <= totalPages && !loading) {
        const filtersWithPage = { ...currentFilters, page };
        setCurrentFilters(filtersWithPage);
        await fetchFavorites(filtersWithPage, false);
      }
    },
    [totalPages, loading, currentFilters, fetchFavorites]
  );

  // API: refrescar
  const refreshFavorites = useCallback(async () => {
    await fetchFavorites(currentFilters, false);
  }, [currentFilters, fetchFavorites]);

  const addToFavorites = useCallback(
    async (
      productId: string,
      guestUserData?: {
        id?:string,
        nombre?: string;
        apellido?: string;
        email?: string;
        telefono?: string;
        tipo_documento?: string;
        numero_documento?: string;
      }
    ) => {
      try {
        let payload;
        
        if (guestUserData?.id) {
          // Si ya tenemos el id guardado, solo enviar el id
          payload = {
            productSKU: productId,
            userInfo: {
              id: guestUserData.id,
            },
          };
        } else {
          // Si no hay user guardado, enviar solo los campos que el backend acepta
          // El backend NO acepta tipo_documento ni numero_documento en userInfo
          // Filtrar explícitamente estos campos y cualquier otro campo no permitido
          const userInfoAllowed: {
            nombre?: string;
            apellido?: string;
            email?: string;
            telefono?: string;
            tipo_documento?: string;
            numero_documento?: string;
          } = {};
          
          if (guestUserData) {
            if (guestUserData.nombre) userInfoAllowed.nombre = guestUserData.nombre;
            if (guestUserData.apellido) userInfoAllowed.apellido = guestUserData.apellido;
            if (guestUserData.email) userInfoAllowed.email = guestUserData.email;
            if (guestUserData.telefono) userInfoAllowed.telefono = guestUserData.telefono;
            if (guestUserData.tipo_documento) userInfoAllowed.tipo_documento = guestUserData.tipo_documento;
            if (guestUserData.numero_documento) userInfoAllowed.numero_documento = guestUserData.numero_documento;
          }
          
          payload = {
            productSKU: productId,
            userInfo: userInfoAllowed,
          };
        }

        // 4. Enviar petición al backend
        const response = await productEndpoints.addFavorite(payload);
       
        if (response.success) {
          setFavorites((prev) => {
            // Evitar duplicados
            if (prev.includes(productId)) {
              return prev;
            }
            const newFavorites = [...prev, productId];
            localStorage.setItem(
              "imagiq_favorites",
              JSON.stringify(newFavorites)
            );
            // Disparar evento para sincronizar navbar y otros componentes
            if (typeof window !== 'undefined') {
              requestAnimationFrame(() => {
                window.dispatchEvent(new Event('favorites-updated'));
              });
            }
            return newFavorites;
          });
          
          // Si recibimos un id del backend, guardarlo en localStorage
          const userInfoFromResponse = response?.data?.userInfo;
          if (userInfoFromResponse?.id || userInfoFromResponse?.nombre) {
            localStorage.setItem("imagiq_user", JSON.stringify(userInfoFromResponse));
            return userInfoFromResponse;
          }
        } else {
          console.error("Error al agregar favorito:", response.message);
          throw new Error(response.message || "Error al agregar favorito");
        }
      } catch (err) {
        console.error("Error al agregar favorito en servidor", err);
        throw err;
      }
    },
    []
  );

  const removeFromFavorites = useCallback(
    async (productSKU: string, guestUserData?: {
        id?:string,
        nombre: string;
        apellido: string;
        email: string;
        telefono: string;
      }) => {
     
      try {
        // Intentar obtener el ID del usuario del localStorage si no se proporciona
        let userId = guestUserData?.id;
        if (!userId) {
          const rawUser = localStorage.getItem("imagiq_user");
          const parsed = rawUser ? JSON.parse(rawUser) : null;
          userId = parsed?.id;
        }
        
        // Si tenemos userId, intentar remover del servidor
        if (userId) {
          const response = await productEndpoints.removeFavorite(
            userId,
            productSKU
          );
          
          if (response.success) {
            setFavorites((prev) => {
              const newFavorites = prev.filter((id) => id !== productSKU);
              // Si no quedan favoritos, limpiar el localStorage
              if (newFavorites.length === 0) {
                localStorage.removeItem("imagiq_favorites");
              } else {
                localStorage.setItem(
                  "imagiq_favorites",
                  JSON.stringify(newFavorites)
                );
              }
              // Disparar evento para sincronizar navbar y otros componentes
              if (typeof window !== 'undefined') {
                requestAnimationFrame(() => {
                  window.dispatchEvent(new Event('favorites-updated'));
                });
              }
              return newFavorites;
            });
          }
        } else {
          // Si no hay userId, remover solo del localStorage
          setFavorites((prev) => {
            const newFavorites = prev.filter((id) => id !== productSKU);
            if (newFavorites.length === 0) {
              localStorage.removeItem("imagiq_favorites");
            } else {
              localStorage.setItem(
                "imagiq_favorites",
                JSON.stringify(newFavorites)
              );
            }
            // Disparar evento para sincronizar navbar y otros componentes
            if (typeof window !== 'undefined') {
              requestAnimationFrame(() => {
                window.dispatchEvent(new Event('favorites-updated'));
              });
            }
            return newFavorites;
          });
        }
      } catch (err) {
        console.error("Error al quitar favorito en servidor", err);
        // Aún así, remover del localStorage para mantener consistencia UI
        setFavorites((prev) => {
          const newFavorites = prev.filter((id) => id !== productSKU);
          if (newFavorites.length === 0) {
            localStorage.removeItem("imagiq_favorites");
          } else {
            localStorage.setItem(
              "imagiq_favorites",
              JSON.stringify(newFavorites)
            );
          }
          // Disparar evento para sincronizar navbar y otros componentes
          if (typeof window !== 'undefined') {
            requestAnimationFrame(() => {
              window.dispatchEvent(new Event('favorites-updated'));
            });
          }
          return newFavorites;
        });
      }
    },
    []
  );

  const isFavorite = useCallback(
    (productId: string) => {
      return favorites.includes(productId);
    },
    [favorites]
  );

  useEffect(() => {
    if (userId) { //userInfo?.id
      const filtersToUse =
        typeof initialFilters === "function"
          ? initialFilters()
          : initialFilters || {};
      fetchFavorites(filtersToUse, false);
    }
  }, [initialFilters, fetchFavorites, userId]);

  return {
    favorites, // ids locales
    favoritesAPI, // productos desde API
    loading,
    error,
    totalItems,
    totalPages,
    currentPage,
    hasNextPage,
    hasPreviousPage,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    filterFavorites,
    loadMore,
    goToPage,
    refreshFavorites,
    hasMore: hasNextPage,
  };
};

export const useRecommendations = () => {
  const [recommendations, setRecommendations] = useState<ProductCardProps[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  const refreshRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      // Por ahora obtener productos con descuento como recomendaciones
      const response = await productEndpoints.getOffers();
      if (response.success && response.data) {
        const apiData = response.data;
        const mappedProducts = mapApiProductsToFrontend(apiData.products);
        setRecommendations(mappedProducts.slice(0, 8)); // Limitar a 8 recomendaciones
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRecommendations();
  }, [refreshRecommendations]);

  return {
    recommendations,
    loading,
    refreshRecommendations,
  };
};


