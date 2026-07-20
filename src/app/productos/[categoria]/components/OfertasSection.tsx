/**
 * Componente para mostrar productos en oferta por sección
 */

"use client";
import React, { useMemo, useState, useCallback } from "react";
import { SlidersHorizontal } from "lucide-react";
import ProductCard from "../../components/ProductCard";
import BundleCard from "../../components/BundleCard";
import { useProducts } from "@/features/products/useProducts";
import { Skeleton } from "@/components/ui/skeleton";
import ItemsPerPageSelector from "../../electrodomesticos/components/ItemsPerPageSelector";
import Pagination from "../../electrodomesticos/components/Pagination";
import Banner from "@/components/Banner";
import { OFERTAS_BANNERS_MAP } from "@/config/banners";
import type { MixedProductItem } from "@/lib/productMapper";

// Componente Skeleton para ProductCard
const ProductCardSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Imagen del producto */}
      <Skeleton className="w-full h-64 bg-gray-200" />

      <div className="p-4">
        {/* Título del producto */}
        <Skeleton className="h-6 w-3/4 mb-2 bg-gray-200" />
        <Skeleton className="h-4 w-1/2 mb-4 bg-gray-200" />

        {/* Precio */}
        <Skeleton className="h-8 w-1/3 mb-2 bg-gray-200" />
        <Skeleton className="h-4 w-1/4 mb-4 bg-gray-200" />

        {/* Botón */}
        <Skeleton className="h-10 w-full rounded-md bg-gray-200" />
      </div>
    </div>
  );
};

// Mapeo de secciones a filtros de API
const ofertasFiltersMap: Record<string, { category?: string; subcategory?: string; menuUuid?: string }> = {
  accesorios: { category: "IM", menuUuid:'87c54352-5181-45b7-831d-8e9470d2288c' },
  "tv-monitores-audio": { category: "AV,IT" },
  "smartphones-tablets": {category: "IM" ,menuUuid:'ff59c937-78ac-4f83-8c5e-2c3048b4ebb7,7609faf8-4c39-4227-915e-0d439d717e84' },
  electrodomesticos: { category: "DA" },
};

// Mapeo de secciones a títulos
const ofertasTitles: Record<string, string> = {
  accesorios: "Accesorios",
  "tv-monitores-audio": "TV, Monitores y Audio",
  "smartphones-tablets": "Smartphones y Tablets",
  electrodomesticos: "Electrodomésticos",
};

interface OfertasSectionProps {
  seccion?: string | null;
}

export default function OfertasSection({ seccion }: OfertasSectionProps) {
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  // Orden (solo en ofertas): 'relevante' = orden original del API (default),
  // 'asc' = menor a mayor, 'desc' = mayor a menor.
  const [sortOrder, setSortOrder] = useState<"relevante" | "asc" | "desc">("relevante");

  const handleSortChange = useCallback((order: "relevante" | "asc" | "desc") => {
    setSortOrder(order);
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Memoizar los filtros para evitar recreaciones innecesarias
  const initialFilters = useMemo(() => {
    const baseFilters = {
      withDiscount: true,
      page: currentPage,
      limit: itemsPerPage,
      sortBy: 'precio',
      // Backend solo entiende asc/desc; 'relevante' usa el orden por defecto
      // (el reordenamiento fino se hace en cliente sobre orderedItems).
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
      precioMin: 1,
      // minStock es la clave que useProducts mapea a stockMinimo; antes decía
      // 'stockMin' (clave muerta) y el filtro de stock nunca se aplicaba → se
      // mostraban ofertas sin stock.
      minStock: 1,
      // Rutear la query pesada de ofertas por el proxy cacheado (Data Cache de
      // Next): el primer visitante paga los ~6s, el resto la recibe en ~ms.
      // Si el proxy falla, getFilteredV2 cae al endpoint directo.
      cacheProxyPath: '/api/pcache/ofertas',
    };

    if (seccion && ofertasFiltersMap[seccion]) {
      const sectionFilters = ofertasFiltersMap[seccion];
      return {
        ...baseFilters,
        ...sectionFilters,
      };
    }

    return baseFilters;
  }, [seccion, currentPage, itemsPerPage, sortOrder]);

  // Usar el hook de productos con filtro de ofertas
  const { 
    products, 
    bundles,
    orderedItems,
    loading, 
    error, 
    totalItems,
    totalPages,
    refreshProducts 
  } = useProducts(initialFilters);

  // Ordenar los items visibles por precio en el CLIENTE (el backend devuelve
  // orderedItems intercalado, no por precio). 'relevante' = orden original.
  // DEBE ir ANTES de cualquier return condicional (regla de hooks).
  const priceOf = (item: MixedProductItem): number =>
    Number(String((item as { price?: string }).price ?? "").replace(/[^\d]/g, "")) || 0;
  const displayItems = useMemo(() => {
    if (sortOrder === "relevante") return orderedItems;
    const arr = [...orderedItems];
    arr.sort((a, b) =>
      sortOrder === "asc" ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a)
    );
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedItems, sortOrder]);

  // Handlers para paginación
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleItemsPerPageChange = useCallback((items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 md:px-8 lg:px-12 py-8">
        <Skeleton className="h-10 w-64 mb-6 mx-auto bg-gray-200" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8">
          {Array.from({ length: itemsPerPage }).map((_, index) => (
            <ProductCardSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error al cargar ofertas</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={refreshProducts}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const sectionTitle = seccion ? ofertasTitles[seccion] : "Ofertas Samsung";

  // Obtener el banner para esta sección
  const bannerConfig = seccion ? OFERTAS_BANNERS_MAP[seccion] : null;

  // Botones de orden (reutilizados en sidebar desktop y barra móvil)
  const sortOptions: Array<{ key: "relevante" | "asc" | "desc"; label: string }> = [
    { key: "relevante", label: "Relevante" },
    { key: "asc", label: "Menor a mayor" },
    { key: "desc", label: "Mayor a menor" },
  ];
  // Barra de orden HORIZONTAL (debajo del título, ancho completo)
  const sortBar = (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="mr-1 flex items-center gap-2 text-sm font-bold text-gray-900">
        <SlidersHorizontal className="h-4 w-4" /> Ordenar por precio:
      </span>
      {sortOptions.map((opt) => (
        <button
          key={opt.key}
          onClick={() => handleSortChange(opt.key)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            sortOrder === opt.key
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-300 text-gray-700 hover:border-gray-400"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 md:px-8 lg:px-12 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">
        {sectionTitle}
      </h1>

      {/* Banner promocional */}
      {bannerConfig && <Banner config={bannerConfig} className="mb-10 max-w-7xl mx-auto" />}

      {/* Orden: barra horizontal debajo del título, arriba del grid */}
      {sortBar}

      {/* Grid a ancho completo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
        {(displayItems.length === 0 && !loading) ? (
          <div className="col-span-full text-center text-gray-500 text-lg py-4">
            Vuelve pronto y encuentra las mejores ofertas
          </div>
        ) : (
          displayItems.map((item: MixedProductItem) => {
            if (item.itemType === 'bundle') {
              const { itemType, ...bundleProps } = item;
              return <BundleCard key={bundleProps.id} {...bundleProps} />;
            } else {
              const { itemType, ...productProps } = item;
              return <ProductCard key={productProps.id} {...productProps} />;
            }
          })
        )}
      </div>

      {/* Paginación */}
      {!error && orderedItems.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <ItemsPerPageSelector
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
          />
        </div>
      )}
    </div>
  );
}
