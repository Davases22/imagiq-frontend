/**
 * Recuperación ante errores del cliente.
 *
 * Contexto (3-oct-2026): un cliente vio la pantalla cruda de Next.js
 * ("Application error: a client-side exception has occurred") en imagiq.com.
 * El servidor respondía 200 y todos los chunks cargaban bien, así que el fallo
 * ocurrió entero dentro de su navegador. No había ningún error boundary en la
 * app, así que el error llegó sin filtro al usuario, en inglés y sin salida.
 *
 * La causa más frecuente de esto en Next.js es el "chunk viejo": el navegador
 * tiene cacheado el HTML de un despliegue anterior, que pide archivos .js cuyo
 * nombre lleva un hash que ya no existe tras el nuevo deploy. Eso no es un bug
 * del código y se arregla recargando — pero el cliente no tiene por qué saber
 * eso, así que aquí se recarga solo.
 */

/** Marca de que ya se recargó por este motivo; evita el bucle infinito. */
const CLAVE_RECARGA = 'imagiq_recarga_por_chunk';

/**
 * ¿El error viene de un archivo de la app que ya no existe en el servidor?
 *
 * El mensaje cambia según el navegador y la versión de Next, así que se
 * comparan varias formas en vez de una sola. Chrome dice "Loading chunk N
 * failed", Safari y Firefox hablan de "dynamically imported module".
 */
export function esErrorDeChunk(error: unknown): boolean {
  if (!error) return false;

  const nombre = (error as Error)?.name || '';
  const mensaje = (error as Error)?.message || String(error);
  const texto = `${nombre} ${mensaje}`.toLowerCase();

  return (
    nombre === 'ChunkLoadError' ||
    texto.includes('loading chunk') ||
    texto.includes('loading css chunk') ||
    texto.includes('dynamically imported module') ||
    texto.includes('importing a module script failed') ||
    texto.includes('failed to fetch dynamically imported')
  );
}

/**
 * Recarga la página UNA sola vez cuando el error es de chunk viejo.
 *
 * Devuelve true si va a recargar, para que quien llama no pinte la pantalla de
 * error y el usuario no vea un parpadeo.
 *
 * Si `sessionStorage` no está disponible (incógnito estricto, cookies
 * bloqueadas) NO se recarga: sin poder dejar la marca no hay forma de saber si
 * ya se intentó, y una recarga ciega entraría en bucle. En ese caso es
 * preferible mostrar la pantalla de error con su botón de reintentar.
 */
export function intentarAutoRecuperacion(error: unknown): boolean {
  if (typeof window === 'undefined') return false;
  if (!esErrorDeChunk(error)) return false;

  try {
    if (window.sessionStorage.getItem(CLAVE_RECARGA)) return false;
    window.sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    return false;
  }

  window.location.reload();
  return true;
}

/**
 * Borra la marca de recarga.
 *
 * Hoy no se invoca desde ningún lado y es deliberado: la marca vive en
 * `sessionStorage`, así que desaparece sola al cerrar la pestaña y basta con
 * eso. Queda disponible por si más adelante se quiere reactivar la recarga
 * automática dentro de la misma sesión, sin tener que tocar el layout raíz.
 */
export function limpiarMarcaDeRecarga(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CLAVE_RECARGA);
  } catch {
    /* sin storage no hay marca que borrar */
  }
}

/**
 * Último recurso del usuario: deja el navegador como recién llegado.
 *
 * La otra causa típica de que la app reviente para UNA sola persona es que su
 * `localStorage` quedó inconsistente (un carrito a medias, una sesión vieja) y
 * algo revienta al leerlo. Eso sobrevive a las recargas, así que el botón de
 * reintentar no basta: hay que vaciar el almacenamiento.
 *
 * Se preservan las claves de consentimiento para no volver a pedirle al usuario
 * algo que ya respondió.
 */
export function limpiarDatosDelSitio(): void {
  if (typeof window === 'undefined') return;

  const PRESERVAR = ['imagiq_consent'];
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
