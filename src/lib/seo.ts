/**
 * Helpers y utilidades para SEO
 * - Generación de meta tags dinámicos
 * - Structured data (JSON-LD)
 * - Canonical URLs
 * - Open Graph y Twitter Cards
 * - Sitemap generation helpers
 * - SEO metrics tracking con PostHog
 */

// SEO meta data interface
export interface SEOData {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: "website" | "article" | "product";
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

// Generate page title with site name
export const generatePageTitle = (
  title: string,
  siteName: string = "Samsung Store"
) => {
  return `${title} | ${siteName}`;
};

// Generate meta description
export const generateMetaDescription = (
  description: string,
  maxLength: number = 160
) => {
  return description.length > maxLength
    ? description.substring(0, maxLength - 3) + "..."
    : description;
};

// Generate structured data for products
export const generateProductStructuredData = (product: {
  name: string;
  description: string;
  images: string[];
  price: number;
  inStock: boolean;
}) => {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "USD",
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
};

// Generate breadcrumb structured data
export const generateBreadcrumbStructuredData = (
  breadcrumbs: Array<{ name: string; url: string }>
) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
};

// Extract keywords from content
export const extractKeywords = (
  content: string,
  maxKeywords: number = 10
): string[] => {
  // Simple keyword extraction logic
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const frequency: Record<string, number> = {};
  words.forEach((word) => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word]) => word);
};

// SEO metrics tracking
export const trackSEOMetrics = (
  page: string,
  metrics: {
    loadTime?: number;
    contentLength?: number;
    imageCount?: number;
    linkCount?: number;
  }
) => {
  // Track SEO-related metrics with PostHog
  if (typeof window !== 'undefined') {
    import('@/lib/posthogClient').then(({ posthogUtils }) => {
      posthogUtils.capture('seo_metrics', {
        page,
        ...metrics,
        timestamp: new Date().toISOString()
      });
    });
  }
};
