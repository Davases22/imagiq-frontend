/**
 * 🗺️ MAPA INTERACTIVO DE TIENDAS SAMSUNG - IMAGIQ
 */

"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Filter } from "lucide-react";
import { useStores } from "@/hooks/useStores";
import type { FormattedStore } from "@/types/store";
import { posthogUtils } from "@/lib/posthogClient";
import dynamic from "next/dynamic";
import { StoreCard } from "./CardsMap";
import { useSelectedStore } from "@/contexts/SelectedStoreContext";

// Dynamically import react-leaflet components
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

// Create a simple map controller component with proper types
const MapController = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      return function MapControllerInner({
        selectedCity,
        cityCoordinates,
        scrollWheelEnabled,
        onMapClick,
        selectedStoreCode,
        stores,
        shouldZoomToStore,
      }: {
        selectedCity: string;
        cityCoordinates: Record<
          string,
          { lat: number; lng: number; zoom: number }
        >;
        scrollWheelEnabled: boolean;
        onMapClick: () => void;
        selectedStoreCode: number | null;
        stores: FormattedStore[];
        shouldZoomToStore: boolean;
      }) {
        const map = mod.useMap();

        useEffect(() => {
          if (map && selectedCity) {
            if (selectedCity === "Todas las ciudades") {
              map.setView([4.5709, -74.2973], 6);
            } else if (cityCoordinates[selectedCity]) {
              const coords = cityCoordinates[selectedCity];
              map.setView([coords.lat, coords.lng], coords.zoom);
            }
          }
        }, [map, selectedCity, cityCoordinates]);

        // Zoom to selected store from carousel only
        useEffect(() => {
          if (map && selectedStoreCode !== null && shouldZoomToStore) {
            const store = stores.find(s => s.codigo === selectedStoreCode);
            if (store) {
              map.setView([store.position[0], store.position[1]], 16, {
                animate: true,
                duration: 1,
              });
            }
          }
        }, [map, selectedStoreCode, stores, shouldZoomToStore]);

        // Control scroll wheel zoom based on state
        useEffect(() => {
          if (map) {
            if (scrollWheelEnabled) {
              map.scrollWheelZoom.enable();
            } else {
              map.scrollWheelZoom.disable();
            }
          }
        }, [map, scrollWheelEnabled]);

        // Enable scroll wheel zoom when user clicks on map
        useEffect(() => {
          if (map) {
            const handleClick = () => {
              onMapClick();
            };

            map.on("click", handleClick);

            return () => {
              map.off("click", handleClick);
            };
          }
        }, [map, onMapClick]);

        return null;
      };
    }),
  { ssr: false }
);

// Global Leaflet instance
let L: Record<string, unknown> = {};

// Initialize Leaflet
const initializeLeaflet = async () => {
  if (typeof window !== "undefined" && !L.divIcon) {
    await import("leaflet/dist/leaflet.css");
    const leaflet = await import("leaflet");
    L = leaflet.default || leaflet;
  }
  return L;
};

interface LocationMapProps {
  initialStores?: FormattedStore[];
}

