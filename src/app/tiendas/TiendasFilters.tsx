/**
 * TiendasFilters - Componente de filtros y "Cerca de mí" para el localizador de tiendas Samsung
 *
 * - Permite buscar tiendas cercanas usando la ubicación del usuario
 * - Permite mostrar/ocultar filtros adicionales (ciudad, horario, búsqueda) al hacer clic en "Filtros"
 * - Filtros robustos: ciudad, horario, búsqueda por nombre/dirección
 * - Código limpio, escalable y documentado
 */

import { useState, useMemo } from "react";
import { useStores } from "@/hooks/useStores";
import type { FormattedStore } from "@/types/store";

interface TiendasFiltersProps {
  onUpdateStores: (filtered: FormattedStore[]) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export default function TiendasFilters({
  onUpdateStores,
  onLoadingChange,
}: TiendasFiltersProps) {
  // Obtener todas las tiendas usando el hook
  const { stores } = useStores();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ciudad, setCiudad] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Extraer ciudades únicas de las tiendas cargadas
  const ciudades = useMemo(() => {
    return Array.from(
      new Set(stores.map((s) => s.ciudad?.trim()).filter(Boolean))
    ).sort();
  }, [stores]);

  // Buscar tiendas cercanas usando geolocalización
  const handleCercaDeMi = () => {
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("La geolocalización no está soportada en este navegador.");
      setLoading(false);
      onLoadingChange?.(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // Filtrar solo tiendas con coordenadas válidas
        const storesWithCoords = stores.filter(
          (store) => store.latitud !== 0 && store.longitud !== 0 &&
                     !isNaN(store.latitud) && !isNaN(store.longitud)
        );

        // Calcular distancia a cada tienda
        const tiendasCercanas = storesWithCoords
          .map((store) => ({
            ...store,
            distancia: getDistance(
              latitude,
              longitude,
              store.position[0],
              store.position[1]
            ),
          }))
          .sort((a, b) => a.distancia - b.distancia)
          .slice(0, 5); // Mostrar las 5 más cercanas
        onUpdateStores(tiendasCercanas);
        setLoading(false);
        onLoadingChange?.(false);
      },
      (err) => {
        setError("No se pudo obtener la ubicación: " + err.message);
        setLoading(false);
        onLoadingChange?.(false);
      }
    );
  };

  // Filtrar tiendas según los filtros seleccionados
  const handleFiltrar = () => {
    let filtradas = stores;
    // Filtro robusto por ciudad (insensible a mayúsculas y espacios)
    if (ciudad) {
      filtradas = filtradas.filter((s) => {
        // Permitir filtrar aunque el usuario seleccione el nombre capitalizado
        return (
          s.ciudad && s.ciudad.trim().toLowerCase() === ciudad.trim().toLowerCase()
        );
      });
    }
    // Filtro robusto por búsqueda de nombre/dirección
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtradas = filtradas.filter(
        (s) =>
          s.descripcion?.toLowerCase().includes(q) ||
          false ||
          s.direccion?.toLowerCase().includes(q) ||
          false
      );
    }
    onUpdateStores(filtradas);
    setShowFilters(false); // Ocultar filtros después de aplicar
  };

  // Utilidad para calcular distancia entre dos coordenadas (Haversine)
  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  return (
    <div className="flex flex-col gap-3 mt-3">
      <div className="flex gap-3 justify-between">
        <button
          className="flex-1 bg-[#E5E5E5] rounded-full px-0 py-2 flex items-center justify-center gap-2 text-gray-900 font-bold text-[15px] border-none shadow-none"
          style={{
            fontFamily: "Samsung Sharp Sans, sans-serif",
            height: "28px",
            fontWeight: "bold",
            fontSize: "15px",
          }}
          onClick={handleCercaDeMi}
          disabled={loading}
        >
          {loading ? "Buscando..." : "Cerca de mí"}
        </button>
        <button
          className="flex-1 bg-[#E5E5E5] rounded-full px-0 py-2 flex items-center justify-center gap-2 text-gray-900 font-bold text-[15px] border-none shadow-none"
          style={{
            fontFamily: "Samsung Sharp Sans, sans-serif",
            height: "28px",
            fontWeight: "bold",
            fontSize: "15px",
          }}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filtros
          <span className="ml-1">
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
              <circle cx="7" cy="7" r="2" />
              <circle cx="17" cy="12" r="2" />
              <circle cx="9" cy="17" r="2" />
            </svg>
          </span>
        </button>
      </div>
      {showFilters && (
        <div className="flex flex-col gap-2 mt-2 animate-fade-in">
          <input
            type="text"
            placeholder="Buscar por nombre o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#E5E5E5] rounded-full px-2 py-1 text-[15px] border-none focus:outline-none font-bold text-gray-700"
            style={{
              fontFamily: "Samsung Sharp Sans, sans-serif",
              height: "28px",
            }}
          />
          <div className="flex gap-2">
            {/* Filtro Ciudad */}
            <select
              className="flex-1 bg-[#E5E5E5] rounded-full px-2 py-1 text-gray-900 font-bold text-[15px] border-none shadow-none"
              style={{
                fontFamily: "Samsung Sharp Sans, sans-serif",
                height: "28px",
              }}
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
            >
              <option value="">Ciudad</option>
              {ciudades.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <button
              className="bg-[#1D8AFF] text-white rounded-[16px] px-4 py-1 font-bold text-[15px] border-none shadow-none"
              style={{
                fontFamily: "Samsung Sharp Sans, sans-serif",
                minWidth: "90px",
              }}
              onClick={handleFiltrar}
            >
              Filtrar
            </button>
          </div>
        </div>
      )}
      {error && <div className="text-red-500 text-xs mt-2">{error}</div>}
    </div>
  );
}
