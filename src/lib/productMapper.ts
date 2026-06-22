/**
 * Product Mapper - Convierte datos de API a formato del frontend
 * - Mapea ProductApiData a ProductCardProps
 * - Mapea BundleApiData a BundleCardProps
 * - Usa imágenes mock mientras se implementan
 */

import { ProductApiData, BundleApiData, BundleOption, ProductOrBundleApiData, BundleDirectResponse } from './api';
import { ProductCardProps, ProductColor, ProductCapacity } from '@/app/productos/components/ProductCard';
import { StaticImageData } from 'next/image';
import type { ZeroInterestSkuResult } from '@/services/cero-interes-sku.service';

// Importar imágenes mock para usar temporalmente
import emptyImg from '@/img/empty.jpeg';

import type { BundleProduct } from './api';

/**
 * Opción de bundle mapeada para el frontend
 */
export interface BundleOptionProps {
  product_sku: string;
  modelo: string;
  price: string; // bundle_discount formateado
  originalPrice?: string; // bundle_price formateado
  discount?: string;
  skus_bundle: string[];
  ind_entre_estre: number;
  imagePreviewUrl?: string[]; // URLs de las imágenes de preview de los productos del bundle
  productos?: BundleProduct[]; // Array de productos del bundle con detalles completos
  // Campos de variante del producto padre
  colorProductSku?: string; // Color hex del producto (ej: "#3C5B8A")
  nombreColorProductSku?: string; // Nombre del color (ej: "Azul Marino")
  capacidadProductSku?: string; // Capacidad (ej: "256GB")
  memoriaRamProductSku?: string; // RAM (ej: "12GB")
  stockTotal?: number; // Stock disponible para esta variante
  // Precios totales del bundle (numéricos, para cálculos en componentes)
  bundleTotalPrice?: number; // Precio total con descuento del bundle (suma de product_discount_price)
  bundleTotalOriginalPrice?: number; // Precio total original del bundle (suma de product_original_price)
}

/**
 * Props para BundleCard (componente de bundles)
 * Nueva estructura con múltiples opciones/variantes
 */
export interface BundleCardProps {
  id: string; // baseCodigoMarket + codCampana
  baseCodigoMarket: string;
  codCampana: string;
  name: string; // modelo de la primera opción (para mostrar título)
  image: string | StaticImageData; // imagePreviewUrl o imagen por defecto
  price: string; // precio de la primera opción (o más bajo)
  originalPrice?: string;
  discount?: string;
  opciones: BundleOptionProps[]; // Array de variantes del bundle
  categoria: string;
  menu: string;
  submenu: string;
  fecha_inicio: string;
  fecha_final: string;
  isBundle: true; // Indicador para distinguir de productos normales
  ceroInteresData?: ZeroInterestSkuResult[]; // Opciones de cero interés del producto padre
}


// Mapeo de colores robusto basado en colores reales de Samsung y otros fabricantes
// colorMap deprecado: el API ahora entrega hex, por lo que no se requiere mapeo nombre->hex

/**
 * Convierte un producto de la API al formato del frontend
 * Ahora agrupa por codigoMarket y maneja múltiples variantes de color
 */
