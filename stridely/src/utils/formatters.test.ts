import { describe, it, expect } from 'vitest';
import { formatDistance, formatDuration, formatPace, toYMD } from './formatters';

// ─── formatDistance ──────────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('convierte metros a km con 2 decimales por defecto', () => {
    expect(formatDistance(5000)).toBe('5.00 km');
    expect(formatDistance(10500)).toBe('10.50 km');
    expect(formatDistance(1234)).toBe('1.23 km');
  });

  it('respeta el número de decimales indicado', () => {
    expect(formatDistance(5000, 0)).toBe('5 km');
    expect(formatDistance(5000, 1)).toBe('5.0 km');
  });

  it('maneja 0 metros', () => {
    expect(formatDistance(0)).toBe('0.00 km');
  });
});

// ─── formatDuration ──────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formatea segundos en MM:SS cuando es menor de 1 hora', () => {
    expect(formatDuration(90)).toBe('01:30');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('formatea en HH:MM:SS cuando supera 1 hora', () => {
    expect(formatDuration(3600)).toBe('01:00:00');
    expect(formatDuration(3661)).toBe('01:01:01');
    expect(formatDuration(7322)).toBe('02:02:02');
  });

  it('maneja 0 segundos', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('formatea exactamente 1 hora', () => {
    expect(formatDuration(3600)).toBe('01:00:00');
  });
});

// ─── formatPace ──────────────────────────────────────────────────────────────

describe('formatPace', () => {
  it('formatea segundos/km a MM:SS /km', () => {
    expect(formatPace(390)).toBe('6:30 /km');
    expect(formatPace(300)).toBe('5:00 /km');
    expect(formatPace(360)).toBe('6:00 /km');
  });

  it('rellena segundos con cero a la izquierda', () => {
    expect(formatPace(361)).toBe('6:01 /km');
    expect(formatPace(309)).toBe('5:09 /km');
  });

  it('redondea los segundos decimales', () => {
    // 390.5 seg → 6:31 (redondeo Math.round)
    expect(formatPace(390.5)).toBe('6:31 /km');
  });

  it('maneja 0', () => {
    expect(formatPace(0)).toBe('0:00 /km');
  });
});

// ─── toYMD ───────────────────────────────────────────────────────────────────

describe('toYMD', () => {
  it('convierte un string ISO a YYYY-MM-DD', () => {
    expect(toYMD('2026-04-09T10:00:00Z')).toBe('2026-04-09');
  });

  it('convierte un objeto Date a YYYY-MM-DD', () => {
    // Usamos UTC para evitar dependencias de zona horaria local
    const d = new Date('2026-01-05T12:00:00Z');
    // toYMD usa getFullYear/getMonth/getDate (local), así que construimos con hora central
    const local = new Date(2026, 0, 5, 12, 0, 0); // 5 enero 2026
    expect(toYMD(local)).toBe('2026-01-05');
  });

  it('rellena mes y día con cero a la izquierda', () => {
    const d = new Date(2026, 0, 5, 12, 0, 0); // enero = 0
    expect(toYMD(d)).toBe('2026-01-05');
  });
});
