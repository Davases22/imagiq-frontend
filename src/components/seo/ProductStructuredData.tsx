import {
  fetchProductMeta,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  productCanonicalUrl,
} from "@/lib/seo-utils";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://imagiq.com";

/**
 * Server component that renders Product + BreadcrumbList JSON-LD for a PDP.
 * Shared by the /productos/{view,multimedia,viewpremium} layouts. The
 * `fetchProductMeta` call is memoized by Next within the same request, so this
 * does not add an extra round-trip on top of `generateMetadata`.
 */
export default async function ProductStructuredData({
  pageKey,
}: {
  pageKey: string;
}) {
  const meta = await fetchProductMeta(pageKey);
  if (!meta) return null;

  const url = productCanonicalUrl(meta.codigoMarket);

  const product = buildProductJsonLd({
    name: meta.name,
    description: meta.description,
    sku: meta.sku,
    gtin13: meta.ean,
    images: meta.image ? [meta.image] : [],
    price: meta.price,
    currency: meta.currency,
    inStock: meta.inStock,
    brand: meta.brand,
    url,
  });

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Inicio", url: SITE_URL },
    { name: "Productos", url: `${SITE_URL}/productos` },
    { name: meta.name, url },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </>
  );
}
