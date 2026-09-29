/**
 * 🎨 HERO IMAGE COMPONENT
 * Componente optimizado solo para secciones hero corporativas
 */

"use client";

import React from "react";
import Image from "next/image";

interface HeroImageProps {
  publicId: string;
  alt: string;
  className?: string;
}

const HeroImage: React.FC<HeroImageProps> = ({
  publicId,
  alt,
  className = "",
}) => {
  // `f_auto,q_auto` deja que Cloudinary elija formato (AVIF/WebP segun el
  // navegador) y calidad. No cambia las dimensiones ni el encuadre, solo el
  // peso: los banners de industria bajan de 130 y 125 KB a 75 y 57 KB.
  const imageUrl = `https://res.cloudinary.com/dqsdl9bwv/image/upload/f_auto,q_auto/${publicId}`;

  return (
    <Image
      src={imageUrl}
      alt={alt}
      width={1920}
      height={1080}
      priority
      quality={90}
      className={`w-full h-auto object-contain ${className}`}
      sizes="100vw"
      loading="eager"
      unoptimized // Evita procesamiento adicional que puede causar timeout
    />
  );
};

export default HeroImage;
