import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { StravaLogin } from '../components/features/strava/StravaLogin';
import type { Workout } from '../types';
import { formatDistance, formatDuration, formatPace, formatDate } from '../utils/formatters';
import './Dashboard.scss';

const TYPE_LABEL: Record<string, string> = { run: 'Carrera', trail: 'Trail', race: 'Race' };
const TYPE_ICON:  Record<string, string> = { run: '🏃', trail: '🏔️', race: '🏅' };

const MOTIVATIONAL = [
  { icon: '🌅', msg: 'Cada kilómetro cuenta. ¿Salimos hoy?' },
  { icon: '🔥', msg: 'La semana aún no ha terminado. Tú puedes.' },
  { icon: '💪', msg: 'El descanso también es entreno. ¡A por la próxima!' },
  { icon: '🎯', msg: 'Sin rutina esta semana. Mañana es un buen día para empezar.' },
];

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0=Dom, 1=Lun ... 6=Sáb
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now); mon.setHours(0,0,0,0); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
  return { mon, sun };
}

function computeWeekStats(acts: Workout[]) {
  const { mon, sun } = getWeekBounds();
  const week = acts.filter(a => {
    const d = new Date(a.date);
    return d >= mon && d <= sun;
  });
  const totalDist = week.reduce((s, a) => s + a.distance, 0);
  const totalTime = week.reduce((s, a) => s + a.duration, 0);
  return { count: week.length, totalDist, totalTime };
}

