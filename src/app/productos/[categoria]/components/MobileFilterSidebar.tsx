/**
 * 📱 MOBILE FILTER SIDEBAR - Sidebar móvil con filtros
 */

"use client";

import { X } from "lucide-react";
import FilterSidebar from "../../components/FilterSidebar";
import FilterSidebarSkeleton from "../../components/FilterSidebarSkeleton";
import type { DynamicFilterConfig, DynamicFilterState } from "@/types/filters";

interface Props {
  readonly show: boolean;
  readonly onClose: () => void;
  // Filtros dinámicos
  readonly dynamicFilters?: DynamicFilterConfig[];
  readonly dynamicFilterState?: DynamicFilterState;
  readonly onDynamicFilterChange?: (
    filterId: string,
    value: string | { min?: number; max?: number; ranges?: string[]; values?: string[] },
    checked?: boolean
  ) => void;
  // Filtros globales
  readonly isStockFilterEnabled?: boolean;
  readonly onStockFilterChange?: (enabled: boolean) => void;
  // Props comunes
  readonly expandedFilters?: Set<string>;
  readonly onToggleFilter?: (filterKey: string) => void;
  readonly resultCount: number;
  readonly loading?: boolean;
}

export default function MobileFilterSidebar({
  show,
  onClose,
  // Filtros dinámicos
  dynamicFilters,
  dynamicFilterState,
  onDynamicFilterChange,
  // Filtros globales
  isStockFilterEnabled,
  onStockFilterChange,
  // Props comunes
  expandedFilters,
  onToggleFilter,
  resultCount,
  loading = false,
}: Props) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Cerrar filtros"
      />
      <div className="relative bg-white w-full max-w-sm h-full overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Filtros</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4">
          {loading ? (
            <FilterSidebarSkeleton />
          ) : (
            <FilterSidebar
              // Solo filtros dinámicos
              dynamicFilters={dynamicFilters}
              dynamicFilterState={dynamicFilterState}
              onDynamicFilterChange={onDynamicFilterChange}
              // Filtros globales
              isStockFilterEnabled={isStockFilterEnabled}
              onStockFilterChange={onStockFilterChange}
              // Props comunes
              expandedFilters={expandedFilters}
              onToggleFilter={onToggleFilter}
              resultCount={resultCount}
            />
          )}
        </div>
      </div>
    </div>
  );
}
