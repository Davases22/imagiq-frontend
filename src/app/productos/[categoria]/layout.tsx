/**
 * Per-category SEO layout.
 *
 * Next.js invokes generateMetadata on every request to /productos/[categoria];
 * we fetch the categorias_visibles list from the backend and resolve the
 * slug to a category, then build the <head> tags from the per-category SEO
 * fields edited in the dashboard (meta_title, meta_description, canonical,
 * noindex/nofollow, OG overrides).
 *
 * If the category is missing, has no SEO overrides, or the fetch fails, we
 * fall back to sensible defaults and let the root layout metadata take over.
 */

import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://imagiq.com";

interface CategoriaSeoPayload {
  uuid: string;
  nombre: string;
  nombre_visible?: string | null;
  descripcion?: string | null;
  activo: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  og_image?: string | null;
  seo_og_title?: string | null;
  seo_og_description?: string | null;
  seo_canonical?: string | null;
  seo_no_index?: boolean;
  seo_no_follow?: boolean;
}

/** Mirror the slug logic used by the dashboard editor and the navbar */
function slugify(raw: string | null | undefined): string {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function findCategoriaBySlug(slug: string): Promise<CategoriaSeoPayload | null> {
  try {
    const res = await fetch(`${API_URL}/api/multimedia/categorias`, {
      next: { revalidate: 300 }, // 5 min ISR cache
    });
    if (!res.ok) return null;
    const categorias = (await res.json()) as CategoriaSeoPayload[];
    if (!Array.isArray(categorias)) return null;
    return (
      categorias.find(
        (c) =>
          slugify(c.nombre_visible) === slug || slugify(c.nombre) === slug,
      ) || null
    );
  } catch {
    return null;
  }
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ categoria: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { categoria } = await params;
  const data = await findCategoriaBySlug(categoria);

  const displayName = data?.nombre_visible || data?.nombre || categoria;
  const title = data?.meta_title || `${displayName} - IMAGIQ`;
  const description =
    data?.meta_description ||
    data?.descripcion ||
    `Explora nuestra selección de ${displayName} en IMAGIQ con envío a toda Colombia.`;
  const url = `${SITE_URL}/productos/${categoria}`;

  return {
    title,
    description,
    keywords: data?.meta_keywords || undefined,
    alternates: { canonical: data?.seo_canonical || url },
    robots: {
      index: !(data?.seo_no_index ?? false),
      follow: !(data?.seo_no_follow ?? false),
    },
    openGraph: {
      type: "website",
      url,
      title: data?.seo_og_title || title,
      description: data?.seo_og_description || description,
      images: data?.og_image ? [{ url: data.og_image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: data?.seo_og_title || title,
      description: data?.seo_og_description || description,
      images: data?.og_image ? [data.og_image] : undefined,
    },
  };
}

export default function CategoriaLayout({ children }: LayoutProps) {
  return children;
}