export default function LocationMap({ initialStores }: LocationMapProps = {}) {
  // Obtener tiendas desde el endpoint usando el hook
  const { stores: apiStores, loading: loadingStores } = useStores();

  // Usar stores iniciales si están disponibles, sino usar los de la API
  const effectiveStores = initialStores && initialStores.length > 0 ? initialStores : apiStores;
  const { selectedStoreCode, setSelectedStoreCode } = useSelectedStore();

  const [selectedCity, setSelectedCity] =
    useState<string>("Todas las ciudades");
  const [hoveredStore, setHoveredStore] = useState<FormattedStore | null>(null);
  const [selectedStore, setSelectedStore] = useState<FormattedStore | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [scrollWheelEnabled, setScrollWheelEnabled] = useState(false);
  const [shouldZoomToStore, setShouldZoomToStore] = useState(false);

  // Filtrar solo tiendas con coordenadas válidas
  const stores = useMemo(() => {
    return effectiveStores.filter(
      (store) => store.latitud !== 0 && store.longitud !== 0 &&
                 !isNaN(store.latitud) && !isNaN(store.longitud)
    );
  }, [effectiveStores]);

  // Initialize Leaflet
  useEffect(() => {
    setIsClient(true);

    initializeLeaflet().then(() => {
      setLeafletReady(true);
    });
  }, []);

  // Force map remount when changing cities to avoid container reuse
  useEffect(() => {
    setMapKey((prev) => prev + 1);
  }, [selectedCity]);

  // Detect when selectedStoreCode changes from carousel (external source)
  // Enable zoom only when selection comes from outside the map
  useEffect(() => {
    if (selectedStoreCode !== null) {
      // Check if this selection is different from current map selection
      if (selectedStore?.codigo !== selectedStoreCode) {
        setShouldZoomToStore(true);
        // Reset after zoom is triggered
        const timer = setTimeout(() => setShouldZoomToStore(false), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedStoreCode, selectedStore]);

  // Get unique cities for filter
  const cities = useMemo(
    () => [
      "Todas las ciudades",
      ...Array.from(new Set(stores.map((store) => store.ciudad))).sort(),
    ],
    [stores]
  );

  // Filter stores based on selected city
  const filteredStores = useMemo(() => {
    if (selectedCity === "Todas las ciudades") {
      return stores;
    }
    return stores.filter((store) => store.ciudad === selectedCity);
  }, [selectedCity, stores]);

  // City coordinates for map centering with proper typing
  const cityCoordinates: Record<
    string,
    { lat: number; lng: number; zoom: number }
  > = useMemo(
    () => ({
      Bogotá: { lat: 4.6951, lng: -74.0306, zoom: 11 },
      Cali: { lat: 3.4516, lng: -76.532, zoom: 11 },
      Bucaramanga: { lat: 7.1254, lng: -73.1198, zoom: 12 },
      Chía: { lat: 4.8609, lng: -74.0276, zoom: 13 },
      Cúcuta: { lat: 7.8939, lng: -72.5078, zoom: 12 },
      Ibagué: { lat: 4.4389, lng: -75.2322, zoom: 12 },
      Manizales: { lat: 5.0703, lng: -75.5138, zoom: 12 },
    }),
    []
  );

  // Handle city selection
  const handleCityChange = useCallback((city: string) => {
    setSelectedCity(city);
    setHoveredStore(null);

    posthogUtils.capture("city_filter_change", {
      selected_city: city,
      stores_count: stores.filter(
        (store) => city === "Todas las ciudades" || store.ciudad === city
      ).length,
    });
  }, [stores]);

  // Handle map click to enable scroll wheel zoom
  const handleMapClick = useCallback(() => {
    if (!scrollWheelEnabled) {
      setScrollWheelEnabled(true);
      posthogUtils.capture("map_scroll_enabled", {
        enabled_by: "click",
      });
    }
  }, [scrollWheelEnabled]);

  // If loading stores, show loading state
  if (loadingStores || !isClient || !leafletReady) {
    return (
      <div className="w-full relative z-10">
        {/* Header eliminado */}

        {/* City Filter - Always visible */}
        <div className="mb-6 flex justify-center">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 max-w-md w-full">
            <div className="flex items-center space-x-3">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium text-gray-700 cursor-pointer"
              >
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}{" "}
                    {city !== "Todas las ciudades" &&
                      `(${stores.filter((s) => s.ciudad === city).length})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 text-center">
              {filteredStores.length} tienda
              {filteredStores.length !== 1 ? "s" : ""} disponible
              {filteredStores.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Loading Map Placeholder */}
        <div className="relative bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="relative h-[600px] flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando mapa interactivo...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Convert FormattedStore to Location for StoreCard compatibility
  const convertStoreToLocation = (store: FormattedStore) => ({
    id: store.codigo || 0,
    name: store.descripcion,
    address: store.direccion + (store.ubicacion_cc ? ` - ${store.ubicacion_cc}` : ''),
    hours: store.horario,
    phone: store.telefono + (store.extension ? ` Ext ${store.extension}` : ''),
    lat: store.position[0],
    lng: store.position[1],
    city: store.ciudad,
    mall: store.ubicacion_cc,
  });

  const center: [number, number] = [4.5709, -74.2973];

  return (
    <div className="w-full relative z-10 flex flex-col items-center px-2 sm:px-4 md:px-0">
      {/* Header eliminado - ya está en el carrusel */}

      {/* City Filter - Responsive: móvil y desktop/tablet */}

      {/* Card seleccionada arriba del mapa solo en móvil */}
      {hoveredStore && (
        <div className="md:hidden w-full flex justify-center mb-2 animate-fade-in px-1">
          <div className=" rounded-xl  p-3 w-full max-w-[99vw] mx-auto">
            <StoreCard store={convertStoreToLocation(hoveredStore)} />
          </div>
        </div>
      )}

      {/* Interactive Map Container - Responsive: móvil y desktop/tablet */}
      <div className="relative rounded-xl overflow-hidden z-10 animate-fade-in w-full max-w-[99vw] mx-auto mt-0 md:mt-2 px-1 md:px-0 md:max-w-none md:rounded-2xl flex justify-center items-center">
        <div className="relative h-[360px] xs:h-[400px] sm:h-[440px] md:h-[500px] lg:h-[600px] md:w-[1200px] lg:w-[1400px] w-full flex justify-center items-center">
          {/* Mensaje para indicar al usuario que haga clic para interactuar */}
          {!scrollWheelEnabled && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm md:text-base font-medium shadow-lg">
                Haz clic para interactuar con el mapa
              </div>
            </div>
          )}
          <MapContainer
            key={`map-${mapKey}`}
            center={center}
            zoom={6}
            style={{ height: "100%", width: "100%" }}
            className="rounded-xl focus:outline-none md:rounded-2xl"
            scrollWheelZoom={false}
            zoomControl={true}
            doubleClickZoom={true}
            dragging={true}
            touchZoom={true}
            aria-label="Mapa interactivo de tiendas Samsung"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            <MapController
              selectedCity={selectedCity}
              cityCoordinates={cityCoordinates}
              scrollWheelEnabled={scrollWheelEnabled}
              onMapClick={handleMapClick}
              selectedStoreCode={selectedStoreCode}
              stores={filteredStores}
              shouldZoomToStore={shouldZoomToStore}
            />

            {filteredStores.map((store, index) => {
              const isHovered = hoveredStore?.codigo === store.codigo;
              const isSelected = selectedStore?.codigo === store.codigo || selectedStoreCode === store.codigo;
              const isHighlighted = isHovered || isSelected;
              return (
              <Marker
                key={`store-${store.codigo}-${index}-${mapKey}`}
                position={[store.position[0], store.position[1]]}
                icon={
                  typeof window !== "undefined" && window.L && window.L.divIcon
                    ? window.L.divIcon({
                        className: "custom-samsung-pin",
                        html: `<div style='width:36px;height:44px;display:flex;align-items:center;justify-content:center;'>
                    <svg width='36' height='44' viewBox='0 0 36 44' fill='none' xmlns='http://www.w3.org/2000/svg'>
                      <path d='M18 0C8.06 0 0 8.5 0 19C0 30.5 18 44 18 44C18 44 36 30.5 36 19C36 8.5 27.94 0 18 0Z' fill='${isHighlighted ? 'white' : '#1D8AFF'}' stroke='${isHighlighted ? '#1D8AFF' : 'white'}' stroke-width='2'/>
                      <text x='50%' y='54%' text-anchor='middle' dominant-baseline='middle' font-family='Samsung Sharp Sans, Arial, sans-serif' font-size='20' font-weight='bold' fill='${isHighlighted ? '#1D8AFF' : 'white'}'>S</text>
                    </svg>
                  </div>`,
                        iconSize: [36, 44],
                        iconAnchor: [18, 44],
                        popupAnchor: [0, -44],
                      })
                    : undefined
                }
                eventHandlers={{
                  mouseover: () => setHoveredStore(store),
                  mouseout: () => setHoveredStore(null),
                  click: () => {
                    // Si la tienda ya está seleccionada, la deseleccionamos
                    if (selectedStore?.codigo === store.codigo) {
                      setSelectedStore(null);
                      setSelectedStoreCode(null);
                    } else {
                      // Si no, la seleccionamos
                      setSelectedStore(store);
                      setSelectedStoreCode(store.codigo);
                    }
                    setHoveredStore(store);
                  },
                }}
              >
                {/* Popup solo en desktop/tablet */}
                <Popup className="hidden md:block">
                  <StoreCard store={convertStoreToLocation(store)} />
                </Popup>
              </Marker>
            );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}