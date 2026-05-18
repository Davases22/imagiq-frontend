/**
 * 📦 PRODUCTOS CATEGORIZADOS PAGE - IMAGIQ ECOMMERCE
 *
 * Página dinámica que maneja diferentes categorías de productos desde API
 * Sistema dinámico basado en datos de backend
 */

"use client";

import { useEffect, Suspense, use, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { posthogUtils } from "@/lib/posthogClient";
import { fbqTrackCustom } from "@/lib/meta-pixel";
import { useDeviceType } from "@/components/responsive";
import { useCurrentMenu } from "@/hooks/useCurrentMenu";
import { useVisibleCategories } from "@/hooks/useVisibleCategories";
import { findCategoryBySlug } from "./utils/slugUtils";

import CategorySection from "./components/CategorySection";
import OfertasSection from "./components/OfertasSection";


// ViewItemList debe dispararse UNA sola vez por categoría. Un useRef por
// instancia NO basta: CategoriaPageContent se re-monta (Suspense +
// useSearchParams vuelve a commitear, doble-invoke de React) y cada montaje
// resetea el ref → disparo doble con datos idénticos. Este guard a nivel de
// módulo sobrevive remounts dentro del mismo contexto JS; re-dispara al
// cambiar de categoría y un reload completo (contexto JS nuevo) cuenta como
// view nuevo. Es la única fuente de ViewItemList en todo el codebase.
let lastViewItemListCategory: string | null = null;

interface CategoriaPageContentProps {
  readonly categoria: string;
}

function CategoriaPageContent({ categoria }: CategoriaPageContentProps) {
  const searchParams = useSearchParams();
  const device = useDeviceType();
  const { visibleCategories, loading: categoriesLoading } = useVisibleCategories();

  const isOfertasPage = categoria === "ofertas";
  const seccionParam = searchParams?.get("seccion");
  
  // Resolver categoría dinámicamente desde API
  const dynamicCategory = useMemo(() => {
    if (isOfertasPage) return null;
    return findCategoryBySlug(visibleCategories, categoria);
  }, [visibleCategories, categoria, isOfertasPage]);

  // Obtener nombre de la categoría para useCurrentMenu (espera el código de API)
  const categoryApiName = dynamicCategory?.nombre;

  const { currentMenu } = useCurrentMenu(
    categoryApiName,
    seccionParam || undefined
  );
  
  // Resolver sección activa dinámicamente
  const activeSection = useMemo(() => {
    if (!seccionParam) return "";

    // Si tenemos menú actual, usar su UUID como sección
    if (currentMenu?.uuid) return currentMenu.uuid;

    // Usar directamente el parámetro de sección
    return seccionParam;
  }, [seccionParam, currentMenu]);
  
  // Título dinámico desde API
  const sectionTitle = useMemo(() => {
    if (currentMenu) {
      return currentMenu.nombreVisible || currentMenu.nombre;
    }
    if (dynamicCategory) {
      return dynamicCategory.nombreVisible || dynamicCategory.nombre;
    }
    return categoria;
  }, [currentMenu, dynamicCategory, categoria]);
  
  // Padding manejado centralmente en CategorySection para evitar acumulación
  const devicePaddingClass = "px-0";

  // Tracking de vista de página (debe estar antes de returns condicionales)
  useEffect(() => {
    if (dynamicCategory) {
      posthogUtils.capture("page_view", {
        page: "productos_categoria",
        categoria: dynamicCategory.nombre,
        section: activeSection,
        device,
      });
      // Dedupe a nivel de módulo (ver lastViewItemListCategory arriba):
      // robusto frente a remounts/doble-invoke; re-dispara al cambiar de
      // categoría.
      if (lastViewItemListCategory !== dynamicCategory.nombre) {
        lastViewItemListCategory = dynamicCategory.nombre;
        fbqTrackCustom("ViewItemList", {
          content_category: dynamicCategory.nombre,
          currency: "COP",
        });
      }
    }
  }, [dynamicCategory, activeSection, device]);

  // Si es ofertas, usar componente especial estático
  if (isOfertasPage) {
    return (
      <div className="bg-white min-h-screen">
        <OfertasSection seccion={seccionParam} />
      </div>
    );
  }
  
  // Mostrar skeleton mientras cargan las categorías
  if (categoriesLoading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  // Error si categoría no se encuentra dinámicamente (solo después de cargar)
  if (!dynamicCategory) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Categoría no encontrada
          </h1>
          <p className="text-gray-600">
            La categoría &quot;{categoria}&quot; no existe
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white ${devicePaddingClass}`}>
      <CategorySection
        categoria={categoria}
        categoriaApiCode={dynamicCategory.nombre}
        seccion={activeSection}
        sectionTitle={sectionTitle}
      />
    </div>
  );
}

function CategoriaPageLoading() {
  return (
    <div className="bg-white min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>
  );
}

export default function Page({
  params,
}: Readonly<{ params: Promise<{ categoria: string }> }>) {
  const { categoria } = use(params);

  return (
    <Suspense fallback={<CategoriaPageLoading />}>
      <CategoriaPageContent categoria={categoria} />
    </Suspense>
  );
}
