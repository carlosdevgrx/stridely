import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import s from '../legal.module.scss';

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Stridely',
  description: 'Condiciones de uso del servicio Stridely. Qué puedes hacer, qué no, y cuáles son tus derechos como usuario.',
  alternates: { canonical: '/terminos' },
  robots: { index: true, follow: false },
};

const LANDING_URL = 'https://stridely-khaki.vercel.app';

export default function TerminosPage() {
  return (
    <main className={s.page}>
      <div className={s.container}>
        <Link href="/" className={s.back}>
          <ArrowLeft size={15} aria-hidden="true" />
          Volver a Stridely
        </Link>

        <h1 className={s.title}>Términos y Condiciones</h1>
        <p className={s.updated}>Última actualización: 15 de abril de 2026</p>

        <section className={s.section}>
          <h2>1. Aceptación de los términos</h2>
          <p>
            Al acceder y usar Stridely, aceptas quedar vinculado por estos Términos y Condiciones y nuestra{' '}
            <Link href="/privacidad">Política de Privacidad</Link>. Si no estás de acuerdo con alguno de estos
            términos, no debes usar el servicio.
          </p>
        </section>

        <section className={s.section}>
          <h2>2. Descripción del servicio</h2>
          <p>
            Stridely es una aplicación web de entrenamiento deportivo que genera planes de carrera personalizados
            mediante inteligencia artificial, basándose en el historial de actividades del usuario importado desde Strava.
          </p>
          <p>
            El servicio se ofrece en modalidad <strong>gratuita</strong> durante la fase beta. Stridely se reserva
            el derecho de introducir un modelo de suscripción en el futuro, comunicándolo con antelación suficiente.
          </p>
        </section>

        <section className={s.section}>
          <h2>3. Registro y cuenta de usuario</h2>
          <ul>
            <li>Debes tener al menos 16 años para crear una cuenta en Stridely.</li>
            <li>Eres responsable de mantener la confidencialidad de tus credenciales de acceso.</li>
            <li>Debes proporcionar información veraz y actualizada durante el registro.</li>
            <li>Notifica inmediatamente a <a href="mailto:privacy@stridely.app">privacy@stridely.app</a> ante cualquier uso no autorizado de tu cuenta.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2>4. Uso aceptable</h2>
          <p>Al usar Stridely te comprometes a:</p>
          <ul>
            <li>No usar el servicio para fines ilegales o no autorizados.</li>
            <li>No intentar acceder a datos de otros usuarios.</li>
            <li>No realizar ingeniería inversa, descompilar ni copiar el software.</li>
            <li>No usar sistemas automatizados (bots, scrapers) para acceder al servicio sin autorización escrita.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2>5. Contenido generado por IA</h2>
          <p>
            Los planes de entrenamiento generados por Stridely son recomendaciones automatizadas basadas en tus datos
            de actividad. <strong>No sustituyen el consejo médico ni el de un entrenador certificado.</strong>
          </p>
          <p>
            Stridely no se hace responsable de lesiones u otros daños derivados de seguir los planes de entrenamiento
            sin consultar previamente a un profesional de la salud o del deporte.
          </p>
        </section>

        <section className={s.section}>
          <h2>6. Propiedad intelectual</h2>
          <p>
            Todo el contenido de Stridely — incluyendo el software, diseño, textos, logotipos e interfaces —
            es propiedad exclusiva de Stridely o sus licenciantes. Queda prohibida su reproducción, distribución
            o modificación sin autorización expresa y por escrito.
          </p>
        </section>

        <section className={s.section}>
          <h2>7. Integración con Strava</h2>
          <p>
            Stridely utiliza la API de Strava para importar tus actividades. Al conectar tu cuenta de Strava,
            aceptas también los{' '}
            <a href="https://www.strava.com/legal/terms" target="_blank" rel="noopener noreferrer">
              Términos de Servicio de Strava
            </a>
            . Stridely no es afiliado ni está respaldado por Strava.
          </p>
        </section>

        <section className={s.section}>
          <h2>8. Disponibilidad del servicio</h2>
          <p>
            Stridely se ofrece "tal cual" durante la fase beta. No garantizamos disponibilidad ininterrumpida
            y nos reservamos el derecho de modificar, suspender o interrumpir el servicio en cualquier momento,
            con o sin previo aviso.
          </p>
        </section>

        <section className={s.section}>
          <h2>9. Limitación de responsabilidad</h2>
          <p>
            En la medida permitida por la ley, Stridely no será responsable de pérdida de datos, lucro cesante,
            daños indirectos o consecuentes derivados del uso o la imposibilidad de uso del servicio.
          </p>
        </section>

        <section className={s.section}>
          <h2>10. Cancelación de cuenta</h2>
          <p>
            Puedes cancelar tu cuenta en cualquier momento desde el perfil de la aplicación o enviando un email
            a <a href="mailto:privacy@stridely.app">privacy@stridely.app</a>. Tras la cancelación, tus datos
            serán eliminados conforme a lo indicado en nuestra{' '}
            <Link href="/privacidad">Política de Privacidad</Link>.
          </p>
        </section>

        <section className={s.section}>
          <h2>11. Legislación aplicable</h2>
          <p>
            Estos términos se rigen por la legislación española. Cualquier disputa se someterá a los tribunales
            competentes de España, salvo que la normativa de consumo aplicable establezca otra jurisdicción.
          </p>
        </section>

        <section className={s.section}>
          <h2>12. Contacto</h2>
          <p>
            Para cualquier consulta sobre estos términos, escríbenos a{' '}
            <a href="mailto:privacy@stridely.app">privacy@stridely.app</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
