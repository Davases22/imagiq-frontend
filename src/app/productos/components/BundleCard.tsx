/**
 * BUNDLE CARD COMPONENT - IMAGIQ ECOMMERCE
 *
 * Componente para mostrar bundles (paquetes de productos)
 * - Diseño similar a ProductCard pero adaptado para bundles
 * - Muestra nombre del bundle, precio y descuento
 * - Próximamente: imagen preview del bundle
 */

"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { posthogUtils } from "@/lib/posthogClient";
import { getCloudinaryUrl } from "@/lib/cloudinary";
import { calculateSavings } from "./utils/productCardHelpers";
import type { BundleCardProps, BundleOptionProps } from "@/lib/productMapper";
import { useCartContext } from "@/features/cart/CartContext";
import { apiGet } from "@/lib/api-client";
import type { BundleInfo, CartProduct } from "@/hooks/useCart";
import { toast } from "sonner";
import { useStockNotification } from "@/hooks/useStockNotification";
import StockNotificationModal from "@/components/StockNotificationModal";
import { shouldRenderValue } from "./utils/shouldRenderValue";
import CeroInteresSection from "@/components/CeroInteresSection";
import type { ZeroInterestSkuResult } from "@/services/cero-interes-sku.service";

/**
 * Selector de variantes del bundle con colores y capacidades
 * - Muestra círculos de color cuando hay colores disponibles
 * - Muestra botones de capacidad cuando hay capacidades disponibles
 * - Fallback a números secuenciales si no hay datos de variantes
 */
