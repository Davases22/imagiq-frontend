/**
 * PRODUCT CARD COMPONENT - IMAGIQ ECOMMERCE
 *
 * Componente reutilizable para mostrar productos con:
 * - Diseño idéntico a Samsung Store
 * - Colores de dispositivos
 * - Botones de acción (Añadir al carrito, Más información)
 * - Tracking de interacciones
 * - Responsive design
 */

"use client";

import { useState, useMemo } from "react";
import { useCartContext } from "@/features/cart/CartContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image, { StaticImageData } from "next/image";
import { Heart, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
import { posthogUtils } from "@/lib/posthogClient";
import { useAnalytics } from "@/lib/analytics/hooks/useAnalytics";
import { fbqAddToWishlist } from "@/lib/meta-pixel";
import { useCloudinaryImage } from "@/hooks/useCloudinaryImage";
import { useProductSelection, type ActiveFilterHints } from "@/hooks/useProductSelection";
import { useChatbot } from "@/contexts/ChatbotContext";
import {
  calculateDynamicPrices,
  calculateSavings,
  formatCapacityLabel,
} from "./utils/productCardHelpers";
import { ColorSelector, CapacitySelector } from "./ProductCardComponents";
import { getCloudinaryUrl } from "@/lib/cloudinary";
import { ProductApiData } from "@/lib/api";
import {
  shouldShowColorSelector,
  shouldShowCapacitySelector,
} from "./utils/categoryColorConfig";
import StockNotificationModal from "@/components/StockNotificationModal";
import { useStockNotification } from "@/hooks/useStockNotification";
import { shouldRenderValue, shouldRenderColor } from "./utils/shouldRenderValue";
import { prefetchFlixmediaScript } from "@/lib/flixmedia";
import CeroInteresSection from "@/components/CeroInteresSection";
import { ZeroInterestSkuResult } from "@/services/cero-interes-sku.service";

export interface ProductColor {
  name: string; // Nombre técnico del color (ej: "black", "white")
  hex: string; // Código hexadecimal del color (ej: "#000000")
  label: string; // Nombre mostrado al usuario (ej: "Negro Medianoche")
  nombreColorDisplay?: string; // Nombre del color del API para mostrar después de "Color:"
  sku: string; // SKU específico para esta variante de color
  ean: string; // SKU específico para esta variante de color
  price?: string; // Precio específico para este color (opcional)
  originalPrice?: string; // Precio original antes de descuento (opcional)
  discount?: string; // Descuento específico para este color (opcional)
  capacity?: string; // Capacidad asociada a esta variante
  imagePreviewUrl?: string; // URL de imagen específica para este color
  imagen_premium?: string[]; // URLs de imágenes premium para este color
  video_premium?: string[]; // URLs de videos premium para este color
}

export interface ProductCapacity {
  value: string; // Valor de capacidad (ej: "128GB", "256GB")
  label: string; // Etiqueta mostrada (ej: "128 GB")
  price?: string; // Precio para esta capacidad
  originalPrice?: string; // Precio original
  discount?: string; // Descuento
  sku?: string; // SKU específico
  ean?: string; // SKU específico
  available?: boolean; // Si está disponible para el color seleccionado
}

export interface ProductCardProps {
  id: string;
  name: string;
  image: string | StaticImageData;
  colors: ProductColor[];
  capacities?: ProductCapacity[];
  price?: string;
  originalPrice?: string;
  discount?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  className?: string;
  segmento?: string | string[];
  selectedColor?: ProductColor;
  selectedCapacity?: ProductCapacity;
  puntos_q?: number;
  apiProduct?: ProductApiData;
  acceptsTradeIn?: boolean;
  desDetallada?: string; // Indica si el producto acepta retoma (basado en indRetoma)
  isInChat?: boolean; // Indica si está siendo renderizado en el chat (para ajustar estilos)
  skuflixmedia?: string; // SKU específico para Flixmedia
  ceroInteresData?: ZeroInterestSkuResult[]; // Datos de cero interés para este producto
  forceNuevo?: boolean; // Forzar ribbon "Nuevo" sin depender de gama
  activeFilterHints?: ActiveFilterHints; // Hints de filtros activos del catálogo
}

export default function ProductCard({
  id,
  name,
  image,
  colors,
  capacities,
  price,
  originalPrice,
  discount,
  isFavorite = false,
  onToggleFavorite,
  className,
  selectedColor: selectedColorProp,
  selectedCapacity: selectedCapacityProp,
  puntos_q = 4, // Valor fijo por defecto
  segmento, // Segmento del producto
  apiProduct, // Nuevo prop para el sistema de selección inteligente
  isInChat = false, // Por defecto NO está en chat
  acceptsTradeIn, // Indica si el producto acepta retoma
  ceroInteresData, // Datos de cero interés desde el parent
  forceNuevo = false, // Forzar ribbon "Nuevo"
  activeFilterHints, // Hints de filtros activos del catálogo
}: ProductCardProps & { puntos_q?: number }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currentImageIndex] = useState(0);
  useAnalytics();

  // Hook para notificaciones de stock
  const stockNotification = useStockNotification();
  
  // Hook para cerrar el chat cuando se redirija
  const { closeChat } = useChatbot();

  // Hook para manejo inteligente de selección de productos
  const productSelection = useProductSelection(
    apiProduct || {
      codigoMarketBase: id,
      codigoMarket: [],
      nombreMarket: [name],
      categoria: "",
      subcategoria: "",
      modelo: [name],
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
    },
    undefined,
    activeFilterHints
  );

  // Determinar si debe mostrar selectores de color/capacidad basándose en la categoría
  const showColorSelector = shouldShowColorSelector(
    apiProduct?.categoria,
    apiProduct?.subcategoria
  );
  const showCapacitySelector = shouldShowCapacitySelector(
    apiProduct?.categoria,
    apiProduct?.subcategoria
  );

  // Integración con el contexto del carrito
  const { addProduct, getQuantityBySku } = useCartContext();

  // Sistema de selección: usar el nuevo hook si está disponible, sino usar el sistema legacy
  const [selectedColorLocal, setSelectedColorLocal] =
    useState<ProductColor | null>(
      colors && colors.length > 0 ? colors[0] : null
    );
  const selectedColor = selectedColorProp ?? selectedColorLocal;

  const [selectedCapacityLocal, setSelectedCapacityLocal] =
    useState<ProductCapacity | null>(
      capacities && capacities.length > 0 ? capacities[0] : null
    );
  const selectedCapacity = selectedCapacityProp ?? selectedCapacityLocal;

  // Usar datos del nuevo sistema si está disponible
  const currentSku = productSelection.selectedSku || selectedColor?.sku;
  const currentCodigoMarket = productSelection.selectedCodigoMarket || null;
  const currentPrice = productSelection.selectedPrice || null;
  const currentOriginalPrice = productSelection.selectedOriginalPrice || null;
  const currentskuPostback = productSelection.selectedSkuPostback || null;

  // Calcular stock real descontando lo que está en el carrito
  const quantityInCart = currentSku ? getQuantityBySku(currentSku) : 0;
  const realStock = Math.max(
    0,
    (productSelection.selectedVariant?.stockDisponible ?? 0) - quantityInCart
  );

  // Verificar si la VARIANTE SELECCIONADA está sin stock
  // Si el usuario selecciona color + almacenamiento específico, verificar ESA combinación
  const isOutOfStock = realStock <= 0;

  // Obtener el nombre del modelo basado en la variante seleccionada
  // Si hay una variante seleccionada, usar el modelo del índice correspondiente
  const currentProductName = useMemo(() => {
    if (apiProduct && productSelection.selectedVariant?.index !== undefined) {
      const variantIndex = productSelection.selectedVariant.index;
      // Usar modelo del índice de la variante seleccionada, o nombreMarket como fallback
      const modelName =
        apiProduct.modelo?.[variantIndex] ||
        apiProduct.nombreMarket?.[variantIndex];
      if (modelName) {
        return modelName;
      }
    }
    // Fallback al nombre original o primer modelo
    return apiProduct?.modelo?.[0] || apiProduct?.nombreMarket?.[0] || name;
  }, [apiProduct, productSelection.selectedVariant, name]);

  // Obtener la imagen del color seleccionado o usar la imagen por defecto
  const currentImage = useMemo(() => {
    // Si hay datos de API, usar la imagen de la variante seleccionada
    if (apiProduct && productSelection.selectedVariant?.imagePreviewUrl) {
      return productSelection.selectedVariant.imagePreviewUrl;
    }
    // Si no hay datos de API, usar el sistema legacy
    if (!apiProduct && selectedColor?.imagePreviewUrl) {
      return selectedColor.imagePreviewUrl;
    }
    // Fallback a la imagen por defecto
    return image;
  }, [apiProduct, productSelection.selectedVariant, selectedColor, image]);

  // Simular múltiples imágenes para el carrusel (en una implementación real, vendrían del backend)
  const productImages = useMemo(
    () => [
      currentImage,
      currentImage,
      currentImage,
      currentImage,
      currentImage,
      currentImage,
    ],
    [currentImage]
  );

  // Aplicar transformación de Cloudinary a todas las imágenes del carrusel
  const transformedImages = useMemo(() => {
    const transformed = productImages.map((img) => {
      const imgSrc = typeof img === "string" ? img : img?.src;
      return getCloudinaryUrl(imgSrc, "catalog");
    });

    return transformed;
  }, [productImages]);

  const handleColorSelect = (color: ProductColor) => {
    if (apiProduct) {
      // El color.name contiene el valor hexadecimal del campo "color" de la API
      // Usar directamente ese valor para seleccionar
      productSelection.selectColor(color.name);
    } else {
      // Usar el sistema legacy
      setSelectedColorLocal(color);
    }

    posthogUtils.capture("product_color_selected", {
      product_id: id,
      product_name: name,
      color_name: color.name,
      color_label: color.label,
      color_sku: color.sku,
      color_ean: color.ean,
    });
  };

  const handleCapacitySelect = (capacity: ProductCapacity) => {
    if (apiProduct) {
      // Usar el nuevo sistema de selección
      productSelection.selectCapacity(capacity.label);
    } else {
      // Usar el sistema legacy
      setSelectedCapacityLocal(capacity);
    }

    posthogUtils.capture("product_capacity_selected", {
      product_id: id,
      product_name: currentProductName,
      capacity_value: capacity.value,
      capacity_sku: capacity.sku,
      capacity_ean: capacity.ean,
    });
  };

  // Calcular precios dinámicos: usar el nuevo sistema si está disponible, sino usar el legacy
  const {
    currentPrice: legacyPrice,
    currentOriginalPrice: legacyOriginalPrice,
  } = calculateDynamicPrices(
    selectedCapacity,
    selectedColor,
    price,
    originalPrice,
    discount
  );

  // Usar precios del nuevo sistema si están disponibles
  const finalCurrentPrice = currentPrice
    ? `$ ${Math.round(currentPrice).toLocaleString("es-CO")}`
    : legacyPrice;
  const finalCurrentOriginalPrice = currentOriginalPrice
    ? `$${Math.round(currentOriginalPrice).toLocaleString("es-CO")}`
    : legacyOriginalPrice;

  const handleAddToCart = async () => {
    if (isLoading) {
      return; // Prevenir múltiples clics mientras está cargando
    }

    setIsLoading(true);

    try {
      // Validación estricta: debe existir un SKU válido
      const skuToUse = currentSku || selectedColor?.sku;
      const eanToUse =
        productSelection.selectedVariant?.ean || selectedColor?.ean || "";

      if (!skuToUse) {
        setIsLoading(false);
        return;
      }

      posthogUtils.capture("add_to_cart_click", {
        product_id: id,
        product_name: name,
        selected_color:
          selectedColor?.name || productSelection.selection.selectedColor,
        selected_color_sku: currentSku || "",
        selected_color_ean: eanToUse,
        source: isInChat ? "chatbot" : "product_card",
      });

      // Agrega el producto al carrito usando el contexto - SIEMPRE cantidad 1
      // shippingCity y shippingStore se obtienen automáticamente del backend
      await addProduct({
        id,
        name,
        image:
          typeof currentImage === "string"
            ? currentImage
            : typeof image === "string"
              ? image
              : image.src ?? "",
        price:
          typeof finalCurrentPrice === "string"
            ? Number.parseInt(finalCurrentPrice.replaceAll(/[^\d]/g, ""))
            : finalCurrentPrice ?? 0,
        originalPrice:
          typeof finalCurrentOriginalPrice === "string"
            ? Number.parseInt(
              finalCurrentOriginalPrice.replaceAll(/[^\d]/g, "")
            )
            : finalCurrentOriginalPrice,
        stock: productSelection.selectedVariant?.stockDisponible ?? 0,
        quantity: 1, // SIEMPRE agregar de 1 en 1
        sku: currentSku || "", // SKU del sistema seleccionado
        ean: eanToUse, // EAN del sistema seleccionado
        puntos_q,
        color:
          displayedSelectedColor?.hex &&
            shouldRenderValue(displayedSelectedColor.hex)
            ? displayedSelectedColor.hex
            : undefined,
        colorName:
          displayedSelectedColor?.nombreColorDisplay &&
            shouldRenderValue(displayedSelectedColor.nombreColorDisplay)
            ? displayedSelectedColor.nombreColorDisplay
            : productSelection.selection.selectedColor &&
              shouldRenderValue(productSelection.selection.selectedColor)
              ? productSelection.selection.selectedColor
              : selectedColor?.label && shouldRenderValue(selectedColor.label)
                ? selectedColor.label
                : undefined,
        capacity:
          productSelection.selection.selectedCapacity &&
            shouldRenderValue(productSelection.selection.selectedCapacity)
            ? productSelection.selection.selectedCapacity
            : selectedCapacity?.label &&
              shouldRenderValue(selectedCapacity.label)
              ? selectedCapacity.label
              : undefined,
        ram:
          productSelection.selection.selectedMemoriaram &&
            shouldRenderValue(productSelection.selection.selectedMemoriaram)
            ? productSelection.selection.selectedMemoriaram
            : undefined,
        skuPostback: productSelection.selectedSkuPostback || "",
        desDetallada: productSelection.selectedVariant?.desDetallada,
        modelo: apiProduct?.modelo?.[0] || "",
        categoria: apiProduct?.categoria || "",
        indRetoma:
          apiProduct?.indRetoma?.[
          productSelection.selectedVariant?.index || 0
          ] ?? (acceptsTradeIn ? 1 : 0),
      });

      // Si está en el chat, cerrar el chat y redirigir al carrito
      if (isInChat) {
        closeChat();
        router.push('/carrito/step1');
      }
    } finally {
      // Restaurar el estado después de un delay para prevenir clics rápidos
      setTimeout(() => {
        setIsLoading(false);
      }, 300); // Tiempo reducido para mejor UX
    }
  };

  const handleToggleFavorite = () => {
    if (!onToggleFavorite) return;

    onToggleFavorite(id);
    posthogUtils.capture("toggle_favorite", {
      product_id: id,
      product_name: name,
      action: isFavorite ? "remove" : "add",
    });

    // Meta AddToWishlist solo cuando se AGREGA (isFavorite refleja el estado previo al click)
    const willBeAdded = !isFavorite;
    if (willBeAdded) {
      fbqAddToWishlist({
        content_name: name,
        content_ids: [currentSku || id],
        content_category: apiProduct?.categoria || "Samsung",
        value: currentPrice || 0,
        currency: "COP",
      });
    }
  };

  const handleRequestStockNotification = async (email: string) => {
    // Obtener el SKU del color seleccionado
    const selectedColorSku = displayedSelectedColor?.sku;

    // Obtener el codigoMarket correspondiente a la variante seleccionada
    const codigoMarket =
      productSelection.selectedCodigoMarket ||
      apiProduct?.codigoMarketBase ||
      "";

    await stockNotification.requestNotification({
      productName: currentProductName,
      email,
      sku: selectedColorSku,
      codigoMarket,
    });
  };

  const handleMoreInfo = () => {
    // Guardar la selección actual del usuario en localStorage
    const selectedProductData = {
      productId: id,
      productName: currentProductName,
      price:
        currentPrice ||
        (typeof finalCurrentPrice === "string"
          ? Number.parseInt(finalCurrentPrice.replaceAll(/[^\d]/g, ""))
          : finalCurrentPrice),
      originalPrice:
        currentOriginalPrice ||
        (typeof finalCurrentOriginalPrice === "string"
          ? Number.parseInt(finalCurrentOriginalPrice.replaceAll(/[^\d]/g, ""))
          : finalCurrentOriginalPrice),
      color:
        displayedSelectedColor?.nombreColorDisplay ||
        productSelection.selection.selectedColor ||
        selectedColor?.label,
      colorHex: displayedSelectedColor?.hex || selectedColor?.hex,
      capacity:
        productSelection.selection.selectedCapacity || selectedCapacity?.label,
      ram: productSelection.selection.selectedMemoriaram,
      sku: currentSku,
      ean: productSelection.selectedVariant?.ean || selectedColor?.ean,
      image:
        typeof currentImage === "string"
          ? currentImage
          : typeof image === "string"
            ? image
            : image.src,
      indcerointeres: apiProduct?.indcerointeres?.[0] ?? 0,
      allPrices: apiProduct?.precioeccommerce || [],
      skuflixmedia: productSelection.selectedSkuflixmedia,
      segmento: segmento || apiProduct?.segmento?.[0],
    };

    // Guardar en localStorage con una clave única por producto
    localStorage.setItem(
      `product_selection_${id}`,
      JSON.stringify(selectedProductData)
    );

    // Si está en el chat, cerrar el chat antes de navegar
    if (isInChat) {
      closeChat();
    }

    // Navega primero a la página multimedia con contenido Flixmedia.
    // Slug sin slash: codigoMarket de AV/DA trae '/' y rompe el route de Next.
    router.push(`/productos/multimedia/${String(id).split("/")[0]}`);
    posthogUtils.capture("product_more_info_click", {
      product_id: id,
      product_name: name,
      source: isInChat ? "chatbot" : "product_card",
      destination: "multimedia_page",
      segment: segmento,
    });
  };

  const handleEntregoEstreno = async () => {
    if (isLoading) {
      return; // Prevenir múltiples clics mientras está cargando
    }

    setIsLoading(true);

    try {
      // Validación estricta: debe existir un SKU válido
      const skuToUse = currentSku || selectedColor?.sku;
      const eanToUse =
        productSelection.selectedVariant?.ean || selectedColor?.ean || "";

      if (!skuToUse) {
        setIsLoading(false);
        return;
      }

      posthogUtils.capture("entrego_estreno_button_click", {
        product_id: id,
        product_name: name,
        selected_color:
          selectedColor?.name || productSelection.selection.selectedColor,
        selected_color_sku: currentSku || "",
        source: "product_card",
      });

      // Agregar el producto al carrito
      await addProduct({
        id,
        name,
        image:
          typeof currentImage === "string"
            ? currentImage
            : typeof image === "string"
              ? image
              : image.src ?? "",
        price:
          typeof finalCurrentPrice === "string"
            ? Number.parseInt(finalCurrentPrice.replaceAll(/[^\d]/g, ""))
            : finalCurrentPrice ?? 0,
        originalPrice:
          typeof finalCurrentOriginalPrice === "string"
            ? Number.parseInt(
              finalCurrentOriginalPrice.replaceAll(/[^\d]/g, "")
            )
            : finalCurrentOriginalPrice,
        stock: productSelection.selectedVariant?.stockDisponible ?? 0,
        quantity: 1,
        sku: currentSku || "",
        ean: eanToUse,
        puntos_q,
        color:
          displayedSelectedColor?.hex &&
            shouldRenderValue(displayedSelectedColor.hex)
            ? displayedSelectedColor.hex
            : undefined,
        colorName:
          displayedSelectedColor?.nombreColorDisplay &&
            shouldRenderValue(displayedSelectedColor.nombreColorDisplay)
            ? displayedSelectedColor.nombreColorDisplay
            : productSelection.selection.selectedColor &&
              shouldRenderValue(productSelection.selection.selectedColor)
              ? productSelection.selection.selectedColor
              : selectedColor?.label && shouldRenderValue(selectedColor.label)
                ? selectedColor.label
                : undefined,
        capacity:
          productSelection.selection.selectedCapacity &&
            shouldRenderValue(productSelection.selection.selectedCapacity)
            ? productSelection.selection.selectedCapacity
            : selectedCapacity?.label &&
              shouldRenderValue(selectedCapacity.label)
              ? selectedCapacity.label
              : undefined,
        ram:
          productSelection.selection.selectedMemoriaram &&
            shouldRenderValue(productSelection.selection.selectedMemoriaram)
            ? productSelection.selection.selectedMemoriaram
            : undefined,
        skuPostback: productSelection.selectedSkuPostback || "",
        desDetallada: productSelection.selectedVariant?.desDetallada,
        modelo: apiProduct?.modelo?.[0] || "",
        categoria: apiProduct?.categoria || "",
        indRetoma:
          apiProduct?.indRetoma?.[
          productSelection.selectedVariant?.index || 0
          ] ?? (acceptsTradeIn ? 1 : 0),
      });

      // Marcar que debe abrirse el modal de Trade-In automáticamente para este SKU específico
      // Guardar ANTES de navegar para asegurar que esté disponible
      if (typeof window !== "undefined") {
        // Guardar el SKU del producto para el cual se debe abrir el modal
        window.localStorage.setItem(
          "open_trade_in_modal_sku",
          currentSku || ""
        );
      }

      // Pequeño delay para asegurar que el localStorage se guarde
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Navegar al carrito
      router.push("/carrito/step1");
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    }
  };

  // Obtener imagen optimizada de Cloudinary para catálogo
  const cloudinaryImage = useCloudinaryImage({
    src: typeof currentImage === "string" ? currentImage : currentImage.src,
    transformType: "catalog",
    responsive: true,
  });

  // Color seleccionado para UI (coincide con el selector de colores)
  const displayedSelectedColor = useMemo(() => {
    if (apiProduct) {
      // Obtener las opciones de color con nombreColorDisplay desde el hook
      const colorOptions = productSelection
        .getColorOptions()
        .map((colorOption) => ({
          name: colorOption.color,
          hex: colorOption.hex,
          label: colorOption.nombreColorDisplay || colorOption.color,
          nombreColorDisplay: colorOption.nombreColorDisplay || undefined,
          sku: colorOption.variants[0]?.sku || "",
          ean: colorOption.variants[0]?.ean || "",
        }));

      // Buscar por el valor de color (hex) ya que productSelection.selection.selectedColor contiene el hex
      return (
        colorOptions.find(
          (c) =>
            c.name === productSelection.selection.selectedColor ||
            c.hex === productSelection.selection.selectedColor
        ) || null
      );
    }
    return selectedColor;
  }, [apiProduct, productSelection, selectedColor]);

  const handleMouseEnter = () => {
    prefetchFlixmediaScript();
  };

  return (
    <>
      <StockNotificationModal
        isOpen={stockNotification.isModalOpen}
        onClose={stockNotification.closeModal}
        productName={currentProductName}
        productImage={
          typeof currentImage === "string"
            ? currentImage
            : typeof image === "string"
              ? image
              : image.src ?? ""
        }
        selectedColor={
          displayedSelectedColor?.nombreColorDisplay &&
            shouldRenderValue(displayedSelectedColor.nombreColorDisplay)
            ? displayedSelectedColor.nombreColorDisplay
            : productSelection.selection.selectedColor &&
              shouldRenderValue(productSelection.selection.selectedColor)
              ? productSelection.selection.selectedColor
              : undefined
        }
        selectedStorage={
          productSelection.selection.selectedCapacity &&
            shouldRenderValue(productSelection.selection.selectedCapacity)
            ? productSelection.selection.selectedCapacity
            : undefined
        }
        onNotificationRequest={handleRequestStockNotification}
      />

      <div
        className={cn(
          "rounded-lg w-full h-full flex flex-col mx-auto",
          className
        )}
        onMouseEnter={handleMouseEnter}
      >
        {/* Sección de imagen con carrusel */}
        <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
          {/* Etiqueta "Nuevo" - Ribbon esquina superior izquierda (si gama es "Nuevo" o forceNuevo) */}
          {(forceNuevo || apiProduct?.gama?.some((g) => g?.toLowerCase() === 'nuevo')) && (
            <div className="absolute top-0 left-0 z-10 overflow-hidden w-[170px] h-[170px]">
              <div className="absolute top-[38px] left-[-42px] w-[220px] bg-blue-600 text-white text-[14px] font-bold text-center py-[10px] -rotate-45 shadow-md tracking-wide">
                Nuevo
              </div>
            </div>
          )}

          {/* Etiqueta de Addi - Parte inferior izquierda */}
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 py-1.5 px-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm">
            <Image
              src="https://res.cloudinary.com/dzi2p0pqa/image/upload/v1764650798/acd66fce-b218-4a0d-95e9-559410496596.png"
              alt="Addi"
              width={14}
              height={14}
              className="object-contain flex-shrink-0"
            />
            <p className="text-[8px] text-gray-700 font-medium">
              Paga con <span className="font-bold">addi</span>
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevenir que se active el click de la card
              handleToggleFavorite();
            }}
            className={cn(
              "absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer",
              "bg-white shadow-md hover:shadow-lg",
              isFavorite ? "text-red-500" : "text-gray-400"
            )}
          >
            <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
          </button>
          {/* Carrusel de imágenes - Clickable */}
          <div
            className="relative w-full h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleMoreInfo();
            }}
          >
            {transformedImages.map((transformedSrc, index) => {
              return (
                <div
                  key={index}
                  className={cn(
                    "absolute inset-0 flex items-center justify-center p-4",
                    index === currentImageIndex ? "opacity-100" : "opacity-0"
                  )}
                >
                  <div className="relative w-full h-full">
                    <Image
                      key={`${id}-${transformedSrc}-${index}`}
                      src={transformedSrc}
                      alt={`${name} - imagen ${index + 1}`}
                      fill
                      priority={index === 0}
                      loading={index === 0 ? "eager" : "lazy"}
                      className="object-cover"
                      sizes={cloudinaryImage.imageProps.sizes}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Etiqueta "Sin unidades" en la parte inferior de la imagen */}
          {isOutOfStock &&
            process.env.NEXT_PUBLIC_MAINTENANCE_MODE !== "true" && (
              <div className="absolute bottom-0 left-0 right-0 mx-3 mb-3">
                <div className="w-full py-1.5 px-3 rounded-md bg-white/95 backdrop-blur-sm border border-gray-200">
                  <p className="text-xs text-gray-600 text-center font-medium">
                    Sin unidades
                  </p>
                </div>
              </div>
            )}
        </div>

        {/* Contenido del producto */}
        <div className="py-2 space-y-2 flex-1 flex flex-col">
          {/* Título del producto */}
          <div className="px-3 min-h-[48px]">
            <h3 className="text-base font-bold line-clamp-2 text-black">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleMoreInfo();
                }}
                className="w-full text-left bg-transparent p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black text-black"
              >
                {currentProductName}
              </button>
            </h3>
            {/* SKU - Siempre visible */}
            {currentSku && (
              <div className="mt-1">
                <p className="text-xs text-gray-500 font-medium">
                  SKU: {currentSku}
                </p>
              </div>
            )}
            {/* CodigoMarket y otros datos - Solo si la variable de entorno lo permite */}
            {process.env.NEXT_PUBLIC_SHOW_PRODUCT_CODES === "true" &&
              process.env.NEXT_PUBLIC_MAINTENANCE_MODE !== "true" &&
              (currentCodigoMarket || currentskuPostback) && (
                <div className="mt-1 space-y-0.5">
                  {currentCodigoMarket && (
                    <p className="text-xs text-gray-500 font-medium">
                      Código: {currentCodigoMarket}
                    </p>
                  )}
                  {currentskuPostback && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium">
                        SKU Postback: {currentskuPostback}
                      </p>
                    </div>
                  )}

                  {/* Mostrar stock disponible ajustado */}
                  {productSelection.selectedVariant && (
                    <div className="text-sm text-gray-600 mt-2">
                      Stock disponible:{" "}
                      <span
                        className={cn(
                          "ml-1 font-semibold",
                          realStock > 0 ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {realStock}
                      </span>
                      {quantityInCart > 0 && (
                        <span className="text-xs text-blue-600 ml-1">
                          ({quantityInCart} en carrito)
                        </span>
                      )}
                      <span className="text-xs text-gray-500 ml-1">
                        (Total: {productSelection.selectedVariant.stockTotal} en{" "}
                        {productSelection.selectedVariant.cantidadTiendas}{" "}
                        {productSelection.selectedVariant.cantidadTiendas === 1
                          ? "tienda"
                          : "tiendas"}
                        )
                      </span>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Nombre de color del API (antes del selector) - Mostrar solo si hex Y nombre son válidos */}
          {displayedSelectedColor &&
            shouldRenderColor(displayedSelectedColor.hex, displayedSelectedColor.nombreColorDisplay) && (
              <div className="px-3 mb-1">
                <p className="text-xs text-gray-600 font-medium">
                  {`Color: ${displayedSelectedColor.nombreColorDisplay}`}
                </p>
              </div>
            )}

          {/* Contenedor para selectores y botón de entrego y estreno */}
          <div className="px-3 flex gap-2 items-start">
            {/* Columna izquierda: Selectores */}
            <div className="flex-1 space-y-2">
              {/* Selector de colores - Mostrar si hay colores válidos (hex + nombre) */}
              {(() => {
                // Filtrar colores válidos (hex válido + nombre válido)
                const validColors = apiProduct
                  ? productSelection
                      .getColorOptions()
                      .filter((c) => shouldRenderColor(c.hex, c.nombreColorDisplay || c.color))
                      .map((colorOption) => ({
                        name: colorOption.color,
                        hex: colorOption.hex,
                        label: colorOption.nombreColorDisplay || colorOption.color,
                        nombreColorDisplay: colorOption.nombreColorDisplay || undefined,
                        sku: colorOption.variants[0]?.sku || "",
                        ean: colorOption.variants[0]?.ean || "",
                      }))
                  : (colors || []).filter((c) =>
                      shouldRenderColor(c.hex, c.nombreColorDisplay || c.label)
                    );

                // Solo mostrar si hay al menos un color válido
                return validColors.length > 0 && (
                  <div className="min-h-[48px]">
                    <ColorSelector
                      colors={validColors}
                      selectedColor={displayedSelectedColor}
                      onColorSelect={handleColorSelect}
                      onShowMore={handleMoreInfo}
                    />
                  </div>
                );
              })()}

              {/* Selector de capacidad - Solo para categorías específicas Y si hay capacidades disponibles */}
              {showCapacitySelector &&
                (apiProduct
                  ? productSelection.allCapacities.length > 0
                  : capacities && capacities.length > 0) && (
                  <div className="min-h-[48px]">
                    <CapacitySelector
                      capacities={
                        apiProduct
                          ? productSelection.allCapacities.map(
                            (capacityName) => {
                              const formattedLabel =
                                formatCapacityLabel(capacityName);
                              const capacityInfo = capacities?.find(
                                (c) => c.label === capacityName
                              ) || {
                                value: capacityName
                                  .toLowerCase()
                                  .replaceAll(/\s+/g, ""),
                                label: formattedLabel,
                                sku: "",
                                ean: "",
                              };
                              return {
                                ...capacityInfo,
                                available: productSelection.availableCapacities.includes(capacityName),
                              };
                            }
                          )
                          : capacities || []
                      }
                      selectedCapacity={
                        apiProduct
                          ? productSelection.allCapacities
                            .map((capacityName) => {
                              const formattedLabel =
                                formatCapacityLabel(capacityName);
                              const capacityInfo = capacities?.find(
                                (c) => c.label === capacityName
                              ) || {
                                value: capacityName
                                  .toLowerCase()
                                  .replaceAll(/\s+/g, ""),
                                label: formattedLabel,
                              };
                              return capacityInfo;
                            })
                            .find(
                              (c) =>
                                c.label ===
                                formatCapacityLabel(
                                  productSelection.selection
                                    .selectedCapacity || ""
                                )
                            ) || null
                          : selectedCapacity
                      }
                      onCapacitySelect={handleCapacitySelect}
                    />
                  </div>
                )}
            </div>

            {/* Columna derecha: Botón de Entrego y Estreno - Mostrar solo si indRetoma === 1 */}
            {productSelection.selectedVariant?.indRetoma === 1 && (
              <div className="flex-shrink-0 w-[120px] self-start -mt-4 relative z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEntregoEstreno();
                  }}
                  disabled={isLoading}
                  className="bg-[#0099FF] text-white px-3 py-2 rounded-md text-center flex flex-col items-center justify-center w-full hover:bg-[#0088EE] active:bg-[#0077DD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative z-10"
                  style={{ pointerEvents: isLoading ? "none" : "auto" }}
                >
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-white mb-1 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <p className="text-[10px] font-bold mb-0 pointer-events-none">
                    Entrego y Estreno
                  </p>
                  <p className="text-[9px] opacity-90 pointer-events-none">
                    aplica ahora
                  </p>
                </button>
              </div>
            )}
          </div>

          {/* Precio */}
          <div className="px-3 space-y-3 mt-auto">
            {finalCurrentPrice && (
              <div className="space-y-1 min-h-[32px]">
                {(() => {
                  const { hasSavings, savings } = calculateSavings(
                    finalCurrentPrice,
                    finalCurrentOriginalPrice
                  );

                  if (!hasSavings) {
                    // Sin descuento: solo precio
                    return (
                      <div className="text-xl font-bold text-black">
                        {finalCurrentPrice}
                      </div>
                    );
                  }

                  // Con descuento: precio + info de descuento a la derecha
                  return (
                    <div className="flex items-end gap-3">
                      {/* Precio final */}
                      <div className="text-xl font-bold text-black leading-tight">
                        {finalCurrentPrice}
                      </div>

                      {/* Info de descuento a la derecha */}
                      <div className="flex flex-col items-start justify-end">
                        {/* Precio anterior tachado */}
                        <span className="text-xs line-through text-gray-500 leading-tight">
                          {finalCurrentOriginalPrice}
                        </span>
                        {/* Ahorro */}
                        <span className="text-xs font-semibold whitespace-nowrap text-blue-600 leading-tight">
                          Ahorra ${savings.toLocaleString("es-CO")}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {/* Botones de acción - Horizontal */}
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true" ||
                    isOutOfStock
                  ) {
                    // Abrir el modal directamente - el modal tiene z-index suficiente
                    stockNotification.openModal();
                  } else {
                    handleAddToCart();
                  }
                }}
                disabled={isLoading}
                className={cn(
                  "flex-1 bg-black text-white py-2 px-2 rounded-full text-xs lg:text-md font-semibold cursor-pointer",
                  "hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                  isLoading && "animate-pulse"
                )}
              >
                {isLoading ? (
                  <Loader className="w-4 h-4 mx-auto" />
                ) : process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true" ? (
                  "Notifícame"
                ) : isOutOfStock ? (
                  "Notifícame"
                ) : isInChat ? (
                  "Comprar"
                ) : (
                  "Añadir al carrito"
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoreInfo();
                }}
                className="text-black text-sm font-medium hover:underline transition-all whitespace-nowrap cursor-pointer"
              >
                Más información
              </button>
            </div>

            {/* Mensaje de cuotas sin interés */}
            {apiProduct?.indcerointeres?.[0] === 1 && (
              <div className="mt-2 sm:mt-3 flex items-start justify-center">
                <CeroInteresSection
                  ceroInteresData={ceroInteresData}
                  isInChat={isInChat}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
