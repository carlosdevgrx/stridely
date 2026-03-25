import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, LayoutDashboard } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { StravaLogin } from '../components/features/strava/StravaLogin';
import type { Workout } from '../types';
import { formatDistance, formatDuration, formatPace, formatDate } from '../utils/formatters';
import './Dashboard.scss';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface CoachRec {
  sessionType: string;
  distance: string | null;
  targetPace: string | null;
  recovery: string | null;
  isRestDay: boolean;
  message: string;
}

const TYPE_LABEL: Record<string, string> = { run: 'Carrera', trail: 'Trail', race: 'Race' };
const TYPE_ICON:  Record<string, string> = { run: '🏃', trail: '🏔️', race: '🏅' };

function SparklineChart({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const W = 220;
  const H = 90;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 6;
  const pts: [number, number][] = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (W - pad * 2),
    H - pad - ((v - min) / range) * (H - pad * 2),
  ]);
  let linePath = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const cp = (cx - px) * 0.45;
    linePath += ` C${(px + cp).toFixed(1)},${py.toFixed(1)} ${(cx - cp).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`;
  }
  const areaPath = `${linePath} L${(W - pad).toFixed(1)},${H} L${pad},${H} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FC5200" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FC5200" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-gradient)" />
      <path
        d={linePath}
        fill="none"
        stroke="#FC5200"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [recommendation, setRecommendation] = useState<CoachRec | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recFetched = useRef(false);

  useEffect(() => {
    if (isConnected) fetchActivities().catch(() => {});
  }, [isConnected, fetchActivities]);

  useEffect(() => {
    setLocalActivities(activities);
  }, [activities]);

  // Fetch AI recommendation once when activities first load
  useEffect(() => {
    if (localActivities.length === 0 || recFetched.current) return;
    recFetched.current = true;
    setLoadingRec(true);
    fetch(`${API_BASE}/api/ai/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities: localActivities.slice(0, 10) }),
    })
      .then(r => r.json())
      .then(d => { if (d.recommendation) setRecommendation(d.recommendation); })
      .catch(() => {})
      .finally(() => setLoadingRec(false));
  }, [localActivities]);

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

  const Sidebar = () => (
    <aside className="dash__sidebar">
      <div className="dash__sidebar-brand">
        <span className="dash__sidebar-brand-icon">🏃</span>
        <span className="dash__sidebar-brand-name">Stridely</span>
      </div>

      <nav className="dash__nav">
        <button className="dash__nav-item dash__nav-item--active">
          <LayoutDashboard size={18} strokeWidth={2} />
          <span>Dashboard</span>
        </button>
      </nav>

      <div className="dash__sidebar-footer">
        <div className="dash__avatar dash__avatar--sidebar">
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} />
            : <span className="dash__avatar-initials">{initials}</span>
          }
        </div>
        <div className="dash__sidebar-user">
          <strong className="dash__sidebar-user-name">{firstName}</strong>
          <button className="dash__sidebar-signout" onClick={signOut}>Cerrar sesión</button>
        </div>
      </div>
    </aside>
  );

  if (!isConnected) {
    return (
      <div className="dash">
        <Sidebar />
        <div className="dash__page">
          <Header />
          <div className="dash__main">
            <div className="dash-state">
              <h2>Conecta tu cuenta de Strava</h2>
              <p>Para ver tus actividades y obtener análisis personalizados, conecta tu cuenta de Strava.</p>
              <StravaLogin />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dash">
        <Sidebar />
        <div className="dash__page">
          <Header />
          <div className="dash__main">
            <div className="dash-state">
              <div className="dash-state__spinner" />
              <p>Cargando tus actividades...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const needsReconnect = error.toLowerCase().includes('reconecta') || error.toLowerCase().includes('renovar') || error.toLowerCase().includes('no conectada');
    return (
      <div className="dash">
        <Sidebar />
        <div className="dash__page">
          <Header />
          <div className="dash__main">
            <div className="dash-state">
              <h2>{needsReconnect ? 'Sesión de Strava expirada' : 'Error al cargar actividades'}</h2>
              <p>{needsReconnect ? 'Tu conexión con Strava ha caducado. Desconecta tu cuenta y vuelve a conectarla para continuar.' : error}</p>
              <div className="dash-state__actions">
                {needsReconnect ? (
                  <button
                    onClick={() => { disconnectStrava(); }}
                    className="dash-state__btn dash-state__btn--danger"
                  >
                    ⚡ Desconectar Strava
                  </button>
                ) : (
                  <button onClick={() => fetchActivities()} className="dash-state__btn">Reintentar</button>
                )}
              </div>
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
      <Sidebar />
      <div className="dash__page">
        <Header />
        <div className="dash__main">

          {/* Saludo */}
          <div className="dash__greeting">
            <h2>Hola, {firstName} 👋</h2>
            <p>{today}</p>
          </div>

          {/* Top 2-column grid: Esta semana + Coach IA */}
          <div className="dash__top-grid">
            <div className="dash__top-col">
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
            </div>

            <div className="dash__top-col">
              {(loadingRec || recommendation) && (
                <>
                  <p className="dash__section-title">Coach IA</p>
                  <div className="dash__ai">
                    <div className="dash__ai-header">
                      <span className="dash__ai-badge">
                        <Sparkles size={11} strokeWidth={2.5} />
                        Coach IA
                      </span>
                      {!loadingRec && recommendation && (
                        <span className="dash__ai-day-label">
                          {recommendation.isRestDay ? 'Día de descanso' : 'Sesión de hoy'}
                        </span>
                      )}
                    </div>

                    {loadingRec ? (
                      <>
                        <div className="dash__ai-skeleton dash__ai-skeleton--card" />
                        <div className="dash__ai-skeleton dash__ai-skeleton--short" />
                      </>
                    ) : recommendation ? (
                      <>
                        {recommendation.isRestDay ? (
                          <div className="dash__ai-rest">
                            <span className="dash__ai-rest-icon">🌙</span>
                            <span className="dash__ai-rest-label">Hoy toca descansar</span>
                          </div>
                        ) : (
                          <div className="dash__ai-card">
                            <div className="dash__ai-grid">
                              <div className="dash__ai-grid-item">
                                <span className="dash__ai-grid-label">Tipo</span>
                                <span className="dash__ai-grid-value dash__ai-grid-value--highlight">
                                  {recommendation.sessionType}
                                </span>
                              </div>
                              <div className="dash__ai-grid-item">
                                <span className="dash__ai-grid-label">Distancia</span>
                                <span className="dash__ai-grid-value">{recommendation.distance ?? '—'}</span>
                              </div>
                              <div className="dash__ai-grid-item">
                                <span className="dash__ai-grid-label">Ritmo objetivo</span>
                                <span className="dash__ai-grid-value">{recommendation.targetPace ?? '—'}</span>
                              </div>
                              <div className="dash__ai-grid-item">
                                <span className="dash__ai-grid-label">Recuperación</span>
                                <span className="dash__ai-grid-value">{recommendation.recovery ?? '—'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <p className="dash__ai-insight">{recommendation.message}</p>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actividad Reciente */}
          {recentActivity && (
            <>
              <p className="dash__section-title">Actividad Reciente</p>
              <div className="dash__recent">
                <div className="dash__recent-body">
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
                <div className="dash__recent-chart">
                  <SparklineChart
                    data={[...localActivities].slice(0, 8).reverse().map(a => a.distance)}
                  />
                  <p className="dash__recent-chart-label">Últimas actividades</p>
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
    </div>
  );
};

export default Dashboard;
