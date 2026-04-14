'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import s from './HeroScene.module.scss';

const APP_URL = 'https://stridely-khaki.vercel.app';

// Width of each side column in pixels — keep in sync with CSS initial value
const SIDE_W = 72;

export default function HeroScene() {
  const topbarRef  = useRef<HTMLDivElement>(null);
  const sideLRef   = useRef<HTMLDivElement>(null);
  const sideRRef   = useRef<HTMLDivElement>(null);
  const cornerLRef = useRef<HTMLDivElement>(null); // concave corner L
  const cornerRRef = useRef<HTMLDivElement>(null); // concave corner R
  const phoneRef   = useRef<HTMLDivElement>(null);
  const floatsRef  = useRef<HTMLDivElement>(null);
  const ticking    = useRef(false);

  useEffect(() => {
    const headerEl = document.querySelector('[data-hero-header]') as HTMLElement | null;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const progress = Math.min(window.scrollY / (window.innerHeight * 0.65), 1);

        // ── Top bar + corners: fade together ─────────────────────────────
        const topOp = Math.max(0, 1 - progress * 2);
        if (topbarRef.current) {
          topbarRef.current.style.opacity      = `${topOp}`;
          topbarRef.current.style.pointerEvents = topOp < 0.1 ? 'none' : 'auto';
        }
        if (cornerLRef.current) cornerLRef.current.style.opacity = `${topOp}`;
        if (cornerRRef.current) cornerRRef.current.style.opacity = `${topOp}`;

        // ── Side columns shrink; corners track their inner edge ────────────────
        const sideW = Math.max(0, SIDE_W * (1 - progress * 1.4));
        if (sideLRef.current)   sideLRef.current.style.width   = `${sideW}px`;
        if (sideRRef.current)   sideRRef.current.style.width   = `${sideW}px`;
        // move corners so they stay glued to the inner edge of the columns
        if (cornerLRef.current) cornerLRef.current.style.left  = `${sideW}px`;
        if (cornerRRef.current) cornerRRef.current.style.right = `${sideW}px`;

        // ── Outer header ──────────────────────────────────────────────────
        if (headerEl) {
          const op = Math.min(1, Math.max(0, (progress - 0.45) / 0.55));
          headerEl.style.opacity       = `${op}`;
          headerEl.style.pointerEvents  = op > 0.1 ? 'auto' : 'none';
        }

        // ── Phone scales up slightly ─────────────────────────────────────────
        if (phoneRef.current) {
          const scale = 0.88 + progress * 0.12;
          const ty    = -progress * 20;
          phoneRef.current.style.transform = `scale(${scale}) translateY(${ty}px)`;
        }

        // ── Floats fade out with top bar ─────────────────────────────────────
        if (floatsRef.current) {
          const op = Math.max(0, 1 - progress * 2.5);
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
      {/*
        ── Frame: solid top bar + two side columns that gradient downward.
        Top bar: solid purple, logo + CTA live here.
        Sides: solid purple at top (matching top bar), fade to transparent.
        On scroll: sides shrink width (JS), top fades — content "eats" the frame.
      */}

      {/* ── Solid top bar (fixed) ── */}
      <div className={s.frameTop} ref={topbarRef}>
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

      {/* ── Left side column ── */}
      <div className={s.frameSideL} ref={sideLRef} />
      {/* ── Right side column ── */}
      <div className={s.frameSideR} ref={sideRRef} />

      {/*
        ── Concave corner pieces ──
        Positioned at the junction: bottom of top bar × inner edge of each column.
        radial-gradient "bites" into the purple, making the dark content look
        like it has inward-curved (concave) corners.
      */}
      <div className={s.cornerL} ref={cornerLRef} />
      <div className={s.cornerR} ref={cornerRRef} />

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

