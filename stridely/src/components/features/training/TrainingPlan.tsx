import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ClipboardList, Check, X } from 'lucide-react';
import { supabase } from '../../../services/supabase/client';
import type { Workout } from '../../../types';
import MiniCalendar from './MiniCalendar';
import './TrainingPlan.scss';

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

function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export interface PlanSession {
  day_number: number;
  type: string;
  duration: string;
  description: string;
  intensity?: string;
  pace_hint?: string;
}

export interface PlanWeek {
  week: number;
  sessions: PlanSession[];
}

export interface StoredPlan {
  id: string;
  goal: string; // '5km' | '10km' | 'half' | 'marathon'
  sessions_per_week: number;
  total_weeks: number;
  weeks: PlanWeek[];
  started_at: string;
}

const GOAL_LABELS: Record<string, string> = {
  '5km': '5 km',
  '10km': '10 km',
  'half': 'Media maratón',
  'marathon': 'Maratón',
};
function getGoalLabel(goal: string): string {
  return GOAL_LABELS[goal] ?? goal;
}

interface Props {
  plan: StoredPlan | null;
  loading: boolean;
  activities: Workout[];
  userId: string;
  onPlanCreated: (plan: StoredPlan) => void;
  onPlanAbandoned?: () => void;
  fullPage?: boolean;
  showSectionTitle?: boolean;
}

export function parsePlanDurationMin(s: string): number {
  const range = s.match(/(\d+)\s*[-\u2013]\s*(\d+)\s*min/i);
  if (range) return (parseInt(range[1]) + parseInt(range[2])) / 2;
  const single = s.match(/(\d+)\s*min/i);
  if (single) return parseInt(single[1]);
  return 0;
}

export function isSessionCompleted(session: PlanSession, weekNum: number, plan: StoredPlan, activities: Workout[]): boolean {
  return findMatchingActivity(session, weekNum, plan, activities) !== null;
}

