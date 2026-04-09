import { describe, it, expect } from 'vitest';
import {
  getSessionDate,
  getPlanCurrentWeek,
  parsePlanDurationMin,
  findMatchingActivity,
  isSessionCompleted,
  isSessionMissed,
} from './planUtils';
import type { StoredPlan, PlanSession, Workout } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWorkout(date: string, durationSec = 3600): Workout {
  return {
    id: Math.random().toString(),
    name: 'Test run',
    distance: 10000,
    duration: durationSec,
    pace: 360,
    date: new Date(date) as unknown as Date,
    type: 'run',
    elevation: 0,
  };
}

function makeSession(dayNumber: number, duration = '45 min', type = 'Rodaje suave'): PlanSession {
  return { day_number: dayNumber, type, duration, description: 'test' };
}

/** Simple 1-week plan that started on a known Monday */
function makePlan(startedAt: string, totalWeeks = 4, sessions: PlanSession[] = []): StoredPlan {
  return {
    id: 'plan-1',
    goal: '10km',
    sessions_per_week: 3,
    total_weeks: totalWeeks,
    started_at: startedAt,
    weeks: [{ week: 1, sessions: sessions.length ? sessions : [makeSession(1), makeSession(3), makeSession(5)] }],
  };
}

// ─── parsePlanDurationMin ─────────────────────────────────────────────────────

describe('parsePlanDurationMin', () => {
  it('parsea duración simple "45 min"', () => {
    expect(parsePlanDurationMin('45 min')).toBe(45);
  });

  it('parsea rango "30-40 min" y devuelve la media', () => {
    expect(parsePlanDurationMin('30-40 min')).toBe(35);
  });

  it('parsea rango con guion largo "30–40 min"', () => {
    expect(parsePlanDurationMin('30–40 min')).toBe(35);
  });

  it('parsea texto con contexto "Rodaje 60 min fácil"', () => {
    expect(parsePlanDurationMin('Rodaje 60 min fácil')).toBe(60);
  });

  it('devuelve 0 si no hay minutos en el string', () => {
    expect(parsePlanDurationMin('10 km')).toBe(0);
    expect(parsePlanDurationMin('')).toBe(0);
  });
});

// ─── getSessionDate ───────────────────────────────────────────────────────────

describe('getSessionDate', () => {
  // Plan empieza el lunes 6 abr 2026
  const startedAt = '2026-04-06';

  it('semana 1, día 1 es el lunes de inicio', () => {
    const d = getSessionDate(startedAt, 1, 1);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // abril=3
    expect(d.getDate()).toBe(6);
  });

  it('semana 1, día 3 es el miércoles', () => {
    const d = getSessionDate(startedAt, 1, 3);
    expect(d.getDate()).toBe(8);
  });

  it('semana 2, día 1 es el lunes siguiente', () => {
    const d = getSessionDate(startedAt, 2, 1);
    expect(d.getDate()).toBe(13);
  });

  it('funciona cuando el plan empieza en miércoles (ancla al lunes de esa semana)', () => {
    // Miércoles 8 abr → lunes de esa semana es 6 abr
    const d = getSessionDate('2026-04-08', 1, 1);
    expect(d.getDate()).toBe(6); // lunes 6 abr
  });
});

// ─── getPlanCurrentWeek ───────────────────────────────────────────────────────

describe('getPlanCurrentWeek', () => {
  it('devuelve semana 1 el día de inicio', () => {
    const plan = makePlan('2026-04-09');
    // vitest no mockea Date.now; usamos una fecha de inicio = hoy para asegurar semana 1
    // En este entorno la fecha actual es 2026-04-09
    expect(getPlanCurrentWeek(plan)).toBe(1);
  });

  it('nunca supera total_weeks', () => {
    const plan = makePlan('2020-01-01', 4); // plan muy antiguo
    expect(getPlanCurrentWeek(plan)).toBe(4);
  });
});

// ─── findMatchingActivity ─────────────────────────────────────────────────────

describe('findMatchingActivity', () => {
  // Plan que empieza el lunes 6 abr 2026
  // Semana 1, día 1 = lunes 6 abr
  // Semana 1, día 3 = miércoles 8 abr
  const plan = makePlan('2026-04-06');
  const session = makeSession(1, '45 min'); // lunes día 1

  it('encuentra actividad realizada el mismo día', () => {
    const acts = [makeWorkout('2026-04-06T10:00:00', 2800)]; // 46 min > 55% de 45
    expect(findMatchingActivity(session, 1, plan, acts)).toBeTruthy();
  });

  it('encuentra actividad realizada un día antes (±1 día)', () => {
    const acts = [makeWorkout('2026-04-05T10:00:00', 2800)];
    expect(findMatchingActivity(session, 1, plan, acts)).toBeTruthy();
  });

  it('encuentra actividad realizada un día después (±1 día)', () => {
    const acts = [makeWorkout('2026-04-07T10:00:00', 2800)];
    expect(findMatchingActivity(session, 1, plan, acts)).toBeTruthy();
  });

  it('NO encuentra actividad si está a 2 días de distancia', () => {
    const acts = [makeWorkout('2026-04-08T10:00:00', 2800)];
    expect(findMatchingActivity(session, 1, plan, acts)).toBeNull();
  });

  it('rechaza actividad demasiado corta (< 55% del tiempo planificado)', () => {
    // 45 min planificados → mínimo ~24.75 min; usamos 20 min (1200 seg)
    const acts = [makeWorkout('2026-04-06T10:00:00', 1200)];
    expect(findMatchingActivity(session, 1, plan, acts)).toBeNull();
  });

  it('devuelve null si no hay actividades', () => {
    expect(findMatchingActivity(session, 1, plan, [])).toBeNull();
  });
});

// ─── isSessionCompleted ───────────────────────────────────────────────────────

describe('isSessionCompleted', () => {
  const plan = makePlan('2026-04-06');
  const session = makeSession(1, '45 min');

  it('devuelve true cuando hay una actividad coincidente', () => {
    const acts = [makeWorkout('2026-04-06T10:00:00', 2800)];
    expect(isSessionCompleted(session, 1, plan, acts)).toBe(true);
  });

  it('devuelve false cuando no hay actividades', () => {
    expect(isSessionCompleted(session, 1, plan, [])).toBe(false);
  });
});

// ─── isSessionMissed ──────────────────────────────────────────────────────────

describe('isSessionMissed', () => {
  // Sesión en el pasado (semana 1 día 1 del plan que empezó hace mucho)
  const pastPlan = makePlan('2025-01-06', 4); // enero 2025
  const pastSession = makeSession(1, '45 min'); // lunes 6 ene 2025 — claramente pasado

  it('devuelve true si la sesión pasó y no hay actividad', () => {
    expect(isSessionMissed(pastSession, 1, pastPlan, [])).toBe(true);
  });

  it('devuelve false si la sesión pasó pero hay actividad coincidente', () => {
    const acts = [makeWorkout('2025-01-06T10:00:00', 2800)];
    expect(isSessionMissed(pastSession, 1, pastPlan, acts)).toBe(false);
  });

  it('devuelve false si la sesión es futura', () => {
    // Plan que empieza en el futuro
    const futurePlan = makePlan('2026-12-01', 4);
    const futureSession = makeSession(1, '45 min');
    expect(isSessionMissed(futureSession, 1, futurePlan, [])).toBe(false);
  });
});
