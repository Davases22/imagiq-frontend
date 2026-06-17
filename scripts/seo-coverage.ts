/**
 * SEO coverage verifier (AC#8) — replaces a DB backfill.
 *
 * Because product metadata is generated server-side at request time from the
 * live catalog, 100% of products get product-specific metadata automatically.
 * This script PROVES it: it enumerates every product (codigoMarket) and, for
 * each canonical PDP URL, asserts the rendered HTML carries product-specific
 * Open Graph (og:type=product, a non-generic og:title, product:price:amount)
 * and that the og:image returns a 200 image. It reports coverage % and lists
 * every product that fell back to generic metadata or failed, so missing
 * catalog data is visible.
 *
 * Idempotent / repeatable / no writes. Run against any environment:
 *
 *   SEO_COVERAGE_BASE_URL=https://www.imagiq.com bun scripts/seo-coverage.ts
 *   bun scripts/seo-coverage.ts --limit 200          # sample
 *
 * Exit code: 0 if 100% covered, 1 otherwise (usable as a CI gate).
 */

const BASE_URL = (
  process.env.SEO_COVERAGE_BASE_URL || "https://www.imagiq.com"
).replace(/\/$/, "");
const GENERIC_TITLE = "Samsung Store - iMagiQ Colombia";
const CONCURRENCY = 8;

const limitArg = process.argv.indexOf("--limit");
const LIMIT =
  limitArg > -1 ? parseInt(process.argv[limitArg + 1] || "0", 10) : 0;

type Status = "OK" | "FALLBACK_GENERIC" | "MISSING_PRODUCT_TAGS" | "IMAGE_FAIL" | "FETCH_ERROR";
interface Result {
  codigoMarket: string;
  status: Status;
  detail?: string;
}

function metaContent(html: string, key: string): string | null {
  // matches <meta property="key" content="..."> or name="key", any attr order
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key.replace(/[:]/g, "\\:")}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

async function checkProduct(codigoMarket: string): Promise<Result> {
  const url = `${BASE_URL}/productos/view/${encodeURIComponent(codigoMarket)}`;
  try {
    const res = await fetch(url, { headers: { "user-agent": "imagiq-seo-coverage" } });
    if (!res.ok) return { codigoMarket, status: "FETCH_ERROR", detail: `HTTP ${res.status}` };
    const html = await res.text();

    const ogTitle = metaContent(html, "og:title");
    const ogType = metaContent(html, "og:type");
    const price = metaContent(html, "product:price:amount");
    const ogImage = metaContent(html, "og:image");

    if (!ogTitle || ogTitle === GENERIC_TITLE) {
      return { codigoMarket, status: "FALLBACK_GENERIC", detail: `og:title="${ogTitle ?? ""}"` };
    }
    if (ogType !== "product" || !price || Number(price) <= 0) {
      return {
        codigoMarket,
        status: "MISSING_PRODUCT_TAGS",
        detail: `og:type=${ogType} price=${price}`,
      };
    }
    if (ogImage) {
      try {
        const img = await fetch(ogImage, { method: "GET" });
        const ct = img.headers.get("content-type") || "";
        if (!img.ok || !ct.startsWith("image/")) {
          return { codigoMarket, status: "IMAGE_FAIL", detail: `${img.status} ${ct}` };
        }
      } catch (e) {
        return { codigoMarket, status: "IMAGE_FAIL", detail: String(e) };
      }
    } else {
      return { codigoMarket, status: "IMAGE_FAIL", detail: "no og:image" };
    }
    return { codigoMarket, status: "OK" };
  } catch (e) {
    return { codigoMarket, status: "FETCH_ERROR", detail: String(e) };
  }
}

async function fetchAllCodigoMarkets(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/api/products`);
  if (!res.ok) throw new Error(`catalog fetch failed: HTTP ${res.status}`);
  const json: any = await res.json();
  const arr: any[] = Array.isArray(json) ? json : json?.products || json?.data || [];
  const set = new Set<string>();
  for (const p of arr) {
    const cm = String(p?.codigoMarket || p?.codigo_market || "").trim();
    if (cm) set.add(cm);
  }
  return [...set];
}

async function runPool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function main() {
  console.log(`[seo-coverage] target: ${BASE_URL}`);
  let codes = await fetchAllCodigoMarkets();
  console.log(`[seo-coverage] catalog products (codigoMarket): ${codes.length}`);
  if (LIMIT > 0) {
    codes = codes.slice(0, LIMIT);
    console.log(`[seo-coverage] sampling first ${codes.length}`);
  }

  const results = await runPool(codes, CONCURRENCY, checkProduct);
  const by: Record<Status, Result[]> = {
    OK: [], FALLBACK_GENERIC: [], MISSING_PRODUCT_TAGS: [], IMAGE_FAIL: [], FETCH_ERROR: [],
  };
  for (const r of results) by[r.status].push(r);

  const ok = by.OK.length;
  const total = results.length;
  const pct = total ? ((ok / total) * 100).toFixed(2) : "0";
  console.log(`\n===== SEO COVERAGE REPORT =====`);
  console.log(`OK (product-specific OG + price + image): ${ok}/${total} (${pct}%)`);
  for (const s of ["FALLBACK_GENERIC", "MISSING_PRODUCT_TAGS", "IMAGE_FAIL", "FETCH_ERROR"] as Status[]) {
    if (by[s].length) {
      console.log(`\n${s}: ${by[s].length}`);
      by[s].slice(0, 50).forEach((r) => console.log(`  - ${r.codigoMarket}  ${r.detail ?? ""}`));
      if (by[s].length > 50) console.log(`  … and ${by[s].length - 50} more`);
    }
  }
  process.exit(ok === total && total > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("[seo-coverage] fatal:", e);
  process.exit(1);
});
