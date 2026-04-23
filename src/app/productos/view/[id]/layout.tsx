import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://imagiq.com";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

interface ProductSeoOverride {
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

/**
 * Fetch per-product SEO overrides from the product_seo side table. Returns
 * null when the product has no overrides (the common case). Keyed by
 * `codigoMarket` — one row per product group, shared across all variants.
 */
async function fetchProductSeoOverride(
  codigoMarket: string,
): Promise<ProductSeoOverride | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/products/seo/overrides/${encodeURIComponent(codigoMarket)}`,
      { next: { revalidate: 300 } }, // 5 min ISR cache
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.codigoMarket) return null;
    return data as ProductSeoOverride;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // The route param `id` is the product's `codigoMarket` (see
  // /productos/view/[id]). We fire the override lookup against that key
  // directly and the product fetch in parallel — no need to wait on the
  // product to resolve the override key anymore.
  const [productRes, override] = await Promise.all([
    fetch(`${API_URL}/api/products/${id}`, { next: { revalidate: 3600 } }),
    fetchProductSeoOverride(id),
  ]);

  try {
    if (!productRes.ok) return {};

    const data = await productRes.json();
    const product = data?.product || data;

    if (!product?.nombre) return {};

    // Derived defaults from the catalog data
    const defaultTitle = `${product.nombre}${product.marca ? ` - ${product.marca}` : ""}`;
    const defaultDescription = product.descripcion
      ? product.descripcion.substring(0, 160)
      : `Compra ${product.nombre} en Imagiq - Distribuidor Oficial Samsung Colombia. Envio gratis y garantia oficial.`;
    const defaultImage =
      product.imagenPrincipal || product.imagen || "/logo-og.png";
    const url = `${SITE_URL}/productos/view/${id}`;

    // Override precedence: admin-edited value > catalog-derived default
    const title = override?.meta_title || defaultTitle;
    const description = override?.meta_description || defaultDescription;
    const image = override?.og_image || defaultImage;
    const ogTitle = override?.seo_og_title || title;
    const ogDescription = override?.seo_og_description || description;

    return {
      title,
      description,
      keywords: override?.meta_keywords || undefined,
      alternates: { canonical: override?.seo_canonical || url },
      robots: {
        index: !(override?.seo_no_index ?? false),
        follow: !(override?.seo_no_follow ?? false),
      },
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        url,
        type: "website",
        images: [{ url: image, width: 800, height: 800, alt: product.nombre }],
      },
      twitter: {
        card: "summary_large_image",
        title: ogTitle,
        description: ogDescription,
        images: [image],
      },
    };
  } catch {
    return {};
  }
}

export default function ProductViewLayout({ children }: Props) {
  return <>{children}</>;
}
