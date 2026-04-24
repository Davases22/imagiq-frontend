/**
 * 🌟 GALAXY SHOWCASE BANNER - Main Component
 *
 * Banner destacado para Galaxy Z Flip7 y Watch8
 * - Menos de 200 líneas de código
 * - Sin tipos 'any'
 * - Componentes modulares
 */

"use client";

import { BANNER_IMAGES } from "./cloudinary-config";
import { BannerImage } from "./BannerImage";
import { BannerButtons } from "./BannerButtons";

export default function GalaxyShowcaseBanner() {
  const images = {
    desktop: BANNER_IMAGES.desktop.url,
    mobile: BANNER_IMAGES.mobile.url,
  };

  return (
    <section
      className="w-full relative bg-white px-4 md:px-6 lg:px-8"
      aria-label="Galaxy Z Flip7 y Watch8 Showcase"
    >
      {/* Main Banner - Aspect ratio 1440x816 (16:9 aprox) */}
      <div className="relative w-full h-[600px] md:h-[500px] lg:h-[816px] max-w-[1440px] mx-auto overflow-hidden bg-white rounded-lg">
        {/* Background Image */}
        <BannerImage images={images} />

        {/* Content Overlay */}
        <div className="relative z-10 h-full flex flex-col items-center justify-end pb-12 md:pb-16 lg:pb-20 px-4">
          {/* Title */}
          <h2 className="text-2xl md:text-5xl lg:text-6xl font-black text-black mb-6 md:mb-10 lg:mb-12 text-center tracking-tight drop-shadow-[0_2px_12px_rgba(255,255,255,0.6)]">
            <span
              style={{
                fontFamily: "'Samsung Sharp Sans', sans-serif",
                fontWeight: 900,
              }}
            >
              Galaxy Z Flip7 | Watch8
            </span>
          </h2>

          {/* Action Buttons */}
          <BannerButtons />
        </div>

        {/* Bottom Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-72 bg-gradient-to-t from-white/40 via-white/20 to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