export function isSessionMissed(session: PlanSession, weekNum: number, plan: StoredPlan, activities: Workout[]): boolean {
  if (isSessionCompleted(session, weekNum, plan, activities)) return false;
  const sessionDate = getSessionDate(plan.started_at, weekNum, session.day_number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  sessionDate.setHours(0, 0, 0, 0);
  return sessionDate < today;
}

// Weeks are measured from the Monday of the week when the plan started,
// exactly matching getSessionDate's planMonday anchor. Uses Date.UTC to be
// immune to DST transitions (Spain CET→CEST loses one hour).
export function getPlanCurrentWeek(plan: StoredPlan): number {
  const [sy, sm, sd] = plan.started_at.split('-').map(Number);
  const startUTC = Date.UTC(sy, sm - 1, sd);
  const startDow = new Date(startUTC).getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = startDow === 0 ? -6 : 1 - startDow;
  const planMondayUTC = startUTC + daysToMonday * 86400000;
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((todayUTC - planMondayUTC) / 86400000);
  return Math.min(Math.floor(diffDays / 7) + 1, plan.total_weeks);
}

export function findMatchingActivity(session: PlanSession, weekNum: number, plan: StoredPlan, activities: Workout[]): Workout | null {
  const sessionDate = getSessionDate(plan.started_at, weekNum, session.day_number);
  const toYMD = (d: Date | string) => {
    const dt = new Date(d as string);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const sessionMs = new Date(sessionDate).getTime();
  const dayMs = 86400000;
  // Accept activities done ±1 day from the planned date
  const candidateDates = new Set([
    toYMD(new Date(sessionMs - dayMs)),
    toYMD(new Date(sessionMs)),
    toYMD(new Date(sessionMs + dayMs)),
  ]);
  const act = activities.find(a => candidateDates.has(toYMD(a.date as unknown as string)));
  if (!act) return null;

  // Prevent double-matching: if another session is closer (or equidistant but
  // earlier than the activity – the real "missed" session), yield to that one.
  const actMs = new Date(act.date as unknown as string).getTime();
  const myDist = Math.abs(actMs - sessionMs);
  for (const planWeek of plan.weeks) {
    for (const s of planWeek.sessions) {
      if (planWeek.week === weekNum && s.day_number === session.day_number) continue;
      const otherMs = new Date(getSessionDate(plan.started_at, planWeek.week, s.day_number)).getTime();
      const otherDist = Math.abs(actMs - otherMs);
      if (otherDist < myDist) return null; // strictly closer session exists
      // Equidistant: the session BEFORE the activity is the one that was missed → it wins
      if (otherDist === myDist && otherMs < actMs && sessionMs > actMs) return null;
    }
  }

  const plannedMin = parsePlanDurationMin(session.duration);
  if (plannedMin > 0 && (act.duration / 60) < plannedMin * 0.55) return null;
  return act;
}

function getSessionColor(type: string, intensity?: string): string {
  const t = type.toLowerCase();
  const iv = (intensity ?? '').toLowerCase();

  if (t.includes('día de carrera') || t.includes('carrera')) return 'red';
  if (iv === 'intenso' || t.includes('interval') || t.includes('fartlek') || t.includes('series') || t.includes('vo2')) return 'red';
  if (iv === 'moderado' || t.includes('tempo') || t.includes('umbral') || t.includes('progres')) return 'amber';
  if (t.includes('largo') || t.includes('tirada')) return 'blue';
  if (t.includes('recupera') || t.includes('descanso') || t.includes('rest')) return 'gray';
  return 'green'; // easy / rodaje / default
}

interface PlanInsight {
  adjustable: boolean;
  banner: string;
  sessions_changed: { week: number; day_number: number; old_type: string; new_type: string; new_duration: string; reason: string }[];
}

export const TrainingPlan: React.FC<Props> = ({ plan, loading, activities, userId, onPlanCreated, onPlanAbandoned, fullPage = false, showSectionTitle = false }) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<'goal' | 'race-details' | 'runner-profile' | 'days' | 'generating'>('goal');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  // Race-specific wizard state
  const [raceDistance, setRaceDistance] = useState<string | null>(null);
  const [raceDate, setRaceDate] = useState('');
  const [weeklyKm, setWeeklyKm] = useState<string | null>(null);
  const [longestRun, setLongestRun] = useState<string | null>(null);
  const [raceGoalType, setRaceGoalType] = useState<'finish' | 'time'>('finish');
  const [targetTime, setTargetTime] = useState('');
  const [longRunDay, setLongRunDay] = useState<'saturday' | 'sunday' | 'any'>('any');
  // Plan insight banner
  const [planInsight, setPlanInsight] = useState<PlanInsight | null>(null);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(false);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const [insightApplied, setInsightApplied] = useState(false);
  const didFetchInsight = useRef(false);

  useEffect(() => {
    if (!plan || loading || activities.length === 0 || didFetchInsight.current) return;
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `plan-insight-${plan.id}-${today}`;
    const dismissKey = `plan-insight-dismissed-${plan.id}-${today}`;
    if (localStorage.getItem(dismissKey)) { setInsightDismissed(true); return; }
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setPlanInsight(JSON.parse(cached)); return; }

    const currentWeek = getPlanCurrentWeek(plan);
    const missedSessions: { week: number; type: string; duration: string }[] = [];
    for (const pw of plan.weeks) {
      if (pw.week >= currentWeek) continue;
      for (const s of pw.sessions) {
        if (isSessionMissed(s, pw.week, plan, activities)) {
          missedSessions.push({ week: pw.week, type: s.type, duration: s.duration });
        }
      }
    }
    const currentWeekSessions = plan.weeks.find(w => w.week === currentWeek)?.sessions ?? [];
    for (const s of currentWeekSessions) {
      if (isSessionMissed(s, currentWeek, plan, activities)) {
        missedSessions.push({ week: currentWeek, type: s.type, duration: s.duration });
      }
    }
    if (missedSessions.length === 0) return;
    didFetchInsight.current = true;

    const acts = activities.slice(0, 10).map(a => ({
      date: a.date ? new Date(a.date as unknown as string).toISOString().split('T')[0] : '',
      distance_km: a.distance ? (a.distance / 1000).toFixed(1) : '0',
    }));

    fetch(`${API_BASE}/api/ai/plan-adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, activities: acts, missed_sessions: missedSessions }),
    })
      .then(r => r.json())
      .then((data: PlanInsight) => {
        if (data.banner) {
          localStorage.setItem(cacheKey, JSON.stringify(data));
          setPlanInsight(data);
        }
      })
      .catch(() => { /* silent fail */ });
  }, [plan, loading, activities]);

  const applyPlanChanges = async () => {
    if (!plan || !planInsight || planInsight.sessions_changed.length === 0) return;
    setApplyingChanges(true);
    // Clone weeks and apply each session change
    const updatedWeeks = plan.weeks.map(pw => ({
      ...pw,
      sessions: pw.sessions.map(s => {
        const change = planInsight.sessions_changed.find(
          c => c.week === pw.week && c.day_number === s.day_number
        );
        if (!change) return s;
        return { ...s, type: change.new_type, duration: change.new_duration };
      }),
    }));
    const { data, error } = await supabase
      .from('training_plans')
      .update({ weeks: updatedWeeks })
      .eq('id', plan.id)
      .select()
      .single();
    setApplyingChanges(false);
    if (!error && data) {
      onPlanCreated(data as unknown as StoredPlan);
      setInsightApplied(true);
      setInsightExpanded(false);
      // Auto-dismiss after 3s
      setTimeout(() => setInsightDismissed(true), 3000);
    }
  };

  const handleAbandon = async () => {
    if (!plan) return;
    setAbandoning(true);
    await supabase.from('training_plans').update({ status: 'abandoned' }).eq('id', plan.id);
    setAbandoning(false);
    setShowAbandonModal(false);
    onPlanAbandoned?.();
  };

  // Date.UTC arithmetic: immune to DST (e.g. Spain loses 1h on March 29)
  const currentWeek = plan ? getPlanCurrentWeek(plan) : 1;

  const progress = plan ? Math.round((currentWeek / plan.total_weeks) * 100) : 0;
  const weekSessions = plan?.weeks?.find(w => w.week === currentWeek)?.sessions ?? [];
  const allWeeks = plan?.weeks ?? [];

  const openModal = () => {
    setStep('goal');
    setSelectedGoal(null);
    setSelectedDays(null);
    setRaceDistance(null);
    setRaceDate('');
    setWeeklyKm(null);
    setLongestRun(null);
    setRaceGoalType('finish');
    setTargetTime('');
    setLongRunDay('any');
    setGenError(null);
    setShowModal(true);
  };

  const handleGenerate = async () => {
    if (!selectedDays) return;
    const isRace = selectedGoal === 'race';
    if (isRace && (!raceDistance || !raceDate)) return;
    if (!isRace && !selectedGoal) return;

    setStep('generating');
    setGenerating(true);
    setGenError(null);

    try {
      const body = isRace
        ? {
            mode: 'race',
            race_distance: raceDistance,
            race_date: raceDate,
            days_per_week: selectedDays,
            activities: activities.slice(0, 5),
            weekly_km: weeklyKm,
            longest_run: longestRun,
            race_goal: raceGoalType,
            target_time: targetTime,
          }
        : {
            goal: selectedGoal,
            days_per_week: selectedDays,
            activities: activities.slice(0, 5),
          };
      if (isRace) (body as Record<string, unknown>).long_run_day = longRunDay;

      const r = await fetch(`${API_BASE}/api/ai/training-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || !d.plan) throw new Error(d.error ?? 'Error generando plan');

      const today = new Date().toISOString().split('T')[0];
      const goalToStore = isRace ? raceDistance! : selectedGoal!;

      const { data: saved, error: dbErr } = await supabase
        .from('training_plans')
        .insert({
          user_id: userId,
          goal: goalToStore,
          sessions_per_week: selectedDays,
          total_weeks: d.plan.total_weeks,
          weeks: d.plan.weeks,
          started_at: today,
          status: 'active',
        })
        .select()
        .single();

      if (dbErr) throw new Error('Error guardando el plan. Asegúrate de crear la tabla training_plans en Supabase.');

      onPlanCreated(saved as unknown as StoredPlan);
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setGenError(msg);
      setStep('days');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="tplan">
        {showSectionTitle && (
          <p className="tplan__section-title">Plan de entrenamiento</p>
        )}
        {loading ? (
          <div className="tplan__loading">
            <div className="tplan__skeleton tplan__skeleton--title" />
            <div className="tplan__skeleton tplan__skeleton--bar" />
            <div className="tplan__skeleton tplan__skeleton--row" />
            <div className="tplan__skeleton tplan__skeleton--row" />
          </div>
        ) : plan ? (
          <>
            <div className="tplan__top">
              <div className="tplan__header-row">
                <span className="tplan__badge"><ClipboardList size={12} strokeWidth={2.2} /> Plan activo</span>
                <div className="tplan__header-actions">
                  <span className="tplan__goal-tag">{getGoalLabel(plan.goal)}</span>
                </div>
              </div>
              <div className="tplan__week-row">
                <span className="tplan__week-label">Semana {currentWeek} de {plan.total_weeks}</span>
                <span className="tplan__week-pct">{progress}%</span>
              </div>
              <div className="tplan__segments">
                {Array.from({ length: plan.total_weeks }, (_, i) => (
                  <div
                    key={i}
                    className={`tplan__segment${
                      i + 1 < currentWeek ? ' tplan__segment--done' :
                      i + 1 === currentWeek ? ' tplan__segment--current' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            {planInsight && !insightDismissed && (
              <div className={`tplan__insight tplan__insight--${insightApplied ? 'success' : planInsight.adjustable ? 'adjusted' : 'warning'}`}>
                <div className="tplan__insight-body">
                  <span className="tplan__insight-icon">
                    {insightApplied ? '✅' : planInsight.adjustable ? '🔄' : '⚠️'}
                  </span>
                  <div className="tplan__insight-content">
                    <p className="tplan__insight-text">
                      {insightApplied ? 'Plan actualizado con los ajustes del coach.' : planInsight.banner}
                    </p>

                    {!insightApplied && planInsight.adjustable && planInsight.sessions_changed.length > 0 && (
                      <>
                        <button
                          className="tplan__insight-toggle"
                          onClick={() => setInsightExpanded(v => !v)}
                        >
                          {insightExpanded ? 'Ocultar propuesta ↑' : `Ver propuesta (${planInsight.sessions_changed.length} cambio${planInsight.sessions_changed.length > 1 ? 's' : ''}) ↓`}
                        </button>

                        {insightExpanded && (
                          <div className="tplan__insight-changes">
                            {planInsight.sessions_changed.map((c, i) => {
                              const sessionDate = plan ? getSessionDate(plan.started_at, c.week, c.day_number) : null;
                              const dateLabel = sessionDate ? `${DAY_FULL[c.day_number]} ${fmtDate(sessionDate)}` : `Sem. ${c.week}`;
                              return (
                              <div key={i} className="tplan__insight-change">
                                <div className="tplan__insight-change-top">
                                  <span className="tplan__insight-change-week">{dateLabel}</span>
                                  <span className="tplan__insight-change-arrow">
                                    <span className="tplan__insight-change-old">{c.old_type}</span>
                                    <span>→</span>
                                    <span className="tplan__insight-change-new">{c.new_type} · {c.new_duration}</span>
                                  </span>
                                </div>
                                <p className="tplan__insight-change-reason">{c.reason}</p>
                              </div>
                              );
                            })}
                            <div className="tplan__insight-actions">
                              <button
                                className="tplan__insight-btn tplan__insight-btn--confirm"
                                onClick={applyPlanChanges}
                                disabled={applyingChanges}
                              >
                                {applyingChanges ? 'Aplicando…' : 'Aplicar cambios'}
                              </button>
                              <button
                                className="tplan__insight-btn tplan__insight-btn--discard"
                                onClick={() => setInsightExpanded(false)}
                                disabled={applyingChanges}
                              >
                                Descartar
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <button
                  className="tplan__insight-close"
                  aria-label="Cerrar aviso"
                  onClick={() => {
                    setInsightDismissed(true);
                    localStorage.setItem(`plan-insight-dismissed-${plan!.id}-${new Date().toISOString().split('T')[0]}`, '1');
                  }}
                ><X size={14} strokeWidth={2.5} /></button>
              </div>
            )}

            <div className="tplan__sessions">
              {fullPage ? (
                // Full page: show all weeks
                allWeeks.map(week => (
                  <div key={week.week} className="tplan__week-block">
                    <p className={`tplan__sessions-title${week.week === currentWeek ? ' tplan__sessions-title--current' : ''}`}>
                      {week.week === currentWeek ? `▶ Semana ${week.week} — actual` : `Semana ${week.week}`}
                    </p>
                    {week.sessions.map((s, i) => {
                      const done = isSessionCompleted(s, week.week, plan, activities);
                      const missed = !done && isSessionMissed(s, week.week, plan, activities);
                      return (
                      <div
                        key={i}
                        className={`tplan__session-card tplan__session-card--${getSessionColor(s.type, s.intensity)}${done ? ' tplan__session-card--completed' : ''}${missed ? ' tplan__session-card--missed' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/training-plan/session/${plan.id}/${week.week}/${s.day_number}`)}
                        onKeyDown={e => e.key === 'Enter' && navigate(`/training-plan/session/${plan.id}/${week.week}/${s.day_number}`)}
                      >
                        <div className="tplan__session-card-top">
                          <span className="tplan__session-card-date">
                            {DAY_FULL[s.day_number]}, {fmtDate(getSessionDate(plan.started_at, week.week, s.day_number))}
                          </span>
                          {done && <span className="tplan__session-card-done"><Check size={11} strokeWidth={2.5} /> Completada</span>}
                          {missed && <span className="tplan__session-card-missed"><X size={11} strokeWidth={2.5} /> No completada</span>}
                        </div>
                        <p className="tplan__session-card-title">
                          {s.type}<span className="tplan__session-card-desc">: {s.duration}</span>
                        </p>
                        {s.description && (
                          <p className="tplan__session-card-subdesc">{s.description}</p>
                        )}
                        {s.pace_hint && (
                          <p className="tplan__session-card-meta">{s.pace_hint}</p>
                        )}
                        <div className="tplan__session-card-arrow-btn" aria-hidden="true">
                          <ArrowUpRight size={16} strokeWidth={2.5} />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                // Dashboard card: only current week
                <>
                  <p className="tplan__sessions-title">Esta semana</p>
                  {weekSessions.length > 0 ? weekSessions.map((s, i) => {
                    const done = isSessionCompleted(s, currentWeek, plan, activities);
                    const missed = !done && isSessionMissed(s, currentWeek, plan, activities);
                    return (
                    <div
                      key={i}
                      className={`tplan__session-card tplan__session-card--${getSessionColor(s.type, s.intensity)}${done ? ' tplan__session-card--completed' : ''}${missed ? ' tplan__session-card--missed' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/training-plan/session/${plan.id}/${currentWeek}/${s.day_number}`)}
                      onKeyDown={e => e.key === 'Enter' && navigate(`/training-plan/session/${plan.id}/${currentWeek}/${s.day_number}`)}
                    >
                      <div className="tplan__session-card-top">
                        <span className="tplan__session-card-date">
                          {DAY_FULL[s.day_number]}, {fmtDate(getSessionDate(plan.started_at, currentWeek, s.day_number))}
                        </span>
                        {done && <span className="tplan__session-card-done"><Check size={11} strokeWidth={2.5} /> Completada</span>}
                        {missed && <span className="tplan__session-card-missed"><X size={11} strokeWidth={2.5} /> No completada</span>}
                      </div>
                      <p className="tplan__session-card-title">
                        {s.type}<span className="tplan__session-card-desc">: {s.duration}</span>
                      </p>
                      {s.description && (
                        <p className="tplan__session-card-subdesc">{s.description}</p>
                      )}
                      {s.pace_hint && (
                        <p className="tplan__session-card-meta">{s.pace_hint}</p>
                      )}
                      <div className="tplan__session-card-arrow-btn" aria-hidden="true">
                        <ArrowUpRight size={16} strokeWidth={2.5} />
                      </div>
                    </div>
                    );
                  }) : (
                    <p className="tplan__sessions-empty">No hay sesiones para esta semana</p>
                  )}
                </>
              )}
            </div>
            {fullPage && (
              <button
                className="tplan__abandon-btn"
                onClick={() => setShowAbandonModal(true)}
              >
                Abandonar plan
              </button>
            )}
          </>
        ) : (
          <div className="tplan__empty">
            <div className="tplan__empty-icon">🎯</div>
            <p className="tplan__empty-title">Sin plan activo</p>
            <p className="tplan__empty-sub">Crea un plan personalizado con IA para alcanzar tu próximo objetivo</p>
            <button className="tplan__cta" onClick={openModal}>Empezar un plan</button>
          </div>
        )}
      </div>

      {showAbandonModal && (
        <div className="tplan-overlay" onClick={() => !abandoning && setShowAbandonModal(false)}>
          <div className="tplan-modal tplan-modal--abandon" onClick={e => e.stopPropagation()}>
            {!abandoning && (
              <button className="tplan-modal__close" onClick={() => setShowAbandonModal(false)} aria-label="Cerrar">✕</button>
            )}
            <div className="tplan-modal__abandon-icon">🗑️</div>
            <h2 className="tplan-modal__title">¿Abandonar el plan?</h2>
            <p className="tplan-modal__sub">
              Perderás tu progreso en el plan <strong>{plan ? getGoalLabel(plan.goal) : ''}</strong>. Podrás crear uno nuevo cuando quieras.
            </p>
            <div className="tplan-modal__footer">
              <button
                className="tplan-modal__btn tplan-modal__btn--ghost"
                onClick={() => setShowAbandonModal(false)}
                disabled={abandoning}
              >
                Cancelar
              </button>
              <button
                className="tplan-modal__btn tplan-modal__btn--danger"
                onClick={handleAbandon}
                disabled={abandoning}
              >
                {abandoning ? 'Abandonando...' : 'Sí, abandonar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="tplan-overlay" onClick={() => !generating && setShowModal(false)}>
          <div className="tplan-modal" onClick={e => e.stopPropagation()}>
            {!generating && (
              <button className="tplan-modal__close" onClick={() => setShowModal(false)} aria-label="Cerrar">✕</button>
            )}

            {/* Step goal: choose type */}
            {step === 'goal' && (
              <div className="tplan-modal__step">
                <p className="tplan-modal__step-num">Paso 1 de {selectedGoal === 'race' ? '4' : '2'}</p>
                <h2 className="tplan-modal__title">¿Cuál es tu objetivo?</h2>
                <p className="tplan-modal__sub">Crearemos un plan basado en tus actividades de Strava</p>
                <div className="tplan-modal__options">
                  <button
                    className={`tplan-modal__option${selectedGoal === '5km' ? ' tplan-modal__option--selected' : ''}`}
                    onClick={() => setSelectedGoal('5km')}
                  >
                    <span className="tplan-modal__option-icon">🏃</span>
                    <span className="tplan-modal__option-title">Mis primeros 5 km</span>
                    <span className="tplan-modal__option-sub">Ideal para empezar a correr</span>
                  </button>
                  <button
                    className={`tplan-modal__option${selectedGoal === '10km' ? ' tplan-modal__option--selected' : ''}`}
                    onClick={() => setSelectedGoal('10km')}
                  >
                    <span className="tplan-modal__option-icon">🚀</span>
                    <span className="tplan-modal__option-title">Llegar a los 10 km</span>
                    <span className="tplan-modal__option-sub">Para corredores con algo de base</span>
                  </button>
                  <button
                    className={`tplan-modal__option${selectedGoal === 'race' ? ' tplan-modal__option--selected' : ''}`}
                    onClick={() => setSelectedGoal('race')}
                  >
                    <span className="tplan-modal__option-icon">🎽</span>
                    <span className="tplan-modal__option-title">Carrera específica</span>
                    <span className="tplan-modal__option-sub">Prepárate para tu próxima carrera</span>
                  </button>
                </div>
                <button
                  className="tplan-modal__btn"
                  disabled={!selectedGoal}
                  onClick={() => selectedGoal === 'race' ? setStep('race-details') : setStep('days')}
                >
                  Continuar →
                </button>
              </div>
            )}

            {/* Step race-details: distance + date */}
            {step === 'race-details' && (() => {
              const todayStr = new Date().toISOString().split('T')[0];
              // Mirror server calculation — timezone-safe noon-based dates, no forced minimum
              const planWeeks = (() => {
                if (!raceDate) return null;
                const today = new Date();
                const dow = today.getDay();
                const daysToMonday = dow === 0 ? -6 : 1 - dow;
                const planMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMonday, 12, 0, 0);
                const [ry, rm, rd] = raceDate.split('-').map(Number);
                const raceNoon = new Date(ry, rm - 1, rd, 12, 0, 0);
                const weeks = Math.ceil((raceNoon.getTime() - planMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
                return Math.min(weeks, 24);
              })();
              const tooSoon = planWeeks !== null && planWeeks < 4;
              return (
                <div className="tplan-modal__step">
                  <p className="tplan-modal__step-num">Paso 2 de 4</p>
                  <h2 className="tplan-modal__title">Tu carrera objetivo</h2>
                  <p className="tplan-modal__sub">Personalizaremos el plan hasta el día de la carrera</p>

                  <label className="tplan-modal__label">Distancia</label>
                  <div className="tplan-modal__race-distances">
                    {[
                      { id: '5km', label: '5 km' },
                      { id: '10km', label: '10 km' },
                      { id: 'half', label: 'Media\nmaratón' },
                      { id: 'marathon', label: 'Maratón' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        className={`tplan-modal__race-dist-opt${raceDistance === opt.id ? ' tplan-modal__race-dist-opt--selected' : ''}`}
                        onClick={() => setRaceDistance(opt.id)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <label className="tplan-modal__label">Fecha de la carrera</label>
                  <MiniCalendar
                    value={raceDate}
                    min={todayStr}
                    onChange={setRaceDate}
                  />
                  {planWeeks !== null && (
                    <p className={`tplan-modal__race-weeks${tooSoon ? ' tplan-modal__race-weeks--warning' : ''}`}>
                      {tooSoon
                        ? `⚠ Solo ${planWeeks} semana${planWeeks === 1 ? '' : 's'} — necesitas al menos 4 semanas para entrenar`
                        : `📅 Plan de ${planWeeks} semanas — el último día es el día de tu carrera`}
                    </p>
                  )}

                  <div className="tplan-modal__footer">
                    <button className="tplan-modal__btn tplan-modal__btn--ghost" onClick={() => setStep('goal')}>← Atrás</button>
                    <button
                      className="tplan-modal__btn"
                      disabled={!raceDistance || !raceDate || tooSoon}
                      onClick={() => setStep('runner-profile')}
                    >
                      Continuar →
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Step runner-profile: current level */}
            {step === 'runner-profile' && (
              <div className="tplan-modal__step">
                <p className="tplan-modal__step-num">Paso 3 de 4</p>
                <h2 className="tplan-modal__title">Tu nivel actual</h2>
                <p className="tplan-modal__sub">Calibraremos la intensidad del plan a tu forma</p>

                <label className="tplan-modal__label">¿Cuántos km corres a la semana?</label>
                <div className="tplan-modal__chips">
                  {['< 10 km', '10-20 km', '20-30 km', '30-40 km', '> 40 km'].map(v => (
                    <button
                      key={v}
                      className={`tplan-modal__chip${weeklyKm === v ? ' tplan-modal__chip--selected' : ''}`}
                      onClick={() => setWeeklyKm(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <label className="tplan-modal__label">¿Cuál es tu tirada más larga reciente?</label>
                <div className="tplan-modal__chips">
                  {['< 5 km', '5 km', '10 km', '15 km', '21 km', '> 21 km'].map(v => (
                    <button
                      key={v}
                      className={`tplan-modal__chip${longestRun === v ? ' tplan-modal__chip--selected' : ''}`}
                      onClick={() => setLongestRun(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <label className="tplan-modal__label">¿Cuál es tu objetivo en la carrera?</label>
                <div className="tplan-modal__race-goal-opts">
                  <button
                    className={`tplan-modal__race-goal-opt${raceGoalType === 'finish' ? ' tplan-modal__race-goal-opt--selected' : ''}`}
                    onClick={() => setRaceGoalType('finish')}
                  >
                    <span>🏁</span>
                    <span>Terminarla</span>
                  </button>
                  <button
                    className={`tplan-modal__race-goal-opt${raceGoalType === 'time' ? ' tplan-modal__race-goal-opt--selected' : ''}`}
                    onClick={() => setRaceGoalType('time')}
                  >
                    <span>⏱</span>
                    <span>Conseguir un tiempo</span>
                  </button>
                </div>
                {raceGoalType === 'time' && (
                  <input
                    type="text"
                    className="tplan-modal__time-input"
                    placeholder="ej: 45:00 · 1:50:00 · 3:30:00"
                    value={targetTime}
                    onChange={e => setTargetTime(e.target.value)}
                  />
                )}

                <label className="tplan-modal__label">¿Qué día prefieres para la tirada larga?</label>
                <div className="tplan-modal__chips">
                  {(['saturday', 'sunday', 'any'] as const).map(v => (
                    <button
                      key={v}
                      className={`tplan-modal__chip${longRunDay === v ? ' tplan-modal__chip--selected' : ''}`}
                      onClick={() => setLongRunDay(v)}
                    >
                      {v === 'saturday' ? '🗓 Sábado' : v === 'sunday' ? '🗓 Domingo' : '↕ Sin preferencia'}
                    </button>
                  ))}
                </div>

                <div className="tplan-modal__footer">
                  <button className="tplan-modal__btn tplan-modal__btn--ghost" onClick={() => setStep('race-details')}>← Atrás</button>
                  <button
                    className="tplan-modal__btn"
                    disabled={!weeklyKm || !longestRun}
                    onClick={() => setStep('days')}
                  >
                    Continuar →
                  </button>
                </div>
              </div>
            )}

            {/* Step days: how many days/week */}
            {step === 'days' && (
              <div className="tplan-modal__step">
                <p className="tplan-modal__step-num">Paso {selectedGoal === 'race' ? '4 de 4' : '2 de 2'}</p>
                <h2 className="tplan-modal__title">¿Cuántos días a la semana?</h2>
                <p className="tplan-modal__sub">Elige los días que puedes comprometerte a entrenar</p>
                <div className="tplan-modal__days">
                  {[2, 3, 4].map(d => (
                    <button
                      key={d}
                      className={`tplan-modal__day-opt${selectedDays === d ? ' tplan-modal__day-opt--selected' : ''}`}
                      onClick={() => setSelectedDays(d)}
                    >
                      <span className="tplan-modal__day-num">{d}</span>
                      <span className="tplan-modal__day-label">días/semana</span>
                    </button>
                  ))}
                </div>
                {genError && <p className="tplan-modal__error">⚠ {genError}</p>}
                <div className="tplan-modal__footer">
                  <button
                    className="tplan-modal__btn tplan-modal__btn--ghost"
                    onClick={() => setStep(selectedGoal === 'race' ? 'runner-profile' : 'goal')}
                  >← Atrás</button>
                  <button className="tplan-modal__btn" disabled={!selectedDays} onClick={handleGenerate}>
                    ✨ Generar mi plan
                  </button>
                </div>
              </div>
            )}

            {/* Step generating: loading */}
            {step === 'generating' && (
              <div className="tplan-modal__generating">
                <div className="tplan-modal__spinner" />
                <p className="tplan-modal__gen-title">Creando tu plan...</p>
                <p className="tplan-modal__gen-sub">La IA está analizando tus datos y diseñando un plan a tu medida. Esto puede tardar unos segundos.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

