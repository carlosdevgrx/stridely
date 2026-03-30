import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, FootprintsIcon, CalendarDays, Timer, Flame, Bell } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { StravaLogin } from '../components/features/strava/StravaLogin';
import type { Workout } from '../types';
import { formatDuration, formatDistance, formatPace, formatDate } from '../utils/formatters';
import { supabase } from '../services/supabase/client';
import { TrainingPlan } from '../components/features/training/TrainingPlan';
import type { StoredPlan, PlanSession } from '../components/features/training/TrainingPlan';
import { isSessionCompleted, getPlanCurrentWeek } from '../components/features/training/TrainingPlan';
import AppSidebar from '../components/common/AppSidebar';
import './Dashboard.scss';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface CoachRec {
  source?: 'ai' | 'plan';
  sessionType: string;
  distance: string | null;
  targetPace: string | null;
  recovery: string | null;
  isRestDay: boolean;
  message: string;
}


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
  const totalElev = week.reduce((s, a) => s + (a.elevation || 0), 0);
  return { count: week.length, totalDist, totalTime, totalElev };
}

function computeStreak(acts: Workout[]): number {
  if (acts.length === 0) return 0;
  const toYMD = (d: Date | string) => {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  };
  const days = new Set(acts.map(a => toYMD(a.date)));
  let streak = 0;
  const cursor = new Date(); cursor.setHours(0,0,0,0);
  if (!days.has(toYMD(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(toYMD(cursor)) && streak <= 365) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getTodayPlanSession(plan: StoredPlan): PlanSession | null {
  const now = new Date();
  const jsDow = now.getDay();
  const todayDayNum = jsDow === 0 ? 7 : jsDow;
  const currentWeek = getPlanCurrentWeek(plan);
  const weekSessions = plan.weeks.find(w => w.week === currentWeek)?.sessions ?? [];
  return weekSessions.find(s => s.day_number === todayDayNum) ?? null;
}

function getTodayPlanContext(plan: StoredPlan): { session: PlanSession; week: number } | null {
  const now = new Date();
  const jsDow = now.getDay();
  const todayDayNum = jsDow === 0 ? 7 : jsDow;
  const currentWeek = getPlanCurrentWeek(plan);
  const weekSessions = plan.weeks.find(w => w.week === currentWeek)?.sessions ?? [];
  const session = weekSessions.find(s => s.day_number === todayDayNum) ?? null;
  return session ? { session, week: currentWeek } : null;
}

const Dashboard: React.FC = () => {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { activities, loading, error, fetchActivities, isConnected, disconnectStrava } = useStrava();
  const [localActivities, setLocalActivities] = useState<Workout[]>([]);
  const [recommendation, setRecommendation] = useState<CoachRec | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [activePlan, setActivePlan] = useState<StoredPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planSessionIntro, setPlanSessionIntro] = useState<string | null>(null);
  const [loadingIntro, setLoadingIntro] = useState(false);
  const recFetched = useRef(false);

  useEffect(() => {
    if (isConnected) fetchActivities().catch(() => {});
  }, [isConnected, fetchActivities]);

  useEffect(() => {
    setLocalActivities(activities);
  }, [activities]);

  // Reset recommendation when the active plan changes (plan created or abandoned on this page)
  useEffect(() => {
    recFetched.current = false;
    setRecommendation(null);
    setPlanSessionIntro(null);
  }, [activePlan?.id]);

  // Fetch a short motivational intro for today's plan session (lazy, cached in localStorage)
  useEffect(() => {
    if (!activePlan) { setPlanSessionIntro(null); return; }
    const ctx = getTodayPlanContext(activePlan);
    if (!ctx) { setPlanSessionIntro(null); return; }

    // Key matches what SessionDetailPage also writes — shared cache
    const cacheKey = `sdp-intro-${activePlan.id}-w${ctx.week}-d${ctx.session.day_number}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setPlanSessionIntro(cached); return; }

    setLoadingIntro(true);
    fetch(`${API_BASE}/api/ai/session-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: ctx.session,
        week: ctx.week,
        total_weeks: activePlan.total_weeks,
        plan_goal: activePlan.goal,
      }),
    })
      .then(r => r.json())
      .then(d => {
        const intro = d.detail?.intro ?? d.intro;
        if (intro) {
          const short = intro.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
          setPlanSessionIntro(short);
          localStorage.setItem(cacheKey, short);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingIntro(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlan?.id]);

  // Recommendation: derive from active plan if one exists, otherwise call AI
  useEffect(() => {
    if (loadingPlan || recFetched.current) return;

    if (activePlan) {
      recFetched.current = true;
      const todaySession = getTodayPlanSession(activePlan);
      if (todaySession) {
        setRecommendation({
          source: 'plan',
          sessionType: todaySession.type,
          distance: todaySession.duration,
          targetPace: todaySession.pace_hint ?? null,
          recovery: todaySession.intensity ?? null,
          isRestDay: false,
          message: todaySession.description,
        });
      } else {
        setRecommendation({
          source: 'plan',
          sessionType: 'Descanso',
          distance: null,
          targetPace: null,
          recovery: null,
          isRestDay: true,
          message: 'Hoy toca descansar. El descanso activo es fundamental para progresar y evitar lesiones.',
        });
      }
      return;
    }

    // No active plan — fall back to AI recommendation based on recent activities
    if (localActivities.length === 0) return;
    recFetched.current = true;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const loadAIRecommendation = async () => {
      setLoadingRec(true);
      try {
        // 1. Check cache in Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: cached } = await supabase
            .from('strava_connections')
            .select('coach_recommendation, coach_rec_date')
            .eq('user_id', user.id)
            .single();

          if (cached?.coach_rec_date === today && cached?.coach_recommendation) {
            setRecommendation(cached.coach_recommendation as CoachRec);
            return;
          }
        }

        // 2. Cache miss — call Groq
        const r = await fetch(`${API_BASE}/api/ai/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activities: localActivities.slice(0, 10) }),
        });
        const d = await r.json();
        if (d.recommendation) {
          setRecommendation(d.recommendation);

          // 3. Save to Supabase cache
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) {
            await supabase
              .from('strava_connections')
              .update({ coach_recommendation: d.recommendation, coach_rec_date: today })
              .eq('user_id', u.id);
          }
        }
      } catch {
        // silently ignore — UI simply won't show the card
      } finally {
        setLoadingRec(false);
      }
    };

    loadAIRecommendation();
  }, [localActivities, loadingPlan, activePlan]);

  // Load active training plan from Supabase
  useEffect(() => {
    if (!user) return;
    setLoadingPlan(true);
    supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setActivePlan(data as StoredPlan | null);
        setLoadingPlan(false);
      });
  }, [user]);

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const firstName   = displayName.split(' ')[0];
  const today       = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!isConnected) {
    return (
      <div className="dash">
        <AppSidebar />
        <div className="dash__page">
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
        <AppSidebar />
        <div className="dash__page">
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
        <AppSidebar />
        <div className="dash__page">
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

  const recentActivities = localActivities.slice(0, 3);
  const weekStats = computeWeekStats(localActivities);
  const streak = computeStreak(localActivities);

  // Daily km for current week (Mon–Sun) — used for sparkline
  const weekDailyKm = (() => {
    const now = new Date();
    const dow = now.getDay();
    const daysToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToMon);
    const days = Array(7).fill(0);
    localActivities.forEach(act => {
      const d = new Date(act.date);
      const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) days[diff] += act.distance / 1000;
    });
    return days;
  })();
  const todayCompleted = (() => {
    if (!activePlan || !recommendation || recommendation.isRestDay || recommendation.source !== 'plan') return false;
    const ctx = getTodayPlanContext(activePlan);
    if (!ctx) return false;
    return isSessionCompleted(ctx.session, ctx.week, activePlan, localActivities);
  })();

  return (
    <div className="dash">
      <AppSidebar />
      <div className="dash__page">
        <div className="dash__main">

          {/* Saludo */}
          <div className="dash__greeting">
            <div className="dash__greeting-top">
              <div className="dash__greeting-left">
                <h2>Hola, {firstName} 👋</h2>
                {streak > 0 && (
                  <span className="dash__streak-pill">
                    <Flame size={13} strokeWidth={2} />
                    {streak} día{streak !== 1 ? 's' : ''} seguidos
                  </span>
                )}
              </div>
              <button className="dash__greeting-bell" aria-label="Notificaciones">
                <Bell size={20} strokeWidth={1.75} />
              </button>
            </div>
            <p>{today}</p>
          </div>

          {/* Stat cards — 2-col row */}
          <div className="dash__stats-row">
            <div className={`dash__stat-card dash__stat-card--km${weekStats.count === 0 ? ' dash__stat-card--empty' : ''}`}>
              <div className="dash__stat-card-top">
                <span className="dash__stat-card-label">Kilómetros</span>
                <FootprintsIcon size={20} strokeWidth={1.5} className="dash__stat-card-icon" />
              </div>
              <svg className="dash__sparkline" viewBox="0 0 70 36" preserveAspectRatio="none" aria-hidden="true">
                {weekDailyKm.map((km, i) => {
                  const max = Math.max(...weekDailyKm, 0.1);
                  const isEmpty = weekStats.count === 0;
                  const h = isEmpty ? 5 : Math.max((km / max) * 30, km > 0 ? 4 : 0);
                  return <rect key={i} x={i * 10 + 1} y={36 - h} width={8} height={h} rx={2} fill={km > 0 ? '#7C3AED' : '#E4E7EF'} />;
                })}
              </svg>
              <div className="dash__stat-card-bottom">
                <span className="dash__stat-card-value">{(weekStats.totalDist / 1000).toFixed(1)}</span>
                <span className="dash__stat-card-unit">km</span>
              </div>
            </div>

            <div className={`dash__stat-card dash__stat-card--runs${weekStats.count === 0 ? ' dash__stat-card--empty' : ''}`}>
              <div className="dash__stat-card-top">
                <span className="dash__stat-card-label">Carreras</span>
                <CalendarDays size={20} strokeWidth={1.5} className="dash__stat-card-icon" />
              </div>
              <div className="dash__stat-card-dots" aria-hidden="true">
                {['L','M','X','J','V','S','D'].map((d, i) => (
                  <div key={i} className={`dash__stat-card-dot${weekDailyKm[i] > 0 ? ' dash__stat-card-dot--active' : ''}`}>
                    <span className="dash__stat-card-dot-label">{d}</span>
                  </div>
                ))}
              </div>
              <div className="dash__stat-card-bottom">
                <span className="dash__stat-card-value">{weekStats.count}</span>
                <span className="dash__stat-card-unit">sesiones</span>
              </div>
              <span className="dash__stat-card-sub">{formatDuration(weekStats.totalTime)} en total</span>
            </div>

            <div className={`dash__stat-card dash__stat-card--time dash__stat-card--desktop-only${weekStats.count === 0 ? ' dash__stat-card--empty' : ''}`}>
              <div className="dash__stat-card-top">
                <span className="dash__stat-card-label">Tiempo</span>
                <Timer size={20} strokeWidth={1.5} className="dash__stat-card-icon" />
              </div>
              <div className="dash__stat-card-dots" aria-hidden="true">
                {['L','M','X','J','V','S','D'].map((d, i) => {
                  const mins = weekDailyKm[i] > 0 ? Math.round(weekDailyKm[i] * 6) : 0;
                  return (
                    <div key={i} className={`dash__stat-card-dot${mins > 0 ? ' dash__stat-card-dot--time' : ''}`}>
                      <span className="dash__stat-card-dot-label">{d}</span>
                    </div>
                  );
                })}
              </div>
              <div className="dash__stat-card-bottom">
                <span className="dash__stat-card-value">{formatDuration(weekStats.totalTime)}</span>
              </div>
              <span className="dash__stat-card-sub">esta semana</span>
            </div>
          </div>

          {/* Coach IA — full width */}
          <div className="dash__top-col">
              {(loadingRec || loadingPlan || recommendation) && (
                <div className="dash__ai">
                  <p className="dash__section-title">Coach IA</p>
                  <div className="dash__ai-header">
                      <span className="dash__ai-badge">
                        <Sparkles size={11} strokeWidth={2.5} />
                        Coach IA
                      </span>
                      {!loadingRec && !loadingPlan && recommendation && (
                        <span className={`dash__ai-day-label${todayCompleted ? ' dash__ai-day-label--done' : ''}`}>
                          {recommendation.isRestDay ? 'Día de descanso' : todayCompleted ? '✓ Sesión completada' : recommendation.source === 'plan' ? 'Sesión del plan' : 'Sesión de hoy'}
                        </span>
                      )}
                    </div>

                    {(loadingRec || loadingPlan) ? (
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
                        ) : todayCompleted ? (
                          <div className="dash__ai-completed">
                            <span className="dash__ai-completed-icon">🏆</span>
                            <div>
                              <span className="dash__ai-completed-label">¡Sesión completada!</span>
                              <span className="dash__ai-completed-sub">{recommendation.sessionType}</span>
                            </div>
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
                                <span className="dash__ai-grid-label">{recommendation.source === 'plan' ? 'Duración' : 'Distancia'}</span>
                                <span className="dash__ai-grid-value">{recommendation.distance ?? '—'}</span>
                              </div>
                              <div className="dash__ai-grid-item">
                                <span className="dash__ai-grid-label">Ritmo objetivo</span>
                                <span className="dash__ai-grid-value">{recommendation.targetPace ?? '—'}</span>
                              </div>
                              <div className="dash__ai-grid-item">
                                <span className="dash__ai-grid-label">{recommendation.source === 'plan' ? 'Intensidad' : 'Recuperación'}</span>
                                <span className="dash__ai-grid-value">{recommendation.recovery ?? '—'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <p className={`dash__ai-insight${loadingIntro && !planSessionIntro && !todayCompleted ? ' dash__ai-insight--loading' : ''}`}>
                          {todayCompleted
                            ? `¡Enhorabuena! Has completado la sesión de hoy. ${recommendation.source === 'plan' ? (planSessionIntro ?? recommendation.message) : recommendation.message}`
                            : (recommendation.source === 'plan' && !recommendation.isRestDay
                              ? (planSessionIntro ?? recommendation.message)
                              : recommendation.message)}
                        </p>
                        {recommendation.source === 'plan' && !recommendation.isRestDay && (() => {
                          const ctx = activePlan ? getTodayPlanContext(activePlan) : null;
                          return ctx ? (
                            <button
                              className="dash__ai-detail-link"
                              onClick={() => navigate(`/training-plan/session/${activePlan!.id}/${ctx.week}/${ctx.session.day_number}`)}
                            >
                              Ver sesión completa
                              <ChevronRight size={20} strokeWidth={2.5} />
                            </button>
                          ) : null;
                        })()}
                      </>
                    ) : null}
                </div>
              )}
          </div>

          {/* Bottom 2-col grid: Salidas recientes + Plan de entrenamiento */}
          <div className="dash__bottom-grid">

          {/* Salidas recientes */}
          {recentActivities.length > 0 && (
            <div className="dash__recent">
              <div className="dash__recent-header">
                <p className="dash__section-title">Salidas recientes</p>
                <button className="dash__recent-all" onClick={() => navigate('/activities')}>
                  Ver todas
                  <span className="dash__recent-all-icon"><ChevronRight size={14} strokeWidth={2.5} /></span>
                </button>
              </div>
              <div className="dash__recent-list">
                {recentActivities.map(act => (
                  <div
                    key={act.id}
                    className="dash__recent-row"
                    onClick={() => navigate(`/activity/${act.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/activity/${act.id}`)}
                  >
                    <div className="dash__recent-row-left">
                      <span className="dash__recent-row-name">{act.name}</span>
                      <span className="dash__recent-row-date">{formatDate(act.date)}</span>
                    </div>
                    <div className="dash__recent-row-stats">
                      <span className="dash__recent-row-stat">{formatDistance(act.distance)}</span>
                      <span className="dash__recent-row-sep">·</span>
                      <span className="dash__recent-row-stat">{formatPace(act.pace)}/km</span>
                      <span className="dash__recent-row-sep">·</span>
                      <span className="dash__recent-row-stat">{formatDuration(act.duration)}</span>
                    </div>
                    <ChevronRight size={24} className="dash__recent-row-arrow" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan de entrenamiento */}
          <TrainingPlan
            plan={activePlan}
            loading={loadingPlan}
            activities={localActivities}
            userId={user?.id ?? ''}
            onPlanCreated={setActivePlan}
            onPlanAbandoned={() => setActivePlan(null)}
            showSectionTitle
          />

          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
