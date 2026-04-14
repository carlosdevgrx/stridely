'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import s from './HeroScene.module.scss';

const APP_URL = 'https://stridely-khaki.vercel.app';

export default function HeroScene() {
  const frameRef  = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);
  const phoneRef  = useRef<HTMLDivElement>(null);
  const floatsRef = useRef<HTMLDivElement>(null);
  const ticking   = useRef(false);

  useEffect(() => {
    // Outer page header – fade it in as the frame dissolves on scroll
    const headerEl = document.querySelector('[data-hero-header]') as HTMLElement | null;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const progress = Math.min(window.scrollY / (window.innerHeight * 0.6), 1);

        // ── Frame: shrinks border + fades ──────────────────────────────────
        if (frameRef.current) {
          const bw = Math.max(0, 12 - progress * 12);
          const op = Math.max(0, 1 - progress * 1.5);
          const br = 28 + progress * 20;
          frameRef.current.style.borderWidth  = `${bw}px`;
          frameRef.current.style.opacity      = `${op}`;
          frameRef.current.style.borderRadius = `${br}px`;
        }

        // ── Inner topbar: fades out first ───────────────────────────────────
        if (topbarRef.current) {
          const op = Math.max(0, 1 - progress * 2.5);
          topbarRef.current.style.opacity      = `${op}`;
          topbarRef.current.style.pointerEvents = progress > 0.4 ? 'none' : 'auto';
        }

        // ── Outer header: fades in after frame starts dissolving ────────────
        if (headerEl) {
          const op = Math.min(1, Math.max(0, (progress - 0.4) / 0.6));
          headerEl.style.opacity      = `${op}`;
          headerEl.style.pointerEvents = op > 0.1 ? 'auto' : 'none';
        }

        // ── Phone: grows slightly ────────────────────────────────────────────
        if (phoneRef.current) {
          const scale = 0.86 + progress * 0.14; // 0.86 → 1.0
          const ty    = -progress * 24;
          phoneRef.current.style.transform = `scale(${scale}) translateY(${ty}px)`;
        }

        // ── Floats: fade with frame ─────────────────────────────────────────
        if (floatsRef.current) {
          const op = Math.max(0, 1 - progress * 2.5);
          floatsRef.current.style.opacity = `${op}`;
        }

        ticking.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // apply state on mount (handles refresh at non-zero scroll)
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className={s.scene}>
      {/* Fixed viewport border frame */}
      <div className={s.frame} ref={frameRef} />

      {/* ── Mini topbar inside the frame: logo + single CTA ── */}
      <div className={s.topbar} ref={topbarRef}>
        <Image
          src="/logo-corporativo.svg"
          alt="Stridely"
          width={100}
          height={26}
          priority
        />
        <Link href={`${APP_URL}/register`} className={s['btn--cta']}>
          Empieza gratis
        </Link>
      </div>

      {/* ── Text content: eyebrow + title + subtitle ── */}
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

      {/* ── Phone stage: phone + floating cards ── */}
      {/* Phone overflows below viewport → "cut off" visual effect */}
      <div className={s.phoneStage}>
        {/* Floating cards – positioned absolute within phoneStage */}
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

        {/* Phone mockup – bottom overflows viewport edge for "cut off" effect */}
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