const Dashboard: React.FC = () => {
  const { signOut, user } = useAuthContext();
  const navigate = useNavigate();
  const { activities, loading, error, fetchActivities, isConnected, disconnectStrava, athleteData } = useStrava();
  const [localActivities, setLocalActivities] = useState<Workout[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isConnected) fetchActivities().catch(() => {});
  }, [isConnected, fetchActivities]);

  useEffect(() => {
    setLocalActivities(activities);
  }, [activities]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const firstName   = displayName.split(' ')[0];
  const initials    = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatarUrl   = (athleteData?.profile_medium ?? athleteData?.profile ?? null) as string | null;
  const today       = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const Header = () => (
    <header className="dash__header">
      <div className="dash__logo">
        <span className="dash__logo-icon">🏃</span>
        <span className="dash__logo-name">Stridely</span>
      </div>

      <div className="dash__user" ref={dropdownRef}>
        <span className="dash__user-name">{displayName}</span>
        <div
          className={`dash__avatar${dropdownOpen ? ' dash__avatar--open' : ''}`}
          onClick={() => setDropdownOpen(o => !o)}
          role="button"
          aria-label="Menú de usuario"
        >
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} />
            : <span className="dash__avatar-initials">{initials}</span>
          }
        </div>

        {dropdownOpen && (
          <div className="dash__dropdown">
            <div className="dash__dropdown-header">
              <strong>{displayName}</strong>
              <p>{user?.email}</p>
            </div>
            {isConnected && (
              <button
                className="dash__dropdown-item dash__dropdown-item--danger"
                onClick={() => { disconnectStrava(); setDropdownOpen(false); }}
              >
                ⚡ Desconectar Strava
              </button>
            )}
            <button
              className="dash__dropdown-item dash__dropdown-item--danger"
              onClick={signOut}
            >
              ↩ Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );

  if (!isConnected) {
    return (
      <div className="dash">
        <Header />
        <div className="dash__main">
          <div className="dash-state">
            <h2>Conecta tu cuenta de Strava</h2>
            <p>Para ver tus actividades y obtener análisis personalizados, conecta tu cuenta de Strava.</p>
            <StravaLogin />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dash">
        <Header />
        <div className="dash__main">
          <div className="dash-state">
            <div className="dash-state__spinner" />
            <p>Cargando tus actividades...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash">
        <Header />
        <div className="dash__main">
          <div className="dash-state">
            <h2>Error al cargar actividades</h2>
            <p>{error}</p>
            <div className="dash-state__actions">
              <button onClick={() => fetchActivities()} className="dash-state__btn">Reintentar</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const recentActivity = localActivities[0] ?? null;
  const weekStats = computeWeekStats(localActivities);
  const motivational = MOTIVATIONAL[new Date().getDay() % MOTIVATIONAL.length];

  return (
    <div className="dash">
      <Header />
      <div className="dash__main">

        {/* Saludo */}
        <div className="dash__greeting">
          <h2>Hola, {firstName} 👋</h2>
          <p>{today}</p>
        </div>

        {/* Weekly Record */}
        <p className="dash__section-title">Esta semana</p>
        {weekStats.count > 0 ? (
          <div className="dash__weekly">
            <div className="dash__weekly-left">
              <span className="dash__weekly-badge">🏆 Récord semanal</span>
              <p className="dash__weekly-dist">{(weekStats.totalDist / 1000).toFixed(2)} km</p>
              <p className="dash__weekly-dist-label">distancia total</p>
            </div>
            <div className="dash__weekly-stats">
              <div className="dash__weekly-stat">
                <span className="dash__weekly-stat-label">Actividades</span>
                <span className="dash__weekly-stat-value">{weekStats.count}</span>
              </div>
              <div className="dash__weekly-stat">
                <span className="dash__weekly-stat-label">Tiempo</span>
                <span className="dash__weekly-stat-value">{formatDuration(weekStats.totalTime)}</span>
              </div>
              <div className="dash__weekly-stat">
                <span className="dash__weekly-stat-label">Distancia</span>
                <span className="dash__weekly-stat-value">{(weekStats.totalDist / 1000).toFixed(1)} km</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="dash__weekly dash__weekly--empty">
            <span className="dash__weekly-empty-icon">{motivational.icon}</span>
            <div>
              <p className="dash__weekly-empty-msg">{motivational.msg}</p>
              <p className="dash__weekly-empty-sub">Aún no hay actividades esta semana</p>
            </div>
          </div>
        )}

        {/* Actividad Reciente */}
        {recentActivity && (
          <>
            <p className="dash__section-title">Actividad Reciente</p>
            <div className="dash__recent">
              <div className="dash__recent-header">
                <span className="dash__recent-type">
                  {TYPE_ICON[recentActivity.type] ?? '🏃'}&nbsp;
                  {TYPE_LABEL[recentActivity.type] ?? recentActivity.type}
                </span>
              </div>
              <p className="dash__recent-name">{recentActivity.name}</p>
              <p className="dash__recent-date">{formatDate(recentActivity.date)}</p>
              <p className="dash__recent-kpi">{formatDistance(recentActivity.distance)}</p>
              <p className="dash__recent-kpi-label">Distancia</p>
              <div className="dash__recent-stats">
                <div className="dash__recent-stat">
                  <span className="dash__recent-stat-label">Tiempo</span>
                  <span className="dash__recent-stat-value">{formatDuration(recentActivity.duration)}</span>
                </div>
                <div className="dash__recent-stat">
                  <span className="dash__recent-stat-label">Ritmo</span>
                  <span className="dash__recent-stat-value">{formatPace(recentActivity.pace)}</span>
                </div>
                {recentActivity.elevation > 0 && (
                  <div className="dash__recent-stat">
                    <span className="dash__recent-stat-label">Desnivel</span>
                    <span className="dash__recent-stat-value">{Math.round(recentActivity.elevation)} m</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Todas las actividades */}
        <div className="dash__activities-header">
          <p className="dash__section-title">Todas las actividades</p>
          <span className="dash__activities-count">{localActivities.length} actividades</span>
        </div>

        {localActivities.length === 0 ? (
          <div className="dash-state">
            <p>No hay actividades cargadas</p>
          </div>
        ) : (
          <div className="dash__grid">
            {localActivities.map((activity) => (
              <div key={activity.id} className="act-card" onClick={() => navigate(`/activity/${activity.id}`)}>
                <div className="act-card__header">
                  <h3 className="act-card__name">{activity.name}</h3>
                  <span className="act-card__type">
                    {TYPE_ICON[activity.type] ?? '🏃'} {TYPE_LABEL[activity.type] ?? activity.type}
                  </span>
                </div>
                <p className="act-card__date">{formatDate(activity.date)}</p>
                <div className="act-card__stats">
                  <div className="act-card__stat">
                    <span className="act-card__stat-label">Distancia</span>
                    <span className="act-card__stat-value">{formatDistance(activity.distance)}</span>
                  </div>
                  <div className="act-card__stat">
                    <span className="act-card__stat-label">Tiempo</span>
                    <span className="act-card__stat-value">{formatDuration(activity.duration)}</span>
                  </div>
                  <div className="act-card__stat">
                    <span className="act-card__stat-label">Ritmo</span>
                    <span className="act-card__stat-value">{formatPace(activity.pace)}</span>
                  </div>
                  {activity.elevation > 0 && (
                    <div className="act-card__stat">
                      <span className="act-card__stat-label">Desnivel</span>
                      <span className="act-card__stat-value">{Math.round(activity.elevation)} m</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
