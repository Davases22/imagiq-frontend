const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://imagiq.com";

interface SeoSettings {
  site_name: string;
  site_url: string;
  title_template: string;
  default_title: string;
  default_description: string;
  default_og_image: string;
  google_verification: string;
  [key: string]: string | null;
}

const DEFAULTS: SeoSettings = {
  site_name: "Samsung Store",
  site_url: SITE_URL,
  title_template: "%s | Samsung Store",
  default_title: "Samsung Store - iMagiQ Colombia",
  default_description:
    "Tiendas oficiales Samsung. Encuentra los últimos Smartphones Galaxy, Televisores y Electrodomésticos con garantía oficial. Descuentos exclusivos y soporte.",
  default_og_image: "/logo-og.png",
  google_verification: "",
};

export async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const res = await fetch(`${API_URL}/api/multimedia/seo/settings`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      // Hardcode title & description — no permitir override del API
      const { default_title, default_description, ...restData } = data;
      return { ...DEFAULTS, ...restData };
    }
  } catch {
    // API unavailable — use defaults
  }

  return DEFAULTS;
}

/** Build WebSite JSON-LD — controls the site name shown in Google SERPs (especially
 * mobile) and enables the Sitelinks Search Box via `potentialAction`. */
export function buildWebSiteJsonLd(settings: SeoSettings) {
  const base = settings.site_url || SITE_URL;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Samsung Store",
    alternateName: ["Samsung Store iMagiQ", "Samsung Store Colombia"],
    url: base,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/productos?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Build Organization JSON-LD for the root layout */
export function buildOrganizationJsonLd(settings: SeoSettings) {
  const socialProfiles: string[] = (() => {
    try { return JSON.parse(settings.social_profiles || "[]"); } catch { return []; }
  })();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.site_name,
    url: settings.site_url,
    logo: `${settings.site_url}/logo-og.png`,
    sameAs: socialProfiles,
  };
}

/** Build Product JSON-LD */
export function buildProductJsonLd(product: {
  name: string;
  description?: string;
  sku: string;
  gtin13?: string | null;
  images: string[];
  price: number;
  currency?: string;
  inStock?: boolean;
  brand?: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    ...(product.gtin13 ? { gtin13: product.gtin13 } : {}),
    image: product.images,
    brand: {
      "@type": "Brand",
      name: product.brand || "Samsung",
    },
    offers: {
      "@type": "Offer",
      url: product.url,
      priceCurrency: product.currency || "COP",
      price: product.price,
      availability: product.inStock !== false
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "Samsung Store iMagiQ",
      },
    },
  };
}