function BundleVariantSelector({
  opciones,
  selectedOptionIndex,
  onSelectOption,
}: {
  opciones: BundleOptionProps[];
  selectedOptionIndex: number;
  onSelectOption: (index: number) => void;
}) {
  // Extraer colores únicos con sus índices
  const uniqueColors = useMemo(() => {
    const colorMap = new Map<
      string,
      { hex: string; name: string; indices: number[] }
    >();
    opciones.forEach((opcion, index) => {
      if (opcion.colorProductSku) {
        const existing = colorMap.get(opcion.colorProductSku);
        if (existing) {
          existing.indices.push(index);
        } else {
          colorMap.set(opcion.colorProductSku, {
            hex: opcion.colorProductSku,
            name: opcion.nombreColorProductSku || "Color",
            indices: [index],
          });
        }
      }
    });
    return Array.from(colorMap.values());
  }, [opciones]);

  // Extraer capacidades únicas con sus índices
  const uniqueCapacities = useMemo(() => {
    const capacityMap = new Map<string, { value: string; indices: number[] }>();
    opciones.forEach((opcion, index) => {
      if (opcion.capacidadProductSku) {
        const existing = capacityMap.get(opcion.capacidadProductSku);
        if (existing) {
          existing.indices.push(index);
        } else {
          capacityMap.set(opcion.capacidadProductSku, {
            value: opcion.capacidadProductSku,
            indices: [index],
          });
        }
      }
    });
    return Array.from(capacityMap.values());
  }, [opciones]);

  // Determinar el color y capacidad actuales
  const selectedOption = opciones[selectedOptionIndex];
  const selectedColor = selectedOption?.colorProductSku;
  const selectedCapacity = selectedOption?.capacidadProductSku;

  // Verificar si hay datos de variantes
  const hasVariantData = uniqueColors.length > 0 || uniqueCapacities.length > 0;

  // Handler para seleccionar color - busca la primera opción con ese color y la capacidad actual (si aplica)
  const handleColorSelect = (colorHex: string) => {
    const colorData = uniqueColors.find((c) => c.hex === colorHex);
    if (!colorData) return;

    // Si hay capacidad seleccionada, buscar opción con ese color Y esa capacidad
    if (selectedCapacity) {
      const matchIndex = colorData.indices.find(
        (idx) => opciones[idx].capacidadProductSku === selectedCapacity
      );
      if (matchIndex !== undefined) {
        onSelectOption(matchIndex);
        return;
      }
    }
    // Si no, seleccionar la primera opción con ese color
    onSelectOption(colorData.indices[0]);
  };

  // Handler para seleccionar capacidad - busca la primera opción con esa capacidad y el color actual (si aplica)
  const handleCapacitySelect = (capacity: string) => {
    const capacityData = uniqueCapacities.find((c) => c.value === capacity);
    if (!capacityData) return;

    // Si hay color seleccionado, buscar opción con esa capacidad Y ese color
    if (selectedColor) {
      const matchIndex = capacityData.indices.find(
        (idx) => opciones[idx].colorProductSku === selectedColor
      );
      if (matchIndex !== undefined) {
        onSelectOption(matchIndex);
        return;
      }
    }
    // Si no, seleccionar la primera opción con esa capacidad
    onSelectOption(capacityData.indices[0]);
  };

  // Fallback: selector numérico si no hay datos de variantes
  if (!hasVariantData) {
    return (
      <div className="px-3">
        <div className="flex flex-wrap gap-1.5">
          {opciones.map((opcion, index) => (
            <button
              key={opcion.product_sku}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectOption(index);
              }}
              className={cn(
                "px-2 py-1 text-xs rounded-md border transition-all",
                selectedOptionIndex === index
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              )}
              title={opcion.modelo}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Obtener el nombre del color seleccionado
  const selectedColorName = selectedOption?.nombreColorProductSku;

  return (
    <div className="px-3 space-y-1.5">
      {/* Label del color seleccionado - igual que ProductCard */}
      {selectedColorName &&
        shouldRenderValue(selectedColorName) &&
        uniqueColors.length > 0 && (
          <p className="text-xs text-gray-600 font-medium">
            {`Color: ${selectedColorName}`}
          </p>
        )}

      {/* Selector de colores - mismo estilo que ProductCard */}
      {uniqueColors.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {uniqueColors.map((color) => (
            <button
              key={color.hex}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleColorSelect(color.hex);
              }}
              className={cn(
                "w-6.5 h-6.5 rounded-full border transition-all duration-200 relative cursor-pointer",
                selectedColor === color.hex
                  ? "border-black p-0.5"
                  : "border-gray-300 hover:border-gray-400"
              )}
              title={color.name}
              aria-label={`Color: ${color.name}`}
            >
              <div
                className="w-full h-full rounded-full"
                style={{ backgroundColor: color.hex }}
              />
              {selectedColor === color.hex && (
                <div className="absolute inset-0 rounded-full border-2 border-white" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Selector de capacidades - mismo estilo que ProductCard */}
      {uniqueCapacities.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {uniqueCapacities.map((capacity) => (
            <button
              key={capacity.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCapacitySelect(capacity.value);
              }}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 cursor-pointer",
                selectedCapacity === capacity.value
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              )}
              title={capacity.value}
            >
              {capacity.value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Componente para mostrar las imágenes del bundle con superposición diagonal
 * - 2 imágenes: esquina superior-izquierda + esquina inferior-derecha, superpuestas ligeramente
 * - 3+ imágenes: distribución en esquinas con superposición
 *
 * EXPORTADO para reutilizar en la página de vista detallada del bundle
 */
export function BundlePreviewImages({
  images,
  bundleName,
}: {
  images: string[];
  bundleName: string;
}) {
  // Filtrar imágenes válidas y tomar máximo 4
  const validImages = images
    .filter((url) => url && typeof url === "string" && url.trim() !== "")
    .slice(0, 4);

  const imageCount = validImages.length;

  // Aplicar transformaciones de Cloudinary
  const transformedImages = useMemo(() => {
    return validImages.map((img) => getCloudinaryUrl(img, "catalog"));
  }, [validImages]);

  if (imageCount === 0) {
    return null;
  }

  // Single image - mostrar grande y centrada
  if (imageCount === 1) {
    return (
      <div className="relative w-full h-full">
        <Image
          src={transformedImages[0]}
          alt={`${bundleName} - producto`}
          fill
          className="object-contain p-2"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
      </div>
    );
  }

  // 2 imágenes: diagonal con mayor superposición y overflow - imagen 1 arriba-izquierda, imagen 2 abajo-derecha
  if (imageCount === 2) {
    return (
      <div className="relative w-full h-full overflow-visible">
        {/* Imagen 1: esquina superior-izquierda */}
        <div className="absolute -top-4 left-0 w-[65%] h-[65%] z-10">
          <Image
            src={transformedImages[0]}
            alt={`${bundleName} - producto 1`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 40vw, 25vw"
          />
        </div>
        {/* Imagen 2: esquina inferior-derecha */}
        <div className="absolute -bottom-4 right-2 w-[60%] h-[60%] z-20">
          <Image
            src={transformedImages[1]}
            alt={`${bundleName} - producto 2`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 40vw, 25vw"
          />
        </div>
        {/* Símbolo + centrado */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="bg-white rounded-full p-1 shadow-md">
            <Plus className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
        </div>
      </div>
    );
  }

  // 3 imágenes: 2 arriba (izq y der) + 1 abajo centrada, sin superposición
  if (imageCount === 3) {
    return (
      <div className="relative w-full h-full">
        {/* Imagen 1: cuadrante superior-izquierdo */}
        <div className="absolute top-0 left-0 w-[50%] h-[50%]">
          <Image
            src={transformedImages[0]}
            alt={`${bundleName} - producto 1`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 30vw, 20vw"
          />
        </div>
        {/* Imagen 2: cuadrante superior-derecho */}
        <div className="absolute top-0 right-0 w-[50%] h-[50%]">
          <Image
            src={transformedImages[1]}
            alt={`${bundleName} - producto 2`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 30vw, 20vw"
          />
        </div>
        {/* Imagen 3: abajo centrada */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[50%] h-[50%]">
          <Image
            src={transformedImages[2]}
            alt={`${bundleName} - producto 3`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 30vw, 20vw"
          />
        </div>
        {/* Símbolo + centrado */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="bg-white rounded-full p-1 shadow-md">
            <Plus className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
        </div>
      </div>
    );
  }

  // 4 imágenes: grid 2x2, sin superposición
  return (
    <div className="relative w-full h-full">
      {/* Imagen 1: cuadrante superior-izquierdo */}
      <div className="absolute top-0 left-0 w-[50%] h-[50%]">
        <Image
          src={transformedImages[0]}
          alt={`${bundleName} - producto 1`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 25vw, 16vw"
        />
      </div>
      {/* Imagen 2: cuadrante superior-derecho */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%]">
        <Image
          src={transformedImages[1]}
          alt={`${bundleName} - producto 2`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 25vw, 16vw"
        />
      </div>
      {/* Imagen 3: cuadrante inferior-izquierdo */}
      <div className="absolute bottom-0 left-0 w-[50%] h-[50%]">
        <Image
          src={transformedImages[2]}
          alt={`${bundleName} - producto 3`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 25vw, 16vw"
        />
      </div>
      {/* Imagen 4: cuadrante inferior-derecho */}
      <div className="absolute bottom-0 right-0 w-[50%] h-[50%]">
        <Image
          src={transformedImages[3]}
          alt={`${bundleName} - producto 4`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 25vw, 16vw"
        />
      </div>
      {/* Símbolo + centrado */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
        <div className="bg-white rounded-full p-1 shadow-md">
          <Plus className="w-4 h-4 text-black" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

export default function BundleCard({
  id,
  baseCodigoMarket,
  codCampana,
  name,
  // image - ya no se usa, las imágenes vienen de previewImages en opciones
  // price, originalPrice, discount - no se usan, se toman de opciones
  opciones,
  categoria,
  menu,
  submenu,
  fecha_inicio,
  fecha_final,
  ceroInteresData,
  className,
}: BundleCardProps & { className?: string }) {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Hook del carrito
  const { addBundleToCart } = useCartContext();

  // Hook para notificar stock
  const stockNotification = useStockNotification();

  // Opción actualmente seleccionada
  const selectedOption = opciones?.[selectedOptionIndex] || opciones?.[0];
  const skus_bundle = selectedOption?.skus_bundle || [];

  // Obtener las imágenes de preview de la opción seleccionada
  const previewImages = selectedOption?.imagePreviewUrl || [];

  // Las opciones se muestran como números simples (1, 2, 3...)
  // El nombre completo del bundle cambia dinámicamente al seleccionar cada opción

  const router = useRouter();

  const handleMoreInfo = () => {
    // Navegar a página de detalle del bundle
    posthogUtils.capture("bundle_more_info_click", {
      bundle_id: id,
      bundle_name: name,
      source: "bundle_card",
      baseCodigoMarket,
      codCampana,
      product_sku: selectedOption?.product_sku,
      opciones_count: opciones?.length || 0,
      categoria,
      menu,
      submenu,
    });

    // Navegar usando los 3 parámetros requeridos por el endpoint
    router.push(`/productos/viewbundle/${baseCodigoMarket}/${codCampana}/${selectedOption?.product_sku}`);
  };

  const handleEntregoEstreno = async () => {
    if (isLoading) {
      return; // Prevenir múltiples clics mientras está cargando
    }

    setIsLoading(true);

    try {
      if (!selectedOption || skus_bundle.length === 0) {
        toast.error("No se pudo agregar el bundle", {
          description: "No hay productos disponibles en este bundle",
        });
        setIsLoading(false);
        return;
      }

      // Verificar stock antes de agregar al carrito
      if (isOutOfStock) {
        toast.error("Producto agotado", {
          description: "Este bundle no tiene stock disponible",
        });
        setIsLoading(false);
        return;
      }

      // Track del evento
      posthogUtils.capture("bundle_entrego_estreno_click", {
        bundle_id: id,
        bundle_name: name,
        product_sku: selectedOption.product_sku,
        skus_bundle,
        selected_option_index: selectedOptionIndex,
        source: "bundle_card",
      });

      // Agregar el bundle al carrito (usar la misma lógica que handleAddToCart)
      if (selectedOption.productos && selectedOption.productos.length > 0) {
        // Calcular precios proporcionales basados en el descuento del bundle
        // para que el total en el carrito coincida con el precio mostrado en el card
        const totalIndividualPrice = selectedOption.productos.reduce(
          (sum, p) => sum + (p.product_discount_price || 0),
          0
        );
        const totalOriginalPrice = selectedOption.productos.reduce(
          (sum, p) => sum + (p.product_original_price || 0),
          0
        );
        // Usar los precios totales del bundle desde selectedOption (ya calculados en el mapper)
        const bundleTotalPrice = selectedOption.bundleTotalPrice || totalIndividualPrice;
        const bundleOriginalPrice = selectedOption.bundleTotalOriginalPrice || totalOriginalPrice;

        // Factor para precios con descuento (para que sum(price) = bundle_discount)
        const priceFactor = totalIndividualPrice > 0
          ? bundleTotalPrice / totalIndividualPrice
          : 1;
        // Factor para precios originales (para que sum(originalPrice) = bundle_price)
        const originalPriceFactor = totalOriginalPrice > 0
          ? bundleOriginalPrice / totalOriginalPrice
          : 1;

        const products: Omit<CartProduct, "quantity">[] =
          selectedOption.productos.map((product, index) => ({
            id: (product.codigoMarket || product.sku).split('/')[0],
            name: product.modelo,
            image:
              product.imagePreviewUrl ||
              previewImages[index] ||
              "/img/logo_imagiq.png",
            // Usar precio proporcional para que el total coincida con bundle_discount
            price: Math.round((product.product_discount_price || 0) * priceFactor),
            // También aplicar factor proporcional al precio original para mostrar ahorro correctamente
            originalPrice: product.product_original_price
              ? Math.round(product.product_original_price * originalPriceFactor)
              : undefined,
            sku: product.sku,
            ean: product.ean || product.sku,
            color: product.color,
            colorName: product.nombreColor,
            capacity: product.capacidad,
            ram: product.memoriaram,
            stock: product.stockTotal,
            modelo: product.modelo,
            categoria: product.categoria || categoria || "IM",
          }));

        // Ajustar errores de redondeo en el último producto
        const currentTotal = products.reduce((sum, p) => sum + p.price, 0);
        const roundingDifference = bundleTotalPrice - currentTotal;
        if (roundingDifference !== 0 && products.length > 0) {
          products[products.length - 1].price += roundingDifference;
        }

        const bundleInfo: BundleInfo = {
          codCampana,
          productSku: selectedOption.product_sku,
          skusBundle: skus_bundle,
          bundlePrice: bundleOriginalPrice,    // Usar el precio total calculado
          bundleDiscount: bundleTotalPrice,    // Usar el precio total calculado
          fechaFinal: new Date(fecha_final),
          ind_entre_estre: selectedOption.ind_entre_estre,
        };

        await addBundleToCart(products, bundleInfo);
      }

      // Marcar que debe abrirse el modal de Trade-In automáticamente para este SKU específico
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "open_trade_in_modal_sku",
          selectedOption.product_sku
        );
      }

      // Pequeño delay para asegurar que el localStorage se guarde
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Navegar al carrito
      router.push("/carrito/step1");
    } catch (error) {
      console.error("Error al agregar bundle con entrego y estreno:", error);
      toast.error("Error al agregar el bundle", {
        description: "Por favor intenta de nuevo",
      });
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedOption || skus_bundle.length === 0) {
      toast.error("No se pudo agregar el bundle", {
        description: "No hay productos disponibles en este bundle",
      });
      return;
    }

    // Verificar stock antes de agregar al carrito
    if (isOutOfStock) {
      toast.error("Producto agotado", {
        description: "Este bundle no tiene stock disponible",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Verificar si tenemos el array de productos desde el backend

      if (selectedOption.productos && selectedOption.productos.length > 0) {
        // Usar datos completos del backend que ya vienen en la opción
        // Calcular precios proporcionales basados en el descuento del bundle
        // para que el total en el carrito coincida con el precio mostrado en el card
        const totalIndividualPrice = selectedOption.productos.reduce(
          (sum, p) => sum + (p.product_discount_price || 0),
          0
        );
        const totalOriginalPrice = selectedOption.productos.reduce(
          (sum, p) => sum + (p.product_original_price || 0),
          0
        );
        // Usar los precios totales del bundle desde selectedOption (ya calculados en el mapper)
        const bundleTotalPrice = selectedOption.bundleTotalPrice || totalIndividualPrice;
        const bundleOriginalPrice = selectedOption.bundleTotalOriginalPrice || totalOriginalPrice;

        // Factor para precios con descuento (para que sum(price) = bundle_discount)
        const priceFactor = totalIndividualPrice > 0
          ? bundleTotalPrice / totalIndividualPrice
          : 1;
        // Factor para precios originales (para que sum(originalPrice) = bundle_price)
        const originalPriceFactor = totalOriginalPrice > 0
          ? bundleOriginalPrice / totalOriginalPrice
          : 1;

        const products: Omit<CartProduct, "quantity">[] =
          selectedOption.productos.map((product, index) => ({
            id: (product.codigoMarket || product.sku).split('/')[0],
            name: product.modelo,
            image:
              product.imagePreviewUrl ||
              previewImages[index] ||
              "/img/logo_imagiq.png",
            // Usar precio proporcional para que el total coincida con bundle_discount
            price: Math.round((product.product_discount_price || 0) * priceFactor),
            // También aplicar factor proporcional al precio original para mostrar ahorro correctamente
            originalPrice: product.product_original_price
              ? Math.round(product.product_original_price * originalPriceFactor)
              : undefined,
            sku: product.sku,
            ean: product.ean || product.sku,
            color: product.color,
            colorName: product.nombreColor,
            capacity: product.capacidad,
            ram: product.memoriaram,
            stock: product.stockTotal,
            modelo: product.modelo,
            categoria: product.categoria || categoria || "IM",
          }));

        // Ajustar errores de redondeo en el último producto
        const currentTotal = products.reduce((sum, p) => sum + p.price, 0);
        const roundingDifference = bundleTotalPrice - currentTotal;
        if (roundingDifference !== 0 && products.length > 0) {
          products[products.length - 1].price += roundingDifference;
        }

        const bundleInfo: BundleInfo = {
          codCampana,
          productSku: selectedOption.product_sku,
          skusBundle: skus_bundle,
          bundlePrice: bundleOriginalPrice,    // Usar el precio total calculado
          bundleDiscount: bundleTotalPrice,    // Usar el precio total calculado
          fechaFinal: new Date(fecha_final),
          ind_entre_estre: selectedOption.ind_entre_estre,
        };

        await addBundleToCart(products, bundleInfo);
      } else {
        // Fallback: usar datos básicos de la opción seleccionada
        toast.warning("Usando datos básicos del bundle", {
          description: "No se pudieron obtener los detalles completos",
        });

        // Construir productos básicos desde los SKUs disponibles
        const basicProducts: Omit<CartProduct, "quantity">[] = skus_bundle.map(
          (sku, index) => ({
            id: sku,
            name: `${selectedOption.modelo || name} - Producto ${index + 1}`,
            image: previewImages[index] || "/img/logo_imagiq.png",
            price: 0, // Se calculará proporcionalmente
            sku,
            ean: sku,
            capacity: shouldRenderValue(selectedOption.capacidadProductSku)
              ? selectedOption.capacidadProductSku
              : undefined,
            color: shouldRenderValue(selectedOption.colorProductSku)
              ? selectedOption.colorProductSku
              : undefined,
            modelo: selectedOption.modelo,
            colorName: shouldRenderValue(selectedOption.nombreColorProductSku)
              ? selectedOption.nombreColorProductSku
              : undefined,
            stock: selectedOption.stockTotal,
            ram: shouldRenderValue(selectedOption.memoriaRamProductSku)
              ? selectedOption.memoriaRamProductSku
              : undefined,
            categoria: categoria || "",
          })
        );

        const bundleInfo: BundleInfo = {
          codCampana,
          productSku: selectedOption.product_sku,
          skusBundle: skus_bundle,
          bundlePrice: parseFloat(
            selectedOption.originalPrice?.replace(/[^0-9]/g, "") || "0"
          ),
          bundleDiscount: parseFloat(
            selectedOption.price?.replace(/[^0-9]/g, "") || "0"
          ),
          fechaFinal: new Date(fecha_final),
          ind_entre_estre: selectedOption.ind_entre_estre,
        };

        await addBundleToCart(basicProducts, bundleInfo);
      }

      // Track del evento
      posthogUtils.capture("bundle_add_to_cart_success", {
        bundle_id: id,
        bundle_name: name,
        product_sku: selectedOption.product_sku,
        skus_bundle,
        selected_option_index: selectedOptionIndex,
        selected_modelo: selectedOption.modelo,
        stock_available: selectedOptionStock,
        source: "bundle_card",
      });
    } catch (error) {
      console.error("Error adding bundle to cart:", error);
      toast.error("Error al agregar el bundle", {
        description: "Por favor, intenta de nuevo más tarde",
      });

      posthogUtils.capture("bundle_add_to_cart_error", {
        bundle_id: id,
        bundle_name: name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Nombre dinámico: usar el modelo de la opción seleccionada o el nombre del bundle
  const displayName = selectedOption?.modelo || name;

  // Obtener el stock de la opción seleccionada
  const selectedOptionStock = useMemo(() => {
    if (
      selectedOption?.stockTotal === undefined ||
      selectedOption?.stockTotal === null ||
      selectedOption.stockTotal < 0
    )
      return null;
    return selectedOption.stockTotal;
  }, [selectedOption]);

  // Verificar si está agotado
  const isOutOfStock = selectedOptionStock === 0;

  // Handler para solicitar notificación de stock
  const handleRequestStockNotification = async (email: string) => {
    if (!selectedOption) return;

    await stockNotification.requestNotification({
      productName: displayName,
      sku: selectedOption.product_sku,
      email,
      codigoMarket: baseCodigoMarket,
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg w-full h-full flex flex-col mx-auto",
        className
      )}
    >
      {/* Sección de imágenes del bundle - overflow visible para que las imágenes se "salgan" - Clickable */}
      <div
        className="relative aspect-square bg-gray-100 rounded-lg overflow-visible cursor-pointer hover:opacity-90 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          handleMoreInfo();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleMoreInfo();
          }
        }}
        aria-label={`Ver detalles de ${displayName}`}
      >
        {/* Etiqueta de Addi - Parte inferior izquierda */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 py-1.5 px-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm">
          <Image
            src="https://res.cloudinary.com/dzi2p0pqa/image/upload/v1764650798/acd66fce-b218-4a0d-95e9-559410496596.png"
            alt="Addi"
            width={14}
            height={14}
            className="object-contain flex-shrink-0"
          />
          <p className="text-[8px] text-gray-700 font-medium">
            Paga con <span className="font-bold">addi</span>
          </p>
        </div>

        <BundlePreviewImages images={previewImages} bundleName={displayName} />
      </div>

      {/* Contenido del bundle */}
      <div className="py-2 space-y-2 flex-1 flex flex-col">
        {/* Título del bundle - muestra el modelo de la opción seleccionada */}
        <div className="px-3 min-h-[48px]">
          <h3 className="text-xs font-bold line-clamp-2 text-black">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleMoreInfo();
              }}
              className="w-full text-left bg-transparent p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black text-black"
            >
              {displayName}
            </button>
          </h3>
          {/* SKU - Siempre visible */}
          {selectedOption?.product_sku && (
            <div className="mt-1">
              <p className="text-xs text-gray-500 font-medium">
                SKU Opción: {selectedOption.product_sku}
              </p>
            </div>
          )}
          {/* Códigos del bundle - Solo si la variable de entorno lo permite */}
          {process.env.NEXT_PUBLIC_SHOW_PRODUCT_CODES === "true" &&
            process.env.NEXT_PUBLIC_MAINTENANCE_MODE !== "true" && (
              <div className="mt-1 space-y-0.5">
                {baseCodigoMarket && (
                  <p className="text-xs text-gray-500 font-medium">
                    Código Market: {baseCodigoMarket}
                  </p>
                )}
                {codCampana && (
                  <p className="text-xs text-gray-500 font-medium">
                    Código Campaña: {codCampana}
                  </p>
                )}
                {skus_bundle && skus_bundle.length > 0 && (
                  <div className="text-xs text-gray-500 font-medium">
                    <span>SKUs Bundle: </span>
                    <span className="text-gray-400">
                      {skus_bundle.join(", ")}
                    </span>
                  </div>
                )}
                {selectedOptionStock !== null && (
                  <div className="text-xs text-gray-500 font-medium">
                    <span>Stock: </span>
                    <span
                      className={cn(
                        "font-semibold",
                        selectedOptionStock > 5
                          ? "text-green-600"
                          : selectedOptionStock > 0
                            ? "text-orange-600"
                            : "text-red-600"
                      )}
                    >
                      {selectedOptionStock} unidades
                    </span>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Vigencia del bundle - Arriba del selector */}
        {fecha_inicio && fecha_final && (
          <div className="px-3">
            <p className="text-xs font-semibold whitespace-nowrap text-blue-600 leading-tight">
              Oferta válida hasta:{" "}
              {new Date(fecha_final).toLocaleDateString("es-CO")}
            </p>
          </div>
        )}

        {/* Contenedor para selector de variantes y botón de entrego y estreno */}
        <div className="px-3 flex gap-2 items-start">
          {/* Columna izquierda: Selector de variantes */}
          <div className="flex-1">
            {opciones && opciones.length > 1 && (
              <BundleVariantSelector
                opciones={opciones}
                selectedOptionIndex={selectedOptionIndex}
                onSelectOption={setSelectedOptionIndex}
              />
            )}
          </div>

          {/* Columna derecha: Botón de Entrego y Estreno - Mostrar solo si ind_entre_estre === 1 */}
          {selectedOption?.ind_entre_estre === 1 && (
            <div className="flex-shrink-0 w-[120px] self-start -mt-4 relative z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEntregoEstreno();
                }}
                disabled={isLoading}
                className="bg-[#0099FF] text-white px-3 py-2 rounded-md text-center flex flex-col items-center justify-center w-full hover:bg-[#0088EE] active:bg-[#0077DD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative z-10"
                style={{ pointerEvents: isLoading ? "none" : "auto" }}
              >
                <svg
                  className="w-4 h-4 md:w-5 md:h-5 text-white mb-1 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <p className="text-[10px] font-bold mb-0 pointer-events-none">
                  Entrego y Estreno
                </p>
                <p className="text-[9px] opacity-90 pointer-events-none">
                  aplica ahora
                </p>
              </button>
            </div>
          )}
        </div>

        {/* Precio. sm:min-h-[42px] en el slot: reserva la línea "Ahorra" igual
            que ProductCard, para mantener los botones alineados entre cards */}
        <div className="px-3 space-y-3 mt-auto">
          {selectedOption && (
            <div className="space-y-1 min-h-[32px] sm:min-h-[42px]">
              {(() => {
                // Usar precio de la opción seleccionada
                const currentPrice = selectedOption.price;
                const currentOriginalPrice = selectedOption.originalPrice;

                const { hasSavings, savings } = calculateSavings(
                  currentPrice,
                  currentOriginalPrice
                );

                if (!hasSavings) {
                  // Sin descuento: solo precio
                  return (
                    <div className="text-xl font-bold text-black">
                      {currentPrice}
                    </div>
                  );
                }

                // Con descuento: precio + info de descuento a la derecha
                return (
                  <div className="flex items-end gap-3">
                    {/* Precio final */}
                    <div className="text-xl font-bold text-black leading-tight">
                      {currentPrice}
                    </div>

                    {/* Info de descuento a la derecha */}
                    <div className="flex flex-col items-start justify-end">
                      {/* Precio anterior tachado */}
                      <span className="text-xs line-through text-gray-500 leading-tight">
                        {currentOriginalPrice}
                      </span>
                      {/* Ahorro */}
                      <span className="text-xs font-semibold whitespace-nowrap text-blue-600 leading-tight">
                        Ahorra ${savings.toLocaleString("es-CO")}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Sección de cero interés — va ANTES de los botones (sin min-h
              reservado) para que la fila de botones quede siempre pegada al
              fondo y alineada con las demás cards del grid (simetría) */}
          <div className="mt-2 sm:mt-3 flex items-start justify-center">
            <CeroInteresSection ceroInteresData={ceroInteresData} />
          </div>

          {/* Botones de acción - Horizontal */}
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isOutOfStock) {
                  stockNotification.openModal();
                } else {
                  handleAddToCart();
                }
              }}
              disabled={isLoading}
              className={cn(
                "flex-1 py-2 px-2 rounded-full text-xs lg:text-md font-semibold transition-colors cursor-pointer",
                "bg-black text-white hover:bg-gray-800",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isLoading && "animate-pulse"
              )}
            >
              {isLoading ? (
                <Loader className="w-4 h-4 mx-auto animate-spin" />
              ) : isOutOfStock ? (
                "Notifícame"
              ) : (
                "Añadir al carrito"
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMoreInfo();
              }}
              className="text-black text-sm font-medium hover:underline transition-all whitespace-nowrap cursor-pointer"
            >
              Más información
            </button>
          </div>
        </div>
      </div>

      {/* Modal de notificación de stock */}
      <StockNotificationModal
        isOpen={stockNotification.isModalOpen}
        onClose={stockNotification.closeModal}
        productName={displayName}
        productImage={
          previewImages && previewImages.length > 0
            ? getCloudinaryUrl(previewImages[0], "catalog")
            : undefined
        }
        selectedColor={
          shouldRenderValue(selectedOption?.nombreColorProductSku)
            ? selectedOption?.nombreColorProductSku
            : undefined
        }
        selectedStorage={
          shouldRenderValue(selectedOption?.capacidadProductSku)
            ? selectedOption?.capacidadProductSku
            : undefined
        }
        onNotificationRequest={handleRequestStockNotification}
      />
    </div>
  );
}
