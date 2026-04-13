'use client';

import { useEffect, useState } from 'react';
import s from './HeroGrid.module.scss';

const COLS = 14;
const ROWS = 8;

interface Star {
  id: number;
  col: number;
  row: number;
}

let uid = 0;

export default function HeroGrid() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    const addStar = () => {
      // Avoid edge intersections so arms don't get clipped
      const col = Math.floor(Math.random() * (COLS - 2)) + 1;
      const row = Math.floor(Math.random() * (ROWS - 2)) + 1;
      const id = ++uid;
      setStars(prev => [...prev, { id, col, row }]);
      setTimeout(() => setStars(prev => prev.filter(st => st.id !== id)), 2600);
    };

    setTimeout(addStar, 100);
    setTimeout(addStar, 700);
    setTimeout(addStar, 1300);

    const interval = setInterval(addStar, 900);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={s.grid} aria-hidden="true">
      {/* Vertical lines */}
      {Array.from({ length: COLS + 1 }).map((_, i) => (
        <div key={`v${i}`} className={s.lineV} style={{ left: `${(i / COLS) * 100}%` }} />
      ))}

      {/* Horizontal lines */}
      {Array.from({ length: ROWS + 1 }).map((_, i) => (
        <div key={`h${i}`} className={s.lineH} style={{ top: `${(i / ROWS) * 100}%` }} />
      ))}

      {/* Star crosses at random intersections */}
      {stars.map(star => (
        <div
          key={star.id}
          className={s.star}
          style={{
            left: `${(star.col / COLS) * 100}%`,
            top: `${(star.row / ROWS) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