export function mapApiProductToFrontend(apiProduct: ProductApiData): ProductCardProps {

  // Determinar imagen basada en categoría/subcategoría
  const image = getProductImage(apiProduct);

  // Crear colores del producto (ahora maneja arrays)
  const colors: ProductColor[] = createProductColorsFromArray(apiProduct);

  // Crear capacidades del producto
  const capacities: ProductCapacity[] = createProductCapacitiesFromArray(apiProduct);

  // Calcular precios y descuentos (usar el primer precio disponible)
  const { price, originalPrice, discount, isNew } = calculatePricingFromArray(apiProduct);

  const id = apiProduct.codigoMarketBase;


  // Procesar imageDetailsUrls: aplanar array de arrays a array simple
  const processedImageDetailsUrls = apiProduct.imageDetailsUrls?.flat().filter((url) => {
    if (Array.isArray(url)) {
      return url[0] && typeof url[0] === 'string' && url[0].trim() !== "";
    }
    return url && typeof url === 'string' && url.trim() !== "";
  }).map((url) => {
    if (Array.isArray(url)) {
      return url[0];
    }
    return url;
  }) || [];

  // Verificar si el producto acepta retoma (Trade-In)
  // indRetoma es un array de 0 o 1, si al menos una variante tiene 1, acepta retoma
  const acceptsTradeIn = apiProduct.indRetoma?.some(value => value === 1) ?? false;

  // Obtener el nombre del producto: usar el primer elemento de modelo o nombreMarket
  const productName = (apiProduct.modelo?.[0] || apiProduct.nombreMarket?.[0] || '').trim();

  return {
    id,
    name: productName,
    image,
    colors,
    capacities: capacities.length > 0 ? capacities : undefined,
    price,
    originalPrice,
    discount,
    segmento: apiProduct.segmento?.[0], // Tomar el primer elemento del array de segmento
    apiProduct: apiProduct, // Incluir el producto original de la API para acceso a campos adicionales
    acceptsTradeIn, // Indicador de si acepta retoma
    skuflixmedia: apiProduct.skuflixmedia?.[0], // Mapear skuflixmedia (tomar el primero si existe)
  };
}

/**
 * Obtiene la imagen apropiada para el producto
 */
function getProductImage(apiProduct: ProductApiData): string | StaticImageData {
  // Priorizar imagePreviewUrl: tomar la PRIMERA URL no vacía, no la posición [0].
  // Algunas variantes ocultas (ej: bundles "+ Marco Café") llegan con imagePreviewUrl=""
  // en el índice 0, lo que dejaba la card sin imagen pese a tener otras variantes con foto.
  if (apiProduct.imagePreviewUrl && apiProduct.imagePreviewUrl.length > 0) {
    const firstPreviewUrl = apiProduct.imagePreviewUrl.find(
      (url) => url && typeof url === 'string' && url.trim() !== ''
    );
    if (firstPreviewUrl) {
      return firstPreviewUrl;
    }
  }

  // Si no hay imagePreviewUrl, usar urlImagenes como fallback
  const firstImageUrl = apiProduct.urlImagenes?.find(url => url && url.trim() !== '');
  if (firstImageUrl) {
    return firstImageUrl;
  }

  // Usar imagen por defecto cuando no hay imagen de la API
  return emptyImg;
}

/**
 * Crea el array de colores para el producto desde el array de colores de la API
 * Incluye información de precios específica por variante de color
 */
