/**
 * Formatters - Funciones de formateo de datos
 */

/**
 * Formatea distancia en metros a km
 */
export const formatDistance = (meters: number, decimals: number = 2): string => {
  const km = meters / 1000;
  return `${km.toFixed(decimals)} km`;
};

/**
 * Formatea tiempo en segundos a formato HH:MM:SS
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(String(hours).padStart(2, '0'));
  parts.push(String(minutes).padStart(2, '0'));
  parts.push(String(secs).padStart(2, '0'));

  return parts.join(':');
};

/**
 * Formatea el ritmo (minutos/km) a formato MIN:SEC
 */
export const formatPace = (paceSeconds: number): string => {
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
};

/**
 * Convierte una fecha a string YYYY-MM-DD (para comparaciones)
 */
export function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

export function toYMD(d: Date | string): string {
  const dt = toDate(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Formatea fecha a formato legible
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('es-ES', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
