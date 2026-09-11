/**
 * 🔍 FILTER SIDEBAR COMPONENT - IMAGIQ ECOMMERCE
 *
 * Componente reutilizable de filtros con:
 * - Configuración dinámica de filtros
 * - Estado de filtros personalizable
 * - Diseño idéntico a la imagen (gris claro, minimalista)
 * - Animaciones suaves y fluidas
 * - Sin barras de scroll visibles
 * - Tracking de interacciones
 * - Accesibilidad mejorada con ARIA
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { posthogUtils } from "@/lib/posthogClient";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import DynamicFilterSection from "./DynamicFilterSection";
import GlobalFiltersSection from "./GlobalFiltersSection";
import type { DynamicFilterConfig, DynamicFilterState } from "@/types/filters";

interface FilterOption {
  label: string;
  min?: number;
  max?: number;
}

interface FilterConfig {
  [key: string]: string[] | FilterOption[];
}

interface FilterState {
  [key: string]: string[];
}

interface FilterSidebarProps {
  // Filtros dinámicos
  dynamicFilters?: DynamicFilterConfig[];
  dynamicFilterState?: DynamicFilterState;
  onDynamicFilterChange?: (
    filterId: string,
    value: string | { min?: number; max?: number; ranges?: string[]; values?: string[] },
    checked?: boolean
  ) => void;
  // Filtros globales
  isStockFilterEnabled?: boolean;
  onStockFilterChange?: (enabled: boolean) => void;
  // Props comunes
  resultCount: number;
  expandedFilters?: Set<string>;
  onToggleFilter?: (filterKey: string) => void;
  className?: string;
  trackingPrefix?: string;
  // Props para sticky behavior
  stickyContainerClasses?: string;
  stickyWrapperClasses?: string;
  stickyStyle?: React.CSSProperties;
}

export default function FilterSidebar({
  // Filtros dinámicos
  dynamicFilters = [],
  dynamicFilterState = {},
  onDynamicFilterChange,
  // Filtros globales
  isStockFilterEnabled = false,
  onStockFilterChange,
  // Props comunes
  resultCount,
  expandedFilters,
  onToggleFilter,
  className,
  trackingPrefix = "filter",
  stickyContainerClasses = "",
  stickyWrapperClasses = "",
  stickyStyle = {},
}: FilterSidebarProps) {
  // Inicializar expandedFilters para filtros dinámicos
  const defaultExpandedFilters = new Set(dynamicFilters.slice(0, 2).map((f) => f.id));
  
  const [internalExpandedFilters, setInternalExpandedFilters] =
    useState<Set<string>>(expandedFilters || defaultExpandedFilters);
  const prefersReducedMotion = useReducedMotion();

  const handleToggleFilter = (filterKey: string) => {
    if (onToggleFilter) {
      onToggleFilter(filterKey);
    } else {
      const newExpanded = new Set(internalExpandedFilters);
      if (newExpanded.has(filterKey)) {
        newExpanded.delete(filterKey);
      } else {
        newExpanded.add(filterKey);
      }
      setInternalExpandedFilters(newExpanded);
    }

    posthogUtils.capture(`${trackingPrefix}_toggle`, {
      filter_type: filterKey,
      action: (onToggleFilter ? (expandedFilters || new Set<string>()) : internalExpandedFilters).has(
        filterKey
      )
        ? "collapse"
        : "expand",
    });
  };


  const handleDynamicFilterChange = (
    filterId: string,
    value: string | { min?: number; max?: number; ranges?: string[]; values?: string[] },
    checked?: boolean
  ) => {
    if (onDynamicFilterChange) {
      onDynamicFilterChange(filterId, value, checked);
    }

    const filter = dynamicFilters.find((f) => f.id === filterId);
    if (filter) {
      posthogUtils.capture(`${trackingPrefix}_applied`, {
        filter_type: filter.sectionName,
        filter_id: filterId,
        filter_value: typeof value === "string" ? value : JSON.stringify(value),
        action: checked ? "add" : "change",
      });
    }
  };

  const currentExpandedFilters = onToggleFilter
    ? (expandedFilters || new Set<string>())
    : internalExpandedFilters;


  const getTotalActiveFilters = () => {
    // Contar filtros dinámicos activos
    return Object.values(dynamicFilterState).reduce((total, state) => {
      let count = 0;
      if (state.values) count += state.values.length;
      if (state.ranges) count += state.ranges.length;
      if (state.min !== undefined || state.max !== undefined) count += 1;
      return total + count;
    }, 0);
  };


  return (
    <motion.div
      className={cn(
        "bg-white rounded-none border-0 shadow-none",
        stickyContainerClasses,
        className
      )}
      style={stickyStyle}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0.01 : 0.4,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <div className={cn(stickyWrapperClasses)}>
        {/* Header igual a la imagen */}
        <div className="p-4 border-b border-gray-300">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 font-bold text-black text-lg">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-black"
                  aria-hidden="true"
                >
                  <path
                    d="M3.75 6.75H14.25"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6.75 11.25H11.25"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="6.75" cy="6.75" r="1.125" fill="currentColor" />
                  <circle cx="11.25" cy="11.25" r="1.125" fill="currentColor" />
                </svg>
                Filtros
              </span>
              <span
                className="text-base text-black font-medium border-l border-gray-300 pl-4"
                aria-live="polite"
                aria-atomic="true"
              >
                {resultCount} resultados
              </span>
            </div>
          </div>
        </div>

        {/* Filtros globales (aparecen en todas las categorías) */}
        {onStockFilterChange && (
          <GlobalFiltersSection
            isStockFilterEnabled={isStockFilterEnabled}
            onStockFilterChange={onStockFilterChange}
          />
        )}

        {/* Contenedor principal con scroll oculto */}
        <div className="overflow-hidden">
          {/* Renderizar filtros dinámicos */}
          {dynamicFilters.length > 0 ? (
            dynamicFilters.map((filter) => {
              const isExpanded = currentExpandedFilters.has(filter.id);
              return (
                <div key={filter.id} className="border-b border-gray-300">
                  <button
                    onClick={() => handleToggleFilter(filter.id)}
                    className="w-full flex items-center justify-between py-4 px-4 text-left hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    aria-expanded={isExpanded}
                    aria-controls={`filter-panel-${filter.id}`}
                    aria-label={`${isExpanded ? 'Contraer' : 'Expandir'} filtro de ${filter.sectionName}`}
                  >
                    <span className="font-semibold text-black text-sm tracking-wide">
                      {filter.sectionName}
                    </span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: prefersReducedMotion ? 0.01 : 0.3 }}
                    >
                      <ChevronDown className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        id={`filter-panel-${filter.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: prefersReducedMotion ? 0.01 : 0.3,
                          ease: [0.25, 0.1, 0.25, 1],
                        }}
                        className="overflow-hidden"
                        role="region"
                        aria-labelledby={`filter-header-${filter.id}`}
                      >
                        <div className="px-4 pb-4">
                          <DynamicFilterSection
                            filter={filter}
                            filterState={dynamicFilterState}
                            onFilterChange={handleDynamicFilterChange}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            // Si no hay filtros dinámicos, no mostrar nada (o mostrar mensaje)
            <div className="p-4 text-sm text-gray-500">
              No hay filtros disponibles
            </div>
          )}
        </div>
        {/* Estilos CSS personalizados para ocultar scrollbars */}
        <style jsx>{`
          .scrollbar-hide {
            -webkit-overflow-scrolling: touch;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </motion.div>
  );
}

// Mobile Filter Modal Component
interface MobileFilterModalProps extends FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileFilterModal({
  isOpen,
  onClose,
  ...filterProps
}: MobileFilterModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop animado */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-50 transition-all duration-300 ease-in-out",
          isOpen ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"
        )}
        onClick={onClose}
      />

      {/* Modal con animación mejorada */}
      <div
        className={cn(
          // en mobile dejamos un pequeño gap a la izquierda con left-4
          "lg:hidden fixed inset-y-0 right-0 left-4 z-50 w-full max-w-sm bg-white shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-300 bg-[#F5F5F5]">
            <h2 className="text-lg font-bold text-black">Filtros</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <FilterSidebar
              {...filterProps}
              className="border-0 shadow-none rounded-none h-full bg-[#F5F5F5]"
            />
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-300 bg-white">
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200"
            >
              Aplicar Filtros ({filterProps.resultCount} productos)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export type { FilterConfig, FilterState, FilterSidebarProps };
