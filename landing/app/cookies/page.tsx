import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import s from '../legal.module.scss';

export const metadata: Metadata = {
  title: 'Política de Cookies — Stridely',
  description: 'Qué cookies usa Stridely, para qué y cómo puedes gestionarlas o desactivarlas.',
  alternates: { canonical: '/cookies' },
  robots: { index: true, follow: false },
};

export default function CookiesPage() {
  return (
    <main className={s.page}>
      <div className={s.container}>
        <Link href="/" className={s.back}>
          <ArrowLeft size={15} aria-hidden="true" />
          Volver a Stridely
        </Link>

        <h1 className={s.title}>Política de Cookies</h1>
        <p className={s.updated}>Última actualización: 15 de abril de 2026</p>

        <section className={s.section}>
          <h2>¿Qué es una cookie?</h2>
          <p>
            Una cookie es un pequeño archivo de texto que un sitio web guarda en tu dispositivo cuando lo visitas.
            Sirve para recordar tus preferencias, mantener tu sesión activa y medir el uso del servicio.
          </p>
        </section>

        <section className={s.section}>
          <h2>Cookies que usamos</h2>

          <p><strong>Cookies estrictamente necesarias</strong></p>
          <ul>
            <li>
              <strong>Sesión de autenticación (Supabase)</strong> — Almacena el token de sesión para que no
              tengas que iniciar sesión en cada visita. Sin esta cookie el servicio no funciona.
              Duración: hasta que cierras sesión o caduca (30 días).
            </li>
            <li>
              <strong>Token de Strava</strong> — Guarda el token OAuth de Strava para sincronizar tus actividades.
              Duración: hasta que desconectas tu cuenta de Strava.
            </li>
          </ul>

          <p style={{ marginTop: '1.25rem' }}><strong>Cookies analíticas</strong></p>
          <ul>
            <li>
              <strong>Vercel Analytics</strong> — Mide el número de visitas, páginas vistas y orígenes de tráfico
              de forma anónima y sin identificadores personales. No requiere consentimiento según la normativa
              española (AEPD) al ser datos agregados. Duración: sesión.
            </li>
          </ul>

          <p style={{ marginTop: '1.25rem' }}><strong>Cookies de terceros</strong></p>
          <ul>
            <li>
              Actualmente Stridely <strong>no utiliza cookies de publicidad ni de seguimiento de terceros</strong>{' '}
              (Google Ads, Meta Pixel, etc.).
            </li>
          </ul>
        </section>

        <section className={s.section}>
          <h2>Cómo gestionar las cookies</h2>
          <p>
            Puedes configurar tu navegador para bloquear o eliminar cookies. Ten en cuenta que desactivar
            las cookies necesarias puede impedir el correcto funcionamiento de la aplicación.
          </p>
          <ul>
            <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a></li>
            <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" target="_blank" rel="noopener noreferrer">Firefox</a></li>
            <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
            <li><a href="https://support.microsoft.com/es-es/windows/eliminar-y-administrar-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer">Edge</a></li>
          </ul>
        </section>

        <section className={s.section}>
          <h2>Cambios en esta política</h2>
          <p>
            Actualizaremos esta política si introducimos nuevas cookies o servicios. Te notificaremos
            cualquier cambio relevante a través de la aplicación.
          </p>
        </section>

        <section className={s.section}>
          <h2>Contacto</h2>
          <p>
            Para cualquier consulta sobre el uso de cookies, escríbenos a{' '}
            <a href="mailto:privacy@stridely.app">privacy@stridely.app</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
