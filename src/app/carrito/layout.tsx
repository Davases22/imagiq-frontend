import type { Metadata } from "next";
import { CheckoutAddressProvider } from "@/features/checkout";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CarritoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CheckoutAddressProvider>{children}</CheckoutAddressProvider>;
}
