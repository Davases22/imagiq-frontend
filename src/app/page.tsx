/**
 * 🏠 PÁGINA PRINCIPAL - IMAGIQ ECOMMERCE
 *
 * Server Component con ISR (Incremental Static Regeneration)
 * Revalida cada 60 segundos para contenido actualizado
 */

import { Suspense } from "react";
import { getHomeProducts, getStores, getProductsByCategory, getProductosHomeConfig } from "@/lib/api-server";
import { getHomeLivestreamPage } from "@/services/multimedia-pages.service";
import { getLivestreamProducts } from "@/lib/livestream-products";
import { mapApiProductsToFrontend } from "@/lib/mappers/product-mapper";
import type { ProductCardProps } from "@/app/productos/components/ProductCard";

// Server Components (sin "use client")
import SEO from "@/components/SEO";
import { CTASection } from "@/components/sections/CTASection";

// Client Components (necesitan interactividad)
import HeroSection from "@/components/sections/HeroSection";
import GalaxyShowcaseBanner from "@/components/sections/GalaxyShowcaseBanner/index";
import AITVsBanner from "@/components/sections/AITVsBanner";
import DynamicBanner from "@/components/banners/DynamicBannerClean";
import TVProductsGrid from "@/components/sections/TVProductsGrid";
import BespokeAIBanner from "@/components/sections/BespokeAIBanner";
import AppliancesProductsGrid from "@/components/sections/AppliancesProductsGrid";
import Reviews from "@/components/sections/Reviews";
import HomeLiveStream from "@/components/sections/HomeLiveStream";

// Componentes que reciben datos del servidor
import ProductShowcase from "@/components/sections/ProductShowcase";
import LocationMap from "@/components/LocationMap";
import StoresCarousel from "@/components/StoresCarousel";

// Skeletons para Suspense
import ProductShowcaseSkeleton from "@/components/sections/ProductShowcaseSkeleton";
import StoresCarouselSkeleton from "@/components/StoresCarouselSkeleton";

// Client wrapper para efectos del lado del cliente (scroll, etc.)
import HomePageClient from "./HomePageClient";

// ISR: regenerar cada 60 segundos
export const revalidate = 60;

/** Tarjetas que pinta cada franja de la home. */
const CUPOS_POR_FRANJA = 4;

/**
 * Aplica la curaduría del dashboard a una franja.
 *
 * Los productos fijados van primero, en el orden configurado y SIN filtrar por
 * inventario: si alguien eligió mostrar un producto, se muestra aunque esté
 * agotado — la ficha ya ofrece avisar cuando vuelva.
 *
 * Si quedan cupos (porque hay menos fijados de los que caben, o porque un
 * código ya no está en el catálogo), se completan con el resto de la categoría
 * como se hacía antes, para que la franja nunca quede coja.
 */
function aplicarCuraduria(
  disponibles: ProductCardProps[],
  codigos: string[],
  conStock: (p: ProductCardProps) => boolean
): ProductCardProps[] {
  const porCodigo = new Map<string, ProductCardProps>();
  for (const p of disponibles) {
    const codigo = p.apiProduct?.codigoMarketBase;
    if (codigo && !porCodigo.has(codigo)) porCodigo.set(codigo, p);
  }

  const elegidos: ProductCardProps[] = [];
  const usados = new Set<string>();

  for (const codigo of codigos) {
    const p = porCodigo.get(codigo);
    if (p && !usados.has(codigo)) {
      elegidos.push(p);
      usados.add(codigo);
    }
    if (elegidos.length >= CUPOS_POR_FRANJA) break;
  }

  // Relleno: solo con productos que tengan inventario, que es el criterio con
  // el que se llenaba la franja antes de existir la curaduría.
  if (elegidos.length < CUPOS_POR_FRANJA) {
    for (const p of disponibles) {
      const codigo = p.apiProduct?.codigoMarketBase;
      if (!codigo || usados.has(codigo) || !conStock(p)) continue;
      elegidos.push(p);
      usados.add(codigo);
      if (elegidos.length >= CUPOS_POR_FRANJA) break;
    }
  }

  return elegidos;
}

