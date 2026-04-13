import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar Sesion",
  description:
    "Inicia sesion en tu cuenta Imagiq para acceder a tus pedidos, direcciones guardadas y ofertas exclusivas.",
  alternates: { canonical: "https://imagiq.com/login" },
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
