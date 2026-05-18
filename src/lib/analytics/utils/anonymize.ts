/**
 * Utilidades para anonimización de datos personales
 *
 * Cumplimiento Ley 1581 de 2012 (Colombia):
 * - Datos anonimizados NO son considerados datos personales
 * - No se puede identificar al titular con estos datos
 *
 * @module analytics/utils/anonymize
 */

/**
 * Anonimiza una dirección IP reemplazando el último octeto con 0
 *
 * Esto hace que la IP sea NO identificable según Ley 1581:
 * - No puede asociarse a una persona natural determinada
 * - Útil para análisis geográfico agregado (ciudad/región)
 * - No útil para identificación individual
 *
 * @param ip - Dirección IP a anonimizar (IPv4 o IPv6)
 * @returns IP anonimizada
 *
 * @example
 * ```typescript
 * anonymizeIP('203.0.113.45')  // → '203.0.113.0'
 * anonymizeIP('192.168.1.100') // → '192.168.1.0'
 * anonymizeIP('2001:db8::1')   // → '2001:db8::'
 * ```
 */
export function anonymizeIP(ip: string): string {
  if (!ip) return '0.0.0.0';

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length !== 4) return '0.0.0.0';

    // Reemplazar último octeto con 0
    parts[3] = '0';
    return parts.join('.');
  }

  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    // Mantener solo los primeros 4 grupos (equivalente a /64)
    const anonymized = parts.slice(0, 4).join(':');
    return `${anonymized}::`;
  }

  return '0.0.0.0';
}

/**
 * Resultado de extracción de cookies de Facebook
 */
export interface FacebookCookies {
  fbp: string | null;
  fbc: string | null;
}

/** Vigencia de la cookie _fbc: 90 días (igual que Meta). */
const FBC_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/** fbclid plausible: tokens URL-safe que usa Meta (evita basura/inyección). */
function isValidFbclid(value: string): boolean {
  return /^[\w.\-]{1,512}$/.test(value);
}

/**
 * Escribe la cookie `_fbc` en el formato exacto de Meta (`fb.1.{ts}.{fbclid}`)
 * para que el Pixel y CAPI converjan en el MISMO valor (dedup) y las
 * conversiones posteriores sigan atribuyendo tras navegar fuera de la URL del
 * anuncio. Persistencia ≈ 90 días, primera‑parte.
 */
function writeFbcCookie(value: string): void {
  try {
    const host = window.location.hostname;
    const onImagiq = /(^|\.)imagiq\.com$/.test(host);
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    const domain = onImagiq ? '; domain=.imagiq.com' : '';
    document.cookie = `_fbc=${value}; path=/; max-age=${FBC_MAX_AGE_SECONDS}; SameSite=Lax${secure}${domain}`;
  } catch {
    // no-op: si la escritura falla igual devolvemos el valor sintetizado
  }
}

/**
 * Extrae cookies de Facebook del navegador.
 *
 * `fbc`: si NO existe la cookie `_fbc` pero la URL trae `?fbclid=` (clic de
 * anuncio), se sintetiza `fb.1.{ts}.{fbclid}` y se persiste como cookie `_fbc`
 * (formato Meta). El Pixel de este sitio carga async y tras consentimiento, así
 * que sin este fallback los clics de anuncio perdían `fbc` (atribución rota).
 * Nunca se sobrescribe una cookie `_fbc` existente (el Pixel gestiona el
 * refresh de un clic nuevo).
 *
 * @returns Objeto con fbp y fbc (o null si no existen)
 *
 * @example
 * ```typescript
 * const { fbp, fbc } = getFacebookCookies();
 * // { fbp: 'fb.1.xxx', fbc: 'fb.1.{ts}.{fbclid}' }
 * ```
 */
export function getFacebookCookies(): FacebookCookies {
  if (typeof document === 'undefined') {
    return { fbp: null, fbc: null };
  }

  const cookies = document.cookie.split(';').reduce<Record<string, string>>((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  const fbp = cookies['_fbp'] ?? null;
  let fbc = cookies['_fbc'] ?? null;

  if (!fbc && typeof window !== 'undefined') {
    try {
      const raw = new URLSearchParams(window.location.search).get('fbclid');
      const fbclid = raw ? raw.trim() : '';
      if (fbclid && isValidFbclid(fbclid)) {
        const synthesized = `fb.1.${Date.now()}.${fbclid}`;
        writeFbcCookie(synthesized);
        fbc = synthesized;
      }
    } catch {
      // no-op: ante cualquier error de parseo, fbc queda null
    }
  }

  return { fbp, fbc };
}
