"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES } from "@/constants/corporate-sales";
import { Industry } from "@/types/corporate-sales";

interface IndustrySelectorProps {
  onIndustrySelect?: (industry: Industry) => void;
  selectedIndustry?: string;
}

export default function IndustrySelector({
  onIndustrySelect,
  selectedIndustry,
}: IndustrySelectorProps) {
  const [selected, setSelected] = useState<string>(selectedIndustry || "");
  const router = useRouter();

  const handleIndustryClick = (industry: Industry) => {
    setSelected(industry.id);
    onIndustrySelect?.(industry);
    // Navegar a la página específica de la industria
    router.push(industry.href);
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            A la medida de tu industria
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Encuentra las soluciones tecnológicas perfectas para tu sector
            empresarial
          </p>
        </div>

        {/* Industry Buttons Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {INDUSTRIES.map((industry) => (
            <button
              key={industry.id}
              onClick={() => handleIndustryClick(industry)}
              className={`
                group relative p-6 rounded-2xl border-2 transition-all duration-300 ease-in-out
                transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/20
                overflow-hidden
                ${
                  selected === industry.id
                    ? `border-blue-500 ${industry.bgColor} ring-4 ring-blue-500/20`
                    : `border-gray-200 bg-white hover:border-gray-300`
                }
              `}
              aria-label={`Seleccionar industria ${industry.name}`}
            >
              {/* Default Content (Icon + Name) */}
              <div className="flex flex-col items-center text-center space-y-3 transition-opacity duration-300 group-hover:opacity-0">
                <div
                  className={`
                  w-16 h-16 rounded-full flex items-center justify-center text-3xl
                  transition-transform duration-300
                  ${
                    selected === industry.id
                      ? "bg-white shadow-md"
                      : "bg-gray-50"
                  }
                `}
                >
                  {industry.icon}
                </div>

                {/* Industry Name */}
                <h3
                  className={`
                  font-semibold text-lg transition-colors duration-300
                  ${selected === industry.id ? industry.color : "text-gray-700"}
                `}
                >
                  {industry.name}
                </h3>
              </div>

              {/* Selected Indicator */}
              {selected === industry.id && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center z-10">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}

              {/* Hover Overlay with Blur Background and Centered Text */}
              <div
                className={`
                  absolute inset-0 flex items-center justify-center p-4 rounded-2xl
                  transition-all duration-300 ease-in-out backdrop-blur-sm
                  bg-black/85
                  opacity-0 group-hover:opacity-100
                `}
              >
                <div className="text-center z-10">
                  <h3 className="font-bold text-lg mb-2 text-white">
                    {industry.name}
                  </h3>
                  <p className="text-sm text-white/85 leading-relaxed font-medium">
                    {industry.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Industry Info */}
        {selected && (
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
            <div className="text-center">
              <p className="text-blue-800 font-medium">
                Has seleccionado:{" "}
                <span className="font-bold">
                  {INDUSTRIES.find((i) => i.id === selected)?.name}
                </span>
              </p>
              <p className="text-blue-600 mt-1">
                {INDUSTRIES.find((i) => i.id === selected)?.description}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
