import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Zap, ThumbsUp, TrendingUp, Sparkles, MapPin, Timer, Flame, Wind } from 'lucide-react';
import { supabase } from '../services/supabase/client';
import { useStrava } from '../hooks/useStrava';
import type { StoredPlan, PlanSession } from '../components/features/training/TrainingPlan';
import { findMatchingActivity } from '../components/features/training/TrainingPlan';
import { formatPace, formatDistance, formatDuration } from '../utils/formatters';
import { stravaClient } from '../services/strava/client';
import AppSidebar from '../components/common/AppSidebar';
import './SessionDetailPage.scss';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const DAY_FULL: Record<number, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
};
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function getSessionDate(startedAt: string, week: number, dayNumber: number): Date {
  const start = new Date(startedAt + 'T12:00:00');
  const dow = start.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const planMonday = new Date(start);
  planMonday.setDate(start.getDate() + daysToMonday);
  const sessionDate = new Date(planMonday);
  sessionDate.setDate(planMonday.getDate() + (week - 1) * 7 + (dayNumber - 1));
  return sessionDate;
}

interface IntervalBlock {
  type: 'work' | 'recovery';
  duration: string;
  pace: string;
  label: string;
}

interface SessionDetail {
  intro: string;
  warm_up: string;
  main: string;
  interval_blocks?: IntervalBlock[];
  reps?: number;
  cool_down: string;
  pace_target: string;
  estimated_time: string;
  tip: string;
}

interface SessionReview {
  headline: string;
  summary: string;
  well_done: string[];
  improve: string[];
  overall: string;
}

const isIntervalType = (type?: string): boolean =>
  /series|intervalo|fartlek|velocidad|tempo/i.test(type ?? '');

/** Strip markdown bold/italic/code markers that the AI sometimes includes */
function cleanText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();
}

