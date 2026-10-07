"use client";
/**
 * TIENDAS PAGE - Samsung Store Locator
 * Implementación responsiva con Toggle Mapa/Lista para móvil/tablet
 */

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useStores } from "@/hooks/useStores";
import type { FormattedStore } from "@/types/store";

// Componentes
import TiendasFilters from "./TiendasFilters";
import StoreCardSkeleton from "./StoreCardSkeleton";
import MapSkeleton from "./MapSkeleton";
import StoreCard from "./components/StoreCard";
import MobileViewToggle from "./components/MobileViewToggle";
import MobileStoreList from "./components/MobileStoreList";
import { useViewMode } from "./hooks/useViewMode";

const MapSection = dynamic(() => import("./MapSection"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function TiendasPage() {
  // Datos de tiendas
  const { stores, loading, error } = useStores();

  // Modo de vista (móvil/tablet vs desktop)
  const { viewMode, toggleView, isMobileOrTablet } = useViewMode();

  // Estado de búsqueda, filtros y selección
  const [search, setSearch] = useState("");
  const [filteredStores, setFilteredStores] = useState<FormattedStore[]>([]);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<FormattedStore | null>(null);

  // Filtrar tiendas por búsqueda de texto y coordenadas válidas
  const visibleStores = useMemo(() => {
    const storesWithCoords = (filteredStores.length > 0 ? filteredStores : stores).filter(
      (store) =>
        store.latitud !== 0 &&
        store.longitud !== 0 &&
        !isNaN(store.latitud) &&
        !isNaN(store.longitud)
    );

    if (!search.trim()) return storesWithCoords;

    const query = search.trim().toLowerCase();
    return storesWithCoords.filter(
      (store) =>
        store.descripcion?.toLowerCase().includes(query) ||
        store.direccion?.toLowerCase().includes(query) ||
        store.ciudad?.toLowerCase().includes(query)
    );
  }, [search, filteredStores, stores]);

  // Manejar selección de tienda desde la lista (cambia a vista mapa)
  const handleStoreSelectFromList = (store: FormattedStore) => {
    setSelectedStore(store);
    if (isMobileOrTablet) {
      toggleView(); // Cambiar a vista mapa para mostrar la tienda seleccionada
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      {/* Header */}
      <header
        className="w-full flex flex-col items-center pt-8 pb-2"
        style={{ zIndex: 10, position: "relative" }}
      >
        <h1
          className="text-2xl md:text-4xl font-bold text-center mb-1 px-4"
          style={{ fontFamily: "Samsung Sharp Sans, sans-serif" }}
        >
          ENCUENTRA TU SAMSUNG STORE
        </h1>
        <p className="text-center text-base md:text-lg text-gray-700 mb-4 px-4">
          Elige la tienda más cercana, agenda tu visita y vive la experiencia Galaxy
        </p>
      </header>

      <main className="relative flex-1 w-full">
        {/* LAYOUT MÓVIL/TABLET */}
        {isMobileOrTablet ? (
          <>
            {/* Vista Mapa (solo montado cuando está activo para evitar errores de Leaflet) */}
            {viewMode === "map" && (
              <div className="absolute inset-0 z-10">
                <MapSection
                  stores={visibleStores}
                  selectedStore={selectedStore}
                  onStoreSelect={setSelectedStore}
                  fullScreen
                  isMobileOrTablet
                />
              </div>
            )}

            {/* Vista Lista */}
            {viewMode === "list" && (
              <MobileStoreList
                stores={visibleStores}
                loading={loading}
                isFilterLoading={isFilterLoading}
                error={error}
                search={search}
                onSearchChange={setSearch}
                onUpdateStores={setFilteredStores}
                onLoadingChange={setIsFilterLoading}
                onStoreSelect={handleStoreSelectFromList}
                selectedStore={selectedStore}
              />
            )}

            {/* Botón Toggle */}
            <MobileViewToggle currentView={viewMode} onToggle={toggleView} />
          </>
        ) : (
          /* LAYOUT DESKTOP - Diseño original */
          <div
            className="flex justify-center items-start"
            style={{ minHeight: 1140 }}
          >
            <MapSection
              stores={visibleStores}
              selectedStore={selectedStore}
              onStoreSelect={setSelectedStore}
            />

            {/* Sidebar desktop */}
            <aside
              className="absolute top-32 left-20 w-[420px] max-w-full bg-white rounded-3xl border border-black p-0 flex flex-col gap-0 z-20 overflow-hidden"
              style={{
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                overflow: "hidden",
              }}
            >
              <div className="w-full flex flex-col gap-2 px-6 pt-6 pb-2 bg-transparent">
                <div
                  className="w-full flex items-center bg-[#E5E5E5] rounded-[16px] px-4"
                  style={{ height: "36px", position: "relative" }}
                >
                  <input
                    type="text"
                    placeholder="Buscar por nombre, dirección o ciudad..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#E5E5E5] rounded-[16px] px-2 py-0 text-[15px] border-none focus:outline-none font-bold text-gray-700"
                    style={{
                      fontFamily: "Samsung Sharp Sans, sans-serif",
                      height: "28px",
                      paddingRight: "32px",
                    }}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600">
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                </div>
                <TiendasFilters
                  onUpdateStores={setFilteredStores}
                  onLoadingChange={setIsFilterLoading}
                />
              </div>

              <div
                className="flex flex-col gap-5 overflow-y-auto px-4 pb-4 pt-2"
                // 780px para que entren 5 tarjetas sin tener que desplazar.
                // El panel arranca en top-32 (128px) y la cabecera ocupa ~150,
                // asi que 128+150+780 = 1058, dentro de los 1080 del mapa.
                style={{ maxHeight: 780, minHeight: 320 }}
              >
                {loading || isFilterLoading ? (
                  <>
                    <StoreCardSkeleton />
                    <StoreCardSkeleton />
                    <StoreCardSkeleton />
                  </>
                ) : error ? (
                  <div className="text-center text-red-500 py-8">
                    <p className="font-semibold mb-2">Error al cargar tiendas</p>
                    <p className="text-sm">{error}</p>
                  </div>
                ) : visibleStores.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No se encontraron tiendas.
                  </div>
                ) : (
                  visibleStores.map((store) => (
                    <StoreCard
                      key={store.codigo}
                      store={store}
                      onSelect={setSelectedStore}
                      isSelected={selectedStore?.codigo === store.codigo}
                    />
                  ))
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