function createProductColorsFromArray(apiProduct: ProductApiData): ProductColor[] {
  const colorsWithPrices: ProductColor[] = [];

  // Crear un mapa de colores únicos con sus precios correspondientes
  const colorPriceMap = new Map<string, {
    color: string;
    preciosNormales: number[];
    preciosDescuento: number[];
    indices: number[]
  }>();

  // Agrupar precios por color
  const MAX_PRICE = 100000000; // Filtrar precios corruptos
  const isValidHex = (c: string) => /^#[0-9A-Fa-f]{6}$/i.test(c?.trim() || '');

  for (let index = 0; index < apiProduct.color.length; index++) {
    const color = apiProduct.color[index];
    const precioNormal = apiProduct.precioNormal[index] || 0;
    const precioeccommerce = apiProduct.precioeccommerce[index] || 0;

    // Solo incluir colores con hex válido Y precios válidos (mayores a 0 y menores al máximo)
    const hasValidPrice = (precioNormal > 0 && precioNormal < MAX_PRICE) || (precioeccommerce > 0 && precioeccommerce < MAX_PRICE);
    if (isValidHex(color) && hasValidPrice) {
      const key = color.toLowerCase();

      if (!colorPriceMap.has(key)) {
        colorPriceMap.set(key, {
          color,
          preciosNormales: [],
          preciosDescuento: [],
          indices: []
        });
      }

      const colorData = colorPriceMap.get(key)!;
      colorData.preciosNormales.push(precioNormal);
      colorData.preciosDescuento.push(precioeccommerce);
      colorData.indices.push(index);
    }
  }

  // Convertir el mapa a array de ProductColor
  for (const { color, preciosNormales, preciosDescuento, indices } of colorPriceMap.values()) {
    // Normalizar el color para búsqueda consistente
    const normalizedColor = color.toLowerCase().trim();

    // Determinar si el color ya es un hexadecimal
    const isHexColor = /^#[0-9A-F]{6}$/i.test(color.trim());

    // Si ya es hex, usarlo directamente; si no, usar gris por defecto para el círculo de color
    const colorInfo = isHexColor
      ? { hex: color.trim(), label: color.trim() } // Usar el hex directamente
      : { hex: '#808080', label: color };
    const formatPrice = (price: number) => {
      if (!price || isNaN(price) || price <= 0) return "Precio no disponible";
      return `$ ${Math.round(price).toLocaleString('es-CO')}`;
    };

    // Encontrar el precio más bajo entre todas las variantes de este color
    // Filtrar precios corruptos (mayores a 100 millones)
    const MAX_PRICE = 100000000;
    const preciosNormalesValidos = preciosNormales.filter(p => p > 0 && p < MAX_PRICE);
    const preciosDescuentoValidos = preciosDescuento.filter(p => p > 0 && p < MAX_PRICE);

    const precioNormalMin = preciosNormalesValidos.length > 0
      ? Math.min(...preciosNormalesValidos)
      : 0;
    const precioDesctoMin = preciosDescuentoValidos.length > 0
      ? Math.min(...preciosDescuentoValidos)
      : precioNormalMin;

    const price = formatPrice(precioDesctoMin);
    let originalPrice: string | undefined;
    let discount: string | undefined;

    // Si hay descuento real
    if (precioDesctoMin > 0 && precioDesctoMin < precioNormalMin && precioNormalMin > 0) {
      originalPrice = formatPrice(precioNormalMin);
      const discountPercent = Math.round(((precioNormalMin - precioDesctoMin) / precioNormalMin) * 100);
      discount = `-${discountPercent}%`;
    }

    // Usar el primer SKU disponible para este color
    const firstIndex = indices[0];

    // Obtener el nombre del color del API si está disponible
    const nombreColorDisplay = apiProduct.nombreColor?.[firstIndex] || undefined;

    // Obtener imágenes y videos premium específicos para este color
    // imagenPremium y videoPremium vienen como arrays de arrays desde el API
    // Intentar primero con el nombre sin guión bajo (imagenPremium), luego con guión bajo (imagen_premium)
    const imagenesPremiumColor = ((apiProduct.imagenPremium?.[firstIndex] || apiProduct.imagen_premium?.[firstIndex]) || []) as string[];
    const videosPremiumColor = ((apiProduct.videoPremium?.[firstIndex] || apiProduct.video_premium?.[firstIndex]) || []) as string[];

    // Filtrar URLs vacías o inválidas
    const imagenesPremiumValidas = Array.isArray(imagenesPremiumColor)
      ? imagenesPremiumColor.filter((url: string) => url && typeof url === 'string' && url.trim() !== '')
      : [];
    const videosPremiumValidos = Array.isArray(videosPremiumColor)
      ? videosPremiumColor.filter((url: string) => url && typeof url === 'string' && url.trim() !== '')
      : [];

    colorsWithPrices.push({
      name: normalizedColor.replaceAll(/\s+/g, '-'),
      hex: colorInfo.hex,
      label: colorInfo.label,
      nombreColorDisplay,
      price,
      originalPrice,
      discount,
      sku: apiProduct.sku[firstIndex],
      ean: apiProduct.ean[firstIndex],
      imagePreviewUrl: apiProduct.imagePreviewUrl?.[firstIndex] || undefined,
      imagen_premium: imagenesPremiumValidas, // Imágenes premium para este color específico
      video_premium: videosPremiumValidos // Videos premium para este color específico
    });
  }

  return colorsWithPrices;
}

