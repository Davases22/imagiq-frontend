/**
 * 📞 CONTACT SECTION - COMPARTIDO
 * Componente genérico de contacto reutilizable para todas las industrias
 */

"use client";

import React from "react";

interface ContactSectionProps {
  onContactClick: () => void;
  title: string;
  description: string;
  buttonText?: string;
}

/**
 * Cierre de cada página de industria.
 *
 * Antes cada industria pintaba aquí un degradado propio (morado en educación,
 * rojo en hoteles, azul en gobierno...), lo que daba una franja enorme y de un
 * color distinto en cada página. Ahora es una banda negra, sobria y bastante
 * más baja, igual en todas.
 */
export default function ContactSection({
  onContactClick,
  title,
  description,
  buttonText = "Contáctanos",
}: ContactSectionProps) {
  return (
    <section className="relative bg-black py-12 md:py-16">
      <div className="relative container mx-auto max-w-3xl px-4 text-center">
        <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">
          {title}
        </h2>
        <p className="mb-6 text-base leading-relaxed text-white/80 md:text-lg">
          {description}
        </p>
        <button
          onClick={onContactClick}
          className="inline-flex items-center rounded-full bg-white px-8 py-3 text-base font-bold text-black transition-colors duration-200 hover:bg-gray-200 md:px-10"
        >
          {buttonText}
        </button>
      </div>
    </section>
  );
}
