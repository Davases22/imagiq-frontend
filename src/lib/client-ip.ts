/**
 * Captura de la IP pública REAL del cliente.
 *
 * Problema: el frontend sirve `/api/*` vía rewrite de Next.js, así que las
 * peticiones llegan al backend proxeadas por la infraestructura de Vercel
 * (AWS us-east-1). El gateway solo ve la IP de egreso de Vercel en
 * `x-forwarded-for`, no la del navegador del cliente. Por eso las órdenes
 * quedaban con `client_ip` = IP de Vercel (Ashburn, Virginia) y la
 * geolocalización de las alertas / ePayco / Meta CAPI era inservible.
 *
 * Solución: el navegador consulta su propia IP pública (ipify, ya permitido en
 * el CSP) y la adjunta como header `x-imagiq-client-ip` en las peticiones de
 * pago. Ese header sí sobrevive el rewrite y el gateway lo prioriza.
 *
 * La IP se cachea en memoria + sessionStorage para no consultar ipify en cada
 * request. Es best-effort: si ipify falla, no se envía el header y el backend
 * cae a su comportamiento anterior.
 */

const STORAGE_KEY = "imagiq_client_ip";
const IPIFY_URL = "https://api.ipify.org?format=json";

let cachedIp: string | null = null;
let inFlight: Promise<string | null> | null = null;

/**
 * Devuelve la IP cacheada de forma síncrona (memoria o sessionStorage), o null
 * si aún no se ha resuelto. No dispara ninguna petición.
 */
export function getCachedClientIp(): string | null {
  if (cachedIp) return cachedIp;
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedIp = stored;
      return stored;
    }
  } catch {
    // sessionStorage no disponible (modo privado, etc.) — se ignora.
  }
  return null;
}

/**
 * Resuelve y cachea la IP pública del cliente. Idempotente: una sola petición
 * a ipify por sesión; las llamadas concurrentes comparten la misma promesa.
 * Conviene invocarla temprano (p. ej. al entrar al checkout) para que la IP
 * esté lista antes de pagar.
 */
export function primeClientIp(): Promise<string | null> {
  if (cachedIp) return Promise.resolve(cachedIp);
  if (typeof window === "undefined") return Promise.resolve(null);

  const stored = getCachedClientIp();
  if (stored) return Promise.resolve(stored);

  if (inFlight) return inFlight;

  inFlight = fetch(IPIFY_URL, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { ip?: string } | null) => {
      const ip = typeof data?.ip === "string" ? data.ip.trim() : null;
      if (ip) {
        cachedIp = ip;
        try {
          sessionStorage.setItem(STORAGE_KEY, ip);
        } catch {
          // se ignora
        }
      }
      return ip;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
