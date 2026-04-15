import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF + WebP: formatos más eficientes. Next.js los sirve según Accept header.
    // AVIF ~50% más pequeño que JPEG → mejor LCP
    formats: ['image/avif', 'image/webp'],
    // Permite optimizar imágenes de Unsplash (usado en las cards de distancias)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // Headers de caché para assets estáticos. Mejora TTFB en revisitas.
  // Cache-Control: immutable = el browser no re-valida nunca estos assets
  async headers() {
    return [
      {
        source: '/(.*\\.(?:jpg|jpeg|png|svg|ico|webp|avif|woff2|woff))',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