/**
 * Crea el array de capacidades para el producto desde el array de capacidades de la API
 * Incluye información de precios específica por variante de capacidad
 */
function createProductCapacitiesFromArray(apiProduct: ProductApiData): ProductCapacity[] {
  const capacitiesWithPrices: ProductCapacity[] = [];

  // Crear un mapa de capacidades únicas con sus precios correspondientes
  const capacityPriceMap = new Map<string, {
    capacity: string;
    preciosNormales: number[];
    preciosDescuento: number[];
    indices: number[]
  }>();

  // Agrupar precios por capacidad
  const MAX_PRICE = 100000000; // Filtrar precios corruptos
  apiProduct.capacidad.forEach((capacity, index) => {
    const precioNormal = apiProduct.precioNormal[index] || 0;
    const precioeccommerce = apiProduct.precioeccommerce[index] || 0;

    // Solo incluir capacidades con precios válidos (mayores a 0 y menores al máximo)
    if (((precioNormal > 0 && precioNormal < MAX_PRICE) || (precioeccommerce > 0 && precioeccommerce < MAX_PRICE))
      && capacity && capacity.trim() !== '' && capacity.toLowerCase() !== 'no aplica') {
      const key = capacity.toLowerCase().trim();

      if (!capacityPriceMap.has(key)) {
        capacityPriceMap.set(key, {
          capacity,
          preciosNormales: [],
          preciosDescuento: [],
          indices: []
        });
      }

      const capacityData = capacityPriceMap.get(key)!;
      capacityData.preciosNormales.push(precioNormal);
      capacityData.preciosDescuento.push(precioeccommerce);
      capacityData.indices.push(index);
    }
  });

  // Convertir el mapa a array de ProductCapacity
  capacityPriceMap.forEach(({ capacity, preciosNormales, preciosDescuento, indices }) => {
    const formatPrice = (price: number) => {
      if (!price || isNaN(price) || price <= 0) return "Precio no disponible";
      return `$ ${Math.round(price).toLocaleString('es-CO')}`;
    };

    // Encontrar el precio más bajo entre todas las variantes de esta capacidad
    // Filtrar precios corruptos (mayores a 100 millones)
    const MAX_PRICE = 100000000;
    const preciosNormalesValidos = preciosNormales.filter(p => p > 0 && p < MAX_PRICE);
    const preciosDescuentoValidos = preciosDescuento.filter(p => p > 0 && p < MAX_PRICE);

    const precioNormalMin = preciosNormalesValidos.length > 0
      ? Math.min(...preciosNormalesValidos)
      : 0;
    const precioDesctoMin = preciosDescuentoValidos.length > 0
      ? Math.min(...preciosDescuentoValidos)
      : precioNormalMin;

    const price = formatPrice(precioDesctoMin);
    let originalPrice: string | undefined;
    let discount: string | undefined;

    // Si hay descuento real
    if (precioDesctoMin > 0 && precioDesctoMin < precioNormalMin && precioNormalMin > 0) {
      originalPrice = formatPrice(precioNormalMin);
      const discountPercent = Math.round(((precioNormalMin - precioDesctoMin) / precioNormalMin) * 100);
      discount = `-${discountPercent}%`;
    }

    // Formatear label para mostrar (ej: "128GB" -> "128 GB")
    const label = capacity.replace(/(\d+)([A-Z]+)/gi, '$1 $2').toUpperCase();

    // Usar el primer SKU disponible para esta capacidad
    const firstIndex = indices[0];

    capacitiesWithPrices.push({
      value: capacity.toLowerCase().replace(/\s+/g, ''),
      label,
      price,
      originalPrice,
      discount,
      sku: apiProduct.sku[firstIndex],
      ean: apiProduct.ean[firstIndex]
    });
  });

  // Ordenar por capacidad numérica (128GB antes de 256GB)
  return capacitiesWithPrices.sort((a, b) => {
    const aNum = parseInt(a.value.match(/\d+/)?.[0] || '0');
    const bNum = parseInt(b.value.match(/\d+/)?.[0] || '0');
    return aNum - bNum;
  });
}

