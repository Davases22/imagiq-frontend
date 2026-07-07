"use client";

import { useState, useMemo } from "react";
import { Plus, Loader } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCartContext } from "@/features/cart/CartContext";
import { useProductSelection } from "@/hooks/useProductSelection";
import { ColorSelector, CapacitySelector } from "@/app/productos/components/ProductCardComponents";
import type { ProductColor, ProductCapacity } from "@/app/productos/components/ProductCard";
import { getCloudinaryUrl } from "@/lib/cloudinary";
import { calculateSavings, formatCapacityLabel } from "@/app/productos/components/utils/productCardHelpers";
import { shouldShowCapacitySelector } from "@/app/productos/components/utils/categoryColorConfig";
import { shouldRenderColor, shouldRenderValue } from "@/app/productos/components/utils/shouldRenderValue";
import { posthogUtils } from "@/lib/posthogClient";
import type { ProductApiData } from "@/lib/api";

interface SuggestionCardProps {
  product: ProductApiData;
}

export default function SuggestionCard({ product }: SuggestionCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { addProduct, getQuantityBySku } = useCartContext();

  const productSelection = useProductSelection(product);

  const showCapacitySelector = shouldShowCapacitySelector(
    product.categoria,
    product.subcategoria,
  );

  // Nombre del producto basado en la variante seleccionada
  const currentProductName = useMemo(() => {
    if (productSelection.selectedVariant?.index !== undefined) {
      const idx = productSelection.selectedVariant.index;
      const name = product.modelo?.[idx] || product.nombreMarket?.[idx];
      if (name) return name;
    }
    return product.desDetallada[0] || product.nombreMarket?.[0] || "";
  }, [product, productSelection.selectedVariant]);

  // Imagen actual basada en variante seleccionada
  const currentImage = useMemo(() => {
    if (productSelection.selectedVariant?.imagePreviewUrl) {
      return productSelection.selectedVariant.imagePreviewUrl;
    }
    return product.imagePreviewUrl[0] || "";
  }, [product, productSelection.selectedVariant]);

  // Precios
  const currentPrice = productSelection.selectedPrice;
  const currentOriginalPrice = productSelection.selectedOriginalPrice;

  const formattedPrice = currentPrice
    ? `$ ${Math.round(currentPrice).toLocaleString("es-CO")}`
    : `$ ${(product.precioeccommerce[0] || product.precioNormal[0]).toLocaleString("es-CO")}`;

  const formattedOriginalPrice = currentOriginalPrice
    ? `$${Math.round(currentOriginalPrice).toLocaleString("es-CO")}`
    : undefined;

  const { hasSavings, savings } = calculateSavings(formattedPrice, formattedOriginalPrice);

  // SKU y stock
  const currentSku = productSelection.selectedSku || product.sku[0];
  const quantityInCart = currentSku ? getQuantityBySku(currentSku) : 0;
  const realStock = Math.max(
    0,
    (productSelection.selectedVariant?.stockDisponible ?? 0) - quantityInCart,
  );
  const isOutOfStock = realStock <= 0;

  // Color seleccionado
  const displayedSelectedColor = useMemo(() => {
    const colorOptions = productSelection
      .getColorOptions()
      .filter((c) => shouldRenderColor(c.hex, c.nombreColorDisplay || c.color))
      .map((colorOption) => ({
        name: colorOption.color,
        hex: colorOption.hex,
        label: colorOption.nombreColorDisplay || colorOption.color,
        nombreColorDisplay: colorOption.nombreColorDisplay || undefined,
        sku: colorOption.variants[0]?.sku || "",
        ean: colorOption.variants[0]?.ean || "",
      }));

    return (
      colorOptions.find(
        (c) =>
          c.name === productSelection.selection.selectedColor ||
          c.hex === productSelection.selection.selectedColor,
      ) || null
    );
  }, [productSelection]);

  // Colores válidos para el selector
  const validColors = useMemo(() => {
    return productSelection
      .getColorOptions()
      .filter((c) => shouldRenderColor(c.hex, c.nombreColorDisplay || c.color))
      .map((colorOption) => ({
        name: colorOption.color,
        hex: colorOption.hex,
        label: colorOption.nombreColorDisplay || colorOption.color,
        nombreColorDisplay: colorOption.nombreColorDisplay || undefined,
        sku: colorOption.variants[0]?.sku || "",
        ean: colorOption.variants[0]?.ean || "",
      }));
  }, [productSelection]);

  // Capacidades disponibles
  const capacityOptions: ProductCapacity[] = useMemo(() => {
    if (!showCapacitySelector) return [];
    return productSelection.availableCapacities.map((capacityName) => {
      const formattedLabel = formatCapacityLabel(capacityName);
      return {
        value: capacityName.toLowerCase().replaceAll(/\s+/g, ""),
        label: formattedLabel,
        sku: "",
        ean: "",
      };
    });
  }, [showCapacitySelector, productSelection.availableCapacities]);

  const selectedCapacity = useMemo(() => {
    const sel = productSelection.selection.selectedCapacity;
    if (!sel) return null;
    return (
      capacityOptions.find(
        (c) => c.label === formatCapacityLabel(sel),
      ) || null
    );
  }, [productSelection.selection.selectedCapacity, capacityOptions]);

  const handleColorSelect = (color: ProductColor) => {
    productSelection.selectColor(color.name);
    posthogUtils.capture("suggestion_color_selected", {
      product_id: product.codigoMarketBase,
      color_name: color.name,
    });
  };

  const handleCapacitySelect = (capacity: ProductCapacity) => {
    productSelection.selectCapacity(capacity.label);
    posthogUtils.capture("suggestion_capacity_selected", {
      product_id: product.codigoMarketBase,
      capacity_value: capacity.value,
    });
  };

  const handleMoreInfo = () => {
    const selectedProductData = {
      productId: product.codigoMarketBase,
      productName: currentProductName,
      price: currentPrice || product.precioeccommerce[0] || product.precioNormal[0],
      originalPrice: currentOriginalPrice,
      color: displayedSelectedColor?.nombreColorDisplay || productSelection.selection.selectedColor,
      colorHex: displayedSelectedColor?.hex,
      capacity: productSelection.selection.selectedCapacity,
      sku: currentSku,
      ean: productSelection.selectedVariant?.ean,
      image: typeof currentImage === "string" ? currentImage : "",
      segmento: product.segmento?.[0],
    };

    localStorage.setItem(
      `product_selection_${product.codigoMarketBase}`,
      JSON.stringify(selectedProductData),
    );

    router.push(`/productos/multimedia/${product.codigoMarketBase}`);
    posthogUtils.capture("suggestion_more_info_click", {
      product_id: product.codigoMarketBase,
      product_name: currentProductName,
    });
  };

  const handleAddToCart = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const skuToUse = currentSku || product.sku[0];
      const eanToUse = productSelection.selectedVariant?.ean || product.ean[0] || "";

      if (!skuToUse) {
        setIsLoading(false);
        return;
      }

      const priceValue = currentPrice || product.precioeccommerce[0] || product.precioNormal[0];
      const originalPriceValue = currentOriginalPrice || undefined;

      await addProduct({
        id: product.codigoMarketBase,
        name: currentProductName,
        image: typeof currentImage === "string"
          ? getCloudinaryUrl(currentImage, "catalog")
          : "",
        price: typeof priceValue === "number" ? priceValue : 0,
        originalPrice: typeof originalPriceValue === "number" ? originalPriceValue : undefined,
        stock: productSelection.selectedVariant?.stockDisponible ?? 0,
        quantity: 1,
        sku: skuToUse,
        ean: eanToUse,
        color:
          displayedSelectedColor?.hex && shouldRenderValue(displayedSelectedColor.hex)
            ? displayedSelectedColor.hex
            : undefined,
        colorName:
          displayedSelectedColor?.nombreColorDisplay &&
          shouldRenderValue(displayedSelectedColor.nombreColorDisplay)
            ? displayedSelectedColor.nombreColorDisplay
            : productSelection.selection.selectedColor &&
                shouldRenderValue(productSelection.selection.selectedColor)
              ? productSelection.selection.selectedColor
              : undefined,
        capacity:
          productSelection.selection.selectedCapacity &&
          shouldRenderValue(productSelection.selection.selectedCapacity)
            ? productSelection.selection.selectedCapacity
            : undefined,
        skuPostback: productSelection.selectedSkuPostback || "",
        desDetallada: productSelection.selectedVariant?.desDetallada,
        modelo: product.modelo?.[0] || "",
        categoria: product.categoria || "",
      }, { source: "suggestion_card" });

      // Evento de intención específico (complementario al add_to_cart_click
      // centralizado de CartContext, que es el paso de funnel).
      posthogUtils.capture("suggestion_add_to_cart", {
        product_id: product.codigoMarketBase,
        product_name: currentProductName,
        sku: skuToUse,
        source: "suggestion_card",
      });
    } catch (error) {
      console.error("Error al agregar producto sugerido:", error);
    } finally {
      setTimeout(() => setIsLoading(false), 300);
    }
  };

  return (
    <div className="flex-shrink-0 flex flex-col w-[180px] snap-start bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Imagen con botón "+" */}
      <div className="relative aspect-square bg-[#F4F4F4] flex items-center justify-center">
        <div
          className="w-full h-full flex items-center justify-center p-3 cursor-pointer"
          onClick={handleMoreInfo}
        >
          <Image
            src={getCloudinaryUrl(
              typeof currentImage === "string" ? currentImage : "",
              "catalog",
            )}
            alt={currentProductName}
            width={140}
            height={140}
            className="object-contain"
          />
        </div>
        <button
          className="absolute top-2 right-2 bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg shadow-green-500/40 hover:bg-green-700 hover:shadow-xl hover:shadow-green-500/50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Agregar ${currentProductName}`}
          onClick={handleAddToCart}
          disabled={isLoading || isOutOfStock}
        >
          {isLoading ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Contenido */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {/* Color name */}
        {displayedSelectedColor &&
          shouldRenderColor(displayedSelectedColor.hex, displayedSelectedColor.nombreColorDisplay) && (
            <p className="text-[10px] text-gray-500 font-medium truncate">
              Color: {displayedSelectedColor.nombreColorDisplay}
            </p>
          )}

        {/* Selector de colores */}
        {validColors.length > 0 && (
          <ColorSelector
            colors={validColors}
            selectedColor={displayedSelectedColor}
            onColorSelect={handleColorSelect}
            onShowMore={handleMoreInfo}
          />
        )}

        {/* Selector de capacidad */}
        {capacityOptions.length > 0 && (
          <CapacitySelector
            capacities={capacityOptions}
            selectedCapacity={selectedCapacity}
            onCapacitySelect={handleCapacitySelect}
          />
        )}

        {/* Nombre del producto */}
        <h4 className="font-semibold text-gray-900 text-xs leading-tight line-clamp-2 mt-1">
          {currentProductName}
        </h4>

        {/* Precios */}
        <div className="mt-auto pt-1">
          <div className="text-sm font-bold text-gray-900">{formattedPrice}</div>
          {hasSavings && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] line-through text-gray-400">
                {formattedOriginalPrice}
              </span>
              <span className="text-[10px] font-semibold text-blue-600">
                -${savings.toLocaleString("es-CO")}
              </span>
            </div>
          )}
        </div>

        {/* Más información */}
        <button
          onClick={handleMoreInfo}
          className="text-[11px] text-gray-600 font-medium hover:underline transition-all cursor-pointer text-left mt-1"
        >
          Más información
        </button>
      </div>
    </div>
  );
}
