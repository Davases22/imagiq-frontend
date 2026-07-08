/**
 * PRODUCT CARD COMPONENTS - IMAGIQ ECOMMERCE
 *
 * Componentes auxiliares reutilizables para ProductCard:
 * - ColorSelector: Selector de colores con círculos de color
 * - CapacitySelector: Selector de capacidades con botones
 * - RamSelector: Selector de memoria RAM (mismo estilo de chips que CapacitySelector)
 */

"use client";

import { cn } from "@/lib/utils";
import type { ProductColor, ProductCapacity } from "./ProductCard";

/**
 * Props para ColorSelector
 */
export interface ColorSelectorProps {
  colors: ProductColor[];
  selectedColor: ProductColor | null;
  onColorSelect: (color: ProductColor) => void;
  onShowMore: (e: React.MouseEvent) => void;
}

/**
 * Función auxiliar para determinar si un color es azul
 */
const isBlueColor = (color: ProductColor): boolean => {
  const colorName = color.name.toLowerCase();
  const colorLabel = color.label.toLowerCase();
  const hex = color.hex.toLowerCase();

  // Verificar por nombre/etiqueta
  const blueKeywords = ['azul', 'blue', 'navy', 'marino', 'celeste', 'sky'];
  const hasBlueKeyword = blueKeywords.some(keyword =>
    colorName.includes(keyword) || colorLabel.includes(keyword)
  );

  if (hasBlueKeyword) return true;

  // Verificar por código hexadecimal (rangos de azul)
  // Extraer componentes RGB del hex
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);

  // Un color es "azul" si el componente azul es dominante
  // y es significativamente mayor que rojo y verde
  return b > r && b > g && b > 100;
};

/**
 * Componente para seleccionar colores del producto
 */
export const ColorSelector = ({
  colors,
  selectedColor,
  onColorSelect,
  onShowMore,
}: ColorSelectorProps) => {
  if (!colors || colors.length === 0) return null;

  // Ordenar colores: azules primero, luego el resto en su orden original
  const sortedColors = [...colors].sort((a, b) => {
    const aIsBlue = isBlueColor(a);
    const bIsBlue = isBlueColor(b);

    // Si ambos son azules o ninguno es azul, mantener orden original
    if (aIsBlue === bIsBlue) return 0;

    // Los azules van primero (retornar negativo para a)
    return aIsBlue ? -1 : 1;
  });

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {sortedColors.slice(0, 4).map((color) => (
          <button
            key={color.name}
            onClick={(e) => {
              e.stopPropagation();
              onColorSelect(color);
            }}
            className={cn(
              "w-6.5 h-6.5 rounded-full border transition-all duration-200 relative cursor-pointer",
              selectedColor?.name === color.name
                ? "border-black p-0.5"
                : "border-gray-300 hover:border-gray-400"
            )}
            title={color.nombreColorDisplay || color.label}
          >
            <div
              className="w-full h-full rounded-full"
              style={{ backgroundColor: color.hex }}
            />
            {selectedColor?.name === color.name && (
              <div className="absolute inset-0 rounded-full border-2 border-white" />
            )}
          </button>
        ))}
        {sortedColors.length > 4 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowMore(e);
            }}
            className="w-6.5 h-6.5 rounded-full border-2 border-gray-300 flex items-center justify-center text-[10px] font-medium text-gray-600 hover:border-gray-400 cursor-pointer"
          >
            +{sortedColors.length - 4}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Props para CapacitySelector
 */
export interface CapacitySelectorProps {
  capacities: ProductCapacity[];
  selectedCapacity: ProductCapacity | null;
  onCapacitySelect: (capacity: ProductCapacity) => void;
}

/**
 * Componente para seleccionar capacidades del producto
 * Muestra todas las capacidades del dispositivo, con las no disponibles cruzadas con línea diagonal
 */
export const CapacitySelector = ({
  capacities,
  selectedCapacity,
  onCapacitySelect,
}: CapacitySelectorProps) => {
  if (!capacities || capacities.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 flex-wrap">
        {capacities.map((capacity) => {
          const isAvailable = capacity.available !== false;
          const isSelected = selectedCapacity?.value === capacity.value;

          return (
            <button
              key={capacity.value}
              disabled={!isAvailable}
              onClick={(e) => {
                e.stopPropagation();
                if (isAvailable) {
                  onCapacitySelect(capacity);
                }
              }}
              className={cn(
                "relative px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 overflow-hidden",
                !isAvailable
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : isSelected
                    ? "border-black bg-black text-white cursor-pointer"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 cursor-pointer"
              )}
            >
              <span className="relative z-10">{capacity.label}</span>
              {/* Línea diagonal de izquierda a derecha cuando no está disponible */}
              {!isAvailable && (
                <span
                  className="absolute inset-0 pointer-events-none z-0"
                  style={{
                    background: "linear-gradient(to top right, transparent calc(50% - 0.5px), #9ca3af calc(50% - 0.5px), #9ca3af calc(50% + 0.5px), transparent calc(50% + 0.5px))",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Opción de memoria RAM para RamSelector
 */
export interface ProductRamOption {
  value: string; // Valor de RAM tal como llega del API (ej: "4GB", "6GB")
  label: string; // Etiqueta mostrada al usuario
  available?: boolean; // Si está disponible para el color/capacidad seleccionados
}

/**
 * Props para RamSelector
 */
export interface RamSelectorProps {
  rams: ProductRamOption[];
  selectedRam: ProductRamOption | null;
  onRamSelect: (ram: ProductRamOption) => void;
}

/**
 * Componente para seleccionar la memoria RAM del producto.
 * Espejo del CapacitySelector: mismos chips, con las opciones no disponibles
 * cruzadas con línea diagonal y deshabilitadas. Delegamos el render en
 * CapacitySelector para garantizar el mismo estilo visual sin duplicar markup.
 */
export const RamSelector = ({
  rams,
  selectedRam,
  onRamSelect,
}: RamSelectorProps) => {
  if (!rams || rams.length === 0) return null;

  return (
    <CapacitySelector
      capacities={rams}
      selectedCapacity={selectedRam}
      onCapacitySelect={onRamSelect}
    />
  );
};
