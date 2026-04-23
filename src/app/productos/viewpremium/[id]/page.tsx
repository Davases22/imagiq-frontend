"use client";

import React, { use } from "react";
import { useProduct } from "@/features/products/useProducts";
import { notFound } from "next/navigation";
import ViewPremiumSkeleton from "./ViewPremiumSkeleton";
import StickyPriceBar from "@/app/productos/dispositivos-moviles/detalles-producto/StickyPriceBar";
import { useScrollNavbar } from "@/hooks/useScrollNavbar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useProductSelection } from "@/hooks/useProductSelection";
import { useCartContext } from "@/features/cart/CartContext";
import { useRouter } from "next/navigation";
import fallbackImage from "@/img/dispositivosmoviles/cel1.png";
import StockNotificationModal from "@/components/StockNotificationModal";
import { useStockNotification } from "@/hooks/useStockNotification";
import { useTradeInPrefetch } from "@/hooks/useTradeInPrefetch";

// Componentes
import ProductCarousel from "../components/ProductCarousel";
import ProductInfo from "../components/ProductInfo";
import ImageModal from "../components/ImageModal";
import TradeInSection from "../components/sections/TradeInSection";
import { useProductLogic } from "../hooks/useProductLogic";
import BenefitsSection from "../../dispositivos-moviles/detalles-producto/BenefitsSection";
import AddToCartButton from "../components/AddToCartButton";
import { ProductCardProps } from "@/app/productos/components/ProductCard";

import FlixmediaPlayer from "@/components/FlixmediaPlayer";
import { preloadFlixmediaScriptEarly } from "@/lib/flixmedia";

// Componente de navegación rápida
import QuickNavBar from "./components/QuickNavBar";