/**
 * Calcula precios, descuentos y si es producto nuevo desde arrays
 * Retorna información completa de precios por variante de color
 */
function calculatePricingFromArray(apiProduct: ProductApiData) {
  // Filtrar precios válidos (mayores a 0 y menores a 100 millones - filtrar datos corruptos)
  const MAX_PRICE = 100000000; // 100 millones
  const preciosNormalesValidos = apiProduct.precioNormal.filter(p => p > 0 && p < MAX_PRICE);
  const preciosDescuentoValidos = apiProduct.precioeccommerce.filter(p => p > 0 && p < MAX_PRICE);

  // Si no hay precios válidos, usar valores por defecto
  if (preciosNormalesValidos.length === 0 && preciosDescuentoValidos.length === 0) {
    return {
      price: "Precio no disponible",
      originalPrice: undefined,
      discount: undefined,
      isNew: false,
    };
  }

  // Usar el primer precio disponible (o el más bajo si hay múltiples)
  const precioNormal = preciosNormalesValidos.length > 0
    ? Math.min(...preciosNormalesValidos)
    : 0;
  const precioeccommerce = preciosDescuentoValidos.length > 0
    ? Math.min(...preciosDescuentoValidos)
    : precioNormal;

  // Formatear precios a formato colombiano - asegurar números enteros
  const formatPrice = (price: number) => {
    if (!price || isNaN(price) || price <= 0) return "Precio no disponible";
    return `$ ${Math.round(price).toLocaleString('es-CO')}`;
  };

  const price = formatPrice(precioeccommerce);
  let originalPrice: string | undefined;
  let discount: string | undefined;

  // Si hay descuento real
  if (precioeccommerce < precioNormal && precioNormal > 0) {
    originalPrice = formatPrice(precioNormal);
    const discountPercent = Math.round(((precioNormal - precioeccommerce) / precioNormal) * 100);
    discount = `-${discountPercent}%`;
  }

  // Determinar si es producto nuevo (menos de 30 días desde fecha de inicio)
  const fechaInicio = new Date(apiProduct.fechaInicioVigencia[0]);
  const ahora = new Date();
  const diasDiferencia = (ahora.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24);
  const isNew = diasDiferencia < 30;

  return {
    price,
    originalPrice,
    discount,
    isNew,
  };
}

/**
 * Convierte múltiples productos de la API
 * Filtra productos sin precios válidos
 * NOTA: Esta función ahora acepta ProductOrBundleApiData[] pero solo procesa productos (ignora bundles)
 * Para procesar bundles, usar mapApiProductsAndBundles
 */
export function mapApiProductsToFrontend(apiProducts: ProductOrBundleApiData[]): ProductCardProps[] {
  // Validación de seguridad
  if (!apiProducts || !Array.isArray(apiProducts)) {
    console.warn('[mapApiProductsToFrontend] Recibido valor inválido:', apiProducts);
    return [];
  }

  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'production';

  return apiProducts
    .filter((item): item is ProductApiData => !isBundle(item))
    .filter((item) => {
      // Filtrar por visibilidad del entorno
      const visibilityArray = environment === 'staging'
        ? item.visibleStaging
        : item.visibleProduction;

      // Si el campo existe, verificar que al menos una variante sea visible
      // Si el campo no existe (backend sin actualizar), mostrar el producto
      if (visibilityArray && Array.isArray(visibilityArray) && visibilityArray.length > 0) {
        return visibilityArray.some(v => v === true);
      }
      return true;
    })
    .map(mapApiProductToFrontend);
}

/**
 * Agrupa productos por categoría
 */
