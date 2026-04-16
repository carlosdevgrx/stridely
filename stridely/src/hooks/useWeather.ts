import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const MEM_CACHE_TTL = 30 * 60 * 1000; // 30 min

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeatherHour {
  hour: number;
  temp: number;
  precipProb: number;
  weathercode: number;
}

export interface WeatherData {
  current: { temp: number; weathercode: number; windspeed: number };
  hourly: WeatherHour[];
  timezone: string;
}

// ─── WMO weather code helpers ─────────────────────────────────────────────────

export function wmoIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code === 1) return '🌤️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

export function wmoLabel(code: number): string {
  if (code === 0) return 'Despejado';
  if (code <= 2) return 'Mayormente despejado';
  if (code === 3) return 'Cubierto';
  if (code <= 48) return 'Niebla';
  if (code <= 55) return 'Llovizna';
  if (code <= 65) return 'Lluvia';
  if (code <= 77) return 'Nieve';
  if (code <= 82) return 'Chubascos';
  if (code <= 86) return 'Nieve intensa';
  return 'Tormenta';
}

function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

// ─── Running tip ──────────────────────────────────────────────────────────────

export function getRunningTip(weather: WeatherData): string | null {
  const now = new Date();
  const currentHour = now.getHours();

  const currentSlot = weather.hourly.find(h => h.hour === currentHour);
  const rainingNow =
    isRainCode(weather.current.weathercode) ||
    (currentSlot?.precipProb ?? 0) >= 60;

  if (rainingNow) {
    const clearHour = weather.hourly.find(
      h => h.hour > currentHour && !isRainCode(h.weathercode) && h.precipProb < 40,
    );
    if (clearHour) return `🌧 Lluvia ahora · despeja hacia las ${clearHour.hour}:00 h`;
    return `🌧 Llueve ahora · considera posponer la salida`;
  }

  const stormHour = weather.hourly.find(h => h.hour > currentHour && h.weathercode >= 95);
  if (stormHour) return `⛈ Tormenta a las ${stormHour.hour}:00 h — espera antes de salir`;

  const rainHour = weather.hourly.find(h => h.hour > currentHour && h.precipProb >= 60);
  if (rainHour) {
    const outBy = Math.max(rainHour.hour - 1, currentHour + 1);
    return `🌧 Llueve a las ${rainHour.hour}:00 h — sal antes de las ${outBy}:00`;
  }

  const temp = weather.current.temp;
  if (temp <= 5) return `🥶 ${temp}°C hoy — abrígate bien para salir`;
  if (temp >= 28) return `🥵 ${temp}°C hoy — hidrátate bien y sal temprano`;

  return `${wmoIcon(weather.current.weathercode)} ${temp}°C · buenas condiciones para correr`;
}

// ─── Module-level cache (survives re-renders, cleared on page reload) ─────────
let memCache: { data: WeatherData; fetchedAt: number; key: string } | null = null;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        const key = `${lat},${lon}`;

        if (memCache && memCache.key === key && Date.now() - memCache.fetchedAt < MEM_CACHE_TTL) {
          setWeather(memCache.data);
          setLoading(false);
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/api/weather?lat=${lat}&lon=${lon}`);
          if (res.ok) {
            const data: WeatherData = await res.json();
            memCache = { data, fetchedAt: Date.now(), key };
            setWeather(data);
          }
        } catch {
          // silent — weather is non-critical
        } finally {
          setLoading(false);
        }
      },
      () => {
        setDenied(true);
        setLoading(false);
      },
      { timeout: 8000, maximumAge: 20 * 60 * 1000 },
    );
  }, []);

  return { weather, loading, denied };
}
