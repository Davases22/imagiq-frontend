/**
 * Emisor para TikTok Events API - Server-Side Tracking
 *
 * Este módulo envía eventos al backend para que sean transmitidos
 * a TikTok vía Events API.
 *
 * Funciona en DOS MODOS:
 * 1. FULL MODE (con consentimiento): Envía todos los datos incluido email/phone
 * 2. ANONYMOUS MODE (sin consentimiento): Solo datos agregados
 *
 * @module analytics/emitters/emit.tiktok-capi
 */

import { apiPost } from '@/lib/api-client';
import type {
  TikTokEventsApiEvent,
  TikTokEventsUserData,
  TikTokEventsProperties,
  CapiResponse,
} from '../types/capi';
import type { AnalyticsUserData } from '../controller';
import { canSendAds } from '../utils';

/**
 * Envía un evento a TikTok Events API vía backend
 *
 * MODO FULL (con consentimiento):
 * - Incluye email, phone (sin hashear, TikTok lo hashea server-side)
 * - content_ids específicos
 * - Número de items
 *
 * MODO ANÓNIMO (sin consentimiento):
 * - NO incluye email, phone
 * - Solo datos agregados (value, currency)
 *
 * @param eventName - Nombre del evento TikTok ('CompletePayment', 'ViewContent', etc)
 * @param eventId - ID único para deduplicación
 * @param properties - Propiedades del evento
 * @param userData - Datos del usuario (opcional, solo si hay consentimiento)
 *
 * @example
 * ```typescript
 * // CON consentimiento
 * await sendTikTokCapi('CompletePayment', 'evt-123', {
 *   value: 599990,
 *   currency: 'COP',
 *   content_ids: ['SM-A50']
 * }, {
 *   email: 'user@example.com',
 *   phone: '+573001234567'
 * });
 *
 * // SIN consentimiento
 * await sendTikTokCapi('CompletePayment', 'evt-123', {
 *   value: 599990,
 *   currency: 'COP'
 * });
 * ```
 */
/**
 * Eventos que NO se difieren: si el usuario se va de la página justo después,
 * perderlos costaría atribución de una venta real. El resto (ViewContent,
 * navegación) se puede esperar sin consecuencias.
 */
const EVENTOS_CRITICOS = new Set(['CompletePayment', 'PlaceAnOrder', 'AddToCart']);

/**
 * Espera a que el navegador esté libre antes de mandar la analítica.
 *
 * El POST a la Events API tardaba ~306 ms y salía DURANTE la carga de la
 * página, compitiendo por conexiones con las peticiones que sí traen los
 * productos (medido el 11-sep-2026: era la petición más lenta al abrir una
 * categoría, más lenta incluso que la que trae el catálogo). La analítica no
 * pinta nada en pantalla, así que puede esperar a que la página termine.
 *
 * Con timeout: si el navegador nunca queda libre, se manda igual al segundo.
 */
function cuandoElNavegadorEsteLibre(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  return new Promise((resolve) => {
    const enIdle = () => {
      const ric = (window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }).requestIdleCallback;
      if (typeof ric === 'function') ric(() => resolve(), { timeout: 1000 });
      else setTimeout(resolve, 300);
    };

    if (document.readyState === 'complete') enIdle();
    else window.addEventListener('load', enIdle, { once: true });
  });
}

export async function sendTikTokCapi(
  eventName: string,
  eventId: string,
  properties: TikTokEventsProperties,
  userData?: AnalyticsUserData
): Promise<void> {
  const hasConsent = canSendAds();

  try {
    // Construir user según consentimiento
    const user: TikTokEventsUserData | undefined = hasConsent
      ? buildFullUserData(userData)
      : undefined;

    // Construir properties según consentimiento
    const event_properties: TikTokEventsProperties = hasConsent
      ? properties
      : buildAnonymousProperties(properties);

    // Construir evento completo
    const event: TikTokEventsApiEvent = {
      event: eventName,
      event_id: eventId,
      timestamp: Math.floor(Date.now() / 1000),
      event_source_url: typeof window !== 'undefined' ? window.location.href : '',
      user,
      properties: event_properties,
    };

    // La analítica espera a que la página termine de cargar: no debe robarle
    // conexiones a las peticiones que traen el contenido. Los eventos
    // críticos (compra) se mandan de inmediato.
    if (!EVENTOS_CRITICOS.has(eventName)) {
      await cuandoElNavegadorEsteLibre();
    }

    // Enviar al backend usando api-client
    const response = await apiPost<CapiResponse>(
      '/api/custommer/analytics/tiktok-events-api/event',
      event
    );

    if (!response.success) {
      console.error('[TikTok CAPI] Event failed:', eventName, response.error);
    }
  } catch {
    // Silenced: TikTok CAPI errors are non-critical and noisy in local dev
  }
}

/**
 * Construye user data COMPLETO (con consentimiento)
 *
 * IMPORTANTE: TikTok NO requiere hashing, lo hace server-side
 */
function buildFullUserData(userData?: AnalyticsUserData): TikTokEventsUserData | undefined {
  if (!userData) return undefined;

  return {
    email: userData.email,
    phone: userData.phone,
  };
}

/**
 * Construye properties ANÓNIMAS (sin consentimiento)
 *
 * Solo incluye datos agregados que NO pueden identificar al usuario
 */
function buildAnonymousProperties(
  properties: TikTokEventsProperties
): TikTokEventsProperties {
  return {
    value: properties.value,
    currency: properties.currency,
    // NO incluir content_ids (podrían ser identificables)
    // NO incluir num_items, contents
  };
}