export default async function HomePage() {
  const emptyResult = {
    products: [],
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  // Fetch paralelo de datos en el servidor
  // Incluimos IM (dispositivos móviles) porque contiene el S26 Ultra y accesorios del showcase
  const [imProductsData, tvProductsData, appliancesData, stores, livestreamPage, curaduria] = await Promise.all([
    getProductsByCategory("IM", undefined, undefined, 1, 500, "precio", "desc").catch(() => emptyResult),
    getProductsByCategory("AV", undefined, undefined, 1, 50, "precio", "desc").catch(() => emptyResult),
    getProductsByCategory("DA", undefined, undefined, 1, 100, "precio", "desc").catch(() => emptyResult),
    getStores().catch(() => []),
    getHomeLivestreamPage().catch(() => null),
    getProductosHomeConfig(),
  ]);

  // Productos destacados del Live (depende de la página, por eso va después)
  const livestreamProducts = livestreamPage
    ? await getLivestreamProducts(livestreamPage.livestream_config)
    : [];

  // Helper para filtrar productos con stock > 0
  const hasStock = (p: ProductCardProps) => {
    const stockTotal = p.apiProduct?.stockTotal;
    if (Array.isArray(stockTotal)) {
      return stockTotal.some(stock => stock > 0);
    }
    return stockTotal ? stockTotal > 0 : false;
  };

  // Mapear productos IM (donde están el S26 Ultra y accesorios).
  // Ojo: NO se filtra por stock aquí. El filtro se aplica al rellenar, dentro
  // de aplicarCuraduria, para que un producto fijado agotado sí se pueda pintar.
  const imProducts = imProductsData.products.length > 0
    ? mapApiProductsToFrontend(imProductsData.products)
    : [];

  const tvProducts = tvProductsData.products.length > 0
    ? mapApiProductsToFrontend(tvProductsData.products)
    : [];

  const appliancesProducts = appliancesData.products.length > 0
    ? mapApiProductsToFrontend(appliancesData.products)
    : [];

  // El showcase de celulares recibe el catálogo IM completo con stock, porque
  // resuelve por su cuenta los SKUs de respaldo cuando no hay curaduría.
  const mappedProducts = imProducts.filter(hasStock);

  const celularesCurados = aplicarCuraduria(
    imProducts,
    curaduria.celulares,
    hasStock
  );

  const mappedTVProducts = aplicarCuraduria(tvProducts, curaduria.tv, hasStock);

  const mappedAppliancesProducts = aplicarCuraduria(
    appliancesProducts,
    curaduria.electro,
    hasStock
  );

  return (
    <>
      <SEO
        title="Samsung Store - iMagiQ Colombia"
        description="Distribuidor oficial de Samsung en Colombia. Encuentra los últimos Galaxy, tablets, wearables y electrodomésticos con garantía oficial. Envío gratis, soporte especializado y las mejores promociones."
        keywords="Samsung Colombia, distribuidor oficial Samsung, Galaxy, Samsung Store, electrodomésticos Samsung, tablets Samsung, smartwatch Samsung, Galaxy Z Fold, Galaxy Z Flip, tienda Samsung Colombia"
      />

      <HomePageClient>
        <div id="main-page" className="min-h-screen md:mr-0 md:overflow-x-clip">
          <HeroSection />

          {/* Transmisión en vivo (solo si hay una página livestream activa en el dashboard) */}
          {livestreamPage && (
            <HomeLiveStream page={livestreamPage} products={livestreamProducts} />
          )}

          <DynamicBanner placement="home-2" className="mt-6 md:mt-8 lg:mt-12">
            <GalaxyShowcaseBanner />
          </DynamicBanner>

          {/* ProductShowcase con Suspense */}
          <Suspense fallback={<ProductShowcaseSkeleton />}>
            <ProductShowcase initialProducts={mappedProducts} curados={celularesCurados} />
          </Suspense>

          <DynamicBanner placement="home-3" className="mt-6 md:mt-8 lg:mt-12">
            <AITVsBanner />
          </DynamicBanner>

          <TVProductsGrid initialProducts={mappedTVProducts} />

          <DynamicBanner placement="home-4" className="mt-6 md:mt-8 lg:mt-12">
            <BespokeAIBanner />
          </DynamicBanner>

          <AppliancesProductsGrid initialProducts={mappedAppliancesProducts} />

          <section id="reviews-slider" className="bg-white">
            <Reviews />
          </section>

          {/* Carrusel de tiendas con datos del servidor */}
          <Suspense fallback={<StoresCarouselSkeleton />}>
            <section id="tiendas-carrusel" className="bg-white">
              <StoresCarousel initialStores={stores} />
            </section>
          </Suspense>

          {/* Mapa de tiendas con datos del servidor */}
          <section id="tiendas" className="py-2 bg-white">
            <div className="container mx-auto px-6">
              <LocationMap initialStores={stores} />
            </div>
          </section>

          <CTASection />
        </div>
      </HomePageClient>
    </>
  );
}
