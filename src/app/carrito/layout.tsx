import type { Metadata } from "next";
import { CheckoutAddressProvider } from "@/features/checkout";
import CheckoutShell from "./components/CheckoutShell";

export const metadata: Metadata = {
  title: "Carrito de compras",
  description: "Tu carrito de compras en Imagiq Samsung Store.",
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
};

export default function CarritoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CheckoutAddressProvider>
      {/* El indicador de pasos aparece desde step2 (tras "Continuar" en el
          carrito); en /carrito y step1 los children van a ancho completo. */}
      <CheckoutShell>{children}</CheckoutShell>
    </CheckoutAddressProvider>
  );
}
