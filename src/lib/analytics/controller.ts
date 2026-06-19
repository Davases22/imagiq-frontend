/**
 * Controlador principal de analytics
 *
 * Orquesta el flujo de eventos:
 * 1. Escucha eventos del dataLayer
 * 2. Genera event_id deduplicable
 * 3. Mapea eventos a cada plataforma (GA4, Meta, TikTok)
 * 4. Envía eventos si hay consentimiento
 * 5. Registra intenciones de abandono
 */

import type { DlAny } from './types';
import { toGa4Event, toMetaEvent, toTiktokEvent } from './mappers';
import type { MetaEvent, TikTokEvent } from './mappers';
import { sendGa4, sendMeta, sendTiktok, sendMetaCapi, sendTikTokCapi, setMetaAdvancedMatching } from './emitters';
import type { GA4UserData } from './emitters/emit.ga4';
import type { MetaCapiCustomData, TikTokEventsProperties } from './types/capi';
import { normalizeUserDataForPixel } from './utils';
import { resolveCartAbandon, resolveCheckoutAbandon } from './abandon';
import { generateEventIdForEvent, handleAbandonTracking } from './helpers/event-processing';

/**
 * Interfaz unificada para datos de usuario en analytics
 */
export interface AnalyticsUserData {
  /** ID interno del usuario (usuarios.id). Se usa como `external_id` en Meta,
   *  idéntico al que envía el server-side (payments-ms usa order.usuario_id),
   *  para que cliente y servidor compartan el mismo identificador. */
  id?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
}

/**
 * Procesa un evento del dataLayer y lo envía a todas las plataformas
 *
 * DUAL TRACKING STRATEGY:
 * - CLIENT-SIDE: Pixels (fbq, ttq) solo si hay consentimiento
 * - SERVER-SIDE: CAPI siempre (FULL si hay consentimiento, ANONYMOUS si no)
 *
 * @param event - Evento del dataLayer
 * @param user - Datos de usuario para Advanced Matching (opcional)
 *
 * @example
 * ```typescript
 * // En tu componente
 * const handleAddToCart = async (product) => {
 *   const dlEvent: DlAddToCart = {
 *     event: 'add_to_cart',
 *     ts: Date.now(),
 *     ecommerce: {
 *       items: [{ item_id: product.sku, item_name: product.name, price: product.price }],
 *       value: product.price,
 *       currency: 'COP',
 *     },
 *   };
 *
 *   const userData = {
 *     email: 'user@example.com',
 *     phone: '+573001234567',
 *     firstName: 'John',
 *     lastName: 'Doe'
 *   };
 *
 *   await processAnalyticsEvent(dlEvent, userData);
 * };
 * ```
 */
