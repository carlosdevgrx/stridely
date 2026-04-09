import { describe, it, expect } from 'vitest';
import {
  daysSinceLastRun,
  avgPace,
  weeklyKmProgression,
  hasRecentQualitySession,
  planCurrentWeek,
} from './helpers.js';

// Fecha fija de referencia para todos los tests: miércoles 9 abril 2026
const NOW = new Date('2026-04-09T12:00:00Z');

/** Crea una actividad con los días de desfase indicados desde NOW */
function act(daysAgo, distanceM = 8000, paceSecPerKm = 360) {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return { date: d.toISOString(), distance: distanceM, pace: paceSecPerKm };
}

// ─── daysSinceLastRun ────────────────────────────────────────────────────────

describe('daysSinceLastRun', () => {
  it('devuelve 0 si salió hoy', () => {
    expect(daysSinceLastRun([act(0)], NOW)).toBe(0);
  });

  it('devuelve 1 si salió ayer', () => {
    expect(daysSinceLastRun([act(1)], NOW)).toBe(1);
  });

  it('devuelve el número correcto de días', () => {
    expect(daysSinceLastRun([act(5)], NOW)).toBe(5);
  });

  it('usa la actividad MÁS reciente si hay varias', () => {
    expect(daysSinceLastRun([act(5), act(2), act(8)], NOW)).toBe(2);
  });

  it('devuelve -1 si no hay actividades', () => {
    expect(daysSinceLastRun([], NOW)).toBe(-1);
    expect(daysSinceLastRun(null, NOW)).toBe(-1);
  });
});

// ─── avgPace ─────────────────────────────────────────────────────────────────

describe('avgPace', () => {
  it('calcula la media correcta', () => {
    const acts = [
      { pace: 300 },
      { pace: 360 },
      { pace: 420 },
    ];
    expect(avgPace(acts)).toBe(360);
  });

  it('ignora actividades con pace = 0', () => {
    expect(avgPace([{ pace: 300 }, { pace: 0 }, { pace: 360 }])).toBe(330);
  });

  it('devuelve 0 si todas tienen pace = 0', () => {
    expect(avgPace([{ pace: 0 }, { pace: 0 }])).toBe(0);
  });

  it('devuelve 0 si el array está vacío', () => {
    expect(avgPace([])).toBe(0);
  });

  it('devuelve 0 con entrada inválida', () => {
    expect(avgPace(null)).toBe(0);
  });
});

// ─── weeklyKmProgression ─────────────────────────────────────────────────────

describe('weeklyKmProgression', () => {
  it('agrupa actividades en la semana correcta', () => {
    // act(0) = miércoles 9 abr → semana del lunes 6 abr
    const result = weeklyKmProgression([act(0, 10000)], 8, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].weekStart).toBe('2026-04-06');
    expect(result[0].km).toBeCloseTo(10);
  });

  it('suma km de dos actividades en la misma semana', () => {
    const result = weeklyKmProgression([act(0, 5000), act(1, 5000)], 8, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].km).toBeCloseTo(10);
  });

  it('crea buckets separados para semanas distintas', () => {
    // act(0) esta semana, act(8) semana anterior
    const result = weeklyKmProgression([act(0, 5000), act(8, 5000)], 8, NOW);
    expect(result).toHaveLength(2);
  });

  it('excluye actividades fuera del periodo', () => {
    // act(100) está fuera de las 8 semanas (56 días)
    const result = weeklyKmProgression([act(100, 10000)], 8, NOW);
    expect(result).toHaveLength(0);
  });

  it('ordena las semanas de más antigua a más reciente', () => {
    const result = weeklyKmProgression([act(0, 5000), act(8, 5000), act(15, 5000)], 8, NOW);
    const starts = result.map(r => r.weekStart);
    expect(starts).toEqual([...starts].sort());
  });

  it('devuelve array vacío si no hay actividades', () => {
    expect(weeklyKmProgression([], 8, NOW)).toHaveLength(0);
  });
});

// ─── hasRecentQualitySession ──────────────────────────────────────────────────

describe('hasRecentQualitySession', () => {
  const REFERENCE_PACE = 360; // 6:00/km

  it('detecta sesión de calidad (pace < media) en los últimos 4 días', () => {
    // pace 300 < 360 = sesión rápida = calidad
    expect(hasRecentQualitySession([act(2, 8000, 300)], REFERENCE_PACE, 4, NOW)).toBe(true);
  });

  it('NO detecta sesión suave (pace > media) como calidad', () => {
    expect(hasRecentQualitySession([act(2, 8000, 420)], REFERENCE_PACE, 4, NOW)).toBe(false);
  });

  it('NO detecta sesión fuera del periodo', () => {
    // act(5) está fuera de los 4 días
    expect(hasRecentQualitySession([act(5, 8000, 300)], REFERENCE_PACE, 4, NOW)).toBe(false);
  });

  it('devuelve false si no hay actividades', () => {
    expect(hasRecentQualitySession([], REFERENCE_PACE, 4, NOW)).toBe(false);
  });

  it('devuelve false si referencePace = 0', () => {
    expect(hasRecentQualitySession([act(1, 8000, 300)], 0, 4, NOW)).toBe(false);
  });
});

// ─── planCurrentWeek ─────────────────────────────────────────────────────────

describe('planCurrentWeek', () => {
  it('devuelve semana 1 el primer día del plan', () => {
    const plan = { started_at: '2026-04-09', total_weeks: 8 };
    expect(planCurrentWeek(plan, NOW)).toBe(1);
  });

  it('devuelve semana 2 tras 7 días', () => {
    const plan = { started_at: '2026-04-02', total_weeks: 8 };
    expect(planCurrentWeek(plan, NOW)).toBe(2);
  });

  it('devuelve semana 4 tras 3 semanas completas', () => {
    const plan = { started_at: '2026-03-19', total_weeks: 8 };
    expect(planCurrentWeek(plan, NOW)).toBe(4);
  });

  it('nunca supera total_weeks aunque el plan esté vencido', () => {
    const plan = { started_at: '2025-01-01', total_weeks: 4 };
    expect(planCurrentWeek(plan, NOW)).toBe(4);
  });

  it('devuelve 1 si el plan empezó en el mismo lunes de la semana actual', () => {
    // Lunes de la semana de NOW (9 abr 2026 es miércoles) → lunes 6 abr
    const plan = { started_at: '2026-04-06', total_weeks: 8 };
    expect(planCurrentWeek(plan, NOW)).toBe(1);
  });
});