export function groupProductsByCategory(products: ProductCardProps[]): Record<string, ProductCardProps[]> {
  const grouped: Record<string, ProductCardProps[]> = {
    'accesorios': [],
    'tv-monitores-audio': [],
    'smartphones-tablets': [],
    'electrodomesticos': [],
  };

  products.forEach(product => {
    // Asegurar que name sea string (después del mapeo siempre debería serlo)
    const productName = typeof product.name === 'string' ? product.name : String(product.name || '');
    const nameLower = productName.toLowerCase();

    // Mapear categorías de la API a categorías del frontend
    if (nameLower.includes('buds') ||
      nameLower.includes('watch') ||
      nameLower.includes('cargador') ||
      nameLower.includes('funda')) {
      grouped['accesorios'].push(product);
    } else if (nameLower.includes('tv') ||
      nameLower.includes('monitor') ||
      nameLower.includes('soundbar')) {
      grouped['tv-monitores-audio'].push(product);
    } else if (nameLower.includes('galaxy') ||
      nameLower.includes('tab') ||
      nameLower.includes('celular')) {
      grouped['smartphones-tablets'].push(product);
    } else {
      grouped['electrodomesticos'].push(product);
    }
  });

  return grouped;
}

/**
 * Type guard para verificar si es un bundle
 */
export function isBundle(item: ProductOrBundleApiData): item is BundleApiData {
  return item.isBundle === true;
}

/**
 * Convierte un bundle de la API al formato del frontend
 * Nueva estructura: bundles agrupados con array de opciones
 */
export function mapApiBundleToFrontend(apiBundle: BundleApiData): BundleCardProps {
  // Formatear precios
  const formatPrice = (price: number) => {
    if (!price || isNaN(price) || price <= 0) return "Precio no disponible";
    return `$ ${Math.round(price).toLocaleString('es-CO')}`;
  };

  // Calcular descuento para una opción
  const calculateDiscount = (bundlePrice: number, bundleDiscount: number): string | undefined => {
    if (bundlePrice > 0 && bundleDiscount > 0 && bundleDiscount < bundlePrice) {
      const discountPercent = Math.round(((bundlePrice - bundleDiscount) / bundlePrice) * 100);
      return `-${discountPercent}%`;
    }
    return undefined;
  };

  // Mapear todas las opciones del bundle
  const opciones: BundleOptionProps[] = (apiBundle.opciones || []).map((opcion: BundleOption) => ({
    product_sku: opcion.product_sku,
    modelo: opcion.modelo,
    price: formatPrice(opcion.bundle_discount),
    originalPrice: opcion.bundle_price > 0 ? formatPrice(opcion.bundle_price) : undefined,
    discount: calculateDiscount(opcion.bundle_price, opcion.bundle_discount),
    skus_bundle: opcion.skus_bundle,
    ind_entre_estre: opcion.ind_entre_estre,
    imagePreviewUrl: opcion.imagePreviewUrl,
    productos: opcion.productos, // Propagar el array de productos del backend
    // Nuevos campos de variante del producto padre
    colorProductSku: opcion.colorProductSku,
    nombreColorProductSku: opcion.nombreColorProductSku,
    capacidadProductSku: opcion.capacidadProductSku,
    memoriaRamProductSku: opcion.memoriaRamProductSku,
    stockTotal: opcion.stockTotal,
    // Precios totales del bundle (numéricos, para cálculos en componentes)
    bundleTotalPrice: opcion.bundle_discount,
    bundleTotalOriginalPrice: opcion.bundle_price,
  }));

  // Usar la primera opción para mostrar datos principales
  const firstOption = apiBundle.opciones?.[0];
  const price = firstOption ? formatPrice(firstOption.bundle_discount) : "Precio no disponible";
  const originalPrice = firstOption && firstOption.bundle_price > 0
    ? formatPrice(firstOption.bundle_price)
    : undefined;
  const discount = firstOption
    ? calculateDiscount(firstOption.bundle_price, firstOption.bundle_discount)
    : undefined;
  const name = firstOption?.modelo || 'Bundle';

  // Obtener imagen: manejar tanto string como array
  let image: string | StaticImageData = emptyImg;
  if (apiBundle.imagePreviewUrl) {
    if (Array.isArray(apiBundle.imagePreviewUrl)) {
      const firstPreviewUrl = apiBundle.imagePreviewUrl.find(url => url && typeof url === 'string' && url.trim() !== '');
      if (firstPreviewUrl) {
        image = firstPreviewUrl;
      }
    } else if (typeof apiBundle.imagePreviewUrl === 'string' && apiBundle.imagePreviewUrl.trim() !== '') {
      image = apiBundle.imagePreviewUrl;
    }
  }

  // Normalizar categoria, menu y submenu (pueden venir como string o array)
  const normalizeStringOrArray = (value: string | string[] | undefined): string => {
    if (!value) return '';
    if (Array.isArray(value)) {
      // Si es array, tomar el primer elemento o unir con coma
      return value.length > 0 ? value[0] : '';
    }
    return value;
  };

  return {
    id: `${apiBundle.baseCodigoMarket}-${apiBundle.codCampana}`,
    baseCodigoMarket: apiBundle.baseCodigoMarket,
    codCampana: apiBundle.codCampana,
    name,
    image,
    price,
    originalPrice,
    discount,
    opciones,
    categoria: normalizeStringOrArray(apiBundle.categoria),
    menu: normalizeStringOrArray(apiBundle.menu),
    submenu: normalizeStringOrArray(apiBundle.submenu),
    fecha_inicio: apiBundle.fecha_inicio,
    fecha_final: apiBundle.fecha_final,
    isBundle: true,
  };
}

