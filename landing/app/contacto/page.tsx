import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { FaInstagram, FaGithub } from 'react-icons/fa';
import s from './contact.module.scss';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contacto — Stridely',
  description: 'Escríbenos para soporte técnico, colaboraciones o cualquier duda sobre Stridely, el coach de running con IA.',
  alternates: { canonical: '/contacto' },
  openGraph: {
    title: 'Contacto — Stridely',
    description: 'Escríbenos para soporte, colaboraciones o cualquier pregunta sobre Stridely.',
  },
};

const channels = [
  {
    icon: <Mail size={18} aria-hidden="true" />,
    label: 'Email',
    value: 'hola@stridely.app',
    desc:  'Respondemos en menos de 48h',
    href:  'mailto:hola@stridely.app',
  },
  {
    icon: <FaInstagram size={18} aria-hidden="true" />,
    label: 'Instagram',
    value: '@stridelyapp',
    desc:  'Síguenos y mándanos un DM',
    href:  'https://www.instagram.com/stridelyapp',
  },
  {
    icon: <FaGithub size={18} aria-hidden="true" />,
    label: 'GitHub',
    value: 'github.com/stridely',
    desc:  'Feedback, bugs y sugerencias',
    href:  'https://github.com/stridely',
  },
];

export default function ContactPage() {
  return (
    <main className={s.page}>
      <div className={s.container}>
        <Link href="/" className={s.back}>
          <ArrowLeft size={15} aria-hidden="true" />
          Volver a Stridely
        </Link>

        <div className={s.grid}>

          {/* ── Columna izquierda: información ── */}
          <div className={s.info}>
            <span className={s.eyebrow}>Contáctanos</span>
            <h1 className={s.title}>
              Estamos aquí<br />
              <span>para ayudarte.</span>
            </h1>
            <p className={s.subtitle}>
              ¿Tienes una duda sobre tu plan de entrenamiento, quieres reportar un bug
              o simplemente quieres contarnos tu próxima carrera? Escríbenos.
            </p>

            <div className={s.channels}>
              {channels.map(ch => (
                <a
                  key={ch.label}
                  href={ch.href}
                  className={s.channel}
                  target={ch.href.startsWith('http') ? '_blank' : undefined}
                  rel={ch.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  <div className={s.channel__icon}>{ch.icon}</div>
                  <div className={s.channel__body}>
                    <span className={s.channel__label}>{ch.label}</span>
                    <span className={s.channel__value}>{ch.value}</span>
                    <span className={s.channel__desc}>{ch.desc}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* ── Columna derecha: formulario ── */}
          <div className={s.formCard}>
            <h2 className={s.formTitle}>Envíanos un mensaje</h2>
            <p className={s.formSubtitle}>Te respondemos directamente a tu email.</p>
            <ContactForm />
          </div>

        </div>
      </div>
    </main>
  );
}
