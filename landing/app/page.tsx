import Image from 'next/image';
import Link from 'next/link';
import HeroGrid from '@/components/HeroGrid';
import s from './page.module.scss';

const APP_URL = 'https://stridely-khaki.vercel.app';

export default function Home() {
  return (
    <>
      {/* ── Header ── */}
      <header className={s.header}>
        <Image
          src="/logo-corporativo.svg"
          alt="Stridely"
          width={110}
          height={28}
          className={s.header__logo}
          priority
        />
        <nav className={s.header__nav}>
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
        <section className={s.hero}>
          <HeroGrid />
          <div className={s['hero__bg-img']} />
          <span className={s.hero__eyebrow}>
            ✦ Tu plan de carrera personalizado
          </span>

          <h1 className={s.hero__title}>
            Corre más lejos.<br />
            <span>Entrena con inteligencia.</span>
          </h1>

          <p className={s.hero__subtitle}>
            Stridely crea planes de carrera personalizados basados en tu historial de Strava.
            Tu coach de IA te guía cada día — sin adivinanzas, sin excusas.
          </p>

          <div className={s.hero__actions}>
            <Link href={`${APP_URL}/register`} className={`${s.hero__btn} ${s['hero__btn--primary']}`}>
              Empieza gratis →
            </Link>
            <Link href={`${APP_URL}/login`} className={`${s.hero__btn} ${s['hero__btn--ghost']}`}>
              Ya tengo cuenta
            </Link>
          </div>

          <div className={s.hero__meta}>
            <div className={s.hero__badge}>
              <span className={s['hero__badge-dot']} />
              Conecta con Strava
            </div>
            <div className={s.hero__divider} />
            <div className={s.hero__badge}>
              Planes adaptados a ti
            </div>
            <div className={s.hero__divider} />
            <div className={s.hero__badge}>
              PWA — funciona en iPhone
            </div>
          </div>

          {/* App mockup — real screenshot */}
          <div className={s.hero__mockup}>
            <div className={s['hero__mockup-phone']}>
              <Image
                src="/IMG_0700.jpg"
                alt="Stridely app – Dashboard"
                width={390}
                height={844}
                className={s['hero__mockup-img']}
                priority
              />
              <div className={s['hero__mockup-fade']} />
            </div>
          </div>
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
