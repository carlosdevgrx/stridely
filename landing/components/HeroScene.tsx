'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import s from './HeroScene.module.scss';

// Must match CSS initial values on .heroWrapper
const MARGIN_H = 36;
const RADIUS   = 20;

export default function HeroScene() {
  const phoneRef  = useRef<HTMLDivElement>(null);
  const ticking   = useRef(false);

  useEffect(() => {
    const wrapperEl = document.querySelector('[data-hero-wrapper]') as HTMLElement | null;
    const headerEl  = document.querySelector('[data-hero-header]')  as HTMLElement | null;
    const pillEl    = document.querySelector('[data-hero-pill]')    as HTMLElement | null;

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

        // ── Initial header fades out ──────────────────────────────────────────
        if (headerEl) {
          const op = Math.max(0, 1 - progress * 6); // fades quickly
          headerEl.style.opacity      = `${op}`;
          headerEl.style.pointerEvents = op < 0.05 ? 'none' : 'auto';
        }

        // ── Pill nav fades in ─────────────────────────────────────────────────
        if (pillEl) {
          const pillOp = Math.min(1, Math.max(0, (progress - 0.12) / 0.2));
          pillEl.style.opacity       = `${pillOp}`;
          pillEl.style.pointerEvents = pillOp > 0.1 ? 'auto' : 'none';
        }

        // ── Phone grows ───────────────────────────────────────────────────────
        if (phoneRef.current) {
          const scale = 0.88 + progress * 0.12;
          phoneRef.current.style.transform = `scale(${scale}) translateY(${-progress * 20}px)`;
        }

        // (floats stay always visible — no fade)

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
          Corre más lejos. <span>Entrena con inteligencia.</span>
        </h1>
        <p className={s.content__subtitle}>
          Stridely crea planes de carrera personalizados basados en tu historial de Strava.
          Tu coach de IA te guía cada día.
        </p>
      </div>

      {/* ── Phone stage — phone bottom overflows viewport ── */}
      <div className={s.phoneStage}>
        {/* Floating cards — richer visual, stay visible on scroll */}
        <div className={s.floats}>

          {/* ── Left Top: Strava weekly sparkline ── */}
          <div className={`${s.float} ${s['float--tl']}`}>
            <div className={s.float__row}>
              <span className={s.float__icon}>⚡</span>
              <div className={s.float__text}>
                <strong>Strava</strong>
                <span>Últimos 7 días</span>
              </div>
              <span className={s.float__up}>↑ 12%</span>
            </div>
            <div className={s.float__spark}>
              {[30, 55, 40, 75, 55, 90, 65].map((h, i) => (
                <span key={i} className={i === 5 ? `${s.float__sparkBar} ${s['float__sparkBar--peak']}` : s.float__sparkBar} style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className={s.float__row}>
              <span className={s.float__kmVal}><strong>38.2</strong> km</span>
              <span className={s.float__kmSub}>esta semana</span>
            </div>
          </div>

          {/* ── Right Top: Plan activo ── */}
          <div className={`${s.float} ${s['float--tr']}`}>
            <span className={s.float__chip}>Carrera 5K</span>
            <strong className={s.float__planDate}>23 de abril · 2026</strong>
            <div className={s.float__progressTrack}>
              <div className={s.float__progressFill} />
            </div>
            <span className={s.float__planMeta}>Semana 3 de 4 &nbsp;·&nbsp; 75%</span>
          </div>

          {/* ── Left Bottom: Coach IA ── */}
          <div className={`${s.float} ${s['float--bl']}`}>
            <div className={s.float__row}>
              <div className={s.float__coachDot}>✦</div>
              <div className={s.float__text}>
                <strong>Coach IA</strong>
                <span>Hoy: 8 km suave 🎯</span>
              </div>
            </div>
            <div className={s.float__streakRow}>
              <span>🔥</span>
              <span className={s.float__streakNum}>12 días seguidos</span>
            </div>
          </div>

          {/* ── Right Bottom: Stats ── */}
          <div className={`${s.float} ${s['float--br']}`}>
            <span className={s.float__icon}>📍</span>
            <div className={s.float__text}>
              <strong>38.2 km</strong>
              <span>Esta semana</span>
            </div>
            <div className={s.float__dotRow}>
              <span className={s.float__dot} />
              <span className={s.float__dot} />
              <span className={`${s.float__dot} ${s['float__dot--active']}`} />
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

