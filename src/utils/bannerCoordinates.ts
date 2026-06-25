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
 * que escala proporcionalmente con el ancho del **contenedor** (`cqi`) o del
 * **viewport** (`vw`).
 *
 * Para banners conviene `cqi`: el padre se marca con `@container/banner` y todo
 * dentro escala con el ancho del banner — así el render en producción y en el
 * preview del dashboard coincide cuando ambos contenedores tienen el mismo
 * ancho, y escala proporcionalmente cuando difieren.
 *
 * - `designPx` = ancho de referencia para el cual el valor original es el "natural".
 *   Para mobile: 420px (max-w del preview del dashboard). Para desktop: 1440px.
 * - `minRatio` = cota inferior como fracción del valor original (default 0.55).
 * - `unit`     = `'cqi'` (recomendado, container-relative) o `'vw'` (legacy).
 *
 * @example
 * fluidFontSize("32px") // "clamp(17.60px, 7.62cqi, 32.00px)"  (cqi por defecto)
 * fluidFontSize("32px", 420, 0.55, 12, 'vw') // "clamp(17.60px, 7.62vw, 32.00px)"
 */
export function fluidFontSize(
  value: string | number | undefined | null,
  designPx = 420,
  // Lower minRatio + minPx than the original so small CTA fontSizes
  // (e.g. 14px) actually shrink visibly between 420 → 360 viewport widths.
  // Previously minPx=12 + minRatio=0.55 capped the floor at 12px, so a
  // 14px CTA only shrank from 14 → 12 (14% reduction) — author reported
  // it didn't feel responsive.
  minRatio = 0.4,
  minPx = 8,
  unit: 'cqi' | 'vw' = 'cqi',
): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const raw = typeof value === 'number' ? `${value}px` : String(value).trim();

  const match = /^([\d.]+)\s*(px|rem|em)?$/.exec(raw);
  if (!match) return raw;

  const num = parseFloat(match[1]);
  const sizeUnit = match[2] || 'px';
  if (!Number.isFinite(num) || num <= 0) return raw;

  const px = sizeUnit === 'px' ? num : num * 16;
  const ratio = (px / designPx) * 100;
  const min = Math.max(px * minRatio, minPx);

  if (min >= px) return `${px.toFixed(2)}px`;

  return `clamp(${min.toFixed(2)}px, ${ratio.toFixed(2)}${unit}, ${px.toFixed(2)}px)`;
}

/**
 * Aplica `fluidFontSize` a cada valor numérico (px/rem/em) dentro de una cadena
 * de padding tipo `"12px 24px"`.
 */
export function fluidPadding(
  value: string | undefined | null,
  designPx = 420,
  // Match fluidFontSize aggressiveness so button padding shrinks at the
  // same rate as the text inside it.
  minRatio = 0.4,
  unit: 'cqi' | 'vw' = 'cqi',
): string | undefined {
  if (!value) return undefined;
  return value
    .trim()
    .split(/\s+/)
    .map((part) => fluidFontSize(part, designPx, minRatio, 4, unit) ?? part)
    .join(' ');
}
