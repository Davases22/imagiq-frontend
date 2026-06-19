/**
 * Historial de búsqueda del buscador del sitio.
 *
 * - UX: "búsquedas recientes" en localStorage (instantáneo, anónimo y logueado),
 *   normalizado, capado y deduplicado por recencia — patrón de Algolia/Segment.
 * - Data: cada búsqueda se loguea al backend (best-effort) para la analítica de
 *   demanda y el "SEO privado" futuro; anónimas con el posthog distinct_id,
 *   logueadas con el user_id. Al iniciar sesión se hace merge anónimo→usuario.
 */
import posthog from "posthog-js";
import { apiPost } from "@/lib/api-client";

const RECENT_KEY = "imagiq_search_history";
const MAX_RECENT = 10;

export interface RecentSearch {
  query: string; // texto mostrado (raw)
  ts: number; // timestamp
}

function normalize(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ───────────────────────── localStorage (UX) ─────────────────────────

export function getRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as RecentSearch[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function setRecentSearches(items: RecentSearch[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    /* storage lleno / bloqueado: no-op */
  }
}

/** Agrega (o sube por recencia) una búsqueda al historial local, dedup por
 * texto normalizado, capado a MAX_RECENT. */
export function addRecentSearch(query: string): void {
  const q = (query || "").trim();
  const norm = normalize(q);
  if (!norm) return;
  const existing = getRecentSearches().filter((r) => normalize(r.query) !== norm);
  setRecentSearches([{ query: q, ts: Date.now() }, ...existing]);
}

export function removeRecentSearch(query: string): void {
  const norm = normalize(query);
  setRecentSearches(getRecentSearches().filter((r) => normalize(r.query) !== norm));
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* no-op */
  }
}

// ───────────────────────── backend (data) ─────────────────────────

function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("imagiq_user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: string };
    return u?.id || null;
  } catch {
    return null;
  }
}

function getAnonId(): string | null {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      return posthog.get_distinct_id?.() || null;
    }
  } catch {
    /* posthog no listo */
  }
  return null;
}

/** Loguea la búsqueda al backend (fire-and-forget, nunca lanza). */
export function logSearchToServer(opts: {
  query: string;
  resultCount?: number;
  clickedProductId?: string;
  categoryContext?: string;
  source?: string;
}): void {
  const query = (opts.query || "").trim();
  if (!query) return;
  const userId = getUserId();
  void apiPost("/api/search-history", {
    query,
    userId,
    anonymousId: userId ? null : getAnonId(),
    resultCount: opts.resultCount,
    clickedProductId: opts.clickedProductId,
    categoryContext: opts.categoryContext,
    source: opts.source ?? "navbar",
  }).catch(() => {
    /* best-effort: no romper el buscador */
  });
}

/** Atajo: registra una búsqueda (UX local + data backend) en un solo lugar. */
export function recordSearch(query: string, opts?: { resultCount?: number; source?: string }): void {
  addRecentSearch(query);
  logSearchToServer({ query, resultCount: opts?.resultCount, source: opts?.source });
}

/** Merge anónimo→usuario al iniciar sesión: reasigna las búsquedas anónimas
 * (mismo posthog distinct_id) a la cuenta. Llamar tras el login. */
export function mergeSearchHistoryOnLogin(userId: string): void {
  const anonymousId = getAnonId();
  if (!userId || !anonymousId) return;
  void apiPost("/api/search-history/merge", { userId, anonymousId }).catch(() => {
    /* best-effort */
  });
}
