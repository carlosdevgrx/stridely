'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import s from './MobileNav.module.scss';

const APP_URL = 'https://app.stridelyapp.com';

const NAV_LINKS = [
  { label: 'Funcionalidades', href: '#features' },
  { label: 'Cómo funciona',   href: '#how'      },
  { label: 'Distancias',      href: '#distances' },
  { label: 'Contacto',        href: '#contact'   },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  // No body scroll lock needed — menu panel uses overscroll-behavior: contain
  // Body overflow manipulation breaks position:fixed on iOS Safari

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={s.nav} role="navigation" aria-label="Menú principal">
      {/* ── Fixed top bar ── */}
      <div className={s.nav__bar}>
        <Link href="/" className={s.nav__logoLink} onClick={close} aria-label="Stridely inicio">
          <Image
            src="/logo-corporativo.svg"
            alt="Stridely"
            width={96}
            height={24}
            className={s.nav__logo}
            priority
          />
        </Link>

        <button
          className={`${s.nav__burger} ${open ? s['nav__burger--open'] : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        >
          {/* 2×2 dot grid */}
          <span className={s.nav__dots}>
            <span className={s.nav__dot} />
            <span className={s.nav__dot} />
            <span className={s.nav__dot} />
            <span className={s.nav__dot} />
          </span>
        </button>
      </div>

      {/* ── Backdrop ── */}
      <div
        className={`${s.nav__backdrop} ${open ? s['nav__backdrop--open'] : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* ── Menu panel ── */}
      <nav
        id="mobile-menu"
        className={`${s.nav__menu} ${open ? s['nav__menu--open'] : ''}`}
        aria-hidden={!open}
      >
        <ul className={s.nav__list}>
          {NAV_LINKS.map(({ label, href }, i) => (
            <li
              key={href}
              className={s.nav__item}
              style={{ '--i': i } as React.CSSProperties}
            >
              <Link href={href} className={s.nav__link} onClick={close}>
                <span className={s.nav__linkNum}>0{i + 1}</span>
                <span className={s.nav__linkLabel}>{label}</span>
                <span className={s.nav__linkArrow} aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className={s.nav__actions}>
          <Link href={`${APP_URL}/login`} className={s.nav__login} onClick={close}>
            Iniciar sesión
          </Link>
          <Link href={`${APP_URL}/register`} className={s.nav__cta} onClick={close}>
            Empieza gratis
          </Link>
        </div>
      </nav>
    </div>
  );
}
