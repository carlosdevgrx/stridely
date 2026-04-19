import type { MetadataRoute } from 'next';

// Next.js genera /sitemap.xml automáticamente a partir de este archivo.
// Google lo usa para descubrir y priorizar páginas con su fecha de actualización.
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://stridelyapp.com';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: 'monthly',
      // FAQ tiene prioridad alta: genera long-tail traffic y rich snippets en SERP
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contacto`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacidad`,
      lastModified: new Date('2026-04-09'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terminos`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: new Date('2026-04-15'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