/**
 * Mapea la respuesta directa del endpoint de bundle individual a BundleCardProps
 * Este mapper se usa para el endpoint /api/products/v2/bundles/:baseCodigoMarket/:codCampana/:product_sku
 */
export function mapDirectBundleResponseToFrontend(
  bundleResponse: BundleDirectResponse
): BundleCardProps {
  // Formatear precios
  const formatPrice = (price: number) => {
    if (!price || isNaN(price) || price <= 0) return "Precio no disponible";
    return `$ ${Math.round(price).toLocaleString('es-CO')}`;
  };

  // Calcular descuento
  const calculateDiscount = (bundlePrice: number, bundleDiscount: number): string | undefined => {
    if (bundlePrice > 0 && bundleDiscount > 0 && bundleDiscount < bundlePrice) {
      const discountPercent = Math.round(((bundlePrice - bundleDiscount) / bundlePrice) * 100);
      return `-${discountPercent}%`;
    }
    return undefined;
  };

  // El endpoint directo solo devuelve UNA opción del bundle (la especificada por product_sku)
  // Crear la opción única a partir de los productos
  const productos = bundleResponse.productos || [];

  // Calcular precios del bundle sumando los precios de los productos
  const bundlePrice = productos.reduce((sum, p) => sum + (p.product_original_price || 0), 0);
  const bundleDiscount = productos.reduce((sum, p) => sum + (p.product_discount_price || 0), 0);

  // Crear nombre del bundle concatenando modelos
  const modelo = productos.map(p => p.modelo).join(' + ') || 'Bundle';

  // Obtener SKUs de los productos
  const skus_bundle = productos.map(p => p.sku);

  // Obtener imágenes preview de los productos
  const imagePreviewUrl = productos
    .map(p => p.imagePreviewUrl)
    .filter((url): url is string => !!url);

  // Extraer datos del primer producto (producto padre)
  const mainProduct = productos[0];

  const opcion: BundleOptionProps = {
    product_sku: bundleResponse.product_sku,
    modelo,
    price: formatPrice(bundleDiscount),
    originalPrice: bundlePrice > 0 ? formatPrice(bundlePrice) : undefined,
    discount: calculateDiscount(bundlePrice, bundleDiscount),
    skus_bundle,
    ind_entre_estre: 0, // Este campo no viene en la respuesta directa
    imagePreviewUrl,
    productos,
    // Datos de variante del producto padre (primer producto)
    colorProductSku: mainProduct?.color,
    nombreColorProductSku: mainProduct?.nombreColor,
    capacidadProductSku: mainProduct?.capacidad,
    memoriaRamProductSku: mainProduct?.memoriaram,
    stockTotal: mainProduct?.stockTotal,
    // Precios totales del bundle (numéricos, para cálculos en componentes)
    bundleTotalPrice: bundleDiscount,
    bundleTotalOriginalPrice: bundlePrice,
  };

  // Obtener imagen del bundle (usar imagen del primer producto o placeholder)
  const image: string | StaticImageData = mainProduct?.imagePreviewUrl || emptyImg;

  return {
    id: `${bundleResponse.baseCodigoMarket}-${bundleResponse.codCampana}`,
    baseCodigoMarket: bundleResponse.baseCodigoMarket,
    codCampana: bundleResponse.codCampana,
    name: modelo,
    image,
    price: formatPrice(bundleDiscount),
    originalPrice: bundlePrice > 0 ? formatPrice(bundlePrice) : undefined,
    discount: calculateDiscount(bundlePrice, bundleDiscount),
    opciones: [opcion], // Solo una opción en la respuesta directa
    categoria: mainProduct?.categoria || '',
    menu: '',
    submenu: '',
    fecha_inicio: '',
    fecha_final: '',
    isBundle: true,
  };
}

