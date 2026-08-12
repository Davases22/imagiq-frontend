"use client";

import { useState, useEffect, useRef } from "react";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useBundle } from "@/features/products/useProducts";
import { useBundleParams } from "./hooks/useBundleParams";
import ViewBundleSkeleton from "./ViewBundleSkeleton";
import { BundleImages } from "./components/BundleImages";
import { BundleInfo } from "./components/BundleInfo";
import { BundleProductsGrid } from "./components/BundleProductsGrid";
import { BundleNotFound, BundleNoOptions } from "./components/EmptyStates";
import StickyPriceBar from "@/app/productos/dispositivos-moviles/detalles-producto/StickyPriceBar";
import BenefitsSection from "@/app/productos/dispositivos-moviles/detalles-producto/BenefitsSection";
import { useScrollNavbar } from "@/hooks/useScrollNavbar";

interface BundleViewPageProps {
  params: Promise<unknown>;
}

/**
 * Página de vista detallada de bundle optimizada
 * Muestra información completa del bundle con imágenes, precios y opciones
 */
export default function BundleViewPage({ params }: BundleViewPageProps) {
  // Extraer y validar parámetros de URL
  const bundleParams = useBundleParams(params);
  const { baseCodigoMarket, codCampana, productSku } = bundleParams || {};

  // TODOS LOS HOOKS DEBEN ESTAR ANTES DE CUALQUIER RETURN
  // Obtener datos del bundle (siempre llamar el hook, validar después)
  const { bundle, loading, error } = useBundle(
    baseCodigoMarket ?? "",
    codCampana ?? "",
    productSku ?? ""
  );

  // Estados locales
  const [showContent, setShowContent] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const addToCartHandlerRef = useRef<(() => Promise<void>) | null>(null);

  // Hook para mostrar/ocultar sticky bar y navbar
  const showStickyBar = useScrollNavbar();

  // Ocultar navbar principal cuando el sticky bar está visible
  useEffect(() => {
    const navbar = document.querySelector('[data-navbar="true"]') as HTMLElement;
    if (navbar) {
      if (showStickyBar) {
        navbar.style.transform = "translateY(-100%)";
        navbar.style.transition = "transform 0.3s ease-in-out";
      } else {
        navbar.style.transform = "translateY(0)";
      }
    }

    // Cleanup: restaurar navbar cuando el componente se desmonta
    return () => {
      const navbar = document.querySelector('[data-navbar="true"]') as HTMLElement;
      if (navbar) {
        navbar.style.transform = "translateY(0)";
      }
    };
  }, [showStickyBar]);

  // Mostrar el contenido en cuanto los datos estén listos (sin retraso artificial
  // de 150 ms que alargaba el skeleton aunque el bundle ya hubiera cargado).
  useEffect(() => {
    setShowContent(!loading && !!bundle);
  }, [loading, bundle]);

  // AHORA SÍ PODEMOS HACER VALIDACIONES Y RETURNS CONDICIONALES
  // Si los parámetros no son válidos, mostrar 404
  if (!bundleParams) {
    return notFound();
  }

  // Estados de carga y error
  if (loading || !showContent) return <ViewBundleSkeleton />;
  if (error) return notFound();
  if (!bundle) return <BundleNotFound />;

  // Validar opción seleccionada
  const selectedOption = bundle.opciones?.[selectedOptionIndex];
  if (!selectedOption) return <BundleNoOptions />;

  const mainProduct =
    selectedOption.productos && selectedOption.productos.length > 0
      ? selectedOption.productos[0]
      : undefined;

  // Convertir precios de string a number para StickyPriceBar
  const parsePrice = (price: string | undefined): number => {
    if (!price) return 0;
    return parseInt(price.replace(/\D/g, ''), 10);
  };

  const basePrice = parsePrice(selectedOption.price);
  const originalPrice = selectedOption.originalPrice
    ? parsePrice(selectedOption.originalPrice)
    : undefined;

  // Manejar click en "Añadir al carrito"
  const handleAddToCart = () => {
    if (addToCartHandlerRef.current) {
      addToCartHandlerRef.current();
    }
  };

  return (
    <>
      {/* StickyPriceBar - con animación al hacer scroll */}
      <StickyPriceBar
        deviceName={bundle.name}
        basePrice={basePrice}
        originalPrice={originalPrice}
        discount={originalPrice && originalPrice > basePrice ? originalPrice - basePrice : undefined}
        selectedColor={selectedOption.nombreColorProductSku}
        selectedStorage={selectedOption.capacidadProductSku}
        indcerointeres={0} // Bundles sin cuotas por defecto
        allPrices={[basePrice]}
        isVisible={showStickyBar}
        onBuyClick={handleAddToCart}
        hasStock={(selectedOption.stockTotal ?? 0) > 0}
        onNotifyStock={() => console.log("Notificar stock")}
      />

      {/* Breadcrumbs */}
      <div className="bg-white pt-18">
        <div className="container mx-auto px-4 md:px-6 lg:px-12 mb-4">
          <Breadcrumbs productName={bundle.name} />
        </div>
      </div>

      {/* Contenido principal */}
      <div className="bg-white pb-8">
        <div className="container mx-auto px-4 md:px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            {/* Grid principal: Imágenes + Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <BundleImages
                bundleName={bundle.name}
                imagePreviewUrl={selectedOption.imagePreviewUrl || []}
                mainProduct={mainProduct}
                allProducts={selectedOption.productos}
              />

              <BundleInfo
                bundleName={bundle.name}
                selectedOption={selectedOption}
                bundleFechaFinal={bundle.fecha_final}
                bundleOptionsCount={bundle.opciones?.length || 0}
                selectedOptionIndex={selectedOptionIndex}
                onOptionChange={setSelectedOptionIndex}
                codCampana={codCampana || ""}
                skusBundle={selectedOption.skus_bundle || []}
                onAddToCart={(handler) => { addToCartHandlerRef.current = handler; }}
                categoria={(Array.isArray(bundle.categoria) ? bundle.categoria[0] : bundle.categoria) || "IM"}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section - Fondo completo de extremo a extremo */}
      <BenefitsSection />

      {/* Sección de Características */}
      <div className="bg-white pb-8">
        <div className="container mx-auto px-4 md:px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            {/* Grid de productos del bundle */}
            <div className="pt-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
                Características
              </h2>
              <BundleProductsGrid products={selectedOption.productos || []} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
