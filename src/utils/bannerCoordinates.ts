/**
 * Utilidades para el Sistema de Posicionamiento de Banners
 *
 * Sistema de posiciones JSON con porcentajes del API
 * position_desktop/mobile: JSON con x,y porcentuales (0-100)
 */

import type { BannerPosition, BannerTextStyles } from '@/types/banner';

/**
 * Parsea una cadena JSON de posición del API a objeto BannerPosition
 *
 * @param positionJson - String JSON en formato {"x":50,"y":50,"imageWidth":1920,"imageHeight":1080}
 * @returns Objeto BannerPosition o null si es inválido
 *
 * @example
 * parsePosition('{"x":26.69,"y":55.53,"imageWidth":1920,"imageHeight":1080}')
 * // { x: 26.69, y: 55.53, imageWidth: 1920, imageHeight: 1080 }
 */
export function parsePosition(positionJson: string | null | undefined): BannerPosition | null {
  if (!positionJson) {
    console.warn('[BannerPosition] Empty position JSON - returning null');
    return null;
  }

  try {
    const parsed = JSON.parse(positionJson) as BannerPosition;

    // Validar que tenga las propiedades necesarias
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number'
    ) {
      console.warn('[BannerPosition] Invalid position format:', parsed);
      return null;
    }

    // Validar rangos (porcentajes deben estar entre 0-100)
    if (parsed.x < 0 || parsed.x > 100 || parsed.y < 0 || parsed.y > 100) {
      console.warn('[BannerPosition] Position out of range (0-100):', parsed);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('[BannerPosition] Failed to parse position JSON:', error);
    return null;
  }
}

/**
 * Convierte un objeto BannerPosition a estilos CSS para posicionamiento absoluto
 *
 * @param position - Objeto BannerPosition con porcentajes x,y
 * @returns Objeto con propiedades left, top y transform para CSS
 *
 * @example
 * positionToCSS({ x: 26.69, y: 55.53, imageWidth: 1920, imageHeight: 1080 })
 * // { left: "26.69%", top: "55.53%", transform: "translate(-50%, -50%)" }
 */
export function positionToCSS(position: BannerPosition | null): {
  left: string;
  top: string;
  transform: string;
} {
  // Fallback al centro si no hay posición
  if (!position) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
    transform: 'translate(-50%, -50%)', // Centrar desde el punto de anclaje
  };
}

/**
 * Parsea una cadena JSON de estilos de texto del API a objeto BannerTextStyles
 *
 * @param textStylesJson - String JSON con estilos de texto (puede ser null)
 * @returns Objeto BannerTextStyles o null si no hay estilos o es inválido
 *
 * @example
 * parseTextStyles('{"title":{"fontSize":"2rem","fontWeight":"700"},...}')
 * // { title: { fontSize: "2rem", fontWeight: "700" }, ... }
 */
export function parseTextStyles(textStylesJson: string | null | undefined): BannerTextStyles | null {
  if (!textStylesJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(textStylesJson) as BannerTextStyles;
    return parsed;
  } catch (error) {
    console.error('[BannerTextStyles] Failed to parse text styles JSON:', error);
    return null;
  }
}

/**
 * Convierte un valor de fontSize/padding (px, rem, em) a una expresión `clamp()`
 * que escala con el ancho del viewport.
 *
 * Diseñado para textos de banners cuyo `fontSize` viene fijo del CMS y se
 * desbordan en pantallas estrechas (ej. Galaxy S20 a 360px) sin hacerse más
 * grandes que el diseño en pantallas anchas (ej. iPhone 14 Pro Max a 430px).
 *
 * - `designVwPx` = ancho de viewport para el cual el valor original es el "natural".
 *   Por defecto 420px: a partir de 420px de viewport, el texto ya no crece.
 * - `minRatio`   = cota inferior como fracción del valor original (default 0.55).
 *
 * @example
 * fluidFontSize("32px") // "clamp(17.60px, 7.62vw, 32.00px)"
 * fluidFontSize("2rem") // "clamp(17.60px, 7.62vw, 32.00px)"
 */
export function fluidFontSize(
  value: string | number | undefined | null,
  designVwPx = 420,
  minRatio = 0.55,
  minPx = 12,
): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const raw = typeof value === 'number' ? `${value}px` : String(value).trim();

  const match = /^([\d.]+)\s*(px|rem|em)?$/.exec(raw);
  if (!match) return raw;

  const num = parseFloat(match[1]);
  const unit = match[2] || 'px';
  if (!Number.isFinite(num) || num <= 0) return raw;

  const px = unit === 'px' ? num : num * 16;
  const vw = (px / designVwPx) * 100;
  const min = Math.max(px * minRatio, minPx);

  if (min >= px) return `${px.toFixed(2)}px`;

  return `clamp(${min.toFixed(2)}px, ${vw.toFixed(2)}vw, ${px.toFixed(2)}px)`;
}

/**
 * Aplica `fluidFontSize` a cada valor numérico (px/rem/em) dentro de una cadena
 * de padding tipo `"12px 24px"`. Útil para CTAs cuyo padding viene del CMS y
 * podría apretar el botón contra el borde en celulares pequeños.
 */
export function fluidPadding(
  value: string | undefined | null,
  designVwPx = 420,
  minRatio = 0.6,
): string | undefined {
  if (!value) return undefined;
  return value
    .trim()
    .split(/\s+/)
    .map((part) => fluidFontSize(part, designVwPx, minRatio, 4) ?? part)
    .join(' ');
}
