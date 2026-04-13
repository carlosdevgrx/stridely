'use client';

import { useEffect, useRef, useState } from 'react';
import s from './HeroGrid.module.scss';

const CELL = 50; // px — always square

interface Star {
  id: number;
  x: number;
  y: number;
}

let uid = 0;

export default function HeroGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    const addStar = () => {
      const el = gridRef.current;
      if (!el) return;
      const W = el.offsetWidth;
      const H = el.offsetHeight;
      const maxCol = Math.floor(W / CELL) - 1;
      const maxRow = Math.floor(H / CELL) - 1;
      if (maxCol < 2 || maxRow < 2) return;
      const col = Math.floor(Math.random() * (maxCol - 1)) + 1;
      const row = Math.floor(Math.random() * (maxRow - 1)) + 1;
      const id = ++uid;
      setStars(prev => [...prev, { id, x: col * CELL, y: row * CELL }]);
      setTimeout(() => setStars(prev => prev.filter(st => st.id !== id)), 3600);
    };

    setTimeout(addStar, 400);
    const interval = setInterval(addStar, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={s.grid} ref={gridRef} aria-hidden="true">
      {stars.map(star => (
        <div
          key={star.id}
          className={s.star}
          style={{ left: star.x, top: star.y }}
        />
      ))}
    </div>
  );
}
