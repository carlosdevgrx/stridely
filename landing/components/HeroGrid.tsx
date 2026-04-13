'use client';

import { useEffect, useRef } from 'react';
import s from './HeroGrid.module.scss';

const COLS = 14;
const ROWS = 8;
const TOTAL = COLS * ROWS;

// How many cells light up simultaneously
const ACTIVE_COUNT = 3;
// ms between new flashes
const INTERVAL_MS = 900;

export default function HeroGrid() {
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const active = new Set<number>();

    const flash = () => {
      // Pick a new random cell not currently active
      let idx: number;
      let attempts = 0;
      do {
        idx = Math.floor(Math.random() * TOTAL);
        attempts++;
      } while (active.has(idx) && attempts < 20);

      active.add(idx);
      const cell = cellRefs.current[idx];
      if (!cell) return;

      // Randomly pick one of 3 glow variants
      const variant = Math.floor(Math.random() * 3) + 1;
      cell.setAttribute('data-glow', String(variant));

      setTimeout(() => {
        cell.removeAttribute('data-glow');
        active.delete(idx);
      }, 1400 + Math.random() * 800);
    };

    // Stagger initial flashes
    for (let i = 0; i < ACTIVE_COUNT; i++) {
      setTimeout(flash, i * 300);
    }

    const id = setInterval(flash, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={s.grid} aria-hidden="true">
      {Array.from({ length: TOTAL }).map((_, i) => (
        <div
          key={i}
          className={s.cell}
          ref={(el) => { cellRefs.current[i] = el; }}
        />
      ))}
    </div>
  );
}
