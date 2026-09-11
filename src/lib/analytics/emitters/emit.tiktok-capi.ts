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
 * perderlos costaría la atribución de una venta real.
 */
const EVENTOS_CRITICOS = new Set(['CompletePayment', 'PlaceAnOrder', 'AddToCart']);

/** Margen que se deja pasar antes de mandar analítica no crítica. */
const ESPERA_MS = 2500;

/**
 * Aparta el envío de analítica del momento en que la página está cargando.
 *
 * El POST a la Events API tarda ~306 ms y salía compitiendo por conexiones
 * con las peticiones que traen el catálogo (medido el 11-sep-2026: era la
 * petición más lenta al abrir una categoría, más que la del propio catálogo).
 *
 * Un primer intento esperaba al evento `load`, y no sirvió: al navegar por
 * clic en el menú no hay recarga, el documento ya está `complete` desde la
 * primera visita y la espera se resolvía al instante. Por eso aquí se espera
 * un tiempo REAL desde la llamada, no un evento del ciclo de vida.
 *
 * Seguro: si la pestaña se oculta o el usuario abandona antes de que venza la
 * espera, se manda de inmediato — así no se pierde el evento.
 */
function esperarMomentoTranquilo(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  return new Promise((resolve) => {
    let listo = false;
    const terminar = () => {
      if (listo) return;
      listo = true;
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alOcultar);
      window.removeEventListener('pagehide', terminar);
      resolve();
    };
    const alOcultar = () => {
      if (document.visibilityState === 'hidden') terminar();
    };

    const temporizador = setTimeout(terminar, ESPERA_MS);
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', terminar, { once: true });
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

    // La analítica no pinta nada: espera a que la carga del contenido haya
    // pasado antes de ocupar una conexión. Los eventos críticos (compra) se
    // mandan de inmediato.
    if (!EVENTOS_CRITICOS.has(eventName)) {
      await esperarMomentoTranquilo();
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
