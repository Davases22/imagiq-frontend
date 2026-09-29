"use client";

import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FormattedStore } from "@/types/store";

interface MapSectionProps {
  stores: FormattedStore[];
  selectedStore?: FormattedStore | null;
  onStoreSelect?: (store: FormattedStore | null) => void;
  fullScreen?: boolean;
  isMobileOrTablet?: boolean;
}

// Component to handle map interactions
function MapController({
  selectedStore,
  resetToCenter,
  onResetComplete
}: {
  selectedStore: FormattedStore | null;
  resetToCenter: [number, number] | null;
  onResetComplete: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedStore && map) {
      map.setView([selectedStore.position[0], selectedStore.position[1]], 16, {
        animate: true,
        duration: 1,
      });
    }
  }, [selectedStore, map]);

  useEffect(() => {
    if (resetToCenter && map) {
      map.setView(resetToCenter, 12, {
        animate: true,
        duration: 0.5,
      });
      onResetComplete();
    }
  }, [resetToCenter, map, onResetComplete]);

  return null;
}

// Coordenadas por defecto según dispositivo
const MAP_CENTER = {
  desktop: [4.6482837, -74.2478936] as [number, number],
  mobile: [4.68, -74.08] as [number, number], // Más al norte para centrar mejor las tiendas
};

export default function MapSection({
  stores,
  selectedStore: externalSelectedStore,
  onStoreSelect,
  fullScreen = false,
  isMobileOrTablet = false,
}: MapSectionProps) {
  // Usar estado externo si se proporciona, sino usar estado interno
  const [internalSelectedStore, setInternalSelectedStore] = useState<FormattedStore | null>(null);
  const [resetToCenter, setResetToCenter] = useState<[number, number] | null>(null);

  const selectedStore = externalSelectedStore !== undefined ? externalSelectedStore : internalSelectedStore;
  const defaultCenter = isMobileOrTablet ? MAP_CENTER.mobile : MAP_CENTER.desktop;

  const handleResetView = useCallback(() => {
    setResetToCenter(defaultCenter);
    if (onStoreSelect) {
      onStoreSelect(null);
    } else {
      setInternalSelectedStore(null);
    }
  }, [defaultCenter, onStoreSelect]);

  const handleResetComplete = useCallback(() => {
    setResetToCenter(null);
  }, []);

  const handleStoreClick = (store: FormattedStore) => {
    const newSelection = selectedStore?.codigo === store.codigo ? null : store;
    if (onStoreSelect) {
      onStoreSelect(newSelection);
    } else {
      setInternalSelectedStore(newSelection);
    }
  };

  // Filtrar solo tiendas con coordenadas válidas para mostrar en el mapa
  const storesWithValidCoords = stores.filter(
    (store) =>
      store.latitud !== 0 &&
      store.longitud !== 0 &&
      !isNaN(store.latitud) &&
      !isNaN(store.longitud)
  );

  // Custom Samsung pin icon with dynamic color
  const getSamsungIcon = (isSelected: boolean) =>
    L.divIcon({
      className: "custom-samsung-pin",
      html: `
      <div style="width:32px;height:40px;display:flex;align-items:center;justify-content:center;">
        <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.27 0 0 7.56 0 16.9C0 27.1 16 40 16 40C16 40 32 27.1 32 16.9C32 7.56 24.73 0 16 0Z" fill="${isSelected ? "white" : "#1D8AFF"}" stroke="${isSelected ? "#1D8AFF" : "white"}" stroke-width="2"/>
          <text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="Samsung Sharp Sans, Arial, sans-serif" font-size="18" font-weight="bold" fill="${isSelected ? "#1D8AFF" : "white"}">S</text>
        </svg>
      </div>
    `,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popupAnchor: [0, -40],
    });

  // Estilos para modo fullscreen (móvil) vs modo desktop
  const containerStyle = fullScreen
    ? {
        position: "absolute" as const,
        inset: 0,
        width: "100%",
        height: "100%",
        borderRadius: 0,
      }
    : {
        // 64 px a cada lado para que el mapa quede alineado con las secciones
        // de productos de la home, que usan ese mismo margen lateral. Antes
        // eran 30 px y la seccion se veia con menos aire que el resto.
        left: 64,
        right: 64,
        top: 0,
        bottom: 0,
        position: "absolute" as const,
        height: "920px",
        minHeight: "920px",
        maxHeight: "920px",
        width: "auto",
        borderRadius: "32px",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
      };

  return (
    <div className="absolute z-0" style={containerStyle}>
      <MapContainer
        center={isMobileOrTablet ? MAP_CENTER.mobile : MAP_CENTER.desktop}
        zoom={12}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController
          selectedStore={selectedStore}
          resetToCenter={resetToCenter}
          onResetComplete={handleResetComplete}
        />
        {storesWithValidCoords.map((store) => {
          const isSelected = selectedStore?.codigo === store.codigo;
          return (
            <Marker
              key={store.codigo}
              position={store.position}
              icon={getSamsungIcon(isSelected)}
              eventHandlers={{
                click: () => handleStoreClick(store),
              }}
            >
              <Popup>
                <b>{store.descripcion}</b>
                <br />
                {store.direccion}
                {store.ubicacion_cc && (
                  <>
                    <br />
                    <small>{store.ubicacion_cc}</small>
                  </>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Botón para volver a la vista general */}
      {selectedStore && (
        <button
          onClick={handleResetView}
          className="absolute top-4 right-4 z-[1000] bg-white text-gray-800 rounded-full px-4 py-2
                     border-2 border-black shadow-lg
                     hover:bg-gray-100 active:scale-95 transition-all duration-200
                     flex items-center gap-2 font-bold text-sm"
          style={{ fontFamily: "Samsung Sharp Sans, sans-serif" }}
          aria-label="Ver todas las tiendas"
        >
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Ver todas</span>
        </button>
      )}
    </div>
  );
}
