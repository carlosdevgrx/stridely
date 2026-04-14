'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import s from './HeroScene.module.scss';

const APP_URL = 'https://stridely-khaki.vercel.app';

export default function HeroScene() {
  const frameRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const floatsRef = useRef<HTMLDivElement>(null);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const progress = Math.min(window.scrollY / (window.innerHeight * 0.6), 1);

        // Frame: shrinks border-width and opacity
        if (frameRef.current) {
          const bw = Math.max(0, 12 - progress * 12); // 12px → 0
          const op = Math.max(0, 1 - progress * 1.4);
          frameRef.current.style.borderWidth = `${bw}px`;
          frameRef.current.style.opacity = `${op}`;
          frameRef.current.style.borderRadius = `${28 + progress * 20}px`;
        }

        // Phone: scales up and moves to center
        if (phoneRef.current) {
          const scale = 0.62 + progress * 0.38; // 0.62 → 1
          const translateY = -progress * 40;
          phoneRef.current.style.transform = `scale(${scale}) translateY(${translateY}px)`;
        }

        // Floats: spread out and fade as phone grows
        if (floatsRef.current) {
          const op = Math.max(0, 1 - progress * 2);
          floatsRef.current.style.opacity = `${op}`;
          floatsRef.current.style.transform = `scale(${1 - progress * 0.1})`;
        }

        ticking.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // init state
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className={s.scene}>
      {/* Viewport frame */}
      <div className={s.frame} ref={frameRef} />

      {/* Floating feature cards around phone */}
      <div className={s.floats} ref={floatsRef}>
        {/* Top-left: Strava */}
        <div className={`${s.float} ${s['float--tl']}`}>
          <span className={s.float__icon}>🔗</span>
          <div className={s.float__text}>
            <strong>Conecta Strava</strong>
            <span>Sincroniza tus carreras</span>
          </div>
        </div>

        {/* Top-right: km data */}
        <div className={`${s.float} ${s['float--tr']}`}>
          <span className={s.float__icon}>📍</span>
          <div className={s.float__text}>
            <strong>38.2 km</strong>
            <span>Esta semana</span>
          </div>
        </div>

        {/* Bottom-left: Coach IA */}
        <div className={`${s.float} ${s['float--bl']}`}>
          <span className={s.float__icon}>✦</span>
          <div className={s.float__text}>
            <strong>Coach IA</strong>
            <span>Guía diaria personalizada</span>
          </div>
        </div>

        {/* Bottom-right: PWA */}
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

      {/* Text content — above phone */}
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
        <div className={s.content__actions}>
          <Link href={`${APP_URL}/register`} className={s['btn--primary']}>
            Empieza gratis →
          </Link>
          <Link href={`${APP_URL}/login`} className={s['btn--ghost']}>
            Ya tengo cuenta
          </Link>
        </div>
      </div>

      {/* Scroll hint */}
      <div className={s.scrollhint}>
        <span />
      </div>
    </section>
  );
}
