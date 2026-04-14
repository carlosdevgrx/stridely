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

        {/* ── Sections placeholder (to enable scroll) ── */}
        <section id="features" className={s.section}>
          <p style={{ color: '#adb5bd', textAlign: 'center' }}>Funcionalidades — próximamente</p>
        </section>
        <section id="how" className={s.section}>
          <p style={{ color: '#adb5bd', textAlign: 'center' }}>Cómo funciona — próximamente</p>
        </section>
        <section id="contact" className={s.section}>
          <p style={{ color: '#adb5bd', textAlign: 'center' }}>Contacto — próximamente</p>
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

