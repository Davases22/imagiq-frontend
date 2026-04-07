import type { MetadataRoute } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://imagiq.com';

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (res.ok) return res.json();
  } catch { /* use fallback */ }
  return fallback;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  // Fetch dynamic pages from CMS (pages with include_in_sitemap=true)
  const pages = await fetchJson<Array<{ slug: string; updated_at: string }>>(
    `${API_URL}/api/multimedia/pages?status=published&is_active=true&limit=500`,
    [],
  );

  // Fetch categories
  const categories = await fetchJson<Array<{ id: string; slug: string; nombre: string }>>(
    `${API_URL}/api/multimedia/categorias`,
    [],
  );

  // Static pages — navbar pages get highest priorities for sitelink visibility
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/ofertas`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/productos/dispositivos-moviles`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/productos/tv-y-audio`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/productos/electrodomesticos`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/productos/monitores`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/tiendas`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/soporte/inicio_de_soporte`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/productos`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/soporte`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/ventas-corporativas`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/ventas-corporativas/education`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/ventas-corporativas/finance`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/ventas-corporativas/government`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/ventas-corporativas/hotels`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/ventas-corporativas/retail`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  // CMS pages (landing pages, legal docs, etc.)
  const cmsPages: MetadataRoute.Sitemap = pages
    .filter((p: any) => p.include_in_sitemap !== false)
    .map((p: any) => ({
      url: `${baseUrl}/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  // Category pages (exclude ones already in staticPages to avoid duplicates)
  const staticSlugs = new Set(['dispositivos-moviles', 'tv-y-audio', 'electrodomesticos', 'monitores']);
  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((c: any) => !staticSlugs.has(c.slug))
    .map((c: any) => ({
      url: `${baseUrl}/productos/${c.slug || c.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

  return [...staticPages, ...cmsPages, ...categoryPages];
}
