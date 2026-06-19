/**
 * Emisor de eventos para Meta Pixel (Facebook Pixel)
 *
 * Envía eventos a Meta Pixel usando fbq() cuando el consentimiento de ads está activo.
 *
 * Resiliencia ante carrera de carga: el pixel de Meta (fbevents.js) se inyecta
 * de forma asíncrona y SOLO tras el consentimiento de marketing. Eventos que
 * disparan temprano (p.ej. InitiateCheckout en el mount de /carrito/step1)
 * pueden ejecutarse antes de que `fbq` exista o antes de que el consentimiento
 * esté resuelto. Antes esos eventos se descartaban silenciosamente; ahora se
 * encolan y se reintentan (acotado) hasta que `fbq` esté disponible Y el
 * consentimiento sea afirmativo.
 *
 * Privacidad: un evento encolado SOLO se entrega cuando canSendAds() es true en
 * el momento de entrega (se revalida cada intento). Si el consentimiento se
 * deniega o nunca se concede, el evento expira en memoria sin enviarse jamás.
 */

import type { MetaEvent } from '../mappers';
import { canSendAds, logConsentBlocked } from '../utils';

interface PendingMetaEvent {
  /** Nombre del evento (para logs) */
  label: string;
  /** Realiza el envío real vía fbq() — solo se invoca con fbq listo + consentimiento */
  send: () => void;
  /** Intentos restantes antes de expirar */
  attemptsLeft: number;
}

const RETRY_INTERVAL_MS = 400;
const MAX_ATTEMPTS = 25; // ~10s: cubre resolución de consentimiento + carga async de fbevents.js

const pendingMetaEvents: PendingMetaEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let consentListenerAttached = false;

/** ¿Está el pixel de Meta listo (cargado + consentimiento) para enviar ahora? */
function isMetaReady(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.fbq === 'function' &&
    canSendAds()
  );
}

function stopFlushTimer(): void {
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/** Intenta entregar la cola; revalida consentimiento en cada intento. */
function flushPendingMetaEvents(): void {
  if (pendingMetaEvents.length === 0) {
    stopFlushTimer();
    return;
  }

  if (isMetaReady()) {
    while (pendingMetaEvents.length > 0) {
      const item = pendingMetaEvents.shift() as PendingMetaEvent;
      try {
        item.send();
      } catch (error) {
        console.error('[Meta Pixel] Failed to send queued event:', item.label, error);
      }
    }
    stopFlushTimer();
    return;
  }

  // Aún no listo: decrementar intentos y expirar los agotados.
  for (let i = pendingMetaEvents.length - 1; i >= 0; i--) {
    pendingMetaEvents[i].attemptsLeft -= 1;
    if (pendingMetaEvents[i].attemptsLeft <= 0) {
      // Distinguir "sin consentimiento" (telemetría) de "pixel nunca cargó".
      if (!canSendAds()) {
        logConsentBlocked('Meta Pixel', pendingMetaEvents[i].label);
      } else {
        console.warn(
          '[Meta Pixel] Dropping event (fbq never became available):',
          pendingMetaEvents[i].label,
        );
      }
      pendingMetaEvents.splice(i, 1);
    }
  }

  if (pendingMetaEvents.length === 0) {
    stopFlushTimer();
  }
}

function ensureFlushScheduled(): void {
  if (typeof window === 'undefined') return;

  if (flushTimer === null && pendingMetaEvents.length > 0) {
    flushTimer = setInterval(flushPendingMetaEvents, RETRY_INTERVAL_MS);
  }

  // Flush inmediato cuando cambia el consentimiento (MetaPixelScript reinyecta
  // el pixel ante 'consentChange'): evita esperar al próximo tick.
  if (!consentListenerAttached) {
    consentListenerAttached = true;
    window.addEventListener('consentChange', () => {
      setTimeout(flushPendingMetaEvents, 50); // defer: deja que fbevents.js termine de inyectarse
    });
  }
}

/**
 * Entrega ahora si Meta está listo (camino rápido, sin cambio de comportamiento
 * para el caso común); si no, encola y reintenta de forma acotada hasta que
 * `fbq` + consentimiento estén disponibles.
 */
function deliverOrQueue(label: string, send: () => void): void {
  if (typeof window === 'undefined') return; // SSR: no-op

  if (isMetaReady()) {
    try {
      send();
    } catch (error) {
      console.error('[Meta Pixel] Failed to send event:', label, error);
    }
    return;
  }

  pendingMetaEvents.push({ label, send, attemptsLeft: MAX_ATTEMPTS });
  ensureFlushScheduled();
}

/**
 * Envía un evento a Meta Pixel vía fbq()
 *
 * @param event - Evento formateado para Meta Pixel
 * @param eventId - Event ID para deduplicación con CAPI
 *
 * Nota: el Advanced Matching NO se pasa en las opciones del `track` (Meta lo
 * ignora ahí). Se configura aparte vía {@link setMetaAdvancedMatching}, que llama
 * `fbq('init', pixelId, {...})`.
 */
export function sendMeta(event: MetaEvent, eventId: string): void {
  deliverOrQueue(event.name, () => {
    const fbq = typeof window !== 'undefined' ? window.fbq : undefined;
    if (typeof fbq !== 'function') return;
    fbq('track', event.name, event.data, { eventID: eventId });
  });
}

/**
 * Configura el Advanced Matching MANUAL del píxel para un usuario conocido.
 *
 * Mecanismo correcto de Meta: `fbq('init', pixelId, { em, ph, fn, ln, external_id })`.
 * El píxel hashea (SHA-256) internamente, así que `userData` debe venir en
 * PLAINTEXT NORMALIZADO (ver normalizeUserDataForPixel). El pixelId vive en el
 * backend; el bootstrap expone `window.__imagiqSetMetaAM(d)` que hace el init.
 *
 * - Consent-gated: usa deliverOrQueue ⇒ solo se aplica con fbq listo + consentimiento.
 * - Idempotente por usuario: solo re-aplica cuando cambian los datos.
 * - Degradación elegante: si el bootstrap viejo no expuso el helper, es no-op.
 */
let lastAppliedAMKey = '';

export function setMetaAdvancedMatching(userData: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  if (!userData || Object.keys(userData).length === 0) return;

  const key = JSON.stringify(userData);
  if (key === lastAppliedAMKey) return; // ya aplicado para este usuario

  deliverOrQueue('advanced-matching', () => {
    const setAM = (
      window as unknown as {
        __imagiqSetMetaAM?: (d: Record<string, string>) => void;
      }
    ).__imagiqSetMetaAM;
    if (typeof setAM === 'function') {
      setAM(userData);
      lastAppliedAMKey = key; // marcar solo tras aplicar realmente
    }
  });
}

/**
 * Envía un evento custom a Meta Pixel
 *
 * @param eventName - Nombre del evento custom
 * @param data - Datos del evento
 * @param eventId - Event ID para deduplicación
 */
export function sendMetaCustom(
  eventName: string,
  data: Record<string, unknown>,
  eventId: string
): void {
  deliverOrQueue(eventName, () => {
    const fbq = typeof window !== 'undefined' ? window.fbq : undefined;
    if (typeof fbq !== 'function') return;
    fbq('trackCustom', eventName, data, { eventID: eventId });
  });
}
