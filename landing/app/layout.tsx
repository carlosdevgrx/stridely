import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import './globals.scss';

// ─── Base URL — cambia a tu dominio definitivo cuando lo tengas ───────────────
const SITE_URL = 'https://stridely-khaki.vercel.app';

// ─── JSON-LD: SoftwareApplication (rich result en Google) ────────────────────
// Permite que Google muestre rating, precio y categoría directamente en los
// resultados. "HealthApplication" es la subcategoría más específica para running.
const jsonLdApp = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Stridely',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web, iOS, Android',
  description: 'Coach de IA para corredores. Conecta Strava y recibe un plan de entrenamiento personalizado para 5K, 10K, media maratón o maratón.',
  url: SITE_URL,
  sameAs: ['https://www.instagram.com/stridelyapp/'],
  // aggregateRating: añadir cuando haya reseñas reales — Google penaliza ratings fabricados
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  },
};

// ─── JSON-LD: Organization (asocia la marca con la cuenta de Instagram) ───────
const jsonLdOrg = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Stridely',
  url: SITE_URL,
  logo: `${SITE_URL}/logo-corporativo.svg`,
  sameAs: ['https://www.instagram.com/stridelyapp/'],
};

// ─── JSON-LD: WebSite (habilita sitelinks searchbox en Google) ───────────────
const jsonLdWebsite = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Stridely',
  url: SITE_URL,
};

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Stridely — Planes de entrenamiento con IA para corredores',
  description: 'Conecta Strava y recibe un plan de carrera personalizado con inteligencia artificial. Para 5K, 10K, media maratón y maratón. Gratis.',
  keywords: ['plan de entrenamiento carrera', 'plan running IA', 'entrenamiento 5K', '10K', 'media maratón', 'maratón', 'Strava', 'inteligencia artificial running'],
  // canonical: Next.js lo genera automáticamente a partir de metadataBase + ruta
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Stridely — Planes de entrenamiento con IA para corredores',
    description: 'Conecta Strava y recibe un plan de carrera personalizado con IA. Para 5K, 10K, media maratón y maratón. Gratis.',
    url: SITE_URL,
    siteName: 'Stridely',
    locale: 'es_ES',
    // 1200×630 es el tamaño de referencia para LinkedIn, Facebook y Twitter
    images: [{ url: '/running-hero.jpg', width: 1200, height: 630, alt: 'Stridely — Entrena con inteligencia artificial' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stridely — Planes de entrenamiento con IA para corredores',
    description: 'Conecta Strava y recibe un plan de carrera personalizado con IA. Gratis.',
    images: ['/running-hero.jpg'],
    creator: '@stridelyapp',
    site: '@stridelyapp',
  },
  // max-image-preview:large permite que Google use imágenes grandes en Discover
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body>
        {children}
        <Analytics />
        {/* JSON-LD: SoftwareApplication — rich results en Google (rating, precio, categoría) */}
        <Script
          id="schema-app"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }}
          strategy="afterInteractive"
        />
        {/* JSON-LD: WebSite — habilita sitelinks searchbox */}
        <Script
          id="schema-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
          strategy="afterInteractive"
        />
        {/* JSON-LD: Organization — asocia la marca con Instagram en Knowledge Graph */}
        <Script
          id="schema-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
