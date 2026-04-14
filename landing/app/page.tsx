import Image from 'next/image';
import Link from 'next/link';
import HeroGrid from '@/components/HeroGrid';
import HeroScene from '@/components/HeroScene';
import s from './page.module.scss';

const APP_URL = 'https://stridely-khaki.vercel.app';

export default function Home() {
  return (
    <>
      {/* ── Header ── */}
      <header className={s.header} data-hero-header>
        <Image
          src="/logo-corporativo.svg"
          alt="Stridely"
          width={110}
          height={28}
          className={s.header__logo}
          priority
        />
        <nav className={s.header__nav}>
          <Link href="#features" className={s.header__link}>Funcionalidades</Link>
          <Link href="#how" className={s.header__link}>Cómo funciona</Link>
          <Link href="#contact" className={s.header__link}>Contacto</Link>
          <Link href={`${APP_URL}/login`} className={s.header__link}>
            Iniciar sesión
          </Link>
          <Link href={`${APP_URL}/register`} className={s.header__cta}>
            Empieza gratis
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <main>
        <div className={s.heroWrapper}>
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
        <span className={s.footer__copy}>© 2026 Stridely</span>
        <div className={s.footer__links}>
          <Link href={`${APP_URL}/privacy`}>Privacidad</Link>
          <Link href={`${APP_URL}/login`}>Acceder</Link>
        </div>
      </footer>
    </>
  );
}

