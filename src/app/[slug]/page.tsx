/**
 * Página dinámica para contenido multimedia
 * Ruta: /[slug]
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getActivePageBySlug } from '@/services/multimedia-pages.service';
import MultimediaPageClient from './components/MultimediaPageClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://imagiq.com';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getActivePageBySlug(slug);

  if (!data?.page) return {};

  const { page } = data;
  const title = page.meta_title || page.title;
  const description = page.meta_description || `${page.title} - ImagiQ`;
  const url = `${SITE_URL}/${slug}`;

  return {
    title,
    description,
    keywords: page.meta_keywords || undefined,
    alternates: { canonical: page.seo_canonical || url },
    robots: {
      index: !page.seo_no_index,
      follow: !page.seo_no_follow,
    },
    openGraph: {
      title: page.seo_og_title || title,
      description: page.seo_og_description || description,
      url,
      images: page.og_image ? [{ url: page.og_image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.seo_og_title || title,
      description: page.seo_og_description || description,
      images: page.og_image ? [page.og_image] : undefined,
    },
  };
}

export default async function DynamicPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { mode } = await searchParams;

  // Si es modo preview (query param ?mode=preview), retornamos datos vacíos iniciales
  // El cliente se encargará de hidratar esto via postMessage
  if (mode === 'preview') {
    const emptyData = {
      page: { title: 'Cargando Vista Previa...', slug: slug, status: 'preview', is_active: true, is_public: false, valid_from: '', valid_until: '', banner_ids: [], faq_ids: [], sections: [], info_sections: [], products_section_title: '', products_section_description: '', meta_title: '', meta_description: '', meta_keywords: null, og_image: null, category: 'preview', subcategory: null, tags: null, view_count: 0, created_at: '', updated_at: '', created_by: '' },
      banners: [],
      faqs: [],
      product_cards: []
    } as any;

    return <MultimediaPageClient pageData={emptyData} />;
  }

  // Llamar al endpoint de manera asíncrona
  const pageData = await getActivePageBySlug(slug);

  // Si no existe, mostrar 404
  if (!pageData) {
    notFound();
  }

  return <MultimediaPageClient pageData={pageData} />;
}
