/**
 * Cloudinary Image Optimization Configuration
 *
 * Centraliza la lógica de transformación de imágenes usando Cloudinary
 * para garantizar tamaños consistentes y optimización automática.
 */

// Configuración de Cloudinary desde variables de entorno
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo';
const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Tipos de transformación disponibles por contexto de uso
 */
export type ImageTransformType =
  // Productos
  | 'catalog'          // Grid de productos (1000x1000)
  | 'product-main'     // Vista principal de producto (1200x1200)
  | 'product-detail'   // Detalle ampliado (1200x1200)
  | 'thumbnail'        // Miniaturas (200x200)
  | 'comparison'       // Comparación de productos (400x400)
  // Banners
  | 'hero'             // Banners/Hero sections legacy (1600x800)
  | 'hero-banner'      // Banner principal/Hero (1440x810)
  | 'catalog-banner'   // Banners intercalados en grids HORIZONTALES (800x600)
  | 'vertical-banner'  // Banners verticales aspect-[9/16] (600x1067)
  | 'landing-banner'   // Landing pages full-width (1600x900)
  | 'mobile-banner'    // Banners mobile (750x1000)
  // General
  | 'original';        // Sin transformación

/**
 * Configuración de transformaciones por tipo
 * Usa las mejores prácticas de Cloudinary:
 * - f_auto: Formato automático (WebP/AVIF cuando disponible)
 * - q_auto: Calidad automática optimizada
 * - c_fill/pad/fit: Estrategia de crop según necesidad
 * - g_auto: Gravity automático (enfoca en contenido importante)
 * - b_auto:predominant: Rellena espacios vacíos con color predominante
 */
const TRANSFORM_CONFIGS: Record<ImageTransformType, string> = {
  // Catálogo - 1000x1000, ALTA CALIDAD optimizada para velocidad
  // q_90: Calidad premium (diferencia imperceptible vs q_100, 40% menos peso)
  // SIN dpr_2.0: Next.js maneja Retina con srcset automático, evita timeouts de generación
  // fl_progressive: Carga progresiva para mejor percepción
  // c_pad: Mantiene producto completo sin recortes
  catalog: 'f_auto,q_90,c_pad,w_1000,h_1000,fl_progressive',

  // Vista principal producto - 1200x1200, calidad premium balanceada
  // q_95: Calidad excelente con buen rendimiento
  'product-main': 'f_auto,q_95,c_pad,g_auto,w_1200,h_1200,fl_progressive',

  // Detalle producto - 1200x1200, máxima calidad para zoom
  // q_100: Máxima calidad donde realmente importa (vista detallada)
  // Tamaño razonable evita timeouts de Cloudinary
  'product-detail': 'f_auto,q_100,c_pad,w_1200,h_1200,fl_progressive',

  // Thumbnail - 200x200, calidad eficiente
  // q_85: Suficiente para miniaturas, tamaño pequeño
  thumbnail: 'f_auto,q_85,c_pad,g_auto,w_200,h_200,b_auto:predominant',

  // Comparación - 400x400, calidad óptima
  comparison: 'f_auto,q_90,c_pad,g_auto,w_400,h_400,b_auto:predominant',

  // Hero/Banner legacy - capado a 1600 de ancho, sin crop (mantener para compatibilidad).
  // c_limit: NO hace upscale ni crop; baja-escala sólo si el original excede el cap.
  hero: 'f_auto,q_100,c_limit,w_1600,fl_progressive',

  // Banner Hero/Principal - sirve la imagen en su proporción natural.
  // c_limit + w_2880: cap retina-friendly para desktops 4K, sin recortar.
  // Sin g_auto porque ya no recortamos — la composición queda intacta.
  'hero-banner': 'f_auto,q_100,c_limit,w_2880,fl_progressive',

  // Banner Catálogo HORIZONTAL - banners intercalados en grids de productos.
  // Cap 1600 suficiente para la posición que ocupan dentro del grid.
  'catalog-banner': 'f_auto,q_100,c_limit,w_1600,fl_progressive',

  // Banner VERTICAL - banners verticales tipo stories.
  // c_fit mantiene la imagen completa dentro del cap.
  'vertical-banner': 'f_auto,q_100,c_limit,w_1200,fl_progressive',

  // Banner Landing - cap de 2520 para pantallas anchas.
  'landing-banner': 'f_auto,q_100,c_limit,w_2520,fl_progressive',

  // Banner Mobile - cap 1200 para dispositivos con DPR 3x (iPhones de 390dp ~ 1170 reales).
  'mobile-banner': 'f_auto,q_100,c_limit,w_1200,fl_progressive',

  // Original - alta calidad sin transformación de tamaño
  original: 'f_auto,q_95,fl_progressive',
};

/**
 * Extrae información de una URL de Cloudinary existente
 * o determina si es una URL externa que necesita ser proxied
 */
function extractCloudinaryInfo(url: string): {
  publicId: string;
  cloudName: string | null;
  isExternal: boolean;
  versionPrefix: string;
} {
  // Si la URL ya es de Cloudinary, extraer cloud name, version y public_id
  const cloudinaryRegex = /cloudinary\.com\/([^\/]+)\/image\/upload\/(v\d+\/)?(.+)$/;
  const match = url.match(cloudinaryRegex);

  if (match) {
    return {
      cloudName: match[1],      // Ej: "dnglv0zqg"
      versionPrefix: match[2] || '',  // Ej: "v1759796902/"
      publicId: match[3],       // Ej: "botopia/audio_video/..."
      isExternal: false
    };
  }

  // Si es una URL externa, usar fetch para proxiar a través de Cloudinary
  return {
    publicId: url,
    cloudName: null,
    versionPrefix: '',
    isExternal: true
  };
}

