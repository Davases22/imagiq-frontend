import { CheckoutAddressProvider } from "@/features/checkout";

export default function CarritoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CheckoutAddressProvider>{children}</CheckoutAddressProvider>;
}