/**
 * Tipo unión para items mezclados (productos y bundles)
 */
export type MixedProductItem =
  | (ProductCardProps & { itemType: 'product' })
  | (BundleCardProps & { itemType: 'bundle' });

/**
 * Convierte múltiples items (productos y bundles) de la API
 * Retorna un objeto con productos y bundles separados, más orderedItems que preserva el orden original del API
 */
export function mapApiProductsAndBundles(apiItems: ProductOrBundleApiData[]): {
  products: ProductCardProps[];
  bundles: BundleCardProps[];
  orderedItems: MixedProductItem[];
} {
  const products: ProductCardProps[] = [];
  const bundles: BundleCardProps[] = [];
  const orderedItems: MixedProductItem[] = [];

  // Determinar el entorno actual para filtrar por visibilidad
  const environment = typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_ENVIRONMENT || 'production'
    : process.env.NEXT_PUBLIC_ENVIRONMENT || 'production';

  apiItems.forEach(item => {
    if (isBundle(item)) {
      const mappedBundle = mapApiBundleToFrontend(item);
      bundles.push(mappedBundle);
      orderedItems.push({ ...mappedBundle, itemType: 'bundle' as const });
    } else {
      // Filtrar productos según visibilidad del entorno
      const visibilityArray = environment === 'staging'
        ? item.visibleStaging
        : item.visibleProduction;

      // Si el campo existe, verificar que al menos una variante sea visible
      // Si el campo no existe (backend sin actualizar), mostrar el producto
      if (visibilityArray && Array.isArray(visibilityArray) && visibilityArray.length > 0) {
        const isVisible = visibilityArray.some(v => v === true);
        if (!isVisible) return; // No incluir este producto
      }

      const mappedProduct = mapApiProductToFrontend(item);
      products.push(mappedProduct);
      orderedItems.push({ ...mappedProduct, itemType: 'product' as const });
    }
  });

  return { products, bundles, orderedItems };
}

/**
 * Combina productos y bundles en una sola lista
 * Útil para mostrarlos mezclados en el mismo grid
 *
 * @param products - Array de productos
 * @param bundles - Array de bundles
 * @param bundlesFirst - Si true, coloca bundles al inicio (default: true)
 * @returns Array mixto con productos y bundles
 */
export function combineProductsAndBundles(
  products: ProductCardProps[],
  bundles: BundleCardProps[],
  bundlesFirst: boolean = true
): MixedProductItem[] {
  const bundleItems: MixedProductItem[] = bundles.map(bundle => ({
    ...bundle,
    itemType: 'bundle' as const,
  }));

  const productItems: MixedProductItem[] = products.map(product => ({
    ...product,
    itemType: 'product' as const,
  }));

  // Si bundlesFirst es true, bundles van primero
  return bundlesFirst
    ? [...bundleItems, ...productItems]
    : [...productItems, ...bundleItems];
}
