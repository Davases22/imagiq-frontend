// ExploreProductList.tsx
"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useFavorites } from "@/features/products/useProducts";
import SkeletonCard from "@/components/SkeletonCard";
import { useDeviceType } from "@/components/responsive";
import { posthogUtils } from "@/lib/posthogClient";
import ProductCard from "../productos/components/ProductCard";
import ItemsPerPageSelector from "./ItemsPerPageSelector";
import Pagination from "./Pagination";

export default function FavoritePage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const device = useDeviceType();
   const [userId, setUserId] = useState<string | undefined>(undefined); // 👈 estado local para el userId
  const lastFiltersRef = useRef<string>("");
    const { addToFavorites, removeFromFavorites, isFavorite } =
    useFavorites();
  const [viewMode] = useState<"grid" | "list">("grid");
  const apiFilters = useMemo(
    () => ({
      subcategory: "Neveras,Nevecon",
    }),
    []
  );
   // cargar userId desde localStorage al montar
  useEffect(() => {
    const rawUser = localStorage.getItem("imagiq_user");
    const parsed = rawUser ? JSON.parse(rawUser) : null;
    setUserId(parsed?.id);
  }, []);


  const initialFilters = useMemo(() => {
    const filters = {
      ...apiFilters,
      page: currentPage,
      limit: itemsPerPage,
    };
    return filters;
  }, [apiFilters, currentPage, itemsPerPage]);

  const {

    favoritesAPI,
    loading,
    error,
    refreshFavorites,
    totalItems,
    totalPages,
    filterFavorites,
  } = useFavorites(userId, initialFilters);

    const handleItemsPerPageChange = useCallback(async (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
    // Scroll suave hacia arriba cuando cambie la cantidad de productos por página
    window.scrollTo({ top: 200, behavior: "smooth" });
  }, []);
    // Funciones para manejar la paginación
  const handlePageChange = useCallback(async (page: number) => {
    setCurrentPage(page);
    // Scroll suave hacia arriba cuando cambie de página
    window.scrollTo({ top: 200, behavior: "smooth" });
  }, []);


  // Actualizar filtros cuando cambien los parámetros de paginación
  useEffect(() => {
     if (!userId) return; // 👈 evita llamar si no hay usuario aún
    const filtersWithPagination = {
      ...apiFilters,
      page: currentPage,
      limit: itemsPerPage,
    };

    // Crear una clave única para evitar bucles infinitos
    const filtersKey = JSON.stringify(filtersWithPagination);

    if (lastFiltersRef.current !== filtersKey) {
      lastFiltersRef.current = filtersKey;
      filterFavorites(filtersWithPagination);
    }
  }, [apiFilters, itemsPerPage, currentPage, filterFavorites, userId]);

  useEffect(() => {
    posthogUtils.capture("favorites_view", {
      section: "favorites",
      category: "favorites",
      device,
    });
  }, [device]);

  if (loading) {
    return (
      <div className="bg-white">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-7xl mx-auto px-4 py-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Error al cargar favoritos
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={refreshFavorites}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8 bg-white">
      <div
        className={cn("grid gap-4 bg-white max-w-7xl mx-auto px-4", {
          "grid-cols-1": true,
          "sm:grid-cols-2": true,
          "md:grid-cols-3": true,
          "lg:grid-cols-4": true,
        })}
      >
        {favoritesAPI.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No se encontraron sugerencias.
          </div>
        ) : (
          favoritesAPI
            .filter((product) => product.image && typeof product.image === 'string' && product.image.trim() !== '')
            .map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              image={product.image}
              colors={product.colors}
              price={product.price}
              originalPrice={product.originalPrice}
              discount={product.discount}
              isFavorite={isFavorite(product.id, product.colors?.map((c) => c.sku))}
              onToggleFavorite={(productId: string) => {
                if (isFavorite(productId)) {
                  removeFromFavorites(productId);
                } else {
                  addToFavorites(productId);
                }
              }}
              className={viewMode === "list" ? "flex-row" : ""}
            />
          ))
        )}
      </div>
        {!loading && !error && totalItems > 0 && (
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
