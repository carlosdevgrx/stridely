import { wmoIcon, wmoLabel, getRunningTip } from '../../hooks/useWeather';
import type { WeatherData } from '../../hooks/useWeather';
import './WeatherCard.scss';

// ─── WeatherCard — full info card ─────────────────────────────────────────────

interface CardProps {
  weather: WeatherData | null;
  loading: boolean;
}

export function WeatherCard({ weather, loading }: CardProps) {
  if (!loading && !weather) return null;

  if (loading && !weather) {
    return (
      <div className="wcard wcard--loading" aria-hidden="true">
        <div className="wcard__skel wcard__skel--main" />
        <div className="wcard__skel wcard__skel--hourly" />
      </div>
    );
  }

  if (!weather) return null;

  const { current, hourly } = weather;

  return (
    <div className="wcard">
      {/* Current conditions */}
      <div className="wcard__current">
        <span className="wcard__big-icon" aria-label={wmoLabel(current.weathercode)}>
          {wmoIcon(current.weathercode)}
        </span>
        <div className="wcard__current-info">
          <span className="wcard__temp">{current.temp}°C</span>
          <span className="wcard__desc">{wmoLabel(current.weathercode)}</span>
        </div>
        <div className="wcard__meta">
          <span className="wcard__wind">💨 {current.windspeed} km/h</span>
          <span className="wcard__tag">Hoy</span>
        </div>
      </div>

      {/* Hourly forecast */}
      {hourly.length > 0 && (
        <div className="wcard__hourly">
          {hourly.slice(0, 7).map((h) => (
            <div key={h.hour} className="wcard__hour">
              <span className="wcard__hour-label">{h.hour}h</span>
              <span className="wcard__hour-icon">{wmoIcon(h.weathercode)}</span>
              <span className="wcard__hour-temp">{h.temp}°</span>
              {h.precipProb > 0 && (
                <span
                  className="wcard__hour-bar"
                  style={{ '--rain': `${h.precipProb}%` } as React.CSSProperties}
                  title={`${h.precipProb}% lluvia`}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── WeatherTip — mobile-only inline running hint ─────────────────────────────

interface TipProps {
  weather: WeatherData;
  hasSession: boolean;
}

export function WeatherTip({ weather, hasSession }: TipProps) {
  const tip = getRunningTip(weather);
  if (!tip || !hasSession) return null;

  const isAlert = tip.startsWith('🌧') || tip.startsWith('⛈') || tip.startsWith('🥵') || tip.startsWith('🥶');

  return (
    <div className={`wtip${isAlert ? ' wtip--alert' : ''}`}>
      <span className="wtip__text">{tip}</span>
    </div>
  );
}
