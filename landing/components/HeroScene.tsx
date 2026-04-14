'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import s from './HeroScene.module.scss';

const APP_URL = 'https://stridely-khaki.vercel.app';

export default function HeroScene() {
  const frameRef  = useRef<HTMLDivElement>(null); // wraps all 3 gradient frame sides
  const phoneRef  = useRef<HTMLDivElement>(null);
  const floatsRef = useRef<HTMLDivElement>(null);
  const ticking   = useRef(false);

  useEffect(() => {
    // Outer page header – fades in once the frame dissolves
    const headerEl = document.querySelector('[data-hero-header]') as HTMLElement | null;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const progress = Math.min(window.scrollY / (window.innerHeight * 0.65), 1);

        // ── Frame (all 3 gradient sides) ────────────────────────────────────
        if (frameRef.current) {
          const op = Math.max(0, 1 - progress * 1.6);
          frameRef.current.style.opacity      = `${op}`;
          frameRef.current.style.pointerEvents = op < 0.15 ? 'none' : 'auto';
        }

        // ── Outer header fades in ────────────────────────────────────────────
        if (headerEl) {
          const op = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));
          headerEl.style.opacity       = `${op}`;
          headerEl.style.pointerEvents  = op > 0.1 ? 'auto' : 'none';
        }

        // ── Phone grows slightly ─────────────────────────────────────────────
        if (phoneRef.current) {
          const scale = 0.88 + progress * 0.12;
          const ty    = -progress * 20;
          phoneRef.current.style.transform = `scale(${scale}) translateY(${ty}px)`;
        }

        // ── Floats fade with frame ───────────────────────────────────────────
        if (floatsRef.current) {
          const op = Math.max(0, 1 - progress * 2.2);
          floatsRef.current.style.opacity = `${op}`;
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
        ── Gradient frame wrapper ──────────────────────────────────────────
        3 fixed overlays (top + left side + right side) that together form
        the "viewport frame" effect. Top is tallest and holds logo + CTA.
        Sides and bottom fade to transparent → gradient, not hard border.
      */}
      <div className={s.frameWrapper} ref={frameRef}>
        {/* Top gradient bar — logo left, CTA right */}
        <div className={s.frameTop}>
          <div className={s.topbar}>
            <Image
              src="/logo-corporativo.svg"
              alt="Stridely"
              width={108}
              height={28}
              priority
            />
            <Link href={`${APP_URL}/register`} className={s['btn--cta']}>
              Empieza gratis
            </Link>
          </div>
        </div>

        {/* Left vertical fade */}
        <div className={s.frameSideL} />
        {/* Right vertical fade */}
        <div className={s.frameSideR} />
        {/* Bottom fade — helps "open" the bottom edge */}
        <div className={s.frameBottom} />
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

