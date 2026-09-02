import React from "react";
import { Heart } from "lucide-react";
import { cleanProductName } from "@/lib/utils";
import ShareButtons from "@/components/ShareButtons";

interface ProductHeaderProps {
  readonly name: string;
  readonly sku?: string;
  readonly codigoMarket?: string;
  readonly stock?: number;
  readonly stockTotal?: number;
  readonly rating?: number;
  readonly reviewCount?: number;
  readonly isFavorite: boolean;
  readonly onToggleFavorite: () => void;
}

export default function ProductHeader({
  name,
  sku,
  codigoMarket,
  stock,
  stockTotal,
  rating,
  reviewCount,
  isFavorite,
  onToggleFavorite,
}: ProductHeaderProps) {
  const getStarClassName = (index: number, rating: number) => {
    if (index < Math.floor(rating)) {
      return "text-black fill-black";
    }
    if (index < rating) {
      return "text-black fill-black";
    }
    return "text-gray-300 fill-gray-300";
  };
  return (
    <div className="mb-8">
      <div className="flex items-start gap-4 mb-4 pr-4">
        <h1
          className="text-[2rem] leading-tight font-bold text-[#222] flex-1"
          style={{ letterSpacing: "-0.5px" }}
        >
          {cleanProductName(name)}
        </h1>
        <div className="flex items-center gap-1 flex-shrink-0 mt-2">
          {/* Botón de favoritos */}
          <button
            onClick={onToggleFavorite}
            className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
            aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          >
            <Heart
              className={`w-5 h-5 transition-all duration-200 ${
                isFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-gray-400 hover:text-red-500"
              }`}
            />
          </button>
          {/* Botón de compartir: nombre y SKU de la variante mostrada */}
          <ShareButtons title={cleanProductName(name)} sku={sku} />
        </div>
      </div>

      {/* Información del producto */}
      {/* SKU - Siempre visible */}
      {sku && (
        <div className="text-sm text-gray-500 mb-3">
          <span className="font-medium">SKU:</span> {sku}
        </div>
      )}
      {/* Código y Stock - Solo si la variable de entorno lo permite */}
      {process.env.NEXT_PUBLIC_SHOW_PRODUCT_CODES === 'true' && (codigoMarket || stock !== undefined || stockTotal !== undefined) && (
        <div className="text-sm text-gray-500 mb-3 space-y-1">
          {codigoMarket && (
            <div>
              <span className="font-medium">Código:</span> {codigoMarket}
            </div>
          )}
          {stock !== undefined && (
            <div>
              <span className="font-medium">Stock:</span> {stock}
            </div>
          )}
          {stockTotal !== undefined && (
            <div>
              <span className="font-medium">Stock Total:</span> {stockTotal}
            </div>
          )}
        </div>
      )}

      {/* Calificación del producto */}
      {rating && (
        <div className="flex items-center gap-2 mb-8">
          <div className="flex items-center">
            {Array.from({ length: 5 }, (_, index) => (
              <svg
                key={`star-${index + 1}`}
                className={`w-3.5 h-3.5 ${getStarClassName(index, rating)}`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
              >
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
            ))}
          </div>
          <span className="text-sm text-[#222] font-semibold">
            {rating.toFixed(1)}
          </span>
          {reviewCount && (
            <span className="text-sm text-[#222]">
              ({reviewCount})
            </span>
          )}
        </div>
      )}

      {/* Línea separadora */}
      <div className="h-px bg-gray-200 mb-8"></div>
    </div>
  );
}
