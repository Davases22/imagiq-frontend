/**
 * 🏗️ LAYOUT RAÍZ - IMAGIQ ECOMMERCE
 */

import type { Metadata } from "next";
import { getSeoSettings, buildOrganizationJsonLd, buildSiteNavigationJsonLd } from "@/lib/seo-utils";
import { samsungSharpSans } from "./fonts";
import { ThreeDSScript } from "@/components/ThreeDSScript";
// Nota: eliminamos la importación de Inter desde next/font/google para evitar
// hacer fetch a fonts.googleapis.com durante el build en entornos sin acceso.
// Usaremos una variable CSS --font-inter definida en globals.css como fallback.
import "./globals.css";

// 🔐 SECURITY: La inicialización del sistema de encriptación se hace en ClientLayout.tsx
// (debe ejecutarse en el cliente, no en el servidor)

import { AuthProvider } from "@/features/auth/context";
import { CartProvider } from "@/features/cart/CartContext";
import { AnalyticsProvider } from "@/features/analytics/AnalyticsContext";
import { UserPreferencesProvider } from "@/features/user/UserPreferencesContext";
import { PostHogProvider } from "@/features/analytics/PostHogProvider";
import ChatbotWidget from "@/components/chatbotWidget";
import { Toaster } from "@/components/ui/sonner";
import ClientLayout from "./ClientLayout";
import AnalyticsScripts from "@/components/analytics/AnalyticsScripts";
import AnalyticsInit from "@/components/analytics/AnalyticsInit";
import { ResponsiveProvider } from "@/components/responsive"; // Importa el provider
import { NavbarVisibilityProvider } from "@/features/layout/NavbarVisibilityContext";
import { ProductProvider } from "@/features/products/ProductContext";
import { SelectedColorProvider } from "@/contexts/SelectedColorContext";
import { PointsProvider } from "@/contexts/PointsContext";
import { SelectedStoreProvider } from "@/contexts/SelectedStoreContext";
import { ChatbotProvider } from "@/contexts/ChatbotContext";
import { GlobalPipProvider } from "@/contexts/GlobalPipContext";
import GlobalPipPlayer from "@/components/GlobalPipPlayer";
import { HeroProvider } from "@/contexts/HeroContext";
import { CategoryMetadataProvider } from "@/contexts/CategoryMetadataContext";
import MaintenanceScreen from "@/components/MaintenanceScreen";
import DevToolsGuard from "@/components/security/DevToolsGuard";
import SecurityInitializer from "@/components/security/SecurityInitializer";
// Si necesitas Inter desde Google Fonts en entornos con internet,
// reactivar la importación desde next/font/google o agregar el CSS manual.

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeoSettings();

  const ogImage = s.default_og_image?.startsWith("/")
    ? `${s.site_url}${s.default_og_image}`
    : s.default_og_image || `${s.site_url}/logo-og.png`;

  return {
    metadataBase: new URL(s.site_url || "https://imagiq.com"),
    title: {
      default: s.default_title,
      template: s.title_template,
    },
    description: s.default_description,
    keywords: [
      "Samsung Colombia",
      "distribuidor oficial Samsung",
      "Galaxy",
      "Samsung Store",
      "electrodomésticos Samsung",
      "tablets Samsung",
      "smartwatch Samsung",
      "Galaxy Z Fold",
      "Galaxy Z Flip",
      "tienda Samsung Colombia",
    ],
    authors: [{ name: "Imagiq Team", url: s.site_url }],
    creator: s.site_name,
    publisher: s.site_name,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: s.site_url,
      siteName: s.site_name,
      title: s.default_title,
      description: s.default_description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${s.site_name} Logo`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@imagiqstore",
      creator: "@imagiqstore",
    },
    verification: {
      google: s.google_verification || process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || "O0rmKClM5-HJ-pLC4H8LFHwVJsvQ44ALMcV2FpUiH5Q",
    },
    alternates: {
      canonical: s.site_url,
    },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover", // Importante para iOS safe-area
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Verificar si el modo mantenimiento está activado
  const isMaintenanceMode =
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

  // Validar children para evitar NaN, null, undefined o string vacío
  let safeChildren = children;
  const isNaNValue =
    (typeof children === "number" && Number.isNaN(children)) ||
    (typeof children === "string" &&
      (children === "NaN" || children.trim() === "")) ||
    children == null;
  if (isNaNValue) {
    safeChildren = <></>;
  }
  return (
    <html
      lang="es"
      className={`${samsungSharpSans.variable}`}
      style={
        {
          "--font-inter":
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
        } as React.CSSProperties
      }
    >
      <head>
        {/* Optimización Flixmedia: DNS prefetch, preconnect y preload para carga ultra-rápida */}
        <link rel="dns-prefetch" href="//media.flixfacts.com" />
        <link rel="dns-prefetch" href="//media.flixcar.com" />
        <link rel="preconnect" href="https://media.flixfacts.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://media.flixcar.com" crossOrigin="anonymous" />
        <link rel="preload" href="//media.flixfacts.com/js/loader.js" as="script" />
        {/* JSON-LD: SiteNavigationElement for Google sitelinks */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildSiteNavigationJsonLd(process.env.NEXT_PUBLIC_SITE_URL || "https://imagiq.com")
            ),
          }}
        />
      </head>
      <body className="antialiased">
        <SecurityInitializer>
          <AnalyticsScripts />
          <AnalyticsInit />

          <DevToolsGuard>
            <ResponsiveProvider>
              <CategoryMetadataProvider>
              <HeroProvider>
                <ProductProvider>
                  <NavbarVisibilityProvider>
                    <PostHogProvider>
                      <AnalyticsProvider>
                        <AuthProvider>
                          <UserPreferencesProvider>
                            <CartProvider>
                              <SelectedColorProvider>
                                <PointsProvider>
                                  <SelectedStoreProvider>
                                    <ChatbotProvider>
                                      <GlobalPipProvider>
                                      {/* Mostrar pantalla de mantenimiento si está activada */}
                                      {isMaintenanceMode ? (
                                        <MaintenanceScreen />
                                      ) : (
                                        <ClientLayout>{safeChildren}</ClientLayout>
                                      )}
                                      {/* Widget del chatbot - solo si NO está en mantenimiento */}
                                      {!isMaintenanceMode && <ChatbotWidget />}
                                      {/* Global PiP mini-player - persists across pages */}
                                      {!isMaintenanceMode && <GlobalPipPlayer />}
                                      </GlobalPipProvider>
                                    </ChatbotProvider>
                                  </SelectedStoreProvider>
                                  {/* Toast notifications */}
                                  <Toaster
                                    position="top-center"
                                    expand={true}
                                    richColors
                                    closeButton
                                    toastOptions={{
                                      duration: 4000,
                                      style: {
                                        background: "white",
                                        border: "1px solid #e2e8f0",
                                        color: "#1e293b",
                                        fontFamily: "var(--font-inter)",
                                      },
                                    }}
                                  />
                                </PointsProvider>
                              </SelectedColorProvider>
                            </CartProvider>
                          </UserPreferencesProvider>
                        </AuthProvider>
                      </AnalyticsProvider>
                    </PostHogProvider>
                  </NavbarVisibilityProvider>
                </ProductProvider>
              </HeroProvider>
              </CategoryMetadataProvider>
            </ResponsiveProvider>
          </DevToolsGuard>
        </SecurityInitializer>
        <ThreeDSScript />
      </body>
    </html>
  );
}
