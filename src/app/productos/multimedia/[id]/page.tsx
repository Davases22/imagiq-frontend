/**
 * 🎬 MULTIMEDIA PAGE - IMAGIQ ECOMMERCE
 *
 * Página dedicada para mostrar contenido multimedia enriquecido de Flixmedia
 * Se accede desde el botón "Más información" de las cards de producto
 *
 * Ruta: /productos/multimedia/[id]
 *
 * Características:
 * - Carga contenido 360°, videos y especificaciones de Samsung
 * - Obtiene MPN/EAN del producto desde el backend
 * - Diseño limpio enfocado en el contenido multimedia
 * - Botón para volver a la vista anterior
 */

"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductApiData } from "@/lib/api";
import { getSkuFromLocation } from "@/hooks/useProductSelection";
import { useProduct } from "@/features/products/useProducts";
import { useAnalyticsWithUser } from "@/lib/analytics";
import { posthogUtils } from "@/lib/posthogClient";
import FlixmediaPlayer from "@/components/FlixmediaPlayer";
import MultimediaBottomBar from "@/components/MultimediaBottomBar";
import { usePrefetchProduct } from "@/hooks/usePrefetchProduct";
import { hasPremiumContent, flixmediaCandidatesForVariant } from "@/lib/flixmedia";
import MultimediaQuickNavBar from "./MultimediaQuickNavBar";

type SelectedProductData = {
  productName?: string;
  price?: number;
  originalPrice?: number;
  color?: string;
  colorHex?: string;
  capacity?: string;
  ram?: string;
  sku?: string;
  ean?: string;
  image?: string;
  indcerointeres?: number;
  allPrices?: number[];
  skuflixmedia?: string;
  segmento?: string | string[];
};

/**
 * Construye la "selección" equivalente a la de localStorage a partir del SKU de
 * variante que viaja en un enlace compartido (`?sku=`), usando los arrays
 * indexados del API. Devuelve null si el SKU no pertenece al producto.
 */
function selectionFromSku(
  product: { name?: string; apiProduct?: ProductApiData } | null | undefined,
  sku: string | null
): SelectedProductData | null {
  const api = product?.apiProduct;
  if (!api || !sku) return null;
  const wanted = sku.trim().toLowerCase();
  const i = (api.sku || []).findIndex((s) => (s || "").trim().toLowerCase() === wanted);
  if (i < 0) return null;
  const price = api.precioeccommerce?.[i];
  const originalPrice = api.precioNormal?.[i];
  return {
    productName: api.nombreMarket?.[i] || product?.name,
    price: typeof price === "number" && price > 0 ? price : undefined,
    originalPrice: typeof originalPrice === "number" && originalPrice > 0 ? originalPrice : undefined,
    color: api.nombreColor?.[i] || undefined,
    colorHex: api.color?.[i] || undefined,
    capacity: api.capacidad?.[i] || undefined,
    ram: api.memoriaram?.[i] || undefined,
    sku: api.sku[i],
    ean: api.ean?.[i] || undefined,
    image: api.imagePreviewUrl?.[i] || undefined,
    indcerointeres: api.indcerointeres?.[i],
    allPrices: api.precioeccommerce || [],
    skuflixmedia: api.skuflixmedia?.[i] || undefined,
    segmento: api.segmento?.[i] || undefined,
  };
}

