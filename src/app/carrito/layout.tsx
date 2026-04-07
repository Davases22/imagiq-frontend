import type { Metadata } from "next";
import { CheckoutAddressProvider } from "@/features/checkout";

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
  return <CheckoutAddressProvider>{children}</CheckoutAddressProvider>;
}
