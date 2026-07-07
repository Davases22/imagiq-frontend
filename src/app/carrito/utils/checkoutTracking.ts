/**
 * Telemetría del funnel de checkout — disparo deduplicado y monótono.
 *
 * Problema que resuelve: los eventos `checkout_stepN_*` se disparaban en varios
 * paths / re-renders / remounts (Suspense) sin dedupe ⇒ funnel NO monótono
 * (p.ej. step3 = 32 eventos / 18 personas). Aquí cada paso se emite EXACTAMENTE
 * una vez por INTENTO de checkout.
 *
 * Mecanismo: un `checkout_attempt_id` estable por intento (sessionStorage) que
 * sobrevive a navegar entre steps; el dedupe se guarda por (intento, paso). Un
 * intento nuevo (otra compra / nueva sesión) obtiene un id fresco vía
 * `resetCheckoutAttempt()` (llamar al completar la compra). Reusa
 * `posthogUtils.capture` (que ya adjunta userId).
 */

import { posthogUtils } from "@/lib/posthogClient";

const ATTEMPT_KEY = "checkout_attempt_id";
const ATTEMPT_TS_KEY = "checkout_attempt_ts";
// Ventana deslizante: si pasan >30 min sin actividad de checkout, el próximo
// paso abre un INTENTO nuevo. Así un re-intento posterior (misma pestaña, sin
// cerrarla) no queda suprimido por el dedupe del intento anterior abandonado;
// navegar entre steps en minutos mantiene el mismo intento.
const IDLE_MS = 30 * 60 * 1000;
const stepKey = (attemptId: string, step: number) => `ph_step_${attemptId}_${step}`;

/** Genera un id opaco (no cripto-sensible) para el intento de checkout. */
function newAttemptId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fallthrough */
  }
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * id estable del intento de checkout actual (lo crea si no existe). Persiste en
 * sessionStorage: estable mientras dure el flujo (todos los steps), fresco en
 * una sesión nueva. Se usa como `cart_id`/clave de dedupe del funnel.
 */
export function getCheckoutAttemptId(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = Date.now();
    let id = sessionStorage.getItem(ATTEMPT_KEY);
    const tsRaw = sessionStorage.getItem(ATTEMPT_TS_KEY);
    const ts = tsRaw ? Number(tsRaw) : 0;
    // Intento nuevo si no hay id o estuvo inactivo más de IDLE_MS.
    if (!id || !ts || now - ts > IDLE_MS) {
      id = newAttemptId();
      sessionStorage.setItem(ATTEMPT_KEY, id);
    }
    sessionStorage.setItem(ATTEMPT_TS_KEY, String(now)); // ventana deslizante
    return id;
  } catch {
    return "";
  }
}

/**
 * Cierra el intento actual: limpia el id y todas las marcas de dedupe de pasos,
 * para que un próximo checkout (misma sesión/tab) cuente como intento nuevo.
 * Llamar al completar la compra (success-checkout).
 */
export function resetCheckoutAttempt(): void {
  if (typeof window === "undefined") return;
  try {
    const id = sessionStorage.getItem(ATTEMPT_KEY);
    if (id) {
      for (let s = 1; s <= 8; s++) sessionStorage.removeItem(stepKey(id, s));
    }
    sessionStorage.removeItem(ATTEMPT_KEY);
    sessionStorage.removeItem(ATTEMPT_TS_KEY);
  } catch {
    /* best-effort */
  }
}

/**
 * Dispara un evento de paso del funnel UNA sola vez por intento. Adjunta
 * `checkout_attempt_id` (= cart_id del funnel) y `step`. El caller pasa el resto
 * de contexto (value, content_ids/SKUs, y props específicas del paso).
 *
 * @returns true si se emitió, false si se deduplicó (ya disparado este intento).
 */
export function trackCheckoutStep(
  step: number,
  eventName: string,
  props?: Record<string, unknown>
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const attemptId = getCheckoutAttemptId();
    const key = stepKey(attemptId, step);
    if (sessionStorage.getItem(key)) return false; // ya disparado este intento
    sessionStorage.setItem(key, "1");
    posthogUtils.capture(eventName, {
      ...(props || {}),
      step,
      cart_id: attemptId,
      checkout_attempt_id: attemptId,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Marca el paso 2 como SALTADO en este intento — para que el funnel de PostHog
 * sea monótono: los usuarios registrados y los invitados recurrentes con
 * dirección persistida son ruteados step1→step3 sin montar Step2, por lo que
 * `checkout_step2_completed` < `checkout_step3_delivery_selected` por diseño.
 * En PostHog el paso 2 del funnel debe modelarse como
 * `checkout_step2_completed OR checkout_step2_skipped`.
 *
 * Comparte el slot de dedupe del paso 2 (clave por NÚMERO de paso): máximo un
 * evento de paso 2 por intento. Caveat aceptado: si un guard emite `skipped` y
 * el usuario después es devuelto a Step2 (p.ej. domicilio sin dirección desde
 * Step3) y lo completa de verdad, la completación queda etiquetada como
 * skipped en ese intento — el conteo del funnel sigue siendo correcto.
 *
 * @param userType - población que salta el paso ('registered' | 'returning_guest' | 'restored_session')
 * @param reason - guard concreto que produjo el salto (para depurar routing)
 */
export function trackStep2Skipped(userType: string, reason: string): boolean {
  return trackCheckoutStep(2, "checkout_step2_skipped", {
    user_type: userType,
    reason,
    skipped: true,
  });
}
