import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://imagiq.com";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await fetch(`${API_URL}/api/products/${id}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return {};

    const data = await res.json();
    const product = data?.product || data;

    if (!product?.nombre) return {};

    const title = `${product.nombre}${product.marca ? ` - ${product.marca}` : ""}`;
    const description = product.descripcion
      ? product.descripcion.substring(0, 160)
      : `Compra ${product.nombre} en Imagiq - Distribuidor Oficial Samsung Colombia. Envio gratis y garantia oficial.`;
    const image = product.imagenPrincipal || product.imagen || "/logo-og.png";
    const url = `${SITE_URL}/productos/view/${id}`;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        type: "website",
        images: [{ url: image, width: 800, height: 800, alt: product.nombre }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return {};
  }
}

export default function ProductViewLayout({ children }: Props) {
  return <>{children}</>;
}