/** Build SiteNavigationElement JSON-LD for sitelinks */
export function buildSiteNavigationJsonLd(siteUrl: string) {
  const navItems = [
    { name: "Ofertas", url: `${siteUrl}/ofertas` },
    { name: "Dispositivos Móviles", url: `${siteUrl}/productos/dispositivos-moviles` },
    { name: "TV y Audio", url: `${siteUrl}/productos/tv-y-audio` },
    { name: "Electrodomésticos", url: `${siteUrl}/productos/electrodomesticos` },
    { name: "Monitores", url: `${siteUrl}/productos/monitores` },
    { name: "Tiendas", url: `${siteUrl}/tiendas` },
    { name: "Servicio Técnico", url: `${siteUrl}/soporte/inicio_de_soporte` },
  ];

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: navItems.map((item, i) => ({
      "@type": "SiteNavigationElement",
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

/** Build BreadcrumbList JSON-LD */
export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Build ItemList JSON-LD for category/listing pages */
export function buildItemListJsonLd(
  items: Array<{ name: string; url: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

// ===========================================================================
// PRODUCT (PDP) METADATA — single source of truth reused by /productos/view,
// /productos/multimedia and /productos/viewpremium layouts (server-side).
// ===========================================================================

export interface ProductMeta {
  codigoMarket: string;
  sku: string;
  ean: string | null;
  name: string;
  description: string;
  image: string | null;
  price: number;
  priceNormal: number;
  currency: string;
  inStock: boolean;
  brand: string;
  condition: string;
  categoria: string | null;
}

export interface ProductSeoOverride {
  codigoMarket: string;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  og_image?: string | null;
  seo_og_title?: string | null;
  seo_og_description?: string | null;
  seo_canonical?: string | null;
  seo_no_index?: boolean;
  seo_no_follow?: boolean;
}

/** Canonical product data for SSR metadata (backend reuses the merchant-feed
 * resolvers, so OG `product:*`, JSON-LD and the Meta catalog feed all agree). */
export async function fetchProductMeta(key: string): Promise<ProductMeta | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/products/${encodeURIComponent(key)}/meta`,
      { next: { revalidate: 300 } }, // 5 min: price/stock stay reasonably fresh
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.codigoMarket) return null;
    return data as ProductMeta;
  } catch {
    return null;
  }
}

/** Per-product SEO overrides (product_seo side table, keyed by codigoMarket).
 * Returns null when the product has no manual override (the common case). */
export async function fetchProductSeoOverride(
  codigoMarket: string,
): Promise<ProductSeoOverride | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/products/seo/overrides/${encodeURIComponent(codigoMarket)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.codigoMarket) return null;
    return data as ProductSeoOverride;
  } catch {
    return null;
  }
}

/** URL of the dynamic branded OG image (next/og route). Lives OUTSIDE `/api/*`
 * because next.config rewrites `/api/*` to the backend, which would shadow it. */
export function productOgImageUrl(codigoMarket: string): string {
  return `${SITE_URL}/og/product/${encodeURIComponent(codigoMarket)}`;
}

/** Canonical product URL — one per product group, regardless of which PDP
 * variant route (view/multimedia/viewpremium) the user landed on. */
export function productCanonicalUrl(codigoMarket: string): string {
  return `${SITE_URL}/productos/view/${encodeURIComponent(codigoMarket)}`;
}

/**
 * Build the full Next.js Metadata for a product page. `key` is the route param
 * (codigoMarket or SKU). Precedence: manual `product_seo` override > catalog
 * default. Emits the complete Open Graph + `product:*` namespace via `other`
 * (Next's typed `openGraph` can't express og:type=product / product:* and would
 * also emit a conflicting og:type=website), so PDP pages feed the Meta catalog.
 * Returns `null` when the product can't be resolved (caller keeps the generic
 * root metadata).
 */
export async function buildProductMetadata(
  key: string,
): Promise<import("next").Metadata | null> {
  const [meta, override] = await Promise.all([
    fetchProductMeta(key),
    fetchProductSeoOverride(key),
  ]);
  if (!meta) return null;

  const codigoMarket = meta.codigoMarket;
  const canonical = override?.seo_canonical || productCanonicalUrl(codigoMarket);

  const title = override?.meta_title || `${meta.name} | Samsung Store`;
  const description = (
    override?.meta_description || meta.description
  ).slice(0, 200);
  const ogTitle = override?.seo_og_title || override?.meta_title || meta.name;
  const ogDescription = override?.seo_og_description || description;
  const ogImage =
    override?.og_image || productOgImageUrl(codigoMarket);
  const availability = meta.inStock ? "in stock" : "out of stock";

  return {
    title,
    description,
    keywords: override?.meta_keywords || undefined,
    alternates: { canonical },
    robots: {
      index: !(override?.seo_no_index ?? false),
      follow: !(override?.seo_no_follow ?? false),
    },
    // Twitter is conflict-free via the typed field.
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    },
    // Full OG + product namespace emitted manually for deterministic og:type
    // and the Meta-catalog `product:*` tags. All URLs absolute.
    other: {
      "og:type": "product",
      "og:title": ogTitle,
      "og:description": ogDescription,
      "og:url": canonical,
      "og:site_name": "Samsung Store",
      "og:locale": "es_CO",
      "og:image": ogImage,
      "og:image:secure_url": ogImage,
      "og:image:width": "1200",
      "og:image:height": "630",
      "og:image:alt": meta.name,
      "product:price:amount": String(meta.price),
      "product:price:currency": meta.currency,
      "product:availability": availability,
      "product:retailer_item_id": meta.sku,
      "product:brand": meta.brand,
      "product:condition": meta.condition,
      // Some scrapers read the legacy og:price:* pair too.
      "og:price:amount": String(meta.price),
      "og:price:currency": meta.currency,
    },
  };
}
