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
  site_name: "Imagiq Samsung Store",
  site_url: SITE_URL,
  title_template: "%s | Imagiq Samsung Store",
  default_title: "Imagiq - Distribuidor Oficial Samsung Colombia",
  default_description:
    "Imagiq - Distribuidor oficial de Samsung en Colombia. Encuentra los últimos Galaxy, tablets, wearables y electrodomésticos con garantía oficial. Envío gratis, soporte especializado y las mejores promociones.",
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
      return { ...DEFAULTS, ...data };
    }
  } catch {
    // API unavailable — use defaults
  }

  return DEFAULTS;
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
      seller: {
        "@type": "Organization",
        name: "ImagiQ",
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
