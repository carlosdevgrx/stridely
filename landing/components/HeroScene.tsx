'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import s from './HeroScene.module.scss';

// Must match CSS initial values on .heroWrapper
const MARGIN_H = 24;
const RADIUS   = 20;

export default function HeroScene() {
  const phoneRef  = useRef<HTMLDivElement>(null);
  const floatsRef = useRef<HTMLDivElement>(null);
  const ticking   = useRef(false);

  useEffect(() => {
    const wrapperEl = document.querySelector('[data-hero-wrapper]') as HTMLElement | null;
    const headerEl  = document.querySelector('[data-hero-header]')  as HTMLElement | null;
    const navEl     = document.querySelector('[data-hero-nav]')     as HTMLElement | null;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const progress = Math.min(window.scrollY / (window.innerHeight * 0.65), 1);

        // ── Card expands to full viewport ─────────────────────────────────────
        if (wrapperEl) {
          const t   = Math.min(1, progress * 2.5);          // completes at ~40% scroll
          const mH  = Math.max(0, MARGIN_H * (1 - t));
          const r   = Math.max(0, RADIUS   * (1 - t));
          const bOp = Math.max(0, 1 - t * 1.5);
          wrapperEl.style.marginLeft   = `${mH}px`;
          wrapperEl.style.marginRight  = `${mH}px`;
          wrapperEl.style.borderRadius = `${r}px`;
          wrapperEl.style.borderColor  = `rgba(124, 58, 237, ${0.30 * bOp})`;
        }

        // ── Header: floating state ────────────────────────────────────────────
        if (headerEl) {
          if (progress > 0.08) headerEl.setAttribute('data-scrolled', '');
          else                 headerEl.removeAttribute('data-scrolled');
        }

        // ── Nav links fade in ─────────────────────────────────────────────────
        if (navEl) {
          const navOp = Math.min(1, Math.max(0, (progress - 0.25) / 0.3));
          navEl.style.opacity       = `${navOp}`;
          navEl.style.pointerEvents = navOp > 0.1 ? 'auto' : 'none';
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

