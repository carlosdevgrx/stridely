import Image from 'next/image';
import Link from 'next/link';
import HeroGrid from '@/components/HeroGrid';
import HeroScene from '@/components/HeroScene';
import s from './page.module.scss';

const APP_URL = 'https://stridely-khaki.vercel.app';

export default function Home() {
  return (
    <>
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
        <Link href={`${APP_URL}/register`} className={s.header__cta}>
          Empieza gratis
        </Link>
      </header>

      {/* ── Floating pill nav: fades in on scroll ── */}
      <div className={s.navPill} data-hero-pill>
        <Link href="#features" className={s.navPill__link}>Funcionalidades</Link>
        <Link href="#how" className={s.navPill__link}>Cómo funciona</Link>
        <Link href="#contact" className={s.navPill__link}>Contacto</Link>
        <Link href={`${APP_URL}/login`} className={s.navPill__link}>Iniciar sesión</Link>
        <Link href={`${APP_URL}/register`} className={s.navPill__cta}>Empieza gratis</Link>
      </div>

      {/* ── Hero ── */}
      <main>
        <div className={s.heroWrapper} data-hero-wrapper>
          <HeroGrid />
          <div className={s['hero__bg-img']} />
          <HeroScene />
        </div>

        {/* ── S1: Feature split — Plan IA ── */}
        <section id="features" className={s.feature}>
          <div className={s.feature__text}>
            <span className={s.feature__eyebrow}>✦ Inteligencia artificial</span>
            <h2 className={s.feature__title}>
              Un plan diseñado<br /><span>solo para ti.</span>
            </h2>
            <p className={s.feature__body}>
              La IA analiza tu historial de Strava — tus ritmos, distancias, días de descanso —
              y construye un plan de entrenamiento adaptado a tu nivel real, no al nivel que crees tener.
            </p>
            <ul className={s.feature__list}>
              <li>Adaptación semanal según tu progreso</li>
              <li>Carga de entrenamiento progresiva y segura</li>
              <li>Alertas de sobreentrenamiento</li>
              <li>Sesiones de rodaje, series y recuperación</li>
            </ul>
            <Link href={`${APP_URL}/register`} className={s.feature__cta}>
              Genera tu plan gratis
            </Link>
          </div>
          <div className={s.feature__visual}>
            <div className={s.feature__phoneWrap}>
              <Image
                src="/IMG_0700.jpg"
                alt="Plan de entrenamiento personalizado en Stridely"
                width={300}
                height={648}
                className={s.feature__phone}
              />
              <div className={s.feature__phoneBadge}>
                <span className={s.feature__phoneBadgeIcon}>🏆</span>
                <div>
                  <strong>Plan activo</strong>
                  <span>Maratón · 16 semanas</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── S2: Distancias — 4 cards ── */}
        <section id="distances" className={s.distances}>
          <div className={s.distances__header}>
            <span className={s.distances__eyebrow}>✦ Elige tu objetivo</span>
            <h2 className={s.distances__title}>Para cada carrera,<br /><span>un plan diferente.</span></h2>
            <p className={s.distances__sub}>
              Desde tu primer 5K hasta cruzar la meta de una maratón. Stridely te prepara para la distancia que elijas.
            </p>
          </div>
          <div className={s.distances__grid}>
            {[
              { dist: '5K',       weeks: '6–8 semanas',   desc: 'Ideal para empezar. Construye base aeróbica y termina fuerte.',       icon: '🏃' },
              { dist: '10K',      weeks: '8–10 semanas',  desc: 'Da el siguiente paso. Más velocidad, más resistencia.',               icon: '⚡' },
              { dist: 'Media',    weeks: '10–14 semanas', desc: '21 km que pondrán a prueba tu constancia y tu estrategia.',           icon: '🎯' },
              { dist: 'Maratón',  weeks: '16–20 semanas', desc: '42 km. El plan más exigente, con cada kilómetro planificado.',        icon: '🏅' },
            ].map(({ dist, weeks, desc, icon }) => (
              <div key={dist} className={s.distances__card}>
                <span className={s.distances__cardIcon}>{icon}</span>
                <h3 className={s.distances__cardDist}>{dist}</h3>
                <span className={s.distances__cardWeeks}>{weeks}</span>
                <p className={s.distances__cardDesc}>{desc}</p>
                <Link href={`${APP_URL}/register`} className={s.distances__cardCta}>
                  Empieza gratis →
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── S3: Full-bleed runner stat ── */}
        <section id="social-proof" className={s.bleed}>
          <div className={s.bleed__overlay} />
          <div className={s.bleed__content}>
            <p className={s.bleed__num}>+12.000</p>
            <p className={s.bleed__label}>corredores ya entrenan con inteligencia</p>
            <Link href={`${APP_URL}/register`} className={s.bleed__cta}>
              Únete ahora
            </Link>
          </div>
        </section>

        {/* ── S4: Cómo funciona ── */}
        <section id="how" className={s.how}>
          <div className={s.how__header}>
            <span className={s.how__eyebrow}>✦ Cómo funciona</span>
            <h2 className={s.how__title}>En tres pasos,<br /><span>listo para correr.</span></h2>
          </div>
          <div className={s.how__steps}>
            {[
              { n: '01', title: 'Conecta Strava',          body: 'Autoriza el acceso en un clic. Importamos tu historial completo de actividades automáticamente.' },
              { n: '02', title: 'La IA te analiza',         body: 'Nuestro modelo estudia tus ritmos, volumen, consistencia y fatiga acumulada para conocerte de verdad.' },
              { n: '03', title: 'Recibe tu plan',           body: 'En segundos tienes un calendario semanal con cada sesión detallada. Se actualiza solo según avanzas.' },
            ].map(({ n, title, body }) => (
              <div key={n} className={s.how__step}>
                <span className={s.how__stepNum}>{n}</span>
                <h3 className={s.how__stepTitle}>{title}</h3>
                <p className={s.how__stepBody}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── S5: CTA final ── */}
        <section id="contact" className={s.finalCta}>
          <div className={s.finalCta__glow} />
          <span className={s.finalCta__eyebrow}>✦ Empieza hoy</span>
          <h2 className={s.finalCta__title}>Deja de improvisar.<br />Entrena con un plan.</h2>
          <p className={s.finalCta__sub}>Gratis. Sin tarjeta de crédito. Listo en 2 minutos.</p>
          <Link href={`${APP_URL}/register`} className={s.finalCta__cta}>
            Conecta con Strava y empieza →
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
            <Link href={`${APP_URL}/register`} className={s.footer__cta}>
              Empieza gratis
            </Link>
          </div>

          {/* Link columns */}
          <div className={s.footer__cols}>
            <div className={s.footer__col}>
              <h3 className={s.footer__colTitle}>Producto</h3>
              <Link href="#" className={s.footer__colLink}>Funcionalidades</Link>
              <Link href="#" className={s.footer__colLink}>Cómo funciona</Link>
              <Link href="#" className={s.footer__colLink}>Precios</Link>
              <Link href="#" className={s.footer__colLink}>Actualizaciones</Link>
            </div>
            <div className={s.footer__col}>
              <h3 className={s.footer__colTitle}>Comunidad</h3>
              <Link href="#" className={s.footer__colLink}>Instagram</Link>
              <Link href="#" className={s.footer__colLink}>Strava Club</Link>
              <Link href="#" className={s.footer__colLink}>Blog</Link>
              <Link href="#" className={s.footer__colLink}>Embajadores</Link>
            </div>
            <div className={s.footer__col}>
              <h3 className={s.footer__colTitle}>Soporte</h3>
              <Link href="#" className={s.footer__colLink}>Centro de ayuda</Link>
              <Link href="#" className={s.footer__colLink}>FAQ</Link>
              <Link href="#" className={s.footer__colLink}>Contacto</Link>
              <Link href="#" className={s.footer__colLink}>Estado del servicio</Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className={s.footer__bottom}>
          <span>© 2026 Stridely. Todos los derechos reservados.</span>
          <div className={s.footer__legal}>
            <Link href="#">Términos</Link>
            <Link href="#">Privacidad</Link>
            <Link href="#">Cookies</Link>
          </div>
        </div>

      </footer>
    </>
  );
}

