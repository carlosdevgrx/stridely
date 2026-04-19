import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import './globals.scss';

// ─── Base URL ───────────────────────────────────────────────────────────────
const SITE_URL = 'https://stridelyapp.com';

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
  title: 'Stridely — Coach de running con IA | Plan personalizado con Strava',
  description: 'Genera tu plan de entrenamiento de running con inteligencia artificial. Conecta Strava y entrena para 5K, 10K, media maratón o maratón. Gratis, sin tarjeta.',
  keywords: ['app running IA', 'plan entrenamiento running', 'coach running inteligencia artificial', 'plan carrera personalizado strava', 'entrenamiento 5K 10K media maratón maratón', 'aplicación running gratis'],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Stridely — Coach de running con IA | Plan personalizado con Strava',
    description: 'Genera tu plan de entrenamiento de running con IA. Conecta Strava y entrena para 5K, 10K, media maratón o maratón. Gratis.',
    url: SITE_URL,
    siteName: 'Stridely',
    locale: 'es_ES',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Stridely — Coach de running con inteligencia artificial' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stridely — Coach de running con IA | Plan personalizado con Strava',
    description: 'Genera tu plan de entrenamiento de running con IA. Conecta Strava. Gratis.',
    images: ['/og-image.png'],
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
