/**
 * Emisor para Meta Conversions API (CAPI) - Server-Side Tracking
 *
 * Este módulo envía eventos al backend para que sean transmitidos
 * a Meta vía Conversions API.
 *
 * Funciona en DOS MODOS:
 * 1. FULL MODE (con consentimiento): Envía todos los datos incluido PII
 * 2. ANONYMOUS MODE (sin consentimiento): Solo datos agregados
 *
 * @module analytics/emitters/emit.meta-capi
 */

import { apiPost } from '@/lib/api-client';
import type {
  MetaCapiEvent,
  MetaCapiUserData,
  MetaCapiCustomData,
  CapiResponse,
} from '../types/capi';
import type { AnalyticsUserData } from '../controller';
import { canSendAds, logConsentBlocked } from '../utils';
import { hashUserData } from '../utils/hash';
import { anonymizeIP, getFacebookCookies } from '../utils/anonymize';

/**
 * Obtiene la IP del cliente (simulado en navegador)
 *
 * NOTA: La IP real se captura en el backend desde el request HTTP
 * Esta función retorna una IP genérica para cumplir con el tipo
 */
function getClientIP(): string {
  // En producción, el backend extrae la IP del request
  return '0.0.0.0';
}

/**
 * Envía un evento a Meta CAPI vía backend
 *
 * MODO FULL (con consentimiento):
 * - Incluye email, phone, cookies de Facebook
 * - IP completa, User-Agent completo
 * - content_ids específicos
 *
 * MODO ANÓNIMO (sin consentimiento):
 * - NO incluye email, phone, cookies
 * - IP anonimizada (último octeto = 0)
 * - Solo datos agregados (value, currency)
 *
 * @param eventName - Nombre del evento Meta ('Purchase', 'ViewContent', etc)
 * @param eventId - ID único para deduplicación
 * @param customData - Datos del evento (value, content_ids, etc)
 * @param userData - Datos del usuario (opcional, solo si hay consentimiento)
 *
 * @example
 * ```typescript
 * // CON consentimiento
 * await sendMetaCapi('Purchase', 'evt-123', {
 *   value: 599990,
 *   currency: 'COP',
 *   content_ids: ['SM-A50']
 * }, {
 *   email: 'user@example.com',
 *   phone: '+573001234567'
 * });
 *
 * // SIN consentimiento
 * await sendMetaCapi('Purchase', 'evt-123', {
 *   value: 599990,
 *   currency: 'COP'
 * });
 * ```
 */
export async function sendMetaCapi(
  eventName: string,
  eventId: string,
  customData: MetaCapiCustomData,
  userData?: AnalyticsUserData
): Promise<void> {
  const hasConsent = canSendAds();

  try {
    // Construir user_data según consentimiento
    const user_data: MetaCapiUserData = hasConsent
      ? await buildFullUserData(userData)
      : buildAnonymousUserData();

    // Construir custom_data según consentimiento
    const custom_data: MetaCapiCustomData = hasConsent
      ? customData
      : buildAnonymousCustomData(customData);

    // Construir evento completo
    const event: MetaCapiEvent = {
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: typeof window !== 'undefined' ? window.location.href : '',
      action_source: 'website',
      user_data,
      custom_data,
    };

    // Enviar al backend usando api-client
    const response = await apiPost<CapiResponse>(
      '/api/custommer/analytics/meta-capi/event',
      event
    );

    if (!response.success) {
      console.error('[Meta CAPI] Event failed:', eventName, response.error);
    }
  } catch {
    // Silenced: Meta CAPI errors are non-critical and noisy in local dev
  }
}

/**
 * Construye user_data COMPLETO (con consentimiento)
 */
async function buildFullUserData(
  userData?: AnalyticsUserData
): Promise<MetaCapiUserData> {
  const { fbp, fbc } = getFacebookCookies();
  const hashedData = userData ? await hashUserData(userData) : {};

  return {
    em: hashedData.em,
    ph: hashedData.ph,
    fn: hashedData.fn,
    ln: hashedData.ln,
    ct: hashedData.ct,
    st: hashedData.st,
    zp: hashedData.zp,
    country: hashedData.country,
    client_ip_address: getClientIP(),
    client_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    fbp: fbp ?? undefined,
    fbc: fbc ?? undefined,
    external_id: userData?.email ? await hashSingleValue(userData.email) : undefined,
  };
}

/**
 * Construye user_data ANÓNIMO (sin consentimiento)
 */
function buildAnonymousUserData(): MetaCapiUserData {
  const ip = getClientIP();
  const anonymizedIP = anonymizeIP(ip);

  return {
    client_ip_address: anonymizedIP,
  };
}

/**
 * Construye custom_data ANÓNIMO (sin consentimiento)
 *
 * Solo incluye datos agregados que NO pueden identificar al usuario
 */
function buildAnonymousCustomData(
  customData: MetaCapiCustomData
): MetaCapiCustomData {
  return {
    value: customData.value,
    currency: customData.currency,
    // NO incluir content_ids (podrían ser identificables)
    // NO incluir content_name, content_category
  };
}

/**
 * Hashea un valor individual con SHA-256
 */
async function hashSingleValue(value: string): Promise<string> {
  const normalized = value.toLowerCase().trim();
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
