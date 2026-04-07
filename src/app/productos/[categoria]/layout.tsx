import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://imagiq.com";

/** SEO metadata for each known product category */
const CATEGORY_META: Record<string, { title: string; description: string }> = {
  "dispositivos-moviles": {
    title: "Dispositivos Móviles Samsung",
    description:
      "Descubre los últimos smartphones Galaxy, tablets, smartwatches y accesorios Samsung. Compra con envío gratis y garantía oficial en Imagiq Colombia.",
  },
  "tv-y-audio": {
    title: "TV y Audio Samsung",
    description:
      "Televisores Samsung QLED, Neo QLED, barras de sonido y parlantes. La mejor experiencia de entretenimiento con garantía oficial en Imagiq Colombia.",
  },
  electrodomesticos: {
    title: "Electrodomésticos Samsung",
    description:
      "Neveras, lavadoras, secadoras, lavavajillas y aspiradoras Samsung. Electrodomésticos de última tecnología con garantía oficial en Imagiq Colombia.",
  },
  monitores: {
    title: "Monitores Samsung",
    description:
      "Monitores Samsung para gaming, productividad y diseño. Pantallas de alta resolución con garantía oficial en Imagiq Colombia.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string }>;
}): Promise<Metadata> {
  const { categoria } = await params;
  const meta = CATEGORY_META[categoria];

  if (!meta) {
    return {
      title: "Productos Samsung",
      description:
        "Encuentra los mejores productos Samsung con garantía oficial, envío gratis y soporte especializado en Imagiq Colombia.",
      alternates: { canonical: `${SITE_URL}/productos/${categoria}` },
    };
  }

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `${SITE_URL}/productos/${categoria}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${SITE_URL}/productos/${categoria}`,
    },
  };
}

export default function CategoriaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
