/**
 * Hook para manejar la selección inteligente de productos
 * - Filtra colores y capacidades basado en las selecciones mutuas
 * - Calcula precios y SKUs dinámicamente según las opciones seleccionadas
 * - Maneja la lógica de arrays indexados donde cada índice representa un producto único
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ProductApiData } from '@/lib/api';
// colorMap deprecado: el API ahora entrega hex

export interface ProductVariant {
  index: number;
  color: string;
  capacity: string;
  memoriaram: string;
  sku: string;
  skuPostback: string;
  ean: string;
  codigoMarket: string;
  precioNormal: number;
  precioeccommerce: number;
  stockTotal: number;
  cantidadTiendas: number; // Cantidad de tiendas con stock > 0
  stockDisponible: number; // Stock total disponible
  imagePreviewUrl?: string;
  urlRender3D?: string;
  desDetallada?: string;
  indcerointeres: number;
  indRetoma: number; // Indicador de retoma (0 o 1)
  skuflixmedia: string;
}

export interface SelectionState {
  selectedColor: string | null;
  selectedCapacity: string | null;
  selectedMemoriaram: string | null;
  selectedVariant: ProductVariant | null;
}

// Interfaces compatibles para componentes legacy
export interface ColorOption {
  color: string;
  nombreColorDisplay: string | null;
  hex: string;
  variants: ProductVariant[];
}

export interface StorageOption {
  capacidad: string;
  variants: ProductVariant[];
}

export interface ActiveFilterHints {
  capacidad?: string[];
  color?: string[];
  memoriaram?: string[];
}

export interface UseProductSelectionReturn {
  // Estado de selección
  selection: SelectionState;

  // Opciones disponibles filtradas
  availableColors: string[];
  availableCapacities: string[];
  availableMemoriaram: string[];

  // Todas las capacidades únicas del producto (sin filtrar por color/RAM)
  allCapacities: string[];

  // Información del producto seleccionado
  selectedSku: string | null;
  selectedSkuPostback: string | null;
  selectedSkuflixmedia: string | null;
  selectedCodigoMarket: string | null;
  selectedPrice: number | null;
  selectedOriginalPrice: number | null;
  selectedDiscount: number | null;
  selectedStockTotal: number | null;
  selectedVariant: ProductVariant | null;
  selectedModelo: string | null;
  selectedNombreMarket: string | null;

  // Funciones de selección
  selectColor: (color: string) => void;
  selectCapacity: (capacity: string) => void;
  selectMemoriaram: (memoriaram: string) => void;
  selectVariant: (variant: ProductVariant) => void;
  resetSelection: () => void;

  // Funciones helper para compatibilidad con componentes legacy
  getColorOptions: () => ColorOption[];
  getStorageOptions: () => StorageOption[];
  getSelectedColorOption: () => ColorOption | null;
  getSelectedStorageOption: () => StorageOption | null;

  // Información de debug
  allVariants: ProductVariant[];

}

export function useProductSelection(apiProduct: ProductApiData, productColors?: Array<{ label: string, hex: string }>, activeFilterHints?: ActiveFilterHints): UseProductSelectionReturn {
  // Crear todas las variantes del producto basadas en los arrays indexados
  const allVariants = useMemo((): ProductVariant[] => {
    const variants: ProductVariant[] = [];

    // Asegurar que todos los arrays tengan el mismo tamaño
    const maxLength = Math.max(
      apiProduct.color.length,
      apiProduct.capacidad.length,
      apiProduct.memoriaram.length,
      apiProduct.sku.length,
      apiProduct.ean.length,
      apiProduct.codigoMarket.length,
      apiProduct.precioNormal.length,
      apiProduct.precioeccommerce.length,
      apiProduct.stockTotal.length,
      apiProduct.cantidadTiendas?.length ?? 0
    );

    for (let i = 0; i < maxLength; i++) {
      const stockTotal = apiProduct.stockTotal[i] || 0;
      const cantidadTiendas = apiProduct.cantidadTiendas?.[i] || 0;
      const stockDisponible = Math.max(0, stockTotal);

      variants.push({
        index: i,
        color: apiProduct.color[i] || '',
        capacity: apiProduct.capacidad[i] || '',
        memoriaram: apiProduct.memoriaram[i] || '',
        sku: apiProduct.sku[i] || '',
        skuPostback: apiProduct.skuPostback?.[i] || '',
        ean: apiProduct.ean[i] || '',
        codigoMarket: apiProduct.codigoMarket[i] || '',
        precioNormal: apiProduct.precioNormal[i] || 0,
        precioeccommerce: apiProduct.precioeccommerce[i] || 0,
        stockTotal,
        cantidadTiendas,
        stockDisponible,
        imagePreviewUrl: apiProduct.imagePreviewUrl?.[i],
        urlRender3D: apiProduct.urlRender3D?.[i],
        desDetallada: apiProduct.desDetallada?.[i] || '',
        indcerointeres: apiProduct.indcerointeres?.[i] ?? 0,
        indRetoma: apiProduct.indRetoma?.[i] ?? 0,
        skuflixmedia: apiProduct.skuflixmedia?.[i] || '',
      });
    }

    // Excluir variantes ocultas en el entorno actual (visibleProduction/visibleStaging
    // === false). Ej: SKUs de bundle "+ Marco Café" que no se venden en la web, no tienen
    // imágenes y NO deben seleccionarse por defecto. Sin esto, si solo esas variantes
    // ocultas tienen stock, findBestVariantToDisplay las elige y la galería queda sin imagen.
    // Replica el filtro de visibilidad de mapApiProductsToFrontend, pero por variante.
    // Se preserva el índice original (v.index) para no romper los accesos posicionales
    // a apiProduct.* (ej: imageDetailsUrls[selectedVariant.index]).
    const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'production';
    const visibilityArray = environment === 'staging'
      ? apiProduct.visibleStaging
      : apiProduct.visibleProduction;

    if (Array.isArray(visibilityArray) && visibilityArray.length > 0) {
      const visibleVariants = variants.filter(v => visibilityArray[v.index] === true);
      // Fallback defensivo: si el filtro dejara todo fuera, conservar todas las variantes
      // (evita un producto sin variantes seleccionables).
      if (visibleVariants.length > 0) {
        return visibleVariants;
      }
    }

    return variants;
  }, [apiProduct]);

  /**
   * Helper function para encontrar la mejor variante a mostrar inicialmente
   * PRIORIDAD ABSOLUTA: Solo mostrar variantes con stockDisponible > 0
   *
   * Priorización:
   * 1. FILTRO OBLIGATORIO: stockDisponible > 0 (nunca mostrar productos sin stock)
   * 2. Dentro de las variantes con stock, priorizar por:
   *    - Mayor stock disponible (más unidades = mejor disponibilidad)
   *    - Precio más bajo (mejor oferta para el usuario)
   *    - Características más comunes (capacidad, RAM)
   * 3. Si NO hay ninguna variante con stock, fallback a la primera variante
   */
  const findBestVariantToDisplay = (variants: ProductVariant[], hints?: ActiveFilterHints): ProductVariant | null => {
    if (variants.length === 0) return null;

    // Si hay hints de filtro del catálogo, preferir variantes que coincidan
    let candidateVariants = variants;
    if (hints) {
      const matching = variants.filter(v => {
        const capMatch = !hints.capacidad?.length || hints.capacidad.some(h => h.trim().toLowerCase() === v.capacity.trim().toLowerCase());
        const colorMatch = !hints.color?.length || hints.color.some(h => h.trim().toLowerCase() === v.color.trim().toLowerCase());
        const ramMatch = !hints.memoriaram?.length || hints.memoriaram.some(h => h.trim().toLowerCase() === v.memoriaram.trim().toLowerCase());
        return capMatch && colorMatch && ramMatch;
      });
      if (matching.length > 0) {
        candidateVariants = matching;
      }
    }

    // FILTRO CRÍTICO: Solo considerar variantes con stock disponible > 0
    const variantsWithStock = candidateVariants.filter(v => v.stockDisponible > 0);


    // Si NO hay variantes con stock, retornar la primera candidata como fallback
    // (esto solo debería pasar si el producto completo está agotado)
    if (variantsWithStock.length === 0) {
      console.warn('⚠️ No variants with available stock found, falling back to first variant');
      return candidateVariants[0];
    }

    // Si solo hay una variante con stock, retornarla inmediatamente
    if (variantsWithStock.length === 1) {
      return variantsWithStock[0];
    }

    // Para múltiples variantes con stock, aplicar criterios de priorización:

    // 1. Ordenar por STOCK DISPONIBLE (de mayor a menor) como prioridad principal
    const sortedByStock = [...variantsWithStock].sort((a, b) =>
      b.stockDisponible - a.stockDisponible
    );

    // 2. Tomar las variantes con mayor stock (top 30% o al menos 3 variantes)
    const topStockCount = Math.max(3, Math.ceil(sortedByStock.length * 0.3));
    const topStockVariants = sortedByStock.slice(0, topStockCount);

    // 3. Dentro de las variantes con mejor stock, ordenar por precio (menor primero)
    const sortedByPrice = [...topStockVariants].sort((a, b) =>
      a.precioeccommerce - b.precioeccommerce
    );

    // 4. Entre las variantes de precio similar (±10%), elegir por características más comunes
    const lowestPrice = sortedByPrice[0].precioeccommerce;
    const similarPriceVariants = sortedByPrice.filter(v =>
      Math.abs(v.precioeccommerce - lowestPrice) <= lowestPrice * 0.1
    );

    // Si hay múltiples variantes con precio similar, elegir por características más comunes
    if (similarPriceVariants.length > 1) {
      // Contar frecuencia de características en TODAS las variantes con stock
      const capacityCount = new Map<string, number>();
      const ramCount = new Map<string, number>();

      variantsWithStock.forEach(v => {
        // Contar capacidades válidas
        if (v.capacity && v.capacity !== '-' && v.capacity.toLowerCase() !== 'no aplica') {
          capacityCount.set(v.capacity, (capacityCount.get(v.capacity) || 0) + 1);
        }
        // Contar RAM válidas
        if (v.memoriaram && v.memoriaram !== '-' && v.memoriaram.toLowerCase() !== 'no aplica') {
          ramCount.set(v.memoriaram, (ramCount.get(v.memoriaram) || 0) + 1);
        }
      });

      // Encontrar la capacidad más común
      let mostCommonCapacity = '';
      let maxCapacityCount = 0;
      capacityCount.forEach((count, capacity) => {
        if (count > maxCapacityCount) {
          maxCapacityCount = count;
          mostCommonCapacity = capacity;
        }
      });

      // Encontrar la RAM más común
      let mostCommonRam = '';
      let maxRamCount = 0;
      ramCount.forEach((count, ram) => {
        if (count > maxRamCount) {
          maxRamCount = count;
          mostCommonRam = ram;
        }
      });

      // Buscar variante que tenga la capacidad y RAM más comunes
      const bestMatch = similarPriceVariants.find(v =>
        (mostCommonCapacity === '' || v.capacity === mostCommonCapacity) &&
        (mostCommonRam === '' || v.memoriaram === mostCommonRam)
      );

      if (bestMatch) return bestMatch;

      // Si no hay coincidencia perfecta, buscar por capacidad más común
      const capacityMatch = similarPriceVariants.find(v =>
        mostCommonCapacity === '' || v.capacity === mostCommonCapacity
      );

      if (capacityMatch) return capacityMatch;
    }

    // Retornar la variante de mejor precio del top de stock
    return sortedByPrice[0];
  };

  // Estados para rastrear qué filtros están activos (seleccionados explícitamente por el usuario)
  // Al inicio, aunque selectedColor tenga valores, estos filtros están inactivos hasta que el usuario los seleccione
  const [activeCapacityFilter, setActiveCapacityFilter] = useState<string | undefined>();
  const [activeRamFilter, setActiveRamFilter] = useState<string | undefined>();

  // Serializar hints para estabilidad en dependencias de useEffect
  const activeFilterHintsSerialized = useMemo(() => JSON.stringify(activeFilterHints || null), [activeFilterHints]);

  // Estado de selección - inicializar con la mejor variante disponible
  const [selection, setSelection] = useState<SelectionState>(() => {
    // Si hay variantes disponibles, seleccionar la mejor (stock > 0, mejor precio, características comunes)
    if (allVariants.length > 0) {
      const bestVariant = findBestVariantToDisplay(allVariants, activeFilterHints);
      if (bestVariant) {
        return {
          selectedColor: bestVariant.color || null,
          selectedCapacity: bestVariant.capacity || null,
          selectedMemoriaram: bestVariant.memoriaram || null,
          selectedVariant: bestVariant
        };
      }
    }
    return {
      selectedColor: null,
      selectedCapacity: null,
      selectedMemoriaram: null,
      selectedVariant: null
    };
  });

  // Actualizar la selección cuando cambien las variantes disponibles
  useEffect(() => {
    // Si no hay selección actual y hay variantes disponibles, seleccionar la mejor
    if (!selection.selectedColor && allVariants.length > 0) {
      const bestVariant = findBestVariantToDisplay(allVariants, activeFilterHints);
      if (bestVariant) {
        setSelection({
          selectedColor: bestVariant.color || null,
          selectedCapacity: bestVariant.capacity || null,
          selectedMemoriaram: bestVariant.memoriaram || null,
          selectedVariant: bestVariant
        });
      }
    }
  }, [allVariants, selection.selectedColor]);

  // Re-seleccionar variante cuando cambien los filtros del catálogo
  useEffect(() => {
    if (allVariants.length > 0) {
      const bestVariant = findBestVariantToDisplay(allVariants, activeFilterHints);
      if (bestVariant) {
        setSelection({
          selectedColor: bestVariant.color || null,
          selectedCapacity: bestVariant.capacity || null,
          selectedMemoriaram: bestVariant.memoriaram || null,
          selectedVariant: bestVariant
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilterHintsSerialized]);

  // Colores disponibles basado en SOLO los filtros activos (no en la selección actual)
  const availableColorsFiltered = useMemo(() => {
    const colors = new Set<string>();

    for (const variant of allVariants) {
      // Filtrado cruzado: solo mostrar colores que tengan la capacidad y RAM activos
      const capacityMatch = !activeCapacityFilter || variant.capacity === activeCapacityFilter;
      const memoriaramMatch = !activeRamFilter || variant.memoriaram === activeRamFilter;
      // Si hay filtro de color del catálogo, solo mostrar esos colores
      const hintColorMatch = !activeFilterHints?.color?.length ||
        activeFilterHints.color.some(h => h.trim().toLowerCase() === variant.color?.trim().toLowerCase());

      if (capacityMatch && memoriaramMatch && hintColorMatch && variant.color && variant.color.trim() !== '') {
        colors.add(variant.color);
      }
    }

    return Array.from(colors);
  }, [allVariants, activeCapacityFilter, activeRamFilter, activeFilterHints]);

  // Capacidades disponibles basado en el color seleccionado y RAM activo
  const availableCapacitiesFiltered = useMemo(() => {
    const capacities = new Set<string>();

    for (const variant of allVariants) {
      // Filtrado cruzado: solo mostrar capacidades que tengan el color seleccionado y RAM activo
      const colorMatch = !selection.selectedColor || variant.color === selection.selectedColor;
      const memoriaramMatch = !activeRamFilter || variant.memoriaram === activeRamFilter;
      // Si hay filtro de capacidad del catálogo, solo mostrar esas capacidades
      const hintCapMatch = !activeFilterHints?.capacidad?.length ||
        activeFilterHints.capacidad.some(h => h.trim().toLowerCase() === variant.capacity?.trim().toLowerCase());

      // Filtrar valores inválidos de capacidad
      // Excluir: vacíos, "no aplica", guiones solos, "N/A", etc.
      const capacityValue = variant.capacity?.trim();
      const isValidCapacity = capacityValue &&
        capacityValue !== '' &&
        capacityValue !== '-' &&
        capacityValue.toLowerCase() !== 'no aplica' &&
        capacityValue.toLowerCase() !== 'n/a' &&
        capacityValue.toLowerCase() !== 'no especifica' &&
        capacityValue.toLowerCase() !== 'no especificado';

      if (colorMatch && memoriaramMatch && hintCapMatch && isValidCapacity) {
        capacities.add(variant.capacity);
      }
    }

    return Array.from(capacities);
  }, [allVariants, selection.selectedColor, activeRamFilter, activeFilterHints]);

  // Memoria RAM disponible basado en el color seleccionado y capacidad activa
  const availableMemoriaramFiltered = useMemo(() => {
    const memoriaram = new Set<string>();

    for (const variant of allVariants) {
      // Filtrado cruzado: solo mostrar RAM que tengan el color seleccionado y capacidad activa
      const colorMatch = !selection.selectedColor || variant.color === selection.selectedColor;
      const capacityMatch = !activeCapacityFilter || variant.capacity === activeCapacityFilter;
      // Si hay filtro de RAM del catálogo, solo mostrar esas opciones
      const hintRamMatch = !activeFilterHints?.memoriaram?.length ||
        activeFilterHints.memoriaram.some(h => h.trim().toLowerCase() === variant.memoriaram?.trim().toLowerCase());

      // Filtrar valores inválidos de memoria RAM
      // Excluir: vacíos, "no aplica", guiones solos, "N/A", etc.
      const memoriaramValue = variant.memoriaram?.trim();
      const isValidMemoriaram = memoriaramValue &&
        memoriaramValue !== '' &&
        memoriaramValue !== '-' &&
        memoriaramValue.toLowerCase() !== 'no aplica' &&
        memoriaramValue.toLowerCase() !== 'n/a' &&
        memoriaramValue.toLowerCase() !== 'no especifica' &&
        memoriaramValue.toLowerCase() !== 'no especificado';

      if (colorMatch && capacityMatch && hintRamMatch && isValidMemoriaram) {
        memoriaram.add(variant.memoriaram);
      }
    }

    return Array.from(memoriaram);
  }, [allVariants, selection.selectedColor, activeCapacityFilter, activeFilterHints]);

  // Todas las capacidades únicas del producto (sin filtrar por color/RAM)
  const allCapacitiesUnfiltered = useMemo(() => {
    const capacities = new Set<string>();

    for (const variant of allVariants) {
      const capacityValue = variant.capacity?.trim();
      const isValidCapacity = capacityValue &&
        capacityValue !== '' &&
        capacityValue !== '-' &&
        capacityValue.toLowerCase() !== 'no aplica' &&
        capacityValue.toLowerCase() !== 'n/a' &&
        capacityValue.toLowerCase() !== 'no especifica' &&
        capacityValue.toLowerCase() !== 'no especificado';

      if (isValidCapacity) {
        capacities.add(variant.capacity);
      }
    }

    return Array.from(capacities);
  }, [allVariants]);

  // Función auxiliar para encontrar la variante exacta que coincida con los parámetros
  // Si hay múltiples variantes que coinciden, selecciona la que tenga mayor stockTotal
  const findVariant = useCallback((color: string, capacity?: string | null, memoriaram?: string | null) => {
    const matchingVariants = allVariants.filter((variant) => {
      const matchesColor = variant.color === color;
      const matchesCapacity = !capacity || capacity === '' || variant.capacity === capacity;
      const matchesMemoriaram = !memoriaram || memoriaram === '' || variant.memoriaram === memoriaram;

      return matchesColor && matchesCapacity && matchesMemoriaram;
    });

    // Si no hay coincidencias, retornar undefined
    if (matchingVariants.length === 0) {
      return undefined;
    }

    // Si hay una sola coincidencia, retornarla
    if (matchingVariants.length === 1) {
      return matchingVariants[0];
    }

    // Si hay múltiples coincidencias, seleccionar la que tenga mayor stockTotal
    return matchingVariants.reduce((best, current) => {
      return current.stockTotal > best.stockTotal ? current : best;
    });
  }, [allVariants]);

  // Variante seleccionada actualmente
  // IMPORTANTE: Usar directamente selection.selectedVariant en lugar de recalcular
  // para preservar la selección inteligente hecha por findBestVariantToDisplay
  const selectedVariant = useMemo(() => {
    // Si ya tenemos una variante seleccionada en el state, usarla directamente
    if (selection.selectedVariant) {
      return selection.selectedVariant;
    }

    // Fallback: Si no hay color seleccionado, no podemos seleccionar una variante
    if (!selection.selectedColor) {
      return null;
    }

    // Fallback: Buscar variante que coincida con los campos que SÍ tienen valores
    // Si hay múltiples variantes que coinciden, seleccionar la que tenga mayor stockTotal
    const matchingVariants = allVariants.filter(variant => {
      const matchesColor = variant.color === selection.selectedColor;

      // Solo verificar capacity si está definida en la selección y no es vacía/null
      const matchesCapacity = !selection.selectedCapacity ||
        selection.selectedCapacity === '' ||
        variant.capacity === selection.selectedCapacity;

      // Solo verificar memoriaram si está definida en la selección y no es vacía/null
      const matchesMemoriaram = !selection.selectedMemoriaram ||
        selection.selectedMemoriaram === '' ||
        variant.memoriaram === selection.selectedMemoriaram;

      return matchesColor && matchesCapacity && matchesMemoriaram;
    });

    if (matchingVariants.length === 0) {
      return null;
    }

    // Si hay múltiples coincidencias, seleccionar la que tenga mayor stockTotal
    return matchingVariants.reduce((best, current) => {
      return current.stockTotal > best.stockTotal ? current : best;
    });
  }, [allVariants, selection.selectedColor, selection.selectedCapacity, selection.selectedMemoriaram, selection.selectedVariant]);

  // Información del producto seleccionado
  const selectedSku = selectedVariant?.sku || null;
  const selectedCodigoMarket = selectedVariant?.codigoMarket || null;
  const selectedPrice = selectedVariant?.precioeccommerce || null;
  const selectedOriginalPrice = selectedVariant?.precioNormal || null;
  const selectedDiscount = selectedPrice && selectedOriginalPrice && selectedPrice < selectedOriginalPrice
    ? Math.round(((selectedOriginalPrice - selectedPrice) / selectedOriginalPrice) * 100)
    : null;
  const selectedStockTotal = selectedVariant?.stockTotal ?? null;

  // Funciones de selección con lógica de filtros activos
  const selectColor = useCallback((color: string) => {
    // Buscar la primera variante con este color que coincida con los filtros activos
    const variant = findVariant(color, activeCapacityFilter, activeRamFilter);

    if (variant) {
      setSelection({
        selectedColor: variant.color,
        selectedCapacity: variant.capacity,
        selectedMemoriaram: variant.memoriaram,
        selectedVariant: variant
      });
    } else {
      // Si no hay coincidencia con los filtros, buscar cualquier variante de ese color
      // Si hay múltiples variantes con ese color, seleccionar la que tenga mayor stockTotal
      const colorVariants = allVariants.filter((v) => v.color === color);
      if (colorVariants.length > 0) {
        const anyVariant = colorVariants.reduce((best, current) => {
          return current.stockTotal > best.stockTotal ? current : best;
        });
        setSelection({
          selectedColor: anyVariant.color,
          selectedCapacity: anyVariant.capacity,
          selectedMemoriaram: anyVariant.memoriaram,
          selectedVariant: anyVariant
        });
        // Actualizar los filtros activos con los valores de la nueva variante
        setActiveCapacityFilter(anyVariant.capacity);
        setActiveRamFilter(anyVariant.memoriaram);
      }
    }
  }, [allVariants, findVariant, activeCapacityFilter, activeRamFilter]);

  const selectCapacity = useCallback((capacity: string) => {
    // Activar filtro de capacidad
    setActiveCapacityFilter(capacity);

    if (!selection.selectedColor) return;

    // Buscar la primera variante con este color y capacidad (manteniendo RAM si es compatible)
    const variant = findVariant(selection.selectedColor, capacity, activeRamFilter);
    if (variant) {
      setSelection({
        selectedColor: variant.color,
        selectedCapacity: variant.capacity,
        selectedMemoriaram: variant.memoriaram,
        selectedVariant: variant
      });
    }
  }, [selection.selectedColor, findVariant, activeRamFilter]);

  const selectMemoriaram = useCallback((memoriaram: string) => {
    // Activar filtro de RAM
    setActiveRamFilter(memoriaram);

    if (!selection.selectedColor) return;

    // Buscar la primera variante con este color y RAM (manteniendo capacidad si es compatible)
    const variant = findVariant(selection.selectedColor, activeCapacityFilter, memoriaram);
    if (variant) {
      setSelection({
        selectedColor: variant.color,
        selectedCapacity: variant.capacity,
        selectedMemoriaram: variant.memoriaram,
        selectedVariant: variant
      });
    }
  }, [selection.selectedColor, findVariant, activeCapacityFilter]);

  const resetSelection = useCallback(() => {
    setSelection({
      selectedColor: null,
      selectedCapacity: null,
      selectedMemoriaram: null,
      selectedVariant: null
    });
    // Resetear también los filtros activos
    setActiveCapacityFilter(undefined);
    setActiveRamFilter(undefined);
  }, []);

  // Función para seleccionar una variante completa directamente
  const selectVariant = useCallback((variant: ProductVariant) => {
    setSelection({
      selectedColor: variant.color,
      selectedCapacity: variant.capacity,
      selectedMemoriaram: variant.memoriaram,
      selectedVariant: variant
    });
    // Actualizar filtros activos
    setActiveCapacityFilter(variant.capacity);
    setActiveRamFilter(variant.memoriaram);
  }, []);

  // Función helper para extraer nombre de color de desDetallada
  const extractColorName = (desDetallada: string | null | undefined): string | null => {
    if (!desDetallada) return null;

    // Formato: "Samsung Galaxy Fold7 5G 12GB 256GB DS / Azul Oscuro + Watch8 40mm / Gris Oscuro"
    // Queremos extraer "Azul Oscuro" (la parte después del primer "/" y antes de cualquier "+" o "--")
    const match = desDetallada.match(/\/\s*([^/+\-]+?)(?:\s*[\+\-]{2}|$)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  };

  // Funciones helper para compatibilidad con componentes legacy
  const getColorOptions = useCallback((): ColorOption[] => {
    return availableColorsFiltered.map(color => {
      // Normalizar el color: trim
      const trimmedColor = color.trim();

      // Detectar si es un color hexadecimal
      const isHexColor = /^#[0-9A-F]{6}$/i.test(trimmedColor);

      let hex: string;

      if (isHexColor) {
        // Si es hexadecimal, usarlo directamente
        hex = trimmedColor;
      } else {
        // Si llega nombre (caso legacy), fallback a gris
        hex = '#808080';
      }

      // Encontrar el nombreColor correspondiente desde el API
      // Buscar la primera variante con este color para obtener su índice y usar nombreColor directamente
      const firstVariantWithColor = allVariants.find(v => v.color === color);
      const nombreColorDisplay = firstVariantWithColor
        ? (apiProduct.nombreColor?.[firstVariantWithColor.index] || null)
        : null;

      return {
        color, // Mantener el valor original para lógica interna
        nombreColorDisplay,
        hex,
        variants: allVariants.filter(v => v.color === color)
      };
    });
  }, [availableColorsFiltered, allVariants, apiProduct]);

  const getStorageOptions = useCallback((): StorageOption[] => {
    return availableCapacitiesFiltered.map(capacity => ({
      capacidad: capacity,
      variants: allVariants.filter(v => v.capacity === capacity)
    }));
  }, [availableCapacitiesFiltered, allVariants]);

  const getSelectedColorOption = useCallback((): ColorOption | null => {
    if (!selection.selectedColor) return null;
    const colorOptions = getColorOptions();
    return colorOptions.find(option => option.color === selection.selectedColor) || null;
  }, [selection.selectedColor, getColorOptions]);

  const getSelectedStorageOption = useCallback((): StorageOption | null => {
    if (!selection.selectedCapacity) return null;
    const storageOptions = getStorageOptions();
    return storageOptions.find(option => option.capacidad === selection.selectedCapacity) || null;
  }, [selection.selectedCapacity, getStorageOptions]);

  //END
  return {
    selection,
    availableColors: availableColorsFiltered,
    availableCapacities: availableCapacitiesFiltered,
    availableMemoriaram: availableMemoriaramFiltered,
    allCapacities: allCapacitiesUnfiltered,
    selectedSku,
    selectedSkuPostback: selectedVariant?.skuPostback || null,
    selectedSkuflixmedia: selectedVariant?.skuflixmedia || null,
    selectedCodigoMarket,
    selectedPrice,
    selectedOriginalPrice,
    selectedDiscount,
    selectedStockTotal,
    selectedVariant,
    selectedModelo: selectedVariant ? apiProduct.modelo[selectedVariant.index] : (apiProduct.modelo[0] || null),
    selectedNombreMarket: selectedVariant ? apiProduct.nombreMarket[selectedVariant.index] : (apiProduct.nombreMarket[0] || null),
    selectColor,
    selectCapacity,
    selectMemoriaram,
    selectVariant,
    resetSelection,
    getColorOptions,
    getStorageOptions,
    getSelectedColorOption,
    getSelectedStorageOption,
    allVariants
  };
}
