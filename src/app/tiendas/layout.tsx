import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tiendas Samsung en Colombia",
  description:
    "Encuentra la tienda Samsung más cercana. Puntos de venta autorizados Imagiq en toda Colombia con atención personalizada y productos originales.",
  alternates: { canonical: "https://imagiq.com/tiendas" },
  openGraph: {
    title: "Tiendas Samsung - Imagiq",
    description: "Puntos de venta Samsung autorizados en Colombia.",
    url: "https://imagiq.com/tiendas",
  },
};

export default function TiendasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
