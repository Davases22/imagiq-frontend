import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Servicio Técnico y Soporte Samsung",
  description:
    "Servicio técnico autorizado Samsung en Colombia. Consulta tu orden de reparación, agenda servicio técnico y encuentra centros de soporte Imagiq.",
  alternates: { canonical: "https://imagiq.com/soporte" },
  openGraph: {
    title: "Servicio Técnico Samsung - Imagiq",
    description:
      "Soporte técnico autorizado Samsung. Consulta órdenes, agenda reparaciones y encuentra centros de servicio.",
    url: "https://imagiq.com/soporte",
  },
};

export default function SoporteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
