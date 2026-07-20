/**
 * Configuración de rutas para visibilidad del chatbot.
 *
 * Convención de matching:
 * - Rutas sin "/" final: match exacto (/carrito)
 * - Rutas con "/" final: match por prefijo (/carrito/ → /carrito/step1, etc.)
 */

/** Rutas donde el chatbot debe OCULTARSE */
export const CHATBOT_HIDDEN_ROUTES = [
  "/carrito",           // Match exacto: solo /carrito
  "/carrito/",          // Match prefijo: /carrito/step1, /carrito/step2, etc.
  "/error-checkout",    // Match exacto
  "/success-checkout/", // Match prefijo: /success-checkout/[orderId]
  "/charging-result",   // Match exacto
  "/verify-purchase/",         // Match prefijo: /verify-purchase/[id]
  "/support/verify-purchase/", // Match prefijo: /support/verify-purchase/[id]
] as const;

/** Rutas donde el chatbot debe MOSTRARSE (prioridad sobre hidden) */
export const CHATBOT_VISIBLE_ROUTES = [
  "/tracking-service/", // Match prefijo: /tracking-service/[orderId]
] as const;
