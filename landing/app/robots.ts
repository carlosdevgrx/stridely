import type { MetadataRoute } from 'next';

// Next.js genera /robots.txt automáticamente a partir de este archivo.
// Googlebot necesita permiso explícito + referencia al sitemap para rastrear eficientemente.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://stridely-khaki.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Evita que Google indexe rutas de API o assets privados si los hubiera
        disallow: ['/api/', '/_next/'],
      },
    ],
    // Referencia directa al sitemap: Google lo detecta mejor via robots.txt que Search Console
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