const SessionDetailPage: React.FC = () => {
  const { planId, week: weekStr, day: dayStr } = useParams<{ planId: string; week: string; day: string }>();
  const navigate = useNavigate();

  const weekNum = parseInt(weekStr ?? '1', 10);
  const dayNum  = parseInt(dayStr  ?? '1', 10);

  const { activities, isConnected, fetchActivities } = useStrava();

  const [plan, setPlan]               = useState<StoredPlan | null>(null);
  const [detail, setDetail]           = useState<SessionDetail | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [review, setReview]           = useState<SessionReview | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [matchedActivity, setMatchedActivity] = useState<ReturnType<typeof findMatchingActivity>>(null);

  useEffect(() => {
    if (isConnected) fetchActivities().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  useEffect(() => {
    if (!planId) return;
    supabase
      .from('training_plans')
      .select('*')
      .eq('id', planId)
      .single()
      .then(({ data }) => {
        setPlan(data as StoredPlan | null);
        setLoadingPlan(false);
      });
  }, [planId]);

  const session: PlanSession | undefined = plan?.weeks
    ?.find(w => w.week === weekNum)
    ?.sessions.find(s => s.day_number === dayNum);

  useEffect(() => {
    if (!plan || !session) return;
    setLoadingDetail(true);
    setDetailError(null);
    fetch(`${API_BASE}/api/ai/session-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session,
        plan_goal: plan.goal,
        week: weekNum,
        total_weeks: plan.total_weeks,
        activities: activities.slice(0, 10).map(a => ({ date: a.date, distance: a.distance, pace: a.pace })),
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.detail) {
          setDetail(d.detail);
          // Cache intro so Dashboard can read it without a separate API call
          if (d.detail.intro && planId) {
            const short = d.detail.intro.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
            localStorage.setItem(`sdp-intro-${planId}-w${weekNum}-d${dayNum}`, short);
          }
        } else setDetailError(d.error ?? 'Error al obtener los detalles');
      })
      .catch(err => setDetailError(err.message))
      .finally(() => setLoadingDetail(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, weekNum, dayNum]);

  // Fetch AI coach review when both the plan session + matching Strava activity exist
  useEffect(() => {
    if (!plan || !session || activities.length === 0) return;
    const matchedAct = findMatchingActivity(session, weekNum, plan, activities);
    if (!matchedAct) return;
    setMatchedActivity(matchedAct);

    const cacheKey = `sdp-review-${planId}-w${weekNum}-d${dayNum}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { try { setReview(JSON.parse(cached)); } catch { /* ignore */ } return; }

    setLoadingReview(true);
    (async () => {
      // For interval sessions, try to fetch 1km splits from Strava for richer AI analysis
      let splits: Array<{ km: number; pace: string; hr?: number }> | undefined;
      if (isIntervalType(session.type)) {
        try {
          const raw = await stravaClient.getActivityById(matchedAct.id);
          if (Array.isArray(raw?.splits_metric) && raw.splits_metric.length > 1) {
            splits = raw.splits_metric.map((s: { split: number; average_speed: number; average_heartrate?: number }) => {
              const paceSec = s.average_speed > 0 ? Math.round(1000 / s.average_speed) : 0;
              return {
                km: s.split,
                pace: paceSec > 0 ? `${Math.floor(paceSec / 60)}:${String(paceSec % 60).padStart(2, '0')}` : '—',
                ...(s.average_heartrate ? { hr: Math.round(s.average_heartrate) } : {}),
              };
            });
          }
        } catch { /* splits are optional — review still works without them */ }
      }

      try {
        const res = await fetch(`${API_BASE}/api/ai/session-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session,
            activity: {
              name: matchedAct.name,
              distance_km: (matchedAct.distance / 1000).toFixed(2),
              duration_min: Math.round(matchedAct.duration / 60),
              pace_str: formatPace(matchedAct.pace),
              elevation_m: Math.round(matchedAct.elevation ?? 0) || undefined,
            },
            plan_goal: plan.goal,
            week: weekNum,
            total_weeks: plan.total_weeks,
            recent_activities: activities.slice(0, 10).map(a => ({ pace: a.pace, date: a.date })),
            splits,
          }),
        });
        const d = await res.json();
        if (d.review) {
          setReview(d.review);
          localStorage.setItem(cacheKey, JSON.stringify(d.review));
        }
      } catch { /* ignore review network errors */ }
    })().finally(() => setLoadingReview(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, activities.length, weekNum, dayNum]);

  const sessionDate = plan && session ? getSessionDate(plan.started_at, weekNum, dayNum) : null;
  const _dur = session?.duration ?? '';
  const _kmM = _dur.match(/(\d+(?:\.\d+)?)\s*km/i);
  const _minM = _dur.match(/(\d+)\s*min/i);
  const _hM = _dur.match(/(\d+(?:\.\d+)?)\s*h/i);
  const dispNum = _kmM?.[1] ?? _hM?.[1] ?? _minM?.[1] ?? _dur.split(/\s/)[0] ?? '';
  const dispUnit = _kmM ? 'km' : _hM ? 'h' : _minM ? "'" : '';

  return (
    <div className="sdp">
      <AppSidebar />
      <div className="sdp__page">
        <div className="sdp__main">
          {loadingPlan ? (
            <div className="sdp__loading">
              <div className="sdp__spinner" />
            </div>
          ) : !session ? (
            <p className="sdp__not-found">Sesión no encontrada.</p>
          ) : (
            <>
              {/* Nav bar */}
              <div className="sdp__nav">
                <button className="sdp__nav-back" onClick={() => navigate('/training-plan')} aria-label="Volver">
                  <ArrowLeft size={18} strokeWidth={2.5} />
                </button>
                <div className="sdp__nav-center">
                  <h1 className="sdp__nav-title">{session.type}</h1>
                  {sessionDate && (
                    <p className="sdp__nav-sub">
                      {DAY_FULL[dayNum]}, {sessionDate.getDate()} {MONTH_SHORT[sessionDate.getMonth()]}
                    </p>
                  )}
                </div>
                <div className="sdp__nav-spacer" />
              </div>

              <div className="sdp__content">
                {/* Hero card */}
                <div className={`sdp__hero sdp__hero--${(session.intensity ?? 'default').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>
                  <div className="sdp__hero-info">
                    <div className="sdp__hero-badges">
                      {session.intensity && (
                        <span className={`sdp__intensity sdp__intensity--${session.intensity}`}>
                          {session.intensity}
                        </span>
                      )}
                    </div>
                    <h2 className="sdp__hero-title">{session.type}</h2>
                    {session.description && <p className="sdp__hero-desc">{session.description}</p>}
                  </div>
                  {dispNum && (
                    <div className="sdp__hero-num">
                      <span className="sdp__hero-num-val">{dispNum}</span>
                      <span className="sdp__hero-num-unit">{dispUnit}</span>
                    </div>
                  )}
                </div>

              {/* Stats */}
              <div className="sdp__stats">
                <div className="sdp__stat sdp__stat--volume">
                  <div className="sdp__stat-icon-wrap">
                    <Clock size={20} strokeWidth={1.75} />
                  </div>
                  <div className="sdp__stat-info">
                    <span className="sdp__stat-label">Volumen</span>
                    <span className="sdp__stat-value">{session.duration}</span>
                  </div>
                </div>
                {session.pace_hint && (
                  <div className="sdp__stat sdp__stat--pace">
                    <div className="sdp__stat-icon-wrap">
                      <Zap size={20} strokeWidth={1.75} />
                    </div>
                    <div className="sdp__stat-info">
                      <span className="sdp__stat-label">Ritmo sugerido</span>
                      <span className="sdp__stat-value">{session.pace_hint}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Detail */}
              {loadingDetail ? (
                <div className="sdp__detail-loading">
                  <div className="sdp__spinner" />
                  <span>El coach IA está preparando tus instrucciones...</span>
                </div>
              ) : detailError ? (
                <div className="sdp__error">⚠ {detailError}</div>
              ) : detail ? (
                <div className="sdp__detail">
                  <div className="sdp__detail-body">
                    <p className="sdp__detail-intro">{cleanText(detail.intro)}</p>

                    <div className="sdp__detail-grid">
                      <div className="sdp__detail-stat">
                        <span className="sdp__detail-stat-label">Tiempo estimado</span>
                        <span className="sdp__detail-stat-value">{detail.estimated_time}</span>
                      </div>
                      {detail.pace_target && (
                        <div className="sdp__detail-stat">
                          <span className="sdp__detail-stat-label">Ritmo objetivo</span>
                          <span className="sdp__detail-stat-value">{detail.pace_target}</span>
                        </div>
                      )}
                    </div>

                    {/* AI Coach review — only shown when session is completed */}
                    {(loadingReview || review) && (
                      <div className="sdp__review">
                        {loadingReview && !review ? (
                          <div className="sdp__review-loading">
                            <div className="sdp__spinner" />
                            <span>El coach IA está analizando tu sesión...</span>
                          </div>
                        ) : review ? (
                          <>
                            {/* Hero headline */}
                            <div className="sdp__review-hero">
                              <span className="sdp__review-done-pill">✓ Sesión completada</span>
                              <h2 className="sdp__review-headline">{review.headline} 🔥</h2>
                            </div>

                            {/* Actual activity stat cards */}
                            {matchedActivity && (
                              <div className="sdp__review-stats">
                                <div className="sdp__review-stat sdp__review-stat--distance">
                                  <div className="sdp__review-stat-icon"><MapPin size={18} strokeWidth={1.75} /></div>
                                  <span className="sdp__review-stat-label">Distancia</span>
                                  <span className="sdp__review-stat-value">{formatDistance(matchedActivity.distance)}</span>
                                </div>
                                <div className="sdp__review-stat sdp__review-stat--time">
                                  <div className="sdp__review-stat-icon"><Timer size={18} strokeWidth={1.75} /></div>
                                  <span className="sdp__review-stat-label">Tiempo</span>
                                  <span className="sdp__review-stat-value">{formatDuration(matchedActivity.duration)}</span>
                                </div>
                                <div className="sdp__review-stat sdp__review-stat--pace">
                                  <div className="sdp__review-stat-icon"><Zap size={18} strokeWidth={1.75} /></div>
                                  <span className="sdp__review-stat-label">Ritmo medio</span>
                                  <span className="sdp__review-stat-value">{formatPace(matchedActivity.pace)}</span>
                                </div>
                              </div>
                            )}

                            {/* Coach analysis */}
                            <div className="sdp__review-analysis">
                              <div className="sdp__review-badge-row">
                                <span className="sdp__review-badge"><Sparkles size={10} strokeWidth={2.5} /> Análisis del entrenador</span>
                              </div>
                              <p className="sdp__review-summary">{cleanText(review.summary)}</p>
                              <div className="sdp__review-cols">
                                <div className="sdp__review-col sdp__review-col--good">
                                  <span className="sdp__review-col-title"><ThumbsUp size={13} strokeWidth={2} /> Lo que hiciste bien</span>
                                  <ul className="sdp__review-list">
                                    {review.well_done.map((item, i) => (
                                      <li key={i}>{cleanText(item)}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="sdp__review-col sdp__review-col--improve">
                                  <span className="sdp__review-col-title"><TrendingUp size={13} strokeWidth={2} /> A tener en cuenta</span>
                                  <ul className="sdp__review-list">
                                    {review.improve.map((item, i) => (
                                      <li key={i}>{cleanText(item)}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              <p className="sdp__review-overall">{cleanText(review.overall)}</p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="sdp__detail-aside">
                    <p className="sdp__blocks-title">Plan de sesión</p>
                    <div className="sdp__blocks">
                      <div className="sdp__block sdp__block--warmup">
                        <div className="sdp__block-header">
                          <span className="sdp__block-num">1</span>
                          <div className="sdp__block-icon-wrap"><Flame size={13} strokeWidth={2.2} /></div>
                          <span className="sdp__block-label">Calentamiento</span>
                          {detail.reps != null && (
                            <span className="sdp__interval-reps">×{detail.reps}</span>
                          )}
                        </div>
                        {detail.interval_blocks && detail.interval_blocks.length > 0 ? (
                          <div className="sdp__interval-blocks">
                            {detail.interval_blocks.map((blk, i) => (
                              <div key={i} className={`sdp__interval-block sdp__interval-block--${blk.type}`}>
                                <span className="sdp__interval-block-label">{blk.label}</span>
                                <span className="sdp__interval-block-duration">{blk.duration}</span>
                                <span className="sdp__interval-block-pace">{blk.pace}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="sdp__block-text">{cleanText(detail.main)}</p>
                        )}
                      </div>
                      <div className="sdp__block sdp__block--main">
                        <div className="sdp__block-header">
                          <span className="sdp__block-num">2</span>
                          <div className="sdp__block-icon-wrap"><Zap size={13} strokeWidth={2.2} /></div>
                          <span className="sdp__block-label">Parte principal</span>
                          {detail.reps != null && (
                            <span className="sdp__interval-reps">×{detail.reps}</span>
                          )}
                        </div>
                        {detail.interval_blocks && detail.interval_blocks.length > 0 ? (
                          <div className="sdp__interval-blocks">
                            {detail.interval_blocks.map((blk, i) => (
                              <div key={i} className={`sdp__interval-block sdp__interval-block--${blk.type}`}>
                                <span className="sdp__interval-block-label">{blk.label}</span>
                                <span className="sdp__interval-block-duration">{blk.duration}</span>
                                <span className="sdp__interval-block-pace">{blk.pace}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="sdp__block-text">{cleanText(detail.main)}</p>
                        )}
                      </div>
                      <div className="sdp__block sdp__block--cooldown">
                        <div className="sdp__block-header">
                          <span className="sdp__block-num">3</span>
                          <div className="sdp__block-icon-wrap"><Wind size={13} strokeWidth={2.2} /></div>
                          <span className="sdp__block-label">Vuelta a la calma</span>
                        </div>
                        <p className="sdp__block-text">{cleanText(detail.cool_down)}</p>
                      </div>
                    </div>
                    <div className="sdp__tip">
                      <span className="sdp__tip-icon">💡</span>
                      <p className="sdp__tip-text">{cleanText(detail.tip)}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionDetailPage;
