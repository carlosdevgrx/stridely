import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.scss';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://stridely-khaki.vercel.app'),
  title: 'Stridely — Planes de entrenamiento con IA para corredores',
  description: 'Conecta Strava y recibe un plan de carrera personalizado con inteligencia artificial. Para 5K, 10K, media maratón y maratón. Gratis.',
  keywords: ['plan de entrenamiento carrera', 'plan running IA', 'entrenamiento 5K', '10K', 'media maratón', 'maratón', 'Strava', 'inteligencia artificial running'],
  openGraph: {
    title: 'Stridely — Planes de entrenamiento con IA para corredores',
    description: 'Conecta Strava y recibe un plan de carrera personalizado con IA. Para 5K, 10K, media maratón y maratón. Gratis.',
    url: 'https://stridely-khaki.vercel.app',
    siteName: 'Stridely',
    locale: 'es_ES',
    images: [{ url: '/running-hero.jpg', width: 1200, height: 630, alt: 'Stridely — Entrena con inteligencia artificial' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stridely — Planes de entrenamiento con IA para corredores',
    description: 'Conecta Strava y recibe un plan de carrera personalizado con IA. Gratis.',
    images: ['/running-hero.jpg'],
  },
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
      <body>{children}<Analytics /></body>
    </html>
  );
}
