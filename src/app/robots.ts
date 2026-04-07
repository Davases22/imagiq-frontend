import type { MetadataRoute } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://imagiq.com';

export default async function robots(): Promise<MetadataRoute.Robots> {
  let disallowPaths = [
    '/carrito/',
    '/perfil/',
    '/api/',
    '/dashboard/',
    '/success-checkout/',
    '/error-checkout/',
    '/charging-result/',
    '/pickup-tracking/',
    '/imagiq-tracking/',
    '/tracking-service/',
    '/verify-purchase/',
    '/*?i=',
  ];
  let aiPolicy = 'block_training';
  let siteUrl = SITE_URL;

  try {
    const res = await fetch(`${API_URL}/api/multimedia/seo/settings`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const settings = await res.json();
      if (settings.robots_disallow_paths) {
        disallowPaths = JSON.parse(settings.robots_disallow_paths);
      }
      if (settings.ai_crawlers_policy) {
        aiPolicy = settings.ai_crawlers_policy;
      }
      if (settings.site_url) {
        siteUrl = settings.site_url;
      }
    }
  } catch {
    // Use defaults if API is unavailable
  }

  const rules: MetadataRoute.Robots['rules'] = [
    {
      userAgent: '*',
      allow: '/',
      disallow: disallowPaths,
    },
  ];

  if (aiPolicy === 'block_training' || aiPolicy === 'block_all') {
    rules.push(
      { userAgent: 'GPTBot', disallow: ['/'] },
      { userAgent: 'CCBot', disallow: ['/'] },
      { userAgent: 'Google-Extended', disallow: ['/'] },
    );
  }

  return {
    rules,
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