/**
 * Genera una URL de Cloudinary optimizada con las transformaciones especificadas
 *
 * @param imageUrl - URL de la imagen (puede ser Cloudinary o externa)
 * @param transformType - Tipo de transformación a aplicar
 * @returns URL optimizada de Cloudinary
 *
 * @example
 * ```ts
 * // Imagen del catálogo
 * const catalogUrl = getCloudinaryUrl(product.image, 'catalog');
 *
 * // Imagen detalle del producto
 * const detailUrl = getCloudinaryUrl(product.image, 'product-detail');
 * ```
 */
export function getCloudinaryUrl(
  imageUrl: string | undefined | null,
  transformType: ImageTransformType = 'original'
): string {
  // Si no hay imagen, devolver placeholder
  if (!imageUrl || typeof imageUrl !== 'string') {
    return '/placeholder-product.png';
  }

  // Si es un StaticImageData o path local, devolverlo tal cual
  if (imageUrl.startsWith('/') || imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  const { publicId, cloudName, versionPrefix, isExternal } = extractCloudinaryInfo(imageUrl);
  const transformation = TRANSFORM_CONFIGS[transformType];

  if (isExternal) {
    // Usar fetch para URLs externas
    return `${CLOUDINARY_BASE_URL}/${transformation}/f_auto/fetch:${encodeURIComponent(publicId)}`;
  }

  // Si la URL ya tenía un cloud name, usar ese en lugar del de .env
  // Esto preserva las URLs completas que vienen del backend
  const baseUrl = cloudName
    ? `https://res.cloudinary.com/${cloudName}/image/upload`
    : CLOUDINARY_BASE_URL;

  // URL de Cloudinary nativa con transformaciones inyectadas
  return `${baseUrl}/${transformation}/${versionPrefix}${publicId}`;
}

/**
 * Genera múltiples tamaños para srcset (responsive images)
 *
 * @param imageUrl - URL de la imagen
 * @param transformType - Tipo base de transformación
 * @returns String para srcset con múltiples tamaños
 */
export function getResponsiveSrcSet(
  imageUrl: string | undefined | null,
  transformType: ImageTransformType
): string {
  if (!imageUrl) return '';

  const baseConfig = TRANSFORM_CONFIGS[transformType];
  const { publicId, cloudName, versionPrefix, isExternal } = extractCloudinaryInfo(imageUrl);

  // Generar variantes: 1x, 1.5x, 2x para dispositivos de alta densidad
  const sizes = [1, 1.5, 2];

  // Determinar el base URL (preservar cloud name de la URL original si existe)
  const baseUrl = cloudName
    ? `https://res.cloudinary.com/${cloudName}/image/upload`
    : CLOUDINARY_BASE_URL;

  const srcset = sizes.map(multiplier => {
    // Extraer dimensiones del baseConfig
    const widthMatch = baseConfig.match(/w_(\d+)/);
    const heightMatch = baseConfig.match(/h_(\d+)/);

    if (!widthMatch || !heightMatch) return null;

    const width = Math.round(parseInt(widthMatch[1]) * multiplier);
    const height = Math.round(parseInt(heightMatch[1]) * multiplier);

    // Reemplazar dimensiones en la config
    const scaledConfig = baseConfig
      .replace(/w_\d+/, `w_${width}`)
      .replace(/h_\d+/, `h_${height}`);

    const url = isExternal
      ? `${CLOUDINARY_BASE_URL}/${scaledConfig}/f_auto/fetch:${encodeURIComponent(publicId)}`
      : `${baseUrl}/${scaledConfig}/${versionPrefix}${publicId}`;

    return `${url} ${multiplier}x`;
  }).filter(Boolean).join(', ');

  return srcset;
}

/**
 * Configuración de dimensiones CSS por tipo de transformación
 * Para usar con Next.js Image component
 * Dimensiones optimizadas para balance calidad/rendimiento
 */
export const IMAGE_DIMENSIONS: Record<ImageTransformType, { width: number; height: number }> = {
  // Productos
  catalog: { width: 1000, height: 1000 },
  'product-main': { width: 1200, height: 1200 },
  'product-detail': { width: 1200, height: 1200 },
  thumbnail: { width: 200, height: 200 },
  comparison: { width: 400, height: 400 },
  // Banners
  hero: { width: 1600, height: 800 },
  'hero-banner': { width: 1440, height: 810 },
  'catalog-banner': { width: 800, height: 600 },
  'vertical-banner': { width: 600, height: 1067 }, // Aspect ratio 9:16
  'landing-banner': { width: 1210, height: 310 }, // Dimensiones del dashboard
  'mobile-banner': { width: 414, height: 310 }, // Dimensiones del dashboard
  // General
  original: { width: 1200, height: 1200 },
};

/**
 * Alias para getCloudinaryUrl (para compatibilidad)
 */
export const getCloudinaryImageUrl = getCloudinaryUrl;

/**
 * Verifica si un banner contiene video en lugar de imagen
 * Útil para evitar aplicar transformaciones de imagen a videos
 *
 * @param banner - Objeto banner con URLs de media
 * @returns true si el banner tiene video, false si es imagen
 *
 * @example
 * ```ts
 * if (isBannerVideo(banner)) {
 *   // Renderizar video sin transformaciones
 * } else {
 *   // Aplicar optimizaciones de imagen
 * }
 * ```
 */
export function isBannerVideo(banner: {
  desktop_video_url?: string | null;
  mobile_video_url?: string | null;
}): boolean {
  return Boolean(banner.desktop_video_url || banner.mobile_video_url);
}
