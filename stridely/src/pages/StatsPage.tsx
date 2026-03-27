import React, { useEffect, useMemo, useState } from 'react';
import { FootprintsIcon, Timer, CalendarDays, Mountain, Award, TrendingUp, Flame, BarChart2 } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { formatPace } from '../utils/formatters';
import { supabase } from '../services/supabase/client';
import AppSidebar from '../components/common/AppSidebar';
import type { Workout } from '../types';
import type { StoredPlan } from '../components/features/training/TrainingPlan';
import { isSessionCompleted } from '../components/features/training/TrainingPlan';
import './StatsPage.scss';

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = 'week' | 'month' | 'year' | 'all';

const PERIOD_OPTS: { key: Period; label: string }[] = [
  { key: 'week',  label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'year',  label: 'Este año' },
  { key: 'all',   label: 'Todo' },
];

const MONTH_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

function toYMD(d: Date | string): string {
  const dt = toDate(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function getPeriodBounds(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(); end.setHours(23,59,59,999);
  if (period === 'week') {
    const d = now.getDay();
    const diff = d === 0 ? -6 : 1 - d;
    const start = new Date(now); start.setDate(now.getDate() + diff); start.setHours(0,0,0,0);
    return { start, end };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start, end };
  }
  return { start: new Date(0), end };
}

function filterByPeriod(activities: Workout[], period: Period): Workout[] {
  const { start, end } = getPeriodBounds(period);
  return activities.filter(a => {
    const d = toDate(a.date);
    return d >= start && d <= end;
  });
}

interface WeekBar {
  label: string;
  totalKm: number;
  count: number;
  isCurrent: boolean;
  isAlert: boolean;
}

function getLast12Weeks(activities: Workout[]): WeekBar[] {
  const now = new Date();
  const d = now.getDay();
  const diff = d === 0 ? -6 : 1 - d;
  const thisMon = new Date(now);
  thisMon.setDate(now.getDate() + diff);
  thisMon.setHours(0,0,0,0);

  const weeks: WeekBar[] = [];
  for (let i = 11; i >= 0; i--) {
    const mon = new Date(thisMon);
    mon.setDate(thisMon.getDate() - i * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
    const weekActs = activities.filter(a => {
      const dt = toDate(a.date);
      return dt >= mon && dt <= sun;
    });
    const totalKm = weekActs.reduce((s, a) => s + a.distance / 1000, 0);
    weeks.push({
      label: `${mon.getDate()} ${MONTH_SHORT[mon.getMonth()]}`,
      totalKm,
      count: weekActs.length,
      isCurrent: i === 0,
      isAlert: false,
    });
  }
  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i-1].totalKm;
    if (prev > 0 && weeks[i].totalKm > prev * 1.1) {
      weeks[i].isAlert = true;
    }
  }
  return weeks;
}

