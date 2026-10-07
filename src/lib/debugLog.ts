/**
 * Log de diagnóstico silenciado por defecto.
 *
 * El arranque dejaba la consola llena: cada carga escupía el ciclo completo de
 * `[AuthContext] loadSession` y varias líneas de `[Socket]`, y entre ese ruido
 * no se veía lo que de verdad importaba. En produccion nunca se vieron
 * -`removeConsole` del next.config los borra del bundle-, asi que esto es solo
 * para el dia a dia en local.
 *
 * Para volver a verlos: `NEXT_PUBLIC_DEBUG_LOGS=true` en `.env.local`.
 */
const activo = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export const debugLog = (...args: unknown[]): void => {
  if (activo) console.log(...args);
};

export const debugWarn = (...args: unknown[]): void => {
  if (activo) console.warn(...args);
};