// Skeleton de carga mejorado
function MultimediaPageSkeleton() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Skeleton del top bar - Arriba */}
      <div className="bg-white border-b border-gray-200 shadow-sm mt-[55px] md:mt-[25px]">
        <div className="max-w-[1680px] mx-auto px-4 md:px-6 lg:px-12">
          <div className="flex items-center justify-between gap-4 md:gap-6 py-3 md:py-4">
            {/* Skeleton nombre del producto */}
            <div className="flex-shrink-0 hidden md:block max-w-[280px]">
              <div className="h-5 bg-gray-200 rounded w-48 animate-pulse" />
            </div>

            {/* Skeleton precio */}
            <div className="flex-1 flex justify-center items-center">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <div className="h-8 bg-gray-200 rounded w-32 animate-pulse" />
                <div className="hidden sm:block w-px h-6 bg-gray-200" />
                <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
              </div>
            </div>

            {/* Skeleton botón */}
            <div className="flex-shrink-0">
              <div className="h-12 bg-gray-200 rounded-full w-32 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Línea decorativa */}
        <div className="h-1 w-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
      </div>

      {/* Skeleton del contenido principal */}
      <div className="flex-1">
        {/* Skeleton del iframe de Flixmedia */}
        <div className="w-full h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 relative overflow-hidden">
          {/* Efecto de brillo */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Icono central de carga */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-gray-200 border-t-[#0066CC] rounded-full animate-spin" />
              <div className="space-y-3">
                <div className="h-3 bg-gray-200 rounded w-48 mx-auto animate-pulse" />
                <div className="h-2 bg-gray-200 rounded w-32 mx-auto animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente principal
export default function MultimediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const { product, loading, error } = useProduct(id);
  const { trackViewItem } = useAnalyticsWithUser();
  const viewFiredRef = React.useRef<string | null>(null);

  // DEBUG: Rastrear estado del producto en cada render
  console.log('[MULTIMEDIA] Render:', {
    routeId: id,
    productId: product?.id,
    productMatch: product?.id === id,
    loading,
    error,
    hasProduct: !!product,
    productSkuflixmedia: product?.skuflixmedia,
  });

  // Estado para almacenar la selección del usuario desde localStorage
  // Inicializar como null para evitar hydration mismatch (servidor no tiene acceso a localStorage)
  const [savedSelectionData, setSavedSelectionData] = useState<SelectedProductData | null>(null);

  // SKU de variante que viaja en un enlace compartido (`?sku=`). Cuando existe,
  // manda sobre la selección guardada en localStorage: quien abre el enlace debe
  // ver la MISMA variante (talla/color) que se compartió, no la de su navegador.
  const [urlSku, setUrlSku] = useState<string | null>(null);

  // selección guardada ya leída de localStorage ("settled"): evita disparar
  // ViewContent/product_viewed con un SKU de fallback antes de resolver la variante.
  const [selectionResolved, setSelectionResolved] = useState(false);

  // Track del id actual para detectar cambio de producto sincrónicamente durante el render.
  // useEffect corre DESPUÉS del render, así que sin esto el primer render post-navegación
  // usaría selectedProductData stale del producto anterior → MPN incorrecto para Flixmedia.
  const [currentId, setCurrentId] = useState(id);
  if (currentId !== id) {
    console.log('[MULTIMEDIA] ID cambió:', { from: currentId, to: id, resettingSelectedData: true });
    setCurrentId(id);
    setSavedSelectionData(null);
    setUrlSku(null);
    setSelectionResolved(false);
  }

  // Leer localStorage después del mount para evitar hydration mismatch
  useEffect(() => {
    const sharedSku = getSkuFromLocation();
    setUrlSku(sharedSku);
    if (sharedSku) {
      // La variante se resuelve contra el producto del API (urlVariantData);
      // se ignora la selección guardada para no arrancar Flixmedia con otro MPN.
      console.log('[MULTIMEDIA] SKU del enlace compartido para', id, ':', sharedSku);
      setSavedSelectionData(null);
      setSelectionResolved(true);
      return;
    }
    const savedSelection = localStorage.getItem(`product_selection_${id}`);
    if (savedSelection) {
      try {
        const parsed = JSON.parse(savedSelection);
        console.log('[MULTIMEDIA] localStorage para', id, ':', {
          skuflixmedia: parsed?.skuflixmedia,
          sku: parsed?.sku,
          productName: parsed?.productName,
        });
        setSavedSelectionData(parsed);
      } catch (e) {
        console.error("Error parsing saved product selection:", e);
        setSavedSelectionData(null);
      }
    } else {
      console.log('[MULTIMEDIA] Sin localStorage para', id);
      setSavedSelectionData(null);
    }
    setSelectionResolved(true);
  }, [id]);

  // Variante del enlace compartido resuelta contra el producto del API. Se
  // calcula en el render (useMemo), no en un effect: así el PRIMER montaje de
  // FlixmediaPlayer ya recibe el MPN correcto y no hay doble inicialización.
  const urlVariantData = useMemo(() => selectionFromSku(product, urlSku), [product, urlSku]);
  const selectedProductData = urlSku ? urlVariantData : savedSelectionData;

  // PRECIO EN VIVO. La selección de localStorage (escrita al hacer clic en la card)
  // no tiene TTL y congela el precio de ESE momento: si Novasoft cambiaba el precio o
  // la variante dejaba de existir, la PDP seguía mostrando el precio viejo (caso The
  // Frame LS03H, 10-sep-2026). Regla: en cuanto llegan datos del API, precio, precio
  // tachado, cuotas e interés salen del API para el SKU seleccionado; localStorage
  // solo alimenta el primer render (Optimistic UI).
  const priceSource = useMemo<SelectedProductData | null>(() => {
    if (urlSku) return urlVariantData;
    if (!product?.apiProduct) return savedSelectionData;
    return selectionFromSku(product, savedSelectionData?.sku ?? null);
  }, [product, urlSku, urlVariantData, savedSelectionData]);

  // ViewContent (Meta pixel + CAPI, deduplicados por el MISMO event_id que genera
  // el pipeline) + product_viewed (PostHog) — los mismos eventos que view/[id] y
  // viewpremium/[id]. /productos/multimedia/[id] es la PDP MÁS visitada (destino de
  // los anuncios) y antes no emitía nada. Consent-gated dentro del pipeline.
  useEffect(() => {
    if (!product?.id || !selectionResolved) return;
    if (viewFiredRef.current === product.id) return;
    const parsePriceLocal = (p?: string | number): number =>
      typeof p === "number" ? p : p ? parseInt(String(p).replace(/[^\d]/g, "")) || 0 : 0;
    const price = priceSource?.price ?? parsePriceLocal(product.price);
    if (!price) return; // esperar a que resuelva el precio (igual que viewpremium)
    // SKU REAL de variante: selección del usuario → primera variante de color →
    // codigoMarketBase solo como último recurso.
    const colorSkus = product.colors?.map((c) => c.sku).filter(Boolean) || [];
    const sku = selectedProductData?.sku || colorSkus[0] || product.id;
    viewFiredRef.current = product.id;
    const category = product.apiProduct?.categoria || "Sin categoría";
    trackViewItem({
      item_id: sku,
      item_name: selectedProductData?.productName || product.name,
      item_brand: "Samsung",
      item_category: category,
      price,
      currency: "COP",
    });
    posthogUtils.capture("product_viewed", {
      product_id: product.id,
      sku,
      price,
      currency: "COP",
      brand: "Samsung",
      category,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, selectionResolved, selectedProductData, priceSource]);

  // Precargar los datos del producto para la vista de detalle (view/viewpremium)
  // mientras el usuario ve el multimedia. Esto hace que la navegación sea instantánea
  usePrefetchProduct({
    productId: id,
    delay: 0, // Sin delay para precarga inmediata
    enabled: !loading && !error && !!product, // Solo precargar si el producto se cargó exitosamente
  });


  // Loading state - Solo mostrar skeleton si NO hay datos locales
  // Si tenemos datos locales (Optimistic UI), mostramos la página inmediatamente
  // mientras useProduct actualiza los datos en background
  if (loading && !selectedProductData) {
    return <MultimediaPageSkeleton />;
  }

  // Error state - Solo si no hay producto Y no hay datos locales, volver atrás
  if ((error || !product) && !selectedProductData) {
    router.back();
    return null;
  }

  // Extraer TODOS los SKUs y EANs del producto desde los colores/capacidades
  // Recolectamos todos los SKUs para que Flixmedia pueda buscar en todos hasta encontrar contenido
  const allSkus = product?.colors?.map(color => color.sku).filter(Boolean) || [];
  const allEans = product?.colors?.map(color => color.ean).filter(Boolean) || [];

  // Agregar SKUs de capacidades si existen
  if (product?.capacities) {
    product.capacities.forEach(capacity => {
      if (capacity.sku) allSkus.push(capacity.sku);
      if (capacity.ean) allEans.push(capacity.ean);
    });
  }

  // MPN para Flixmedia: candidatos de la variante seleccionada resueltos contra el
  // API (skuflixmedia / SKU padre / sku, ver flixmediaCandidatesForVariant). Si la
  // variante no está en el API (o aún no cargó), se usa lo guardado o el producto.
  const productSku = ((): string | null => {
    const api = product?.apiProduct;
    const wanted = (selectedProductData?.sku || "").trim().toLowerCase();
    const i = api && wanted ? (api.sku || []).findIndex((s) => (s || "").trim().toLowerCase() === wanted) : -1;
    const fromVariant = i >= 0 && api
      ? flixmediaCandidatesForVariant({ skuflixmedia: api.skuflixmedia?.[i], descGeneral: api.descGeneral?.[i], sku: api.sku[i] })
      : flixmediaCandidatesForVariant({ skuflixmedia: selectedProductData?.skuflixmedia, sku: selectedProductData?.sku });
    if (fromVariant.length > 0) return fromVariant.join(",");
    const fromProduct = api
      ? flixmediaCandidatesForVariant({ skuflixmedia: api.skuflixmedia?.[0], descGeneral: api.descGeneral?.[0], sku: api.sku?.[0] })
      : [];
    return fromProduct.join(",") || product?.skuflixmedia || allSkus[0] || null;
  })();

  // EAN solo como respaldo si hay skuflixmedia pero se necesita EAN
  const productEan = productSku ? (allEans.length > 0 ? allEans[0] : null) : null;

  // DEBUG: Rastrear resolución del SKU
  console.log('[MULTIMEDIA] SKU resolución:', {
    routeId: id,
    productSku,
    productEan,
    sources: {
      'selectedData.skuflixmedia': selectedProductData?.skuflixmedia,
      'product.skuflixmedia': product?.skuflixmedia,
      'apiProduct.skuflixmedia[0]': product?.apiProduct?.skuflixmedia?.[0],
      'selectedData.sku': selectedProductData?.sku,
      'allSkus[0]': allSkus[0],
    },
    selectedProductDataKeys: selectedProductData ? Object.keys(selectedProductData) : null,
    hasProduct: !!product,
    loading,
  });

  // Parsear precios a números
  const parsePrice = (price: string | number | undefined): number => {
    if (typeof price === "number") return price;
    if (!price) return 0;
    return parseInt(price.replace(/[^\d]/g, "")) || 0;
  };

  // Precio de la variante seleccionada (en vivo del API; ver priceSource), sino el del producto general
  const numericPrice = priceSource?.price ?? parsePrice(product?.price);

  // Para originalPrice: variante seleccionada, o product.originalPrice, o precioNormal del apiProduct
  const getOriginalPrice = (): number | undefined => {
    // 1. Variante seleccionada: si existe, manda aunque no tenga descuento (sin
    //    tachado), para no caer en un precio normal de OTRA variante.
    if (priceSource) {
      return priceSource.originalPrice;
    }
    // 2. Luego verificar product.originalPrice directo
    if (product?.originalPrice) {
      return parsePrice(product.originalPrice);
    }
    // 3. Finalmente, verificar apiProduct.precioNormal (viene como array)
    if (product?.apiProduct?.precioNormal && product.apiProduct.precioNormal.length > 0) {
      const precioNormal = product.apiProduct.precioNormal[0];
      if (precioNormal && precioNormal > 0) {
        return precioNormal;
      }
    }
    return undefined;
  };

  const numericOriginalPrice = getOriginalPrice();

  // Obtener indcerointeres del producto (puede venir como array del API)
  const getIndcerointeres = (): number => {
    // Variante seleccionada (en vivo del API; ver priceSource)
    if (priceSource?.indcerointeres !== undefined) {
      return priceSource.indcerointeres;
    }
    // Si el producto tiene apiProduct (datos del API)
    if (product?.apiProduct?.indcerointeres) {
      const indcerointeresArray = product.apiProduct.indcerointeres;
      // Tomar el primer valor del array, si no existe usar 0
      return indcerointeresArray[0] ?? 0;
    }
    // Fallback a 0 si no existe
    return 0;
  };

  const indcerointeres = getIndcerointeres();

  // Obtener allPrices: usar de localStorage si existe, sino del producto, sino usar el precio actual
  const rawAllPrices = priceSource?.allPrices ?? product?.apiProduct?.precioeccommerce ?? [];
  // Asegurar que allPrices tenga al menos el precio actual para el cálculo de cuotas
  const allPrices = rawAllPrices.length > 0 ? rawAllPrices : (numericPrice > 0 ? [numericPrice] : []);

  // Obtener nombre del producto: usar de localStorage si existe, sino del producto
  const displayProductName = selectedProductData?.productName ?? product?.name;

  // Función helper para verificar si el producto es premium
  const isPremiumProduct = (segmento?: string | string[]): boolean => {
    if (!segmento) return false;
    const segmentoValue = Array.isArray(segmento) ? segmento[0] : segmento;
    return segmentoValue?.toUpperCase() === 'PREMIUM';
  };

  const hasPremiumContentCheck = (): boolean => {
    if (!product) return false;
    return hasPremiumContent(product.apiProduct, product.colors);
  };

  // Determinar la ruta según el segmento O el contenido premium del producto
  // Enviar a viewpremium si tiene segmento premium O tiene contenido premium
  // Verificar segmento en: localStorage, product.segmento, o product.apiProduct.segmento
  const getSegmento = (): string | undefined => {
    // 1. Primero de localStorage
    if (selectedProductData?.segmento) {
      const seg = selectedProductData.segmento;
      return Array.isArray(seg) ? seg[0] : seg;
    }
    // 2. Luego de product.segmento directo
    if (product?.segmento) {
      const seg = product.segmento;
      return Array.isArray(seg) ? seg[0] : seg;
    }
    // 3. Finalmente de apiProduct.segmento (viene como array del backend)
    if (product?.apiProduct?.segmento && Array.isArray(product.apiProduct.segmento) && product.apiProduct.segmento.length > 0) {
      return product.apiProduct.segmento[0];
    }
    return undefined;
  };

  const segmento = getSegmento();
  const isPremium = isPremiumProduct(segmento);
  const hasPremium = hasPremiumContentCheck();

  const viewRoute = (isPremium || hasPremium)
    ? `/productos/viewpremium/${id}`
    : `/productos/view/${id}`;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Bar con info del producto y CTA - Fixed debajo del Navbar */}
      <MultimediaBottomBar
        productName={displayProductName || ""}
        shareSku={selectedProductData?.sku ?? null}
        price={numericPrice}
        originalPrice={numericOriginalPrice}
        indcerointeres={indcerointeres}
        allPrices={allPrices}
        onViewDetailsClick={() => router.push(viewRoute)}
        isVisible={true}
      />

      {/* QuickNavBar: Caracteristicas / Especificaciones - detecta secciones de Flixmedia */}
      <MultimediaQuickNavBar />

      {/* Contenido principal - Flixmedia Player con padding para navbar + BottomBar + QuickNavBar */}
      <div
        className="flex-1 pt-[55px] xl:pt-[70px] bg-white"
      >
        {/* skipMatchApi: inyectar loader.js sin esperar el Match API. El await del
            Match era peso muerto serial (~100-700ms en frío): no gatea el render ni
            el redirect — "sin contenido" lo detectan el callback noshow y el timeout
            de 4s del player, que siguen redirigiendo a view/viewpremium. */}
        <FlixmediaPlayer
          mpn={productSku}
          ean={productEan}
          productName={displayProductName}
          productId={id}
          segmento={segmento}
          apiProduct={product?.apiProduct}
          productColors={product?.colors}
          skipMatchApi={true}
          className=""
        />
      </div>
    </div>
  );
}
