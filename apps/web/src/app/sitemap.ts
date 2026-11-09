import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

const ROUTES = ['', '/how-it-works', '/features', '/community', '/about', '/faq', '/demo', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({ url: `${site.url}${r}`, changeFrequency: 'monthly', priority: r === '' ? 1 : r === '/demo' ? 0.9 : 0.6 }));
}
