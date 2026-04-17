import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import HeroGrid from '@/components/HeroGrid';
import HeroScene from '@/components/HeroScene';
import MobileNav from '@/components/MobileNav';
import s from './page.module.scss';

const APP_URL = 'https://stridely-khaki.vercel.app';
const SITE_URL = 'https://stridely-khaki.vercel.app';

export default function Home() {
  return (
    <>
      {/*
        LCP hint: running-hero.jpg es el elemento más grande en el viewport
        (background-image del .bleed). Los background-image no reciben preload
        automático — este <link> lo fuerza y mejora directamente el LCP score.
      */}
      <link
        rel="preload"
        as="image"
        href="/running-hero.jpg"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ fetchPriority: 'high' } as any)}
      />
      {/* ── Initial header: logo + CTA, fades out on scroll ── */}
      <header className={s.header} data-hero-header>
        <Image
          src="/logo-corporativo.svg"
          alt="Stridely"
          width={110}
          height={28}
          className={s.header__logo}
          priority
        />
            <Link href={`${APP_URL}/register`} className={s.header__cta} aria-label="Empieza gratis con Stridely">
          Empieza gratis
        </Link>
      </header>

      {/* ── Mobile nav: logo + hamburger (visible only ≤840px) ── */}
      <MobileNav />

      {/* ── Floating pill nav: fades in on scroll (desktop only) ── */}
      <nav className={s.navPill} data-hero-pill aria-label="Navegación principal">
        <Link href="#features" className={s.navPill__link}>Funcionalidades</Link>
        <Link href="#distances" className={s.navPill__link}>Distancias</Link>
        <Link href="#how" className={s.navPill__link}>Cómo funciona</Link>
        <Link href="/contacto" className={s.navPill__link}>Contacto</Link>
        <Link href={`${APP_URL}/login`} className={s.navPill__link}>Iniciar sesión</Link>
        <Link href={`${APP_URL}/register`} className={s.navPill__cta}>Empieza gratis</Link>
      </nav>

      {/* ── Hero ── */}
      <main>
        <div className={s.heroWrapper} data-hero-wrapper>
          <HeroGrid />
          <div className={s['hero__bg-img']} />
          <HeroScene />
        </div>

        {/* ── S1: Feature split — Plan IA ── */}
        <section id="features" className={s.feature}>

          {/* Left: text */}
          <div className={s.feature__text}>
            <span className={s.feature__eyebrow} aria-label="Tu plan de carrera">Tu plan de carrera</span>
            <h2 className={s.feature__title}>
              Entrena como<br /><span>nunca antes.</span>
            </h2>
            <p className={s.feature__body}>
              La IA analiza tu historial de Strava — ritmos, distancias,
              descansos — y construye un plan adaptado a tu nivel real,
              no al que crees tener.
            </p>
            <ul className={s.feature__list}>
              <li>Adaptación semanal según tu progreso</li>
              <li>Carga progresiva y segura</li>
              <li>Alertas de sobreentrenamiento</li>
              <li>Rodajes, series y recuperación detallados</li>
            </ul>
            <Link href={`${APP_URL}/register`} className={s.feature__cta}>
              Genera tu plan gratis
            </Link>
          </div>

          {/* Center: phone */}
          <div className={s.feature__center}>
            <div className={s.feature__phoneWrap}>
              <Image
                src="/strider.png"
                // Keyword principal en alt: ayuda a Google Images y refuerza relevancia temática
                alt="Plan de entrenamiento running personalizado con IA en Stridely"
                width={320}
                height={692}
                className={s.feature__phone}
              />
            </div>
          </div>

          {/* Right: floating insight card */}
          <div className={s.feature__aside}>
            <div className={s.feature__insightCard}>
              <span className={s.feature__insightEmoji} aria-hidden="true">🎯</span>
              <p className={s.feature__insightText}>
                Cada sesión tiene un propósito.
                Cada kilómetro, una razón.
              </p>
            </div>
          </div>

        </section>

        {/* ── S2: Distancias — 4 cards ── */}
        <section id="distances" className={s.distances}>
          <div className={s.distances__header}>
            <span className={s.distances__eyebrow}><span aria-hidden="true">✦ </span>Elige tu objetivo</span>
            <h2 className={s.distances__title}>Para cada carrera,<br /><span>un plan diferente.</span></h2>
            <p className={s.distances__sub}>
              Desde tu primer 5K hasta cruzar la meta de una maratón. Stridely te prepara para la distancia que elijas.
            </p>
          </div>
          <div className={s.distances__grid}>
            {[
              { dist: '5K',      weeks: '6–8 semanas',   desc: 'Ideal para empezar. Construye base aeróbica y termina fuerte.',     img: 'https://images.unsplash.com/photo-1461897104016-0b3b00cc81ee?w=800&q=80' },
              { dist: '10K',     weeks: '8–10 semanas',  desc: 'Da el siguiente paso. Más velocidad, más resistencia.',             img: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80' },
              { dist: 'Media',   weeks: '10–14 semanas', desc: '21 km que pondrán a prueba tu constancia y tu estrategia.',         img: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=80' },
              { dist: 'Maratón', weeks: '16–20 semanas', desc: '42 km. El plan más exigente, con cada kilómetro planificado.',      img: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&q=80' },
            ].map(({ dist, weeks, desc, img }) => (
              <div key={dist} className={s.distances__card} style={{ backgroundImage: `url(${img})` }}>
                <div className={s.distances__cardOverlay} />
                <div className={s.distances__cardBody}>
                  <h3 className={s.distances__cardDist}>{dist}</h3>
                  <span className={s.distances__cardWeeks}>{weeks}</span>
                  <p className={s.distances__cardDesc}>{desc}</p>
                  <Link href={`${APP_URL}/register`} className={s.distances__cardCta} aria-label={`Empieza gratis con el plan ${dist}`}>
                    Empieza gratis <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── S3: Full-bleed manifesto ── */}
        <section id="social-proof" className={s.bleed}>
          <div className={s.bleed__overlay} />
          <div className={s.bleed__content}>
            <p className={s.bleed__eyebrowText}>Hecho para corredores reales</p>
            <h2 className={s.bleed__num}>Deja de improvisar.</h2>
            <p className={s.bleed__label}>
              Un plan de IA basado en tu historial real de Strava.
              No en promedios. En ti.
            </p>
            <Link href={`${APP_URL}/register`} className={s.bleed__cta} aria-label="Empieza gratis con Stridely">
              Empieza gratis
            </Link>
          </div>
        </section>

        {/* ── S4: Cómo funciona ── */}
        <section id="how" className={s.how}>
          <div className={s.how__header}>
            <span className={s.how__eyebrow}><span aria-hidden="true">✦ </span>Cómo funciona</span>
            <h2 className={s.how__title}>En tres pasos,<br /><span>listo para correr.</span></h2>
          </div>
          <div className={s.how__steps}>
            {[
              { n: '01', title: 'Conecta Strava',          body: 'Autoriza el acceso en un clic. Importamos tu historial completo de actividades automáticamente.' },
              { n: '02', title: 'La IA te analiza',         body: 'Nuestro modelo estudia tus ritmos, volumen, consistencia y fatiga acumulada para conocerte de verdad.' },
              { n: '03', title: 'Recibe tu plan',           body: 'En segundos tienes un calendario semanal con cada sesión detallada. Se actualiza solo según avanzas.' },
            ].map(({ n, title, body }) => (
              <div key={n} className={s.how__step}>
                <span className={s.how__stepNum} aria-hidden="true">{n}</span>
                <h3 className={s.how__stepTitle}>{title}</h3>
                <p className={s.how__stepBody}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── S5: CTA final ── */}
        <section id="contact" className={s.finalCta}>
          <div className={s.finalCta__glow} aria-hidden="true" />
          <span className={s.finalCta__eyebrow}><span aria-hidden="true">✦ </span>Empieza hoy</span>
          <h2 className={s.finalCta__title}>Deja de improvisar.<br />Entrena con un plan.</h2>
          <p className={s.finalCta__sub}>Gratis. Sin tarjeta de crédito. Listo en 2 minutos.</p>
          <Link href={`${APP_URL}/register`} className={s.finalCta__cta}>
            Conecta con Strava y empieza <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className={s.footer}>

        {/* Marquee strip */}
        <div className={s.footer__marqueeWrap} aria-hidden="true">
          <div className={s.footer__marqueeTrack}>
            {[...Array(6)].map((_, i) => (
              <span key={i} className={s.footer__marqueeItem}>
                Corre más lejos · Entrena con inteligencia · Tu coach de IA ·&nbsp;
              </span>
            ))}
          </div>
        </div>

        {/* Main footer content */}
        <div className={s.footer__inner}>

          {/* Brand col */}
          <div className={s.footer__brand}>
            <Image
              src="/logo-corporativo.svg"
              alt="Stridely"
              width={110}
              height={28}
              className={s.footer__logo}
            />
            <p className={s.footer__tagline}>
              Entrena más inteligente.<br />Corre más lejos.
            </p>
            <Link href={`${APP_URL}/register`} className={s.footer__cta} aria-label="Empieza gratis con Stridely">
              Empieza gratis
            </Link>
          </div>

          {/* Link columns */}
          <div className={s.footer__cols}>
            <div className={s.footer__col}>
              <h3 className={s.footer__colTitle}>Producto</h3>
              <Link href="#features" className={s.footer__colLink}>Funcionalidades</Link>
              <Link href="#distances" className={s.footer__colLink}>Distancias</Link>
              <Link href="#how" className={s.footer__colLink}>Cómo funciona</Link>
              <Link href="#contact" className={s.footer__colLink}>Únete gratis</Link>
            </div>
            <div className={s.footer__col}>
              <h3 className={s.footer__colTitle}>Comunidad</h3>
              <Link href="https://www.instagram.com/stridelyapp" target="_blank" rel="noopener noreferrer" className={s.footer__colLink}>Instagram</Link>
              <Link href="https://www.strava.com/clubs" target="_blank" rel="noopener noreferrer" className={s.footer__colLink}>Strava Club</Link>
              {/* href="#" temporales: cuando existan las páginas, reemplazar por rutas reales */}
              <Link href="#" className={s.footer__colLink} aria-disabled="true">Blog</Link>
              <Link href="#" className={s.footer__colLink} aria-disabled="true">Embajadores</Link>
            </div>
            <div className={s.footer__col}>
              <h3 className={s.footer__colTitle}>Soporte</h3>
              <Link href="/contacto" className={s.footer__colLink}>Contacto</Link>
              <Link href="/faq" className={s.footer__colLink}>FAQ</Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className={s.footer__bottom}>
          <span>© 2026 Stridely. Todos los derechos reservados.</span>
          <div className={s.footer__legal}>
            <Link href="/terminos" className={s.footer__colLink}>Términos</Link>
            <Link href="/privacidad" className={s.footer__colLink}>Privacidad</Link>
            <Link href="/cookies" className={s.footer__colLink}>Cookies</Link>
          </div>
        </div>

      </footer>
    </>
  );
}

