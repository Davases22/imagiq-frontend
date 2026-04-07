/**
 * Footer del Sitio Web - Diseño Samsung Store
 * - Layout en columnas (6 columnas en desktop)
 * - Enlaces organizados por categorías
 * - Código modular y escalable
 * - Redes sociales y enlaces legales
 * - Animaciones elegantes
 * - Sincronización dinámica con el navbar y páginas legales del dashboard
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { getFooterSections } from "./footer/footer-config";
import { FooterColumn } from "./footer/FooterColumn";
import { FooterBottom } from "./footer/FooterBottom";
import { useVisibleCategories } from "@/hooks/useVisibleCategories";
import { useLegalPages } from "@/hooks/useLegalPages";

function Footer() {
  const [isVisible, setIsVisible] = useState(false);
  const { getNavbarRoutes, loading: categoriesLoading } = useVisibleCategories();
  const { getFooterLinks, loading: legalLoading } = useLegalPages();

  // Obtener rutas del navbar para sincronizar con footer
  const navbarRoutes = useMemo(() => {
    const routes = getNavbarRoutes();
    // Filtrar solo las rutas que queremos en el footer (excluir algunas si es necesario)
    return routes.map(route => ({
      name: route.name,
      href: route.href,
    }));
  }, [getNavbarRoutes]);

  // Obtener links legales dinámicos
  const legalLinks = useMemo(() => {
    return getFooterLinks();
  }, [getFooterLinks]);

  // Generar secciones del footer dinámicamente basadas en las rutas del navbar y páginas legales
  const footerSections = useMemo(() => {
    // Si aún está cargando cualquiera, usar la versión estática como fallback
    if (categoriesLoading || legalLoading) {
      return getFooterSections();
    }
    // Generar secciones dinámicamente con las rutas del navbar y links legales
    return getFooterSections(navbarRoutes, legalLinks);
  }, [navbarRoutes, legalLinks, categoriesLoading, legalLoading]);

  // Animación de entrada al montar
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <footer
      id="footer"
      data-nosnippet
      className={`bg-white border-t border-gray-200 transition-all duration-700 scroll-mt-20 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      }`}
    >
      <div className="px-4 xl:px-10 py-8 md:py-12">
        {/* Columnas principales - Mobile: Acordeón (< md) */}
        <div className="md:hidden">
          {footerSections.map((section, index) => (
            <FooterColumn
              key={section.title}
              section={section}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* Columnas principales - Tablet y Desktop: Grid responsive */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-[1fr_1.5fr_1.5fr_1fr] gap-8 lg:gap-10 xl:gap-12">
          {footerSections.map((section, index) => (
            <div
              key={section.title || `section-${index}`}
              className="border-l border-gray-200 first:border-l-0 pl-8 lg:pl-10 xl:pl-12 first:pl-0"
            >
              <FooterColumn
                section={section}
                index={index}
                isVisible={isVisible}
              />
            </div>
          ))}
        </div>

        {/* Sección inferior */}
        <FooterBottom isVisible={isVisible} />
      </div>
    </footer>
  );
}

export { Footer };
export default Footer;
