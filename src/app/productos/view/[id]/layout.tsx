import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://imagiq.com";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

interface ProductSeoOverride {
  sku: string;
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
 * null when the product has no overrides (the common case).
 */
async function fetchProductSeoOverride(
  sku: string,
): Promise<ProductSeoOverride | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/products/seo/overrides/${encodeURIComponent(sku)}`,
      { next: { revalidate: 300 } }, // 5 min ISR cache
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.sku) return null;
    return data as ProductSeoOverride;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await fetch(`${API_URL}/api/products/${id}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return {};

    const data = await res.json();
    const product = data?.product || data;

    if (!product?.nombre) return {};

    // Load per-product SEO overrides (if any) using the product's sku. The
    // route param is usually codigoMarket, which is different from sku, so
    // we must wait on the product fetch before we can issue the override
    // lookup.
    const override = product.sku
      ? await fetchProductSeoOverride(product.sku)
      : null;

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
