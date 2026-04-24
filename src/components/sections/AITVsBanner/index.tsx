/**
 * 🎬 AI TVS BANNER - Main Component
 *
 * Banner destacado para Nuevos AI TVs 2025
 * - Componente modular y reutilizable
 * - Sin tipos 'any'
 * - Responsive para desktop y mobile
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { BANNER_IMAGES } from "./cloudinary-config";
import { BannerImage } from "./BannerImage";
import { posthogUtils } from "@/lib/posthogClient";

export default function AITVsBanner() {
  const [isHovering, setIsHovering] = useState(false);

  const images = {
    desktop: BANNER_IMAGES.desktop.url,
    mobile: BANNER_IMAGES.mobile.url,
  };

  const handleButtonClick = () => {
    posthogUtils.capture("ai_tvs_banner_click", {
      action: "comprar",
      source: "ai_tvs_banner",
    });
  };

  return (
    <section
      className="w-full relative px-4 md:px-6 lg:px-8"
      aria-label="Nuevos AI TVs 2025 Showcase"
    >
      {/* Main Banner */}
      <div className="relative w-full h-[680px] md:h-[500px] lg:h-[810px] max-w-[1440px] mx-auto overflow-hidden rounded-lg">
        {/* Background Image */}
        <BannerImage images={images} />

        {/* Content Overlay */}
        <div className="relative z-10 h-full flex flex-col items-center md:items-start justify-start md:justify-center pt-12 md:pt-0 px-6 md:px-12 lg:px-20">
          {/* Title */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-3 md:mb-4 tracking-tight text-center md:text-left">
            <span style={{ fontFamily: "'Samsung Sharp Sans', sans-serif", fontWeight: 900 }}>
              Nuevos AI TVs 2025
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-sm md:text-base lg:text-lg text-white mb-6 md:mb-8 max-w-md text-center md:text-left">
            <span style={{ fontFamily: "'Samsung Sharp Sans', sans-serif", fontWeight: 400 }}>
              Sin interés a 3, 6 o 12 cuotas pagando con bancos aliados
            </span>
          </p>

          {/* Action Button */}
          <Link
            href="/productos/tv-y-audio"
            className="group inline-block"
            onClick={handleButtonClick}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <button
              className={`
                px-6 md:px-8 py-2.5 md:py-3 rounded-full text-sm md:text-base font-bold
                transition-all duration-300
                ${
                  isHovering
                    ? "bg-white text-black"
                    : "bg-transparent text-white border-2 border-white"
                }
              `}
            >
              <span style={{ fontFamily: "'Samsung Sharp Sans', sans-serif", fontWeight: 700 }}>
                Comprar
              </span>
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
