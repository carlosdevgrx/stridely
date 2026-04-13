import Image from 'next/image';
import Link from 'next/link';
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
          <span className={s.hero__eyebrow}>
            ✦ Entrenamiento con IA
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

          {/* App mockup */}
          <div className={s.hero__mockup}>
            <div className={s['hero__mockup-frame']}>
              <div className={`${s['hero__mockup-row']} ${s['hero__mockup-row--header']}`}>
                <div className={s['hero__mockup-avatar']} />
                <div className={s['hero__mockup-text']}>
                  <strong>Semana 4 · Plan 10K</strong>
                  <span>Objetivo: 45:00 min</span>
                </div>
                <span className={s['hero__mockup-pill']}>En forma ↑</span>
              </div>

              <div className={s['hero__mockup-row']}>
                <div className={s['hero__mockup-stat']}>
                  <strong>38.2</strong>
                  <span>km esta semana</span>
                </div>
                <div className={s['hero__mockup-stat']}>
                  <strong>5:12</strong>
                  <span>ritmo medio</span>
                </div>
                <div className={s['hero__mockup-stat']}>
                  <strong>6</strong>
                  <span>sesiones</span>
                </div>
              </div>

              <div className={s['hero__mockup-message']}>
                Hoy toca rodaje suave de 8 km a ritmo 5:45. Tu carga de la semana pasada fue alta — este ritmo es deliberado. Confía en el proceso.
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className={s.footer}>
        <span className={s.footer__copy}>© 2026 Stridely</span>
        <div className={s.footer__links}>
          <Link href="/privacy">Privacidad</Link>
          <Link href={`${APP_URL}/login`}>Acceder</Link>
        </div>
      </footer>
    </>
  );
}
