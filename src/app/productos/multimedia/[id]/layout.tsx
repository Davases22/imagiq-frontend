import type { Metadata } from "next";
import { buildProductMetadata } from "@/lib/seo-utils";
import ProductStructuredData from "@/components/seo/ProductStructuredData";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

// The multimedia route is the URL shared in Meta Ads / WhatsApp. It used to be
// a client-only page with no metadata, so crawlers got the generic root tags.
// This server layout renders product-specific metadata + product:* + JSON-LD
// (canonical points to the single /productos/view/{codigoMarket} URL).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return (await buildProductMetadata(id)) ?? {};
}

export default async function ProductMultimediaLayout({
  params,
  children,
}: Props) {
  const { id } = await params;
  return (
    <>
      <ProductStructuredData pageKey={id} />
      {children}
    </>
  );
}
