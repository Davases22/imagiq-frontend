import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ofertas y Promociones Samsung",
  description:
    "Descubre las mejores ofertas y promociones Samsung. Galaxy, tablets, wearables y electrodomésticos con descuentos exclusivos en Imagiq Colombia.",
  alternates: { canonical: "https://imagiq.com/ofertas" },
  openGraph: {
    title: "Ofertas Samsung - Samsung Store",
    description: "Las mejores ofertas en productos Samsung con envio gratis y garantia oficial.",
    url: "https://imagiq.com/ofertas",
  },
};

export default function OfertasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
