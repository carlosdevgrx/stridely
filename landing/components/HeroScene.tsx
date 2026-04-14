'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import s from './HeroScene.module.scss';

const APP_URL = 'https://stridely-khaki.vercel.app';

// Side column width — keep in sync with CSS var --side-w
const SIDE_W = 72;
// Height of the top bar
const TOP_H  = 64;

export default function HeroScene() {
  const frameRef  = useRef<HTMLDivElement>(null); // single unified frame
  const phoneRef  = useRef<HTMLDivElement>(null);
  const floatsRef = useRef<HTMLDivElement>(null);
  const ticking   = useRef(false);

  useEffect(() => {
    const headerEl = document.querySelector('[data-hero-header]') as HTMLElement | null;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const progress = Math.min(window.scrollY / (window.innerHeight * 0.65), 1);

        // ── Frame fades out ───────────────────────────────────────────────────
        if (frameRef.current) {
          const op = Math.max(0, 1 - progress * 1.8);
          frameRef.current.style.opacity      = `${op}`;
          frameRef.current.style.pointerEvents = op < 0.1 ? 'none' : 'auto';
          // content area grows: shrink the side insets toward 0
          const sideW = Math.max(0, SIDE_W * (1 - progress * 1.4));
          frameRef.current.style.setProperty('--side-w', `${sideW}px`);
        }

        // ── Outer header fades in ─────────────────────────────────────────────
        if (headerEl) {
          const op = Math.min(1, Math.max(0, (progress - 0.45) / 0.55));
          headerEl.style.opacity      = `${op}`;
          headerEl.style.pointerEvents = op > 0.1 ? 'auto' : 'none';
        }

        // ── Phone grows ───────────────────────────────────────────────────────
        if (phoneRef.current) {
          const scale = 0.88 + progress * 0.12;
          phoneRef.current.style.transform = `scale(${scale}) translateY(${-progress * 20}px)`;
        }

        // ── Floats fade ───────────────────────────────────────────────────────
        if (floatsRef.current) {
          floatsRef.current.style.opacity = `${Math.max(0, 1 - progress * 2.5)}`;
        }

        ticking.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className={s.scene}>

      {/*
        Single fixed frame element.
        CSS draws it as a "U" shape around the viewport using box-shadow + clip-path.
        --side-w is a CSS custom property updated by JS on scroll to shrink sides.
      */}
      <div className={s.frame} ref={frameRef}>
        {/* Logo + CTA live inside the top bar zone */}
        <div className={s.frame__topbar}>
          <Image
            src="/logo-corporativo.svg"
            alt="Stridely"
            width={108}
            height={28}
            priority
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <Link href={`${APP_URL}/register`} className={s['btn--cta']}>
            Empieza gratis
          </Link>
        </div>
      </div>

      {/* ── Text content ── */}
      <div className={s.content}>
        <span className={s.content__eyebrow}>✦ Tu plan de carrera personalizado</span>
        <h1 className={s.content__title}>
          Corre más lejos.<br />
          <span>Entrena con inteligencia.</span>
        </h1>
        <p className={s.content__subtitle}>
          Stridely crea planes de carrera personalizados basados en tu historial de Strava.
          Tu coach de IA te guía cada día.
        </p>
      </div>

      {/* ── Phone stage — phone bottom overflows viewport ── */}
      <div className={s.phoneStage}>
        {/* Floating cards */}
        <div className={s.floats} ref={floatsRef}>
          <div className={`${s.float} ${s['float--tl']}`}>
            <span className={s.float__icon}>🔗</span>
            <div className={s.float__text}>
              <strong>Conecta Strava</strong>
              <span>Sincroniza tus carreras</span>
            </div>
          </div>
          <div className={`${s.float} ${s['float--tr']}`}>
            <span className={s.float__icon}>📍</span>
            <div className={s.float__text}>
              <strong>38.2 km</strong>
              <span>Esta semana</span>
            </div>
          </div>
          <div className={`${s.float} ${s['float--bl']}`}>
            <span className={s.float__icon}>✦</span>
            <div className={s.float__text}>
              <strong>Coach IA</strong>
              <span>Guía diaria personalizada</span>
            </div>
          </div>
          <div className={`${s.float} ${s['float--br']}`}>
            <span className={s.float__icon}>📱</span>
            <div className={s.float__text}>
              <strong>PWA · iPhone</strong>
              <span>Sin App Store</span>
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className={s.phone} ref={phoneRef}>
          <Image
            src="/IMG_0700.jpg"
            alt="Stridely app – Dashboard"
            width={390}
            height={844}
            className={s.phone__img}
            priority
          />
          <div className={s.phone__fade} />
        </div>
      </div>

    </section>
  );
}

