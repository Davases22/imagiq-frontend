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
import { canSendAds, isAdsConsentResolved } from '../utils';
import { hashUserData } from '../utils/hash';
import { getFacebookCookies } from '../utils/anonymize';

/**
 * IP del cliente: NO se envía desde el navegador.
 *
 * Devuelve `undefined` para que la clave se OMITA del payload y el backend
 * (customer-success-ms analytics.controller) haga fallback a `x-forwarded-for`
 * — la IP real del cliente que el gateway ya reenvía. El antiguo stub
 * '0.0.0.0' era truthy y mataba ese fallback: TODOS los eventos CAPI del
 * browser llegaban a Meta con IP 0.0.0.0 (EMQ capado).
 */
function getClientIP(): string | undefined {
  return undefined;
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
  // Consentimiento ya resuelto (concedido o denegado): comportamiento actual,
  // envío inmediato en el modo que corresponda.
  if (canSendAds()) {
    await dispatchMetaCapi(eventName, eventId, customData, userData, true);
    return;
  }
  if (isAdsConsentResolved() || typeof window === 'undefined') {
    // Denegado explícitamente (o SSR): anónimo de inmediato, sin esperar.
    await dispatchMetaCapi(eventName, eventId, customData, userData, false);
    return;
  }

  // Consentimiento PENDIENTE (banner sin responder): encolar con ventana
  // acotada — simetría con la pata del pixel (emit.meta.ts deliverOrQueue),
  // que espera ~10s a consentimiento y luego dispara CON fbc/AM. Antes el
  // CAPI muestreaba canSendAds() una sola vez y salía ANONYMOUS (sin
  // fbc/fbp/PII) aunque el usuario consintiera milisegundos después → Meta
  // veía el evento server sin fbc pareado con el pixel con fbc.
  //
  // Fire-and-forget: NO bloqueamos al caller (processAnalyticsEvent awaitea
  // este promise; esperar 10s retrasaría el abandon-tracking y los hooks).
  // El event_id se captura al encolar → dedup con el pixel intacto.
  pendingCapiEvents.push({
    eventName,
    eventId,
    customData,
    userData,
    attemptsLeft: CONSENT_MAX_ATTEMPTS,
  });
  ensureCapiFlushScheduled();
}

// ---------------------------------------------------------------------------
// Cola de espera de consentimiento (solo eventos disparados ANTES de que el
// usuario responda el banner). No depende de window.fbq: el CAPI debe
// funcionar aunque un ad-blocker impida cargar el pixel.
// ---------------------------------------------------------------------------

interface PendingCapiEvent {
  eventName: string;
  eventId: string;
  customData: MetaCapiCustomData;
  userData?: AnalyticsUserData;
  attemptsLeft: number;
}

const CONSENT_RETRY_INTERVAL_MS = 400;
const CONSENT_MAX_ATTEMPTS = 25; // ~10s: misma ventana que la cola del pixel

const pendingCapiEvents: PendingCapiEvent[] = [];
let capiFlushTimer: ReturnType<typeof setInterval> | null = null;
let capiConsentListenerAttached = false;

function stopCapiFlushTimer(): void {
  if (capiFlushTimer !== null) {
    clearInterval(capiFlushTimer);
    capiFlushTimer = null;
  }
}

/** Drena la cola enviando cada evento en el modo indicado. */
function drainPendingCapiEvents(hasConsent: boolean): void {
  while (pendingCapiEvents.length > 0) {
    const item = pendingCapiEvents.shift() as PendingCapiEvent;
    void dispatchMetaCapi(
      item.eventName,
      item.eventId,
      item.customData,
      item.userData,
      hasConsent
    );
  }
  stopCapiFlushTimer();
}

/** Revalida consentimiento en cada tick y resuelve la cola. */
function flushPendingCapiEvents(): void {
  if (pendingCapiEvents.length === 0) {
    stopCapiFlushTimer();
    return;
  }

  // Consentimiento concedido dentro de la ventana → FULL (con fbc/fbp/PII).
  if (canSendAds()) {
    drainPendingCapiEvents(true);
    return;
  }

  // Denegado explícitamente → anónimo ya (no seguir esperando).
  if (isAdsConsentResolved()) {
    drainPendingCapiEvents(false);
    return;
  }

  // Sigue pendiente: decrementar intentos; los agotados salen en anónimo
  // (comportamiento pre-fix, solo que ~10s más tarde).
  for (let i = pendingCapiEvents.length - 1; i >= 0; i--) {
    pendingCapiEvents[i].attemptsLeft -= 1;
    if (pendingCapiEvents[i].attemptsLeft <= 0) {
      const [expired] = pendingCapiEvents.splice(i, 1);
      void dispatchMetaCapi(
        expired.eventName,
        expired.eventId,
        expired.customData,
        expired.userData,
        false
      );
    }
  }

  if (pendingCapiEvents.length === 0) {
    stopCapiFlushTimer();
  }
}

function ensureCapiFlushScheduled(): void {
  if (typeof window === 'undefined') return;

  if (capiFlushTimer === null && pendingCapiEvents.length > 0) {
    capiFlushTimer = setInterval(flushPendingCapiEvents, CONSENT_RETRY_INTERVAL_MS);
  }

  // Resolución inmediata al responder el banner (mismo CustomEvent que usa la
  // pata del pixel): no esperar al próximo tick del intervalo.
  if (!capiConsentListenerAttached) {
    capiConsentListenerAttached = true;
    window.addEventListener('consentChange', () => {
      setTimeout(flushPendingCapiEvents, 0);
    });
  }
}

/**
 * Construye y envía el evento CAPI al backend en el modo indicado.
 * `event_time` se calcula al ENVIAR (no al encolar) — irrelevante para el
 * dedup de Meta (ventana de 48h por event_id).
 */
async function dispatchMetaCapi(
  eventName: string,
  eventId: string,
  customData: MetaCapiCustomData,
  userData: AnalyticsUserData | undefined,
  hasConsent: boolean
): Promise<void> {
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
    // external_id: preferimos el usuario_id en crudo (idéntico al server-side)
    // y caemos al email hasheado solo si no hay id. Consistencia cliente/servidor.
    external_id: userData?.id
      ? userData.id
      : userData?.email
        ? await hashSingleValue(userData.email)
        : undefined,
  };
}

/**
 * Construye user_data ANÓNIMO (sin consentimiento)
 *
 * Sin IP hardcodeada: `getClientIP()` devuelve undefined → la clave se omite
 * y el backend resuelve/anonimiza la IP real desde x-forwarded-for.
 */
function buildAnonymousUserData(): MetaCapiUserData {
  return {
    client_ip_address: getClientIP(),
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