export async function processAnalyticsEvent(
  event: DlAny,
  user?: AnalyticsUserData
): Promise<void> {
  try {
    // 1. Generar event_id deduplicable
    const eventId = await generateEventIdForEvent(event);

    // 2. Mapear a cada plataforma
    const ga4Event = toGa4Event(event);
    const metaEvent = toMetaEvent(event, eventId, user);
    const tiktokEvent = toTiktokEvent(event, eventId, user);

    // 3. Preparar datos de usuario para GA4 Enhanced Conversions
    const ga4UserData: GA4UserData | undefined = user ? {
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      address: user.address,
    } : undefined;

    // 4. CLIENT-SIDE: Enviar a pixels (solo si hay consentimiento)
    await sendGa4(ga4Event, ga4UserData);
    // Advanced Matching manual del píxel para usuario conocido: sube el EMQ de
    // todos los eventos del píxel (ViewContent/AddToCart/...). Plaintext
    // normalizado (el píxel hashea). El AAM automático está desactivado por
    // autoConfig=false, así que este es el mecanismo de coincidencia avanzada.
    if (user) {
      const pixelAM = normalizeUserDataForPixel({
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      if (Object.keys(pixelAM).length > 0) setMetaAdvancedMatching(pixelAM);
    }
    sendMeta(metaEvent, eventId);
    sendTiktok(tiktokEvent, eventId);

    // 5. SERVER-SIDE: Enviar a CAPI SIEMPRE (modo condicional)
    await sendServerSideEvents(metaEvent, tiktokEvent, eventId, user);

    // 6. Registrar intenciones de abandono
    handleAbandonTracking(event);
  } catch (error) {
    console.error('[Analytics] Failed to process event:', event.event, error);
  }
}

/**
 * Envía eventos a las APIs server-side (CAPI)
 *
 * Esta función SIEMPRE se ejecuta, sin importar el consentimiento.
 * Modo FULL o ANONYMOUS se decide dentro de cada emisor.
 */
async function sendServerSideEvents(
  metaEvent: MetaEvent,
  tiktokEvent: TikTokEvent,
  eventId: string,
  user?: AnalyticsUserData
): Promise<void> {
  try {
    // Construir custom_data para Meta CAPI (type-safe extraction)
    const metaCustomData: MetaCapiCustomData = {
      value: typeof metaEvent.data.value === 'number' ? metaEvent.data.value : undefined,
      currency: typeof metaEvent.data.currency === 'string' ? metaEvent.data.currency : undefined,
      content_type: typeof metaEvent.data.content_type === 'string' ? metaEvent.data.content_type : undefined,
      content_ids: Array.isArray(metaEvent.data.content_ids) ? metaEvent.data.content_ids : undefined,
      content_name: typeof metaEvent.data.content_name === 'string' ? metaEvent.data.content_name : undefined,
      num_items: typeof metaEvent.data.num_items === 'number' ? metaEvent.data.num_items : undefined,
      search_string: typeof metaEvent.data.search_string === 'string' ? metaEvent.data.search_string : undefined,
    };

    // Construir properties para TikTok Events API (type-safe extraction)
    const tiktokProperties: TikTokEventsProperties = {
      value: typeof tiktokEvent.data.value === 'number' ? tiktokEvent.data.value : undefined,
      currency: typeof tiktokEvent.data.currency === 'string' ? tiktokEvent.data.currency : undefined,
      content_ids: Array.isArray(tiktokEvent.data.content_ids) ? tiktokEvent.data.content_ids : undefined,
      content_type: typeof tiktokEvent.data.content_type === 'string' ? tiktokEvent.data.content_type : undefined,
      num_items: typeof tiktokEvent.data.num_items === 'number' ? tiktokEvent.data.num_items : undefined,
      search_string: typeof tiktokEvent.data.search_string === 'string' ? tiktokEvent.data.search_string : undefined,
    };

    // Enviar a ambas APIs en paralelo
    await Promise.all([
      sendMetaCapi(metaEvent.name, eventId, metaCustomData, user),
      sendTikTokCapi(tiktokEvent.name, eventId, tiktokProperties, user),
    ]);
  } catch (error) {
    console.error('[Analytics] Failed to send server-side events:', error);
  }
}

/**
 * Inicializa el sistema de analytics
 *
 * Debe llamarse una vez al cargar la aplicación.
 * - Verifica abandono pendiente en page load
 * - (Opcional) Configura heartbeat para chequear abandono periódicamente
 */
export function initAnalytics(): void {
  if (globalThis.window === undefined) return;

  // Verificar abandono al cargar la página
  setTimeout(() => {
    resolveCartAbandon();
    resolveCheckoutAbandon();
  }, 5000); // Esperar 5s después del page load
}

/**
 * Push de evento al dataLayer (helper)
 *
 * Wrapper para pushear eventos al dataLayer de forma type-safe
 *
 * @param event - Evento del dataLayer
 *
 * @example
 * ```typescript
 * pushToDataLayer({
 *   event: 'view_item',
 *   ts: Date.now(),
 *   ecommerce: { items: [...] }
 * });
 * ```
 */
export function pushToDataLayer(event: DlAny): void {
  if (globalThis.window === undefined) return;

  globalThis.window.dataLayer ??= [];

  globalThis.window.dataLayer.push(event);
}
