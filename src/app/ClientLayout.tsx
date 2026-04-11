"use client";
/**
 * ClientLayout: Componente cliente para renderizar el layout principal con Navbar y Footer.
 * Permite ocultar el Navbar dinámicamente según la ruta (ej: /carrito).
 * Se usa dentro del layout.tsx (servidor) para separar lógica cliente y exportar metadata correctamente.
 */
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import { useNavbarVisibility } from "@/features/layout/NavbarVisibilityContext";
import { usePreloadAllProducts } from "@/hooks/usePreloadAllProducts";
import { useClarityIdentity } from "@/hooks/useClarityIdentity";
import { useInWebCampaign } from "@/hooks/useInWebCampaign";
import { useFavicon } from "@/hooks/useFavicon";
import VersionManager from "@/components/VersionManager";
import { InWebCampaignDisplay } from "@/components/InWebCampaign/InWebCampaignDisplay";
import PostHogTestButton from "@/components/debug/PostHogTestButton";

// Rutas donde el Navbar NO debe mostrarse
const HIDDEN_NAVBAR_ROUTES = [
  "/carrito",
  "/charging-result",
  "/success-checkout/",
  "/error-checkout",
  "/verify-purchase/",
];

function shouldHideNavbar(pathname: string) {
  return HIDDEN_NAVBAR_ROUTES.some((route) =>
    route.endsWith("/") ? pathname.startsWith(route) : pathname === route
  );
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideNavbar = shouldHideNavbar(pathname || '');
  const { hideNavbar: hideNavbarDynamic } = useNavbarVisibility();

  // Hook para gestionar campañas InWeb
  const { activeCampaigns, closeCampaign } = useInWebCampaign({
    channelName: "inweb"
  });

  // Precargar productos de todas las combinaciones posibles en background
  usePreloadAllProducts();

  // Actualizar el favicon dinámicamente desde la base de datos
  useFavicon();

  // Validar children para evitar NaN
  const safeChildren =
    typeof children === "number" && isNaN(children) ? null : children;

  // Ocultar el Footer solo en /carrito (sin step), /ofertas y las rutas de animaciones
  // Mostrar el Footer en /carrito/step2 y otros pasos del carrito
  const isCarritoStep = pathname?.startsWith("/carrito/step");
  const hideFooter =
    (!isCarritoStep && (pathname === "/carrito" || pathname === "/carrito/")) ||
    pathname === "/ofertas" ||
    pathname === "/charging-result" ||
    pathname === "/success-checkout" ||
    pathname === "/carrito/error-checkout";

  // Identificación automática de usuarios en Clarity
  useClarityIdentity();



  return (
    <>
      <VersionManager />
      {/* 🧪 Botón de prueba PostHog - solo en desarrollo */}
      <PostHogTestButton />
      <CookieBanner />
      {activeCampaigns.map((campaign) => (
        <InWebCampaignDisplay
          key={campaign.id}
          campaign={campaign}
          onClose={() => closeCampaign(campaign.id)}
        />
      ))}
      <div id="main-layout" className="min-h-screen flex flex-col md:mr-0">
        {/* Solo monta el Navbar si no debe ocultarse por ruta ni por scroll dinámico */}
        {!hideNavbar && !hideNavbarDynamic && <Navbar />}
        <main className="flex-1" id="main-content">
          {safeChildren}
        </main>
        {!hideFooter && <Footer />}
      </div>
    </>
  );
}