function computeStreak(activities: Workout[]): number {
  if (activities.length === 0) return 0;
  const days = new Set(activities.map(a => toYMD(a.date)));
  let streak = 0;
  const cursor = new Date(); cursor.setHours(0,0,0,0);
  if (!days.has(toYMD(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(toYMD(cursor)) && streak <= 365) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function fmtTotalTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

// Session date helper (mirrors TrainingPlan.tsx)
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

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  run:   { label: 'Carrera',  color: '#F5611A' },
  trail: { label: 'Trail',    color: '#f59e0b' },
  race:  { label: 'Race',     color: '#ef4444' },
};

// ─── Weekly bars chart ────────────────────────────────────────────────────────
function WeeklyBars({ weeks }: { weeks: WeekBar[] }) {
  const maxKm = Math.max(...weeks.map(w => w.totalKm), 1);
  return (
    <div className="stats__bars">
      {weeks.map((w, i) => (
        <div key={i} className="stats__bar-col">
          {w.totalKm > 0 && (
            <span className="stats__bar-label-top">{w.totalKm.toFixed(0)}</span>
          )}
          <div className="stats__bar-track">
            <div
              className={`stats__bar-fill${w.isAlert ? ' stats__bar-fill--alert' : ''}${w.isCurrent ? ' stats__bar-fill--current' : ''}`}
              style={{ height: `${Math.max((w.totalKm / maxKm) * 100, w.totalKm > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className={`stats__bar-label-bot${w.isCurrent ? ' stats__bar-label-bot--current' : ''}`}>
            {w.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Pace progression chart ───────────────────────────────────────────────────
interface PacePoint { pace: number; date: Date; name: string; }

function PaceChart({ data }: { data: PacePoint[] }) {
  if (data.length < 2) {
    return (
      <div className="stats__chart-empty">
        Necesitas al menos 2 salidas en el período para ver la progresión
      </div>
    );
  }

  const W = 600, H = 160;
  const PAD = { t: 10, r: 16, b: 28, l: 48 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;

  const minT = data[0].date.getTime();
  const maxT = data[data.length - 1].date.getTime();
  const paces = data.map(d => d.pace);
  const minP = Math.min(...paces);
  const maxP = Math.max(...paces);
  const pRange = Math.max(maxP - minP, 60);

  const toX = (d: Date) =>
    maxT === minT ? PAD.l + cW / 2 : PAD.l + ((d.getTime() - minT) / (maxT - minT)) * cW;
  // Fast pace (low seconds) → top of chart (low Y in SVG)
  const toY = (p: number) => PAD.t + ((p - minP) / pRange) * cH;

  const pts = data.map(d => ({ x: toX(d.date), y: toY(d.pace) }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length-1].x.toFixed(1)},${(PAD.t+cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.t+cH).toFixed(1)} Z`;

  const yMarks = [0, 0.5, 1].map(t => ({ p: minP + t * pRange, y: toY(minP + t * pRange) }));
  const xFirst = data[0].date;
  const xLast  = data[data.length - 1].date;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="stats__pace-svg"
      aria-label="Progresión de ritmo"
    >
      <defs>
        <linearGradient id="stats-pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5611A" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#F5611A" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yMarks.map((m, i) => (
        <line key={i} x1={PAD.l} y1={m.y} x2={W - PAD.r} y2={m.y}
          stroke="#E4E7EF" strokeWidth="1" />
      ))}

      {/* Area */}
      <path d={areaPath} fill="url(#stats-pg)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#F5611A" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {pts.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3"
          fill="#F5611A" stroke="white" strokeWidth="1.5" />
      ))}

      {/* Y axis labels */}
      {yMarks.map((m, i) => {
        const min = Math.floor(m.p / 60);
        const sec = Math.round(m.p % 60);
        return (
          <text key={i} x={PAD.l - 6} y={m.y + 4} textAnchor="end"
            fontSize="10" fill="#ADB5BD" fontFamily="Inter, sans-serif">
            {min}:{String(sec).padStart(2,'0')}
          </text>
        );
      })}

      {/* X axis labels */}
      <text x={PAD.l} y={H - 6} textAnchor="start"
        fontSize="10" fill="#ADB5BD" fontFamily="Inter, sans-serif">
        {xFirst.getDate()} {MONTH_SHORT[xFirst.getMonth()]}
      </text>
      <text x={W - PAD.r} y={H - 6} textAnchor="end"
        fontSize="10" fill="#ADB5BD" fontFamily="Inter, sans-serif">
        {xLast.getDate()} {MONTH_SHORT[xLast.getMonth()]}
      </text>
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const StatsPage: React.FC = () => {
  const { user } = useAuthContext();
  const { activities, loading, fetchActivities, isConnected } = useStrava();
  const [period, setPeriod] = useState<Period>('month');
  const [activePlan, setActivePlan] = useState<StoredPlan | null>(null);

  useEffect(() => {
    if (isConnected) fetchActivities().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => { if (data) setActivePlan(data as StoredPlan); });
  }, [user?.id]);

  const filtered = useMemo(() => filterByPeriod(activities, period), [activities, period]);
  const weekBars = useMemo(() => getLast12Weeks(activities), [activities]);

  const kpis = useMemo(() => ({
    km:        filtered.reduce((s, a) => s + a.distance / 1000, 0),
    time:      filtered.reduce((s, a) => s + a.duration, 0),
    count:     filtered.length,
    elevation: filtered.reduce((s, a) => s + (a.elevation || 0), 0),
    avgPace:   filtered.length > 0
      ? filtered.reduce((s, a) => s + a.pace, 0) / filtered.length
      : 0,
  }), [filtered]);

  const records = useMemo(() => {
    const over5k  = activities.filter(a => a.distance >= 5000);
    const over10k = activities.filter(a => a.distance >= 10000);
    const best5k  = over5k.length  > 0 ? over5k.reduce((b, a)  => a.pace < b.pace ? a : b) : null;
    const best10k = over10k.length > 0 ? over10k.reduce((b, a) => a.pace < b.pace ? a : b) : null;
    const longest = activities.length  > 0 ? activities.reduce((b, a) => a.distance > b.distance ? a : b) : null;
    const streak  = computeStreak(activities);
    return { best5k, best10k, longest, streak };
  }, [activities]);

  const typeStats = useMemo(() => {
    if (filtered.length === 0) return [];
    const counts: Record<string, number> = {};
    filtered.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return Object.entries(counts)
      .map(([type, count]) => ({ type, count, pct: Math.round(count / filtered.length * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const paceData = useMemo<PacePoint[]>(() => {
    return [...filtered]
      .sort((a, b) => +toDate(a.date) - +toDate(b.date))
      .map(a => ({ pace: a.pace, date: toDate(a.date), name: a.name }));
  }, [filtered]);

  const planConsistency = useMemo(() => {
    if (!activePlan || activities.length === 0) return null;
    const { start, end } = getPeriodBounds(period);
    let planned = 0, completed = 0;
    activePlan.weeks.forEach(week => {
      week.sessions.forEach(session => {
        const sd = getSessionDate(activePlan.started_at, week.week, session.day_number);
        if (sd >= start && sd <= end) {
          planned++;
          if (isSessionCompleted(session, week.week, activePlan, activities)) completed++;
        }
      });
    });
    return planned > 0 ? { planned, completed } : null;
  }, [activePlan, activities, period]);

  const isEmpty = !loading && filtered.length === 0;
  const allEmpty = !loading && activities.length === 0;

  return (
    <div className="stats">
      <AppSidebar />
      <div className="stats__page">
        <div className="stats__main">

          {/* Header */}
          <div className="stats__header">
            <div>
              <h2 className="stats__title">Estadísticas</h2>
              <p className="stats__subtitle">
                {activities.length > 0
                  ? `${activities.length} actividades cargadas`
                  : 'Conecta Strava para ver tus estadísticas'}
              </p>
            </div>
            <div className="stats__periods" role="tablist">
              {PERIOD_OPTS.map(opt => (
                <button
                  key={opt.key}
                  role="tab"
                  aria-selected={period === opt.key}
                  className={`stats__period${period === opt.key ? ' stats__period--active' : ''}`}
                  onClick={() => setPeriod(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="stats__kpis">
            <div className="stats__kpi">
              <FootprintsIcon size={26} strokeWidth={1.5} className="stats__kpi-icon" />
              <span className="stats__kpi-value">
                {loading ? '—' : `${kpis.km.toFixed(1)} km`}
              </span>
              <span className="stats__kpi-label">Kilómetros</span>
            </div>
            <div className="stats__kpi">
              <Timer size={26} strokeWidth={1.5} className="stats__kpi-icon" />
              <span className="stats__kpi-value">
                {loading ? '—' : fmtTotalTime(kpis.time)}
              </span>
              <span className="stats__kpi-label">Tiempo total</span>
            </div>
            <div className="stats__kpi">
              <CalendarDays size={26} strokeWidth={1.5} className="stats__kpi-icon" />
              <span className="stats__kpi-value">
                {loading ? '—' : kpis.count}
              </span>
              <span className="stats__kpi-label">Salidas</span>
            </div>
            <div className="stats__kpi">
              <Mountain size={26} strokeWidth={1.5} className="stats__kpi-icon" />
              <span className="stats__kpi-value">
                {loading ? '—' : `${Math.round(kpis.elevation)} m`}
              </span>
              <span className="stats__kpi-label">Desnivel acum.</span>
            </div>
          </div>

          {allEmpty && !loading ? (
            <div className="stats__empty">
              <BarChart2 size={40} strokeWidth={1.2} />
              <p>Sin actividades. Conecta Strava y sal a correr para ver tus estadísticas.</p>
            </div>
          ) : (
            <>
              {/* Mid grid: weekly bars + personal records */}
              <div className="stats__mid-grid">
                {/* Weekly bars */}
                <div className="stats__card">
                  <div className="stats__card-header">
                    <p className="stats__card-title">Kilómetros por semana</p>
                    <span className="stats__card-sub">Últimas 12 semanas</span>
                  </div>
                  {weekBars.some(w => w.isAlert) && (
                    <div className="stats__alert">
                      ⚠ Semana con aumento &gt;10% respecto a la anterior — vigila la sobrecarga
                    </div>
                  )}
                  <WeeklyBars weeks={weekBars} />
                  <div className="stats__bar-legend">
                    <span className="stats__bar-legend-item">
                      <span className="stats__bar-legend-dot stats__bar-legend-dot--normal" />
                      Normal
                    </span>
                    <span className="stats__bar-legend-item">
                      <span className="stats__bar-legend-dot stats__bar-legend-dot--current" />
                      Esta semana
                    </span>
                    <span className="stats__bar-legend-item">
                      <span className="stats__bar-legend-dot stats__bar-legend-dot--alert" />
                      +10% alerta
                    </span>
                  </div>
                </div>

                {/* Personal records */}
                <div className="stats__card">
                  <div className="stats__card-header">
                    <p className="stats__card-title">Récords personales</p>
                    <Award size={16} className="stats__card-icon" />
                  </div>
                  <div className="stats__records">
                    <div className="stats__record">
                      <span className="stats__record-label">Mejor ritmo 5 km</span>
                      <span className="stats__record-value">
                        {records.best5k ? formatPace(records.best5k.pace) : '—'}
                      </span>
                      {records.best5k && (
                        <span className="stats__record-date">
                          {toDate(records.best5k.date).getDate()} {MONTH_SHORT[toDate(records.best5k.date).getMonth()]} {toDate(records.best5k.date).getFullYear()}
                        </span>
                      )}
                    </div>
                    <div className="stats__record">
                      <span className="stats__record-label">Mejor ritmo 10 km</span>
                      <span className="stats__record-value">
                        {records.best10k ? formatPace(records.best10k.pace) : '—'}
                      </span>
                      {records.best10k && (
                        <span className="stats__record-date">
                          {toDate(records.best10k.date).getDate()} {MONTH_SHORT[toDate(records.best10k.date).getMonth()]} {toDate(records.best10k.date).getFullYear()}
                        </span>
                      )}
                    </div>
                    <div className="stats__record">
                      <span className="stats__record-label">Carrera más larga</span>
                      <span className="stats__record-value">
                        {records.longest ? `${(records.longest.distance / 1000).toFixed(2)} km` : '—'}
                      </span>
                      {records.longest && (
                        <span className="stats__record-date stats__record-date--name" title={records.longest.name}>
                          {records.longest.name}
                        </span>
                      )}
                    </div>
                    <div className="stats__record">
                      <div className="stats__record-streak">
                        <Flame size={18} strokeWidth={1.8} className={records.streak > 0 ? 'stats__streak-icon--active' : 'stats__streak-icon'} />
                        <span className="stats__record-label">Racha activa</span>
                      </div>
                      <span className="stats__record-value">
                        {records.streak > 0 ? `${records.streak} días` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pace progression chart */}
              <div className="stats__card">
                <div className="stats__card-header">
                  <p className="stats__card-title">Progresión de ritmo</p>
                  <div className="stats__card-meta">
                    <TrendingUp size={14} className="stats__card-icon" />
                    {!isEmpty && kpis.avgPace > 0 && (
                      <span className="stats__card-sub">Media {formatPace(kpis.avgPace)}</span>
                    )}
                  </div>
                </div>
                {isEmpty ? (
                  <div className="stats__chart-empty">Sin actividades en el período seleccionado</div>
                ) : (
                  <PaceChart data={paceData} />
                )}
              </div>

              {/* Bottom grid: type distribution + plan consistency */}
              <div className="stats__bot-grid">
                {/* Type distribution */}
                <div className="stats__card">
                  <p className="stats__card-title">Tipo de salidas</p>
                  {isEmpty ? (
                    <p className="stats__chart-empty">Sin datos en el período</p>
                  ) : (
                    <div className="stats__types">
                      {typeStats.map(({ type, count, pct }) => {
                        const cfg = TYPE_CONFIG[type] ?? { label: type, color: '#ADB5BD' };
                        return (
                          <div key={type} className="stats__type-row">
                            <span className="stats__type-dot" style={{ background: cfg.color }} />
                            <span className="stats__type-name">{cfg.label}</span>
                            <div className="stats__type-bar-track">
                              <div
                                className="stats__type-bar-fill"
                                style={{ width: `${pct}%`, background: cfg.color }}
                              />
                            </div>
                            <span className="stats__type-count">{count} <span className="stats__type-pct">({pct}%)</span></span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Plan consistency */}
                {activePlan && (
                  <div className="stats__card">
                    <p className="stats__card-title">Consistencia del plan</p>
                    {planConsistency ? (
                      <>
                        <div className="stats__consistency">
                          <span className="stats__consistency-fraction">
                            <span className="stats__consistency-done">{planConsistency.completed}</span>
                            <span className="stats__consistency-of">/{planConsistency.planned}</span>
                          </span>
                          <span className="stats__consistency-label">sesiones completadas</span>
                        </div>
                        <div className="stats__consistency-bar-track">
                          <div
                            className="stats__consistency-bar-fill"
                            style={{ width: `${Math.round(planConsistency.completed / planConsistency.planned * 100)}%` }}
                          />
                        </div>
                        <span className="stats__consistency-pct">
                          {Math.round(planConsistency.completed / planConsistency.planned * 100)}% del plan
                        </span>
                        <p className="stats__consistency-plan">
                          Plan activo · {activePlan.goal.toUpperCase()}
                        </p>
                      </>
                    ) : (
                      <p className="stats__chart-empty">No hay sesiones planificadas en este período</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
