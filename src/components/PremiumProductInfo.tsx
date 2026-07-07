"use client";

import React from "react";
import type { ProductCardProps } from "@/app/productos/components/ProductCard";
import { useDeviceVariants, type ColorOption, type StorageOption } from "@/hooks/useDeviceVariants";
import { useCartContext } from "@/features/cart/CartContext";
import { useFavorites } from "@/features/products/useProducts";
import { posthogUtils } from "@/lib/posthogClient";
import { useRouter } from "next/navigation";

/**
 * Componente de información del producto para página premium
 * Solo muestra la información sin carrusel de imágenes
 */
const PremiumProductInfo: React.FC<{ product: ProductCardProps }> = ({
  product,
}) => {
  const {
    colorOptions,
    storageOptions,
    selectedDevice,
    selectedStorage,
    selectedColor,
    selectedVariant,
    currentPrice,
    loading: variantsLoading,
    setSelectedColor,
    setSelectedStorage,
  } = useDeviceVariants(product.id);

  const { addProduct } = useCartContext();
  const router = useRouter();
  const { addToFavorites, removeFromFavorites, isFavorite: checkIsFavorite } =
    useFavorites();

  const isFavorite = checkIsFavorite(product.id);

  const handleColorSelection = (colorOption: ColorOption) => {
    setSelectedColor(colorOption);
    posthogUtils.capture("product_color_selected", {
      product_id: product.id,
      product_name: product.name,
      selected_color: colorOption.color,
    });
  };

  const handleStorageSelection = (storage: StorageOption) => {
    setSelectedStorage(storage);
    posthogUtils.capture("product_storage_selected", {
      product_id: product.id,
      product_name: product.name,
      selected_storage: storage.capacidad,
    });
  };

  const handleAddToCart = async () => {
    if (!selectedStorage || !selectedColor || !selectedDevice) {
      alert("Por favor selecciona todas las opciones del producto");
      return;
    }

    if (!selectedVariant?.sku) {
      console.error("Error: No SKU disponible para el variant seleccionado");
      alert("Error al agregar el producto al carrito");
      return;
    }

    try {
      let priceValue = 0;
      const price = currentPrice as string | number | null;

      if (typeof price === "string") {
        priceValue = Number.parseInt(price.replace(/[^\d]/g, ""));
      } else if (typeof price === "number") {
        priceValue = price;
      }

      addProduct({
        id: product.id,
        name: product.name,
        image:
          typeof product.image === "string" ? product.image : product.image.src,
        price: priceValue,
        quantity: 1,
        sku: selectedVariant.sku,
        ean: selectedVariant.ean || "",
        puntos_q: 4,
        categoria: product.apiProduct?.categoria || "",
      });

      // add_to_cart_click se emite centralizado en CartContext.addProduct.

      alert("Producto agregado al carrito");
    } catch (error) {
      console.error("Error al agregar al carrito:", error);
      alert("Error al agregar el producto al carrito");
    }
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push("/carrito");
  };

  const handleToggleFavorite = () => {
    if (isFavorite) {
      removeFromFavorites(product.id);
    } else {
      addToFavorites(product.id);
    }
    posthogUtils.capture("toggle_favorite", {
      product_id: product.id,
      product_name: product.name,
      action: isFavorite ? "remove" : "add",
    });
  };

  const hasStock = () => {
    if (!selectedVariant) return true;
    return selectedVariant.stockTotal > 0;
  };

  const parsePrice = (price: string | number | null | undefined): number => {
    if (typeof price === "number") return price;
    if (!price) return 0;
    if (typeof price === "string") {
      return parseInt(price.replace(/[^\d]/g, "")) || 0;
    }
    return 0;
  };

  const numericPrice = parsePrice(currentPrice);

  return (
    <div className="w-full space-y-6">
      {/* Nombre del producto */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          {product.name}
        </h1>
        {product.apiProduct?.modelo?.[0] && (
          <p className="text-sm text-gray-600">Modelo: {product.apiProduct.modelo[0]}</p>
        )}
      </div>

      {/* Rating - ProductCardProps doesn't have rating or reviewCount, so we'll skip this section */}

      {/* Precio */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-gray-900">
            ${numericPrice.toLocaleString("es-CO")}
          </span>
          {product.originalPrice && (
            <span className="text-lg text-gray-500 line-through">
              {product.originalPrice}
            </span>
          )}
        </div>
        {product.discount && (
          <span className="inline-block bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-semibold">
            {product.discount}
          </span>
        )}
      </div>

      {/* Opciones de Color */}
      {colorOptions && colorOptions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Elige tu Color
          </h3>
          <div className="flex flex-wrap gap-3">
            {colorOptions.map((colorOption) => (
              <button
                key={colorOption.color}
                onClick={() => handleColorSelection(colorOption)}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${selectedColor?.color === colorOption.color
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-400"
                  }`}
              >
                <div
                  className="w-12 h-12 rounded-full mb-2"
                  style={{ backgroundColor: colorOption.hex }}
                />
                <span className="text-xs font-medium text-gray-700">
                  {colorOption.color}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Opciones de Almacenamiento */}
      {storageOptions && storageOptions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Elige tu Almacenamiento
          </h3>
          <div className="flex flex-wrap gap-3">
            {storageOptions.map((storage) => (
              <button
                key={storage.capacidad}
                onClick={() => handleStorageSelection(storage)}
                className={`px-6 py-3 rounded-lg border-2 font-medium transition-all ${selectedStorage?.capacidad === storage.capacidad
                  ? "border-black bg-black text-white"
                  : "border-gray-300 hover:border-gray-500"
                  }`}
              >
                {storage.capacidad}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stock Status */}
      {!hasStock() && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 font-semibold">Sin stock</p>
        </div>
      )}

      {/* Botones de Acción */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={handleAddToCart}
          disabled={!hasStock() || variantsLoading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {variantsLoading ? "Cargando..." : "Agregar al carrito"}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={!hasStock() || variantsLoading}
          className="flex-1 bg-black hover:bg-gray-800 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Comprar ahora
        </button>
        <button
          onClick={handleToggleFavorite}
          className="p-4 border-2 border-gray-300 rounded-lg hover:border-red-500 transition-colors"
        >
          <span
            className={`text-2xl ${isFavorite ? "text-red-500" : "text-gray-400"
              }`}
          >
            ♥
          </span>
        </button>
      </div>

      {/* Descripción */}
      {product.apiProduct?.descGeneral?.[0] && (
        <div className="pt-6 border-t">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Descripción
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {product.apiProduct.descGeneral[0]}
          </p>
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <p className="font-semibold text-gray-900">
          • Envío gratis en compras mayores a $500.000
        </p>
        <p className="font-semibold text-gray-900">
          • Garantía oficial Samsung
        </p>
        <p className="font-semibold text-gray-900">
          • Devolución en 30 días
        </p>
      </div>
    </div>
  );
};

export default PremiumProductInfo;