// @ts-expect-error Next.js infiere el tipo de params automáticamente
export default function ProductViewPage({ params }) {
  const resolvedParams = use(params);
  type ParamsWithId = { id: string };
  const id =
    resolvedParams &&
      typeof resolvedParams === "object" &&
      "id" in resolvedParams
      ? (resolvedParams as ParamsWithId).id
      : undefined;
  // Estado para almacenar el producto inicial desde localStorage (Optimistic UI)
  const [initialProduct, setInitialProduct] = React.useState<ProductCardProps | null>(() => {
    if (typeof window !== 'undefined' && id) {
      try {
        const saved = localStorage.getItem(`product_selection_${id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Convertir datos guardados a estructura ProductCardProps mínima necesaria
          return {
            id: id,
            name: parsed.productName || "",
            image: parsed.image || fallbackImage.src,
            price: parsed.price?.toString(),
            originalPrice: parsed.originalPrice?.toString(),
            colors: parsed.color ? [{
              name: parsed.color,
              hex: parsed.colorHex || "#000000",
              label: parsed.color,
              sku: parsed.sku || "",
              ean: parsed.ean || ""
            }] : [],
            capacities: parsed.capacity ? [{
              value: parsed.capacity,
              label: parsed.capacity
            }] : [],
            segmento: parsed.segmento,
            skuflixmedia: parsed.skuflixmedia, // Mapear skuflixmedia desde localStorage
            // Datos mínimos para que funcione la UI
            apiProduct: {
              codigoMarketBase: id,
              codigoMarket: [],
              nombreMarket: [parsed.productName || ""],
              categoria: "Móviles", // Fallback seguro
              subcategoria: "",
              modelo: [parsed.productName || ""],
              color: [],
              capacidad: [],
              memoriaram: [],
              descGeneral: [],
              sku: [],
              ean: [],
              desDetallada: [],
              stockTotal: [],
              cantidadTiendas: [],
              cantidadTiendasReserva: [],
              urlImagenes: [],
              urlRender3D: [],
              imagePreviewUrl: [],
              imageDetailsUrls: [],
              precioNormal: [],
              precioeccommerce: [],
              fechaInicioVigencia: [],
              fechaFinalVigencia: [],
              indRetoma: [],
              indcerointeres: [],
              skuPostback: [],
              skuflixmedia: parsed.skuflixmedia ? [parsed.skuflixmedia] : [], // También en apiProduct por si acaso
              segmento: parsed.segmento ? (Array.isArray(parsed.segmento) ? parsed.segmento : [parsed.segmento]) : ["PREMIUM"], // Asegurar que pase la validación de premium
              imagenPremium: [["placeholder"]], // Hack para pasar validación de contenido premium
            }
          } as ProductCardProps;
        }
      } catch (e) {
        console.error("Error parsing saved product selection:", e);
      }
    }
    return null;
  });

  const { product: apiProduct, loading, error } = useProduct(id ?? "");

  // Usar producto del API si está listo, sino usar el inicial de localStorage
  const product = apiProduct || initialProduct;

  const [showContent, setShowContent] = React.useState(false);

  // Hook personalizado para manejar toda la lógica del producto
  const {
    selectedColor,
    selectedStorage,
    selectedRam,
    currentImageIndex,
    showStickyCarousel,
    isModalOpen,
    modalImageIndex,
    slideDirection,
    carouselRef,
    specsRef,
    premiumImages,
    productImages,
    detailImages,
    setSelectedColor,
    setSelectedStorage,
    setSelectedRam,
    setCurrentImageIndex,
    openModal,
    closeModal,
    goToNextImage,
    goToPrevImage,
    goToImage,
  } = useProductLogic(product);

  // Hook para manejo inteligente de selección de productos - compartido entre componentes
  const productSelection = useProductSelection(
    product?.apiProduct || {
      codigoMarketBase: product?.id || "",
      codigoMarket: [],
      nombreMarket: product?.name ? [product.name] : [],
      categoria: "",
      subcategoria: "",
      modelo: product?.name ? [product.name] : [],
      color: [],
      capacidad: [],
      memoriaram: [],
      descGeneral: [],
      sku: [],
      ean: [],
      desDetallada: [],
      stockTotal: [],
      cantidadTiendas: [],
      cantidadTiendasReserva: [],
      urlImagenes: [],
      urlRender3D: [],
      imagePreviewUrl: [],
      imageDetailsUrls: [],
      precioNormal: [],
      precioeccommerce: [],
      fechaInicioVigencia: [],
      fechaFinalVigencia: [],
      indRetoma: [],
      indcerointeres: [],
      skuPostback: [],
    }
  );

  // Hooks para carrito y navegación
  const { addProduct } = useCartContext();
  const router = useRouter();
  const [loadingCart, setLoadingCart] = React.useState(false);

  // Hook para notificación de stock
  const stockNotification = useStockNotification();

  // 🚀 Prefetch automático de datos de Trade-In
  useTradeInPrefetch();

  // Handler para añadir al carrito con los datos correctos del productSelection
  const handleAddToCart = async () => {
    if (!product) return;

    if (!productSelection.selectedSku) {
      alert("Por favor selecciona todas las opciones del producto");
      return;
    }

    setLoadingCart(true);
    try {
      await addProduct({
        id: product.id,
        name: product.name,
        price: productSelection.selectedPrice || 0,
        originalPrice: productSelection.selectedOriginalPrice || undefined,
        stock: productSelection.selectedStockTotal ?? 1,
        quantity: 1,
        image:
          productSelection.selectedVariant?.imagePreviewUrl ||
          (typeof product.image === "string"
            ? product.image
            : fallbackImage.src),
        sku: productSelection.selectedSku,
        ean: productSelection.selectedVariant?.ean || "",
        puntos_q: product.puntos_q ?? 4,
        color: productSelection.getSelectedColorOption()?.hex || undefined,
        colorName: productSelection.getSelectedColorOption()?.nombreColorDisplay || productSelection.selection.selectedColor || undefined,
        capacity: productSelection.selection.selectedCapacity || undefined,
        ram: productSelection.selection.selectedMemoriaram || undefined,
        skuPostback: productSelection.selectedSkuPostback || '',
        desDetallada: productSelection.selectedVariant?.desDetallada,
        modelo: product.apiProduct?.modelo?.[0] || "",
        categoria: product.apiProduct?.categoria || "",
        indRetoma: product.apiProduct?.indRetoma?.[productSelection.selectedVariant?.index || 0] ?? (product.acceptsTradeIn ? 1 : 0),
      });
    } finally {
      setLoadingCart(false);
    }
  };

  const handleBuyNow = async () => {
    await handleAddToCart();

  };

  const hasStock = () => {
    return (
      productSelection.selectedStockTotal !== null &&
      productSelection.selectedStockTotal > 0
    );
  };

  // Handler para solicitar notificación de stock
  const handleRequestStockNotification = async (email: string) => {
    if (!product) return;

    // Obtener el SKU del color seleccionado
    const selectedColorSku = productSelection.selectedSku || undefined;

    // Obtener el codigoMarket correspondiente a la variante seleccionada
    const codigoMarket = productSelection.selectedCodigoMarket || product.apiProduct?.codigoMarketBase || '';

    await stockNotification.requestNotification({
      productName: product.name,
      email,
      sku: selectedColorSku,
      codigoMarket,
    });
  };

  // Barra sticky superior con la misma animación/estilo de la vista normal
  const showStickyBar = useScrollNavbar(150, 50, true);

  // Precargar DNS + script de Flixmedia lo antes posible
  React.useEffect(() => {
    preloadFlixmediaScriptEarly();
  }, []);

  // Efecto para ocultar/mostrar el header principal exactamente igual que en view normal
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (showStickyBar) {
      document.body.classList.add("hide-main-navbar");
    } else {
      const timer = setTimeout(() => {
        document.body.classList.remove("hide-main-navbar");
      }, 250);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.classList.remove("hide-main-navbar");
    };
  }, [showStickyBar]);

  // Delay para asegurar transición suave
  React.useEffect(() => {
    if (product) {
      // Si tenemos producto (local o API), mostrar contenido inmediatamente o con mínimo delay
      // Si es local, queremos instantáneo (0 o 50ms). Si es API, el delay original estaba bien.
      // Reducimos a 50ms para que sea casi instantáneo pero permita renderizado inicial
      const timer = setTimeout(() => setShowContent(true), 50);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [product]);

  if (!id) {
    return notFound();
  }

  // SIEMPRE mostrar skeleton mientras está cargando el producto desde el API
  // Esto evita el flash de contenido incompleto
  if (loading) {
    return <ViewPremiumSkeleton />;
  }

  // Si hubo error y no hay producto del API, mostrar not found
  if (error && !apiProduct) {
    return notFound();
  }

  // Si no hay producto del API después de cargar, usar notFound()
  if (!apiProduct) {
    return notFound();
  }

  // En este punto, apiProduct está garantizado que existe
  // Usamos apiProduct directamente para evitar errores de null
  const productToUse = apiProduct;

  // Validar que el producto tenga segmento PREMIUM
  const isPremiumProduct = productToUse.apiProduct?.segmento?.some(
    (seg) => seg?.toUpperCase() === "PREMIUM"
  );

  // Nota: antes redirigíamos a /productos/view cuando el producto no tenía
  // imagenPremium/videoPremium, pero eso causaba que productos PREMIUM sin
  // assets premium no mostraran imágenes. Ahora el ProductCarousel cae a las
  // imágenes del color seleccionado si premiumImages está vacío, así que el
  // único gate que queda es el segmento PREMIUM del producto.
  if (!isPremiumProduct) {
    router.replace(`/productos/view/${id}`);
    return <ViewPremiumSkeleton />;
  }

  // Obtener indcerointeres del producto (puede venir como array del API)
  const getIndcerointeres = (): number => {
    // Si el producto tiene apiProduct (datos del API)
    if (productToUse.apiProduct?.indcerointeres) {
      const indcerointeresArray = productToUse.apiProduct.indcerointeres;
      // Tomar el primer valor del array, si no existe usar 0
      return indcerointeresArray[0] ?? 0;
    }
    // Fallback a 0 si no existe
    return 0;
  };

  const indcerointeres = getIndcerointeres();

  return (
    <>
      {/* StickyPriceBar exacto de la página view normal */}
      <StickyPriceBar
        deviceName={productToUse.name}
        basePrice={productSelection.selectedPrice || (() => {
          const selectedCapacity = productToUse.capacities?.find(c => c.value === selectedStorage);
          const priceStr = selectedCapacity?.price || productToUse.price || "0";
          return Number.parseInt(String(priceStr).replaceAll(/\D/g, ''), 10);
        })()}
        selectedStorage={productSelection.selection.selectedCapacity || ((selectedStorage || undefined) && String(selectedStorage).replace(/(\d+)\s*gb\b/i, '$1 GB'))}
        selectedColor={
          productSelection.getSelectedColorOption()?.nombreColorDisplay ||
          productSelection.selection.selectedColor ||
          (() => {
            const colorObj = productToUse.colors?.find(c => c.name === selectedColor);
            return colorObj?.nombreColorDisplay || colorObj?.label || selectedColor || undefined;
          })()
        }
        indcerointeres={indcerointeres}
        allPrices={productToUse.apiProduct?.precioeccommerce || []}
        isVisible={showStickyBar}
        onBuyClick={handleBuyNow}
        hasStock={hasStock()}
        onNotifyStock={stockNotification.openModal}
        showShareButton={true}
      />

      {/* Barra de navegación rápida entre secciones - siempre visible */}
      <QuickNavBar isStickyBarVisible={showStickyBar} />

      {/* SECCIÓN: Comprar - Layout de dos columnas: Carrusel sin márgenes, Info con márgenes */}
      <section id="comprar-section" className="bg-white pt-12 pb-0 mb-0 min-h-screen scroll-mt-[180px]">
        {/* Breadcrumbs */}
        <div className="px-4 lg:px-8 mb-4 pt-24 md:pt-20 xl:pt-20">
          <Breadcrumbs
            productId={id || ""}
            categoryCode={productToUse.apiProduct?.categoria}
            subcategoria={productToUse.apiProduct?.subcategoria}
          />
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-start relative">
          {/* Columna izquierda: Carrusel - ocupa el ancho */}
          <div className="lg:col-span-9 lg:sticky lg:top-24 self-start overflow-hidden lg:-mt-8">
            <ProductCarousel
              ref={carouselRef}
              product={productToUse}
              selectedColor={selectedColor}
              currentImageIndex={currentImageIndex}
              setCurrentImageIndex={setCurrentImageIndex}
              showStickyCarousel={showStickyCarousel}
              premiumImages={premiumImages}
              productImages={productImages}
              onOpenModal={openModal}
              setSelectedColor={setSelectedColor}
            />
          </div>

          {/* Columna derecha: Información del producto con márgenes normales - SCROLLEABLE.
              lg:min-h-[120vh]: colchón para que el sticky (lg:sticky lg:top-24) de la
              columna izquierda tenga recorrido sin generar un gap vacío gigante antes
              de la sección Flixmedia (antes era 200vh, quedaban 800-1200px en blanco). */}
          <div className="lg:col-span-3 px-4 md:px-6 lg:px-12 mt-0 lg:mt-0 lg:min-h-[120vh]">
            <div className="max-w-7xl mx-auto">
              <ProductInfo
                ref={specsRef}
                product={productToUse}
                selectedColor={selectedColor}
                selectedStorage={selectedStorage}
                selectedRam={selectedRam}
                indcerointeres={indcerointeres}
                setSelectedColor={setSelectedColor}
                setSelectedStorage={setSelectedStorage}
                setSelectedRam={setSelectedRam}
                setCurrentImageIndex={setCurrentImageIndex}
                currentImageIndex={currentImageIndex}
                productImages={productImages}
                onOpenModal={openModal}
                productSelection={productSelection}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sección de Estreno y Entrego - solo si el producto acepta retoma */}
      {(productSelection.selectedVariant?.indRetoma === 1 ||
        (!productSelection.selectedVariant && productToUse.acceptsTradeIn)) && (
        <div className="bg-white pb-2 md:pb-4 mt-[clamp(1rem,4vw,2rem)] relative z-10 clear-both">
          <div className="container mx-auto px-4 md:px-6 lg:px-12">
            <div className="max-w-7xl mx-auto">
              <TradeInSection
                onTradeInComplete={(deviceName, value) => {
                  console.log('Trade-in completado:', deviceName, value);
                }}
                productSku={productSelection.selectedSku || undefined}
                productName={productToUse.name}
                skuPostback={productSelection.selectedSkuPostback || undefined}
              />
            </div>
          </div>
        </div>
      )}

      {/* Beneficios imagiq - Banner que ocupa el ancho */}
      <BenefitsSection />

      {/* SECCIÓN: Detalles - Contenido multimedia de Flixmedia (sin márgenes para mejor presentación) */}
      <section id="detalles-section" className="bg-white scroll-mt-[180px]">
        <FlixmediaPlayer
          mpn={productSelection.selectedSkuflixmedia || productToUse.skuflixmedia || productToUse.apiProduct?.skuflixmedia?.[0]}
          ean={productSelection.selectedVariant?.ean}
          productName={productToUse.name}
          productId={productToUse.id}
          segmento={productToUse.apiProduct?.segmento}
          apiProduct={productToUse.apiProduct}
          productColors={productToUse.colors}
          preventRedirect={true}
          className="w-full"
        />
      </section>

      {/* Botón de añadir al carrito al final de la página */}
      <AddToCartButton
        product={productToUse}
        productSelection={productSelection}
        onNotifyStock={stockNotification.openModal}
      />

      {/* Modal de notificación de stock */}
      <StockNotificationModal
        isOpen={stockNotification.isModalOpen}
        onClose={stockNotification.closeModal}
        productName={productToUse.name}
        productImage={
          productSelection.selectedVariant?.imagePreviewUrl ||
          (typeof productToUse.image === "string"
            ? productToUse.image
            : fallbackImage.src)
        }
        selectedColor={productSelection.getSelectedColorOption()?.nombreColorDisplay || productSelection.selection.selectedColor || undefined}
        selectedStorage={productSelection.selection.selectedCapacity || undefined}
        onNotificationRequest={handleRequestStockNotification}
      />

      {/* Modal para fotos del color seleccionado */}
      <ImageModal
        isOpen={isModalOpen}
        productImages={detailImages}
        modalImageIndex={modalImageIndex}
        slideDirection={slideDirection}
        product={productToUse}
        selectedColor={selectedColor}
        onClose={closeModal}
        onNextImage={goToNextImage}
        onPrevImage={goToPrevImage}
        onGoToImage={goToImage}
      />
      {/* Estilos globales para animación de ocultar header, idénticos a view normal */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          body.hide-main-navbar header[data-navbar="true"] {
            transform: translateY(-100%) scale(0.97) !important;
            opacity: 0 !important;
            filter: blur(3px) !important;
            transition:
              transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              filter 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) !important;
            pointer-events: none !important;
          }

          .fixed-navbar-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 9999 !important;
            will-change: transform, opacity, filter !important;
          }

          .fixed-navbar-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
            border-radius: inherit;
            pointer-events: none;
          }

          .fixed-navbar-container * {
            backface-visibility: hidden;
            transform-style: preserve-3d;
          }
        `,
        }}
      />
    </>
  );
}
