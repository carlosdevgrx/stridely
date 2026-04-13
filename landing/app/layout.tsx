import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.scss';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://stridely-khaki.vercel.app'),
  title: 'Stridely — Entrena con inteligencia',
  description: 'Planes de carrera personalizados con IA. Conecta Strava, entrena con propósito y alcanza tu próxima meta.',
  openGraph: {
    title: 'Stridely — Entrena con inteligencia',
    description: 'Planes de carrera personalizados con IA.',
    url: 'https://stridely-khaki.vercel.app',
    siteName: 'Stridely',
    images: [{ url: '/icon-192.png', width: 192, height: 192 }],
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
