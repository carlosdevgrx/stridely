import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import s from './faq.module.scss';
import FaqAccordion from './FaqAccordion';

export const metadata: Metadata = {
  title: 'Preguntas Frecuentes — Stridely',
  description: '¿Necesitas Strava? ¿Es gratis? ¿Cómo funciona la IA? Resolvemos todas las dudas sobre Stridely, el coach de running con inteligencia artificial.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'FAQ — Preguntas frecuentes sobre Stridely',
    description: 'Resolvemos todas las dudas sobre el coach de running con IA.',
  },
};

const APP_URL = 'https://app.stridelyapp.com';

// ─── Contenido de las FAQs ────────────────────────────────────────────────────
// Definido como datos planos para poder reutilizarlo en el JSON-LD Schema
const faqGroups = [
  {
    title: 'El servicio',
    items: [
      {
        q: '¿Qué es Stridely?',
        a: 'Stridely es una aplicación web que actúa como tu coach de running personal con inteligencia artificial. Analiza tu historial real de entrenamientos en Strava y genera un plan de carrera personalizado, semana a semana, adaptado a tu nivel, tus objetivos y tu disponibilidad.',
      },
      {
        q: '¿Es Stridely gratuito?',
        a: 'Sí, Stridely es completamente gratuito durante la fase beta. No necesitas tarjeta de crédito. Si en el futuro se introduce un modelo de suscripción, te lo comunicaremos con antelación suficiente.',
      },
      {
        q: '¿En qué se diferencia Stridely de otros planes de entrenamiento?',
        a: 'La mayoría de planes de entrenamiento son genéricos (semanas tipo "corre 3 veces por semana"). Stridely parte de tu historial real — tus ritmos, volumen semanal, días de descanso y fatiga acumulada — para construir un plan que refleja cómo eres tú, no un runner promedio. Además, el plan se actualiza solo a medida que avanzas.',
      },
    ],
  },
  {
    title: 'Strava y conexión',
    items: [
      {
        q: '¿Necesito una cuenta de Strava para usar Stridely?',
        a: 'Sí. Strava es el origen de tus datos de entrenamiento. Stridely necesita acceder a tu historial de actividades para que la IA pueda analizarte correctamente. La conexión se realiza mediante OAuth (autorización oficial de Strava), de forma segura y sin que Stridely conozca tu contraseña de Strava.',
      },
      {
        q: '¿Puedo usar Stridely si llevo poco tiempo corriendo o no tengo historial?',
        a: 'Sí. Con pocas actividades la IA tiene menos contexto, pero genera igualmente un plan adaptado a lo que sí tiene. Cuantas más actividades sincronices, más preciso y personalizado será el plan.',
      },
      {
        q: '¿Qué datos de Strava utiliza Stridely?',
        a: 'Stridely importa tus actividades de carrera: distancia, duración, ritmo, frecuencia cardíaca (si la registras), desnivel y cadencia. No accede a tu feed social, segmentos de otros usuarios ni datos de pago de Strava.',
      },
    ],
  },
  {
    title: 'Los planes de entrenamiento',
    items: [
      {
        q: '¿Para qué distancias puedo entrenar con Stridely?',
        a: 'Actualmente Stridely genera planes para 5K (6–8 semanas), 10K (8–10 semanas), media maratón (10–14 semanas) y maratón (16–20 semanas). Cada plan tiene una progresión de carga diferente adaptada a las exigencias de cada distancia.',
      },
      {
        q: '¿Con qué frecuencia se actualiza mi plan?',
        a: 'El plan se recalcula automáticamente cada semana en función de las actividades que hayas realizado. Si corriste de más, la IA reduce la carga de la siguiente semana. Si te quedaste corto, la ajustará progresivamente para no perder el ritmo.',
      },
      {
        q: '¿El plan incluye solo rodajes o también series y trabajo de calidad?',
        a: 'Cada sesión del plan está detallada: rodajes suaves, series de velocidad, progresivos, tiradas largas y días de recuperación activa. El objetivo es que sepas exactamente qué hacer cada día y por qué.',
      },
    ],
  },
  {
    title: 'Privacidad y seguridad',
    items: [
      {
        q: '¿Están seguros mis datos de Strava?',
        a: 'Sí. Los tokens de acceso de Strava se almacenan cifrados y nunca se comparten con terceros. Stridely cumple con el RGPD. Puedes consultar todos los detalles en nuestra Política de Privacidad.',
      },
      {
        q: '¿Puedo eliminar mi cuenta y todos mis datos?',
        a: 'Sí, en cualquier momento. Puedes solicitar la eliminación desde tu perfil en la app o escribiendo a privacy@stridely.app. Todos tus datos se borran en un plazo máximo de 30 días.',
      },
    ],
  },
  {
    title: 'Técnico',
    items: [
      {
        q: '¿Funciona Stridely en móvil?',
        a: 'Sí. Stridely es una Progressive Web App (PWA): funciona en el navegador de tu teléfono con una experiencia similar a una app nativa. Puedes añadirla a tu pantalla de inicio en iOS y Android.',
      },
      {
        q: '¿Necesito instalar algo?',
        a: 'No. Stridely funciona directamente en el navegador, sin descargas. Si quieres acceso rápido, puedes añadirla a tu pantalla de inicio desde el menú de tu navegador ("Añadir a pantalla de inicio" en iOS Safari o "Instalar aplicación" en Chrome Android).',
      },
    ],
  },
];

// ─── JSON-LD FAQPage ──────────────────────────────────────────────────────────
// Google puede mostrar las preguntas expandibles directamente en los resultados
// de búsqueda (rich snippet), aumentando visibilidad sin coste adicional.
const jsonLdFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqGroups.flatMap(g =>
    g.items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        // El texto plano es lo que indexa Google — sin JSX
        text: typeof item.a === 'string' ? item.a : String(item.a),
      },
    }))
  ),
};

export default function FaqPage() {
  return (
    <main className={s.page}>
      {/* JSON-LD: FAQPage Schema — rich snippets en SERP */}
      <Script
        id="schema-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        strategy="afterInteractive"
      />

      <div className={s.container}>
        <Link href="/" className={s.back}>
          <ArrowLeft size={15} aria-hidden="true" />
          Volver a Stridely
        </Link>

        <header className={s.header}>
          <span className={s.eyebrow}>Preguntas frecuentes</span>
          <h1 className={s.title}>Todo lo que necesitas<br /><span>saber sobre Stridely.</span></h1>
          <p className={s.subtitle}>
            Si no encuentras lo que buscas, escríbenos a{' '}
            <a href="mailto:privacy@stridely.app">privacy@stridely.app</a>.
          </p>
        </header>

        {/* Acordeón — Client Component */}
        <FaqAccordion groups={faqGroups} />

        {/* CTA al final */}
        <div className={s.cta}>
          <div className={s.ctaText}>
            <p>¿Listo para empezar?</p>
            <p>Conecta Strava y ten tu plan en menos de 2 minutos.</p>
          </div>
          <Link href={`${APP_URL}/register`} className={s.ctaLink}>
            Empieza gratis <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
