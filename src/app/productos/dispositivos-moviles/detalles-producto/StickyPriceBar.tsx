"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiShoppingCart } from "react-icons/fi";
import { useCeroInteres } from "@/hooks/useCeroInteres";
import { cleanProductName } from "@/lib/utils";
import ShareButtons from "@/components/ShareButtons";

interface StickyPriceBarProps {
  deviceName: string;
  basePrice: number;
  originalPrice?: number;
  discount?: number;
  selectedStorage?: string;
  selectedColor?: string;
  indcerointeres: number; // 0 = sin cuotas, 1 = mostrar "test"
  allPrices?: number[]; // Todos los precios del producto (precioeccommerce)
  onBuyClick?: () => void;
  isVisible?: boolean;
  hasStock?: boolean;
  onNotifyStock?: () => void;
  showShareButton?: boolean;
  // SKU de la variante mostrada, para el enlace compartido (`?sku=`)
  shareSku?: string | null;
}

/**
 * Componente StickyPriceBar
 *
 * Barra sticky que muestra:
 * - Al inicio: Visible debajo del navbar principal (top-[70px])
 * - Al hacer scroll: Sube a top-0 con animaciones y oculta el navbar principal
 */
const StickyPriceBar: React.FC<StickyPriceBarProps> = ({
  deviceName,
  basePrice,
  originalPrice,
  discount,
  selectedStorage,
  selectedColor,
  indcerointeres,
  allPrices = [],
  onBuyClick,
  isVisible = false,
  hasStock = true,
  onNotifyStock,
  showShareButton = false,
  shareSku = null,
}) => {
  // Hook para cuotas sin interés (solo cuando indcerointeres === 1)
  const ceroInteres = useCeroInteres(
    allPrices,
    basePrice,
    indcerointeres,
    true // siempre habilitado
  );

  // Cálculos de financiación Addi
  const monthlyPayment = basePrice / 12;
  const savings = discount || (originalPrice ? originalPrice - basePrice : 0);

  // Formatear precio en COP
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Nombre completo con configuración (limpiando "No aplica")
  const fullDeviceName = cleanProductName(
    `${deviceName}${selectedStorage ? ` ${selectedStorage}` : ""}${selectedColor ? ` - ${selectedColor}` : ""}`
  );

  // Renderizar información de precio según indcerointeres (SOLO PARA DESKTOP)
  const renderPriceInfoDesktop = () => {
    if (indcerointeres === 0) {
      return (
        <div className="flex items-baseline gap-2 flex-wrap justify-center">
          <span className="text-xl md:text-2xl font-bold text-[#222]">
            {formatPrice(basePrice)}
          </span>
          {originalPrice && originalPrice > basePrice && (
            <>
              <span className="text-base text-gray-400 line-through">
                {formatPrice(originalPrice)}
              </span>
              <span className="text-green-600 font-semibold text-sm">
                Ahorra {formatPrice(savings)}
              </span>
            </>
          )}
        </div>
      );
    }

    if (indcerointeres === 1) {
      const textoInteresCompleto = ceroInteres.formatText();
      const cuotaMensualCalculada = ceroInteres.cuotaMensual || Math.round(basePrice / 24);
      const plazoMeses = ceroInteres.plazoMaximo || 24;
      const cuotaFormateada = formatPrice(cuotaMensualCalculada);
      const textoCompletoFinal = textoInteresCompleto || `Desde ${cuotaFormateada} al mes en ${plazoMeses} cuotas sin interés`;

      return (
        <div className="flex items-center justify-center w-full">
          <p className="text-xs sm:text-sm md:text-base text-[#222] leading-tight text-center">
            <span className="font-bold">{textoCompletoFinal}</span>
            {" "}
            <span className="font-semibold">ó {formatPrice(basePrice)}</span>
          </p>
        </div>
      );
    }

    // DEFAULT: Addi
    return (
      <div className="text-center">
        <div className="flex items-baseline justify-center gap-1 flex-wrap text-xs">
          <span className="text-gray-600">Desde</span>
          <span className="text-base md:text-lg font-bold text-[#222]">
            {formatPrice(monthlyPayment)}
          </span>
          <span className="text-gray-600">al mes en 12 cuotas sin intereses*</span>
        </div>
        <div className="flex items-center justify-center gap-1 flex-wrap text-xs">
          <span className="text-gray-600">o</span>
          <span className="font-semibold text-[#222]">
            {formatPrice(basePrice)}
          </span>
          <span className="text-gray-500">
            *Aplican condiciones. Sujeto a aprobación crediticia.
          </span>
        </div>
      </div>
    );
  };

  // Contenido compartido
  const BarContent = () => (
    <>
      <div className="mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between gap-2 md:gap-4 py-2.5">
          {/* MÓVIL: Layout agrupado a la izquierda (Nombre + Precio + Ahorro) */}
          <div className="flex-1 flex md:hidden items-center min-w-0">
            <div className="flex flex-col items-start gap-0.5 min-w-0">
              {/* Fila 1: Nombre */}
              <h3 className="text-xs font-bold text-[#222] line-clamp-1">
                {fullDeviceName}
              </h3>

              {/* Filas 2 y 3: Precio según indcerointeres */}
              {indcerointeres === 0 ? (
                <>
                  <span className="text-sm font-bold text-[#222]">
                    {formatPrice(basePrice)}
                  </span>
                  {originalPrice && originalPrice > basePrice && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 line-through">
                        {formatPrice(originalPrice)}
                      </span>
                      <span className="text-xs text-green-600 font-semibold">
                        Ahorra {formatPrice(savings)}
                      </span>
                    </div>
                  )}
                </>
              ) : indcerointeres === 1 ? (
                <>
                  {(() => {
                    const textoInteresSimple = ceroInteres.formatTextSimple();
                    const cuotaMensualCalculada = ceroInteres.cuotaMensual || Math.round(basePrice / 24);
                    const plazoMeses = ceroInteres.plazoMaximo || 24;
                    const cuotaFormateada = formatPrice(cuotaMensualCalculada);
                    const textoSimpleFinal = textoInteresSimple || `${cuotaFormateada} en ${plazoMeses} meses`;

                    return (
                      <>
                        <span className="text-sm font-bold text-[#222]">
                          {textoSimpleFinal}
                        </span>
                        <span className="text-xs text-gray-500">
                          o {formatPrice(basePrice)}
                        </span>
                      </>
                    );
                  })()}
                </>
              ) : (
                <span className="text-sm font-bold text-[#222]">
                  {formatPrice(basePrice)}
                </span>
              )}
            </div>
          </div>

          {/* DESKTOP: Layout original (Nombre izquierda, Precio centro) */}
          <div className="hidden md:flex items-center flex-shrink-0 md:max-w-[180px] xl:max-w-none">
            <h3 className="text-xs md:text-sm font-semibold text-[#222] leading-tight md:line-clamp-2 xl:whitespace-nowrap xl:line-clamp-none">
              {fullDeviceName}
            </h3>
          </div>

          <div className="hidden md:flex flex-1 justify-center items-center min-w-0">
            {renderPriceInfoDesktop()}
          </div>

          {/* DERECHA: Share + CTA (mismo para móvil y desktop) */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {showShareButton && <ShareButtons title={deviceName} sku={shareSku} />}
            {hasStock ? (
              <motion.button
                onClick={onBuyClick}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="
                  flex items-center gap-2
                  bg-[#0066CC] hover:bg-[#0052A3]
                  text-white
                  px-5 md:px-6 py-2 md:py-2.5
                  rounded-full
                  font-semibold text-sm
                  transition-colors duration-200
                  whitespace-nowrap
                "
              >
                <FiShoppingCart className="text-lg" />
                <span className="hidden sm:inline">Añadir al carrito</span>
                <span className="sm:hidden">Añadir</span>
              </motion.button>
            ) : (
              <motion.button
                onClick={onNotifyStock}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="
                  flex items-center gap-2
                  bg-gray-800 hover:bg-gray-700
                  text-white
                  px-5 md:px-6 py-2 md:py-2.5
                  rounded-full
                  font-semibold text-sm
                  transition-colors duration-200
                  whitespace-nowrap
                "
              >
                <FiShoppingCart className="text-lg" />
                <span className="hidden sm:inline">Notificarme</span>
                <span className="sm:hidden">Avisar</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Versión inicial: siempre visible debajo del navbar principal */}
      {!isVisible && (
        <div
          className="fixed top-[60px] md:top-[78px] xl:top-[100px] left-0 right-0 z-[1500] bg-white/95 backdrop-blur-xl overflow-visible"
          style={{ fontFamily: "SamsungSharpSans" }}
        >
          <BarContent />
        </div>
      )}

      {/* Versión scroll: aparece en top-0 con animaciones cuando isVisible=true */}
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key="sticky-price-bar-scroll"
            initial={{
              y: -100,
              opacity: 0,
            }}
            animate={{
              y: 0,
              opacity: 1,
            }}
            exit={{
              y: -100,
              opacity: 0,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              opacity: {
                duration: 0.3,
              },
            }}
            className="fixed top-0 left-0 right-0 z-[9999] bg-white/95 backdrop-blur-xl overflow-visible"
            style={{
              fontFamily: "SamsungSharpSans",
            }}
          >
            <BarContent />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StickyPriceBar;
