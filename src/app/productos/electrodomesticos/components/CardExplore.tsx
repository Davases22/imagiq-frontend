/**
 * 🎴 CardExplore - IMAGIQ ECOMMERCE
 *
 * Componente reutilizable para mostrar productos a explorar:
 * - Botones de acción (Compra aquí, Conoce mas)
 * - Responsive design
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image, { StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import { posthogUtils } from "@/lib/posthogClient";

export interface ProductColor {
  name: string; // Nombre técnico del color (ej: "black", "white")
  hex: string; // Código hexadecimal del color (ej: "#000000")
  label: string; // Nombre mostrado al usuario (ej: "Negro Medianoche")
  sku: string; // SKU específico para esta variante de color
  price?: string; // Precio específico para este color (opcional)
  originalPrice?: string; // Precio original antes de descuento (opcional)
  discount?: string; // Descuento específico para este color (opcional)
}

export interface ExploreProductProps {
  id: string;
  name: string;
  image: string | StaticImageData;
  onAddToCart?: (productId: string, color: string) => void;
  sku?: string | null;
  segmento?: string | string[]; // Segmento del producto (Premium, etc.) - puede ser string o array
  className?: string;
}

export default function CardExplore({
  id,
  name,
  image,
  segmento,
  className,
}: ExploreProductProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);


  const handleMoreInfo = () => {
    console.log(`🔗 Navegando a producto con ID: ${id}`);
    console.log(`📝 Nombre del producto: ${name}`);
    // Navega primero a la página multimedia (slug sin slash: AV/DA traen '/').
    router.push(`/productos/multimedia/${String(id).split("/")[0]}`);
    posthogUtils.capture("product_more_info_click", {
      product_id: id,
      product_name: name,
      source: "product_card",
      destination: "multimedia_page",
      segment: segmento,
    });
  };

  const handleBuy = () => {
    alert("Compra iniciada");
  };
  return (
    <div
      className={cn(
        "bg-[#D9D9D9] rounded-2xl max-w-72 shadow-sm border border-gray-300 overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header con badges */}
      <div className="relative">
        {/* Imagen del producto */}
        <div className="relative bg-[#D9D9D9] aspect-square overflow-hidden">
          <Image
            src={image}
            alt={name}
            fill
            className={cn(
              "object-contain transition-transform duration-300 p-6",
              isHovered && "scale-105"
            )}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 bg-[#D9D9D9]">
        {/* Título del producto */}
        <h3 className="font-semibold text-gray-900 text-center text-base mb-3 line-clamp-2 leading-5 truncate">
          {name}
        </h3>

        {/* Botones de acción */}
        <div className="space-y-2">
          {/* <button
            onClick={handleMoreInfo}
            className="w-full bg-white border border-gray-400 text-gray-700 py-3 px-4 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors duration-200"
          >
            ¡Compra aquí!
          </button> */}
          <button
            className="w-full bg-black text-white border border-black rounded-full px-4 py-2 font-semibold text-sm sm:text-base shadow hover:bg-gray-900 transition-all"
            style={{ fontFamily: "SamsungSharpSans" }}
            onClick={handleBuy}
          >
            ¡Compra aquí!
          </button>

          <button
            className="w-full bg-transparent text-black border border-black rounded-full px-4 py-2 font-semibold text-sm sm:text-base shadow hover:bg-white/30 transition-all"
            style={{ fontFamily: "SamsungSharpSans" }}
            onClick={handleMoreInfo}
          >
            Más información
          </button>
        </div>
      </div>
    </div>
  );
}
