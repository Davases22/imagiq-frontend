import type { Metadata } from "next";
import { buildProductMetadata } from "@/lib/seo-utils";
import ProductStructuredData from "@/components/seo/ProductStructuredData";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

// Premium PDP variant. Was client-only with no metadata → generic preview.
// Server layout adds product-specific metadata + product:* + JSON-LD, sharing
// the same central helper as /view and /multimedia.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return (await buildProductMetadata(id)) ?? {};
}

export default async function ProductViewPremiumLayout({
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
