/**
 * Normaliza la URL de destino de una campaña (in-web, banners) antes de abrirla.
 *
 * Por qué: el 10-sep-2026 la campaña "Slider Aniversario 7" se guardó con
 * `content_url = "productos/multimedia/LS03H"` (sin "/" inicial). `window.open`
 * la resolvía RELATIVA a la página actual (/productos/tv-y-audio) →
 * /productos/productos/multimedia/LS03H → 404, y el usuario "rebotaba" a la
 * categoría. Reglas:
 * - vacío → null (no hay enlace)
 * - http(s)://… o "//…" → tal cual
 * - "/ruta" → tal cual
 * - "dominio.com/ruta" (empieza por algo con punto antes de la primera "/") → https://
 * - cualquier otra cosa ("productos/…") → "/" + ruta
 */
export function normalizeCampaignUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? "").trim();
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url)) return url;
  if (url.startsWith("/")) return url;
  const firstSegment = url.split(/[/?#]/)[0];
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i.test(firstSegment)) return `https://${url}`;
  return `/${url.replace(/^\.?\/+/, "")}`;
}
