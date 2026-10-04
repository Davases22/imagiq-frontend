/**
 * Última salida para el usuario cuando la app revienta: dejar su navegador
 * como recién llegado.
 *
 * Esto cubre un caso que `chunkRecoveryScript` no puede resolver. Aquel actúa
 * cuando un archivo de `/_next/static` no llega y recarga para reintentar; pero
 * si lo que está mal es el `localStorage` del cliente —un carrito a medias, una
 * sesión vieja, un JSON que quedó partido— recargar no sirve de nada: el dato
 * roto sigue ahí y la app vuelve a reventar en cada intento. Por eso el botón
 * de reintentar no basta y hace falta poder vaciar el almacenamiento.
 */

/**
 * Vacía `localStorage` y `sessionStorage`, preservando el consentimiento para
 * no volver a preguntarle al usuario algo que ya respondió.
 *
 * Cada paso va en su propio try/catch a propósito: si el navegador bloquea el
 * almacenamiento (incógnito estricto, cookies deshabilitadas) la función tiene
 * que seguir hasta el final igual, porque quien la llama va a recargar después
 * y esa recarga es lo que de verdad le importa al cliente.
 */
export function limpiarDatosDelSitio(): void {
  if (typeof window === "undefined") return;

  const PRESERVAR = ["imagiq_consent"];
  const guardado: Array<[string, string]> = [];

  try {
    for (const clave of PRESERVAR) {
      const valor = window.localStorage.getItem(clave);
      if (valor !== null) guardado.push([clave, valor]);
    }
  } catch {
    /* si ni leer se puede, se sigue al clear igual */
  }

  try {
    window.localStorage.clear();
  } catch {
    /* ignorado a propósito: el objetivo es recargar pase lo que pase */
  }
  try {
    window.sessionStorage.clear();
  } catch {
    /* idem */
  }

  try {
    for (const [clave, valor] of guardado) {
      window.localStorage.setItem(clave, valor);
    }
  } catch {
    /* si no se pudo restaurar, se volverá a preguntar y no pasa nada */
  }
}
