"use client";

import React, { useState } from "react";
import CardBrandLogo from "./CardBrandLogo";

interface AnimatedCardProps {
  cardNumber: string;
  cardHolder: string;
  expiryDate: string;
  cvv: string;
  brand?: string;
  isFlipped?: boolean;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  cardNumber,
  cardHolder,
  expiryDate,
  cvv,
  brand,
  isFlipped: externalIsFlipped = false,
}) => {
  const [internalIsFlipped, setInternalIsFlipped] = useState(false);
  const isFlipped = externalIsFlipped || internalIsFlipped;

  // Formatear número de tarjeta para mostrar (primeros 6 dígitos visibles, resto enmascarado)
  const formatCardNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, "");
    const masked = cleaned.length > 6
      ? cleaned.slice(0, 6) + cleaned.slice(6).replace(/\d/g, "•")
      : cleaned;
    const padded = masked.padEnd(16, "•");
    const groups = padded.match(/.{1,4}/g) || [];
    return groups.join(" ");
  };

  // Enmascarar CVV para display
  const maskedCvv = cvv ? "•".repeat(cvv.length) : "•••";

  // Determinar color del fondo según marca (colores pastel suaves)
  const getCardColor = () => {
    if (!brand) return "from-slate-300 to-slate-400";

    const brandLower = brand.toLowerCase();
    if (brandLower.includes("visa")) return "from-blue-300 to-blue-400";
    if (brandLower.includes("mastercard")) return "from-orange-300 to-red-300";
    if (brandLower.includes("amex") || brandLower.includes("american")) return "from-teal-300 to-teal-400";
    if (brandLower.includes("discover")) return "from-orange-300 to-orange-400";

    return "from-slate-300 to-slate-400";
  };

  // Logo de marca usando el componente CardBrandLogo
  const renderBrandLogo = () => {
    return (
      <div className="scale-125">
        <CardBrandLogo brand={brand} size="lg" />
      </div>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto perspective-1000">
      <div
        className={`relative w-full aspect-[1.6/1] transition-transform duration-700 transform-style-3d ${isFlipped ? "rotate-y-180" : ""
          }`}
        onMouseEnter={() => cvv && !externalIsFlipped && setInternalIsFlipped(true)}
        onMouseLeave={() => !externalIsFlipped && setInternalIsFlipped(false)}
      >
        {/* Frente de la tarjeta */}
        <div
          className={`absolute w-full h-full rounded-2xl shadow-2xl bg-gradient-to-br ${getCardColor()} p-6 md:p-7 flex flex-col justify-between backface-hidden`}
        >
          {/* Chip y logo */}
          <div className="flex justify-between items-start">
            <div className="w-14 h-11 rounded bg-gradient-to-br from-yellow-200 to-yellow-400 shadow-md" />
            <div className="scale-125">
              {renderBrandLogo()}
            </div>
          </div>

          {/* Número de tarjeta */}
          <div>
            <div className="text-gray-800 text-lg md:text-xl font-mono tracking-wider mb-5 font-semibold">
              {formatCardNumber(cardNumber)}
            </div>

            {/* Titular y fecha */}
            <div className="flex justify-between items-end">
              <div>
                <div className="text-gray-700 text-[10px] mb-1 font-semibold">TITULAR</div>
                <div className="text-gray-800 text-xs md:text-sm font-bold tracking-wide uppercase">
                  {cardHolder || "NOMBRE APELLIDO"}
                </div>
              </div>
              <div>
                <div className="text-gray-700 text-[10px] mb-1 font-semibold">VENCE</div>
                <div className="text-gray-800 text-xs md:text-sm font-mono font-semibold">
                  {expiryDate || "MM/AA"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reverso de la tarjeta */}
        <div
          className={`absolute w-full h-full rounded-2xl shadow-2xl bg-gradient-to-br ${getCardColor()} backface-hidden rotate-y-180`}
        >
          {/* Banda magnética */}
          <div className="w-full h-14 bg-black mt-7" />

          {/* CVV */}
          <div className="px-6 md:px-7 mt-8">
            <div className="bg-white h-12 rounded flex items-center justify-end px-4">
              <div className="text-black font-mono text-lg italic font-semibold">
                {maskedCvv}
              </div>
            </div>
            <div className="text-gray-200 text-[10px] mt-2 text-right font-semibold">CVV</div>
          </div>

        </div>
      </div>

      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
};

export default AnimatedCard;
