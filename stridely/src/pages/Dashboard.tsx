import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, FootprintsIcon, CalendarDays, Timer, Flame, Bell, CheckCircle2, TrendingUp, Calendar, Trophy, Zap, Moon } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { StravaLogin } from '../components/features/strava/StravaLogin';
import type { Workout } from '../types';
import { formatDuration, formatDistance, formatPace, formatDate } from '../utils/formatters';
import { supabase } from '../services/supabase/client';
import { TrainingPlan } from '../components/features/training/TrainingPlan';
import type { StoredPlan, PlanSession } from '../components/features/training/TrainingPlan';
import { isSessionCompleted, isSessionMissed, getPlanCurrentWeek } from '../components/features/training/TrainingPlan';
import AppSidebar from '../components/common/AppSidebar';
import { useCoachChat } from '../context/CoachChatContext';
import carreraImg from '../assets/carrera-destacada.svg';
import './Dashboard.scss';

const GOAL_META: Record<string, { label: string; dist: string }> = {
  '5km':      { label: 'Carrera 5K',      dist: '5 km' },
  '10km':     { label: 'Carrera 10K',     dist: '10 km' },
  'half':     { label: 'Media Maratón',   dist: '21,1 km' },
  'marathon': { label: 'Maratón',         dist: '42,2 km' },
};

function getRaceDate(plan: StoredPlan): Date {
  const start = new Date(plan.started_at);
  start.setDate(start.getDate() + plan.total_weeks * 7);
  return start;
}

function getDaysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((d.getTime() - now.getTime()) / 86_400_000));
}

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

interface AppNotification {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning';
}

interface CheckinData {
  activity: Workout;
  session: PlanSession | null;
  question: string;
  chips: { label: string; value: string }[];
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

function getNextPlanSession(plan: StoredPlan): { session: PlanSession; daysFromNow: number } | null {
  const now = new Date();
  const jsDow = now.getDay();
  const todayDayNum = jsDow === 0 ? 7 : jsDow;
  const currentWeek = getPlanCurrentWeek(plan);
  const currentWeekSessions = plan.weeks.find(w => w.week === currentWeek)?.sessions ?? [];
  const nextInThisWeek = currentWeekSessions
    .filter(s => s.day_number > todayDayNum)
    .sort((a, b) => a.day_number - b.day_number)[0];
  if (nextInThisWeek) return { session: nextInThisWeek, daysFromNow: nextInThisWeek.day_number - todayDayNum };
  const nextWeekSessions = plan.weeks.find(w => w.week === currentWeek + 1)?.sessions ?? [];
  const nextInNextWeek = [...nextWeekSessions].sort((a, b) => a.day_number - b.day_number)[0];
  if (nextInNextWeek) return { session: nextInNextWeek, daysFromNow: (8 - todayDayNum) + nextInNextWeek.day_number };
  return null;
}

// ─── Post-run check-in helpers ───────────────────────────────────────────────
function parsePaceHintToSecPerKm(hint: string): number | null {
  const m = hint.match(/(\d+):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function buildCheckin(activity: Workout, session: PlanSession | null): { question: string; chips: { label: string; value: string }[] } {
  if (!session || !session.pace_hint) {
    return {
      question: '¿Cómo fue la salida?',
      chips: [
        { label: 'Muy bien 🔥', value: 'Muy bien, me sentí fuerte' },
        { label: 'Bien', value: 'Bien, sin nada especial' },
        { label: 'Regular', value: 'Regular, no fue mi mejor día' },
        { label: 'Me costó', value: 'Me costó mucho, fue duro' },
      ],
    };
  }
  const plannedSec = parsePaceHintToSecPerKm(session.pace_hint);
  if (!plannedSec) {
    return {
      question: '¿Cómo tienes las piernas ahora mismo?',
      chips: [
        { label: 'Frescas 💪', value: 'Piernas frescas, podría haberlas dado más' },
        { label: 'Bien', value: 'Bien, ritmo correcto' },
        { label: 'Algo cargadas', value: 'Algo cargadas, las noto pesadas' },
        { label: 'Muy cargadas 😴', value: 'Muy cargadas, estoy bastante cansado' },
      ],
    };
  }
  const diff = activity.pace - plannedSec; // seconds/km: positive = slower, negative = faster
  if (diff < -20) {
    const diffAbs = Math.round(Math.abs(diff));
    return {
      question: `Fuiste ${diffAbs}seg/km más rápido de lo planificado. ¿Lo forzaste o te salió solo?`,
      chips: [
        { label: 'Me salió solo ✨', value: 'Me salió solo, me sentí muy bien' },
        { label: 'Lo forcé un poco', value: 'Lo forcé conscientemente' },
        { label: 'Sin darme cuenta', value: 'No me di cuenta, iba por sensaciones' },
      ],
    };
  }
  if (diff > 20) {
    return {
      question: '¿Qué pasó hoy? Fuiste algo más lento de lo planificado.',
      chips: [
        { label: 'Cansancio 😴', value: 'Tenía cansancio acumulado de días anteriores' },
        { label: 'Mal día', value: 'Simplemente fue un mal día' },
        { label: 'Condiciones 🌧️', value: 'Las condiciones externas no ayudaron' },
      ],
    };
  }
  return {
    question: '¿Cómo tienes las piernas ahora mismo?',
    chips: [
      { label: 'Frescas 💪', value: 'Piernas frescas, podría haberlas dado más' },
      { label: 'Bien', value: 'Bien, ritmo correcto' },
      { label: 'Algo cargadas', value: 'Algo cargadas, las noto pesadas' },
      { label: 'Muy cargadas 😴', value: 'Muy cargadas, estoy bastante cansado' },
    ],
  };
}

// ─── Confetti overlay ─────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#7C3AED', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#06b6d4'];
function Confetti() {
  return (
    <div className="dash__confetti" aria-hidden="true">
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={i}
          className="dash__confetti-particle"
          style={{
            left: `${i * 3.2 + 5}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${i * 0.07}s`,
            animationDuration: `${0.9 + (i % 4) * 0.25}s`,
            width: i % 3 === 0 ? '10px' : '7px',
            height: i % 3 === 0 ? '10px' : '13px',
            borderRadius: i % 4 === 0 ? '50%' : '2px',
            transform: `rotate(${i * 37}deg)`,
          }}
        />
      ))}
    </div>
  );
}

const Dashboard: React.FC = () => {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { activities, loading, error, fetchActivities, isConnected, initializing, disconnectStrava, athleteData } = useStrava();
  const push = usePushNotifications();
  const [pushBannerDismissed, setPushBannerDismissed] = useState(() =>
    localStorage.getItem('push-banner-dismissed') === '1'
  );
  const [localActivities, setLocalActivities] = useState<Workout[]>([]);
  const [recommendation, setRecommendation] = useState<CoachRec | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [activePlan, setActivePlan] = useState<StoredPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planSessionIntro, setPlanSessionIntro] = useState<string | null>(null);
  const [loadingIntro, setLoadingIntro] = useState(false);
  const [checkin, setCheckin] = useState<CheckinData | null>(null);
  const [checkinReply, setCheckinReply] = useState<string | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [patternAlert, setPatternAlert] = useState<string | null>(null);
  const [coachQOpen, setCoachQOpen] = useState(false);
  const [coachQLoading, setCoachQLoading] = useState(false);
  const [coachQReply, setCoachQReply] = useState<string | null>(null);
  const recFetched = useRef(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef(false);

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

  // Cuando hay suscripción activa y cambia el plan, actualizar todaySession en el server
  useEffect(() => {
    if (push.status !== 'subscribed' || !activePlan) return;
    const ctx = getTodayPlanContext(activePlan);
    if (!ctx) return;
    const todaySession = { type: ctx.session.type, distance: ctx.session.duration ?? '' };
    push.subscribe(athleteData?.id ? String(athleteData.id) : undefined, todaySession);
  }, [activePlan?.id, push.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close notifications when clicking outside
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications]);

  // Post-run check-in detection — fires when activities finish loading
  useEffect(() => {
    if (loading || localActivities.length === 0) return;
    const todayYMD = new Date().toISOString().slice(0, 10);
    const toYMD = (d: Date | string) => new Date(d as string).toISOString().slice(0, 10);
    const todayAct = localActivities.find(a => toYMD(a.date) === todayYMD);
    if (!todayAct) return;
    if (localStorage.getItem(`checkin-${todayAct.id}`)) return;
    const todaySession = activePlan ? getTodayPlanSession(activePlan) : null;
    const { question, chips } = buildCheckin(todayAct, todaySession);
    setCheckin({ activity: todayAct, session: todaySession, question, chips });
  }, [loading, localActivities, activePlan]);

  // Pattern alert detection — runs once per day, needs ≥3 check-ins
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `pattern-alert-${today}`;
    const dismissedKey = `pattern-alert-dismissed-${today}`;
    if (localStorage.getItem(dismissedKey)) return;
    const cached = localStorage.getItem(cacheKey);
    if (cached !== null) {
      setPatternAlert(cached || null);
      return;
    }
    const run = async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) return;
        const { data: rows } = await supabase
          .from('post_run_checkins')
          .select('created_at, answer')
          .eq('user_id', u.id)
          .order('created_at', { ascending: false })
          .limit(7);
        if (!rows || rows.length < 3) { localStorage.setItem(cacheKey, ''); return; }
        const checkins = rows.map(row => ({
          date: new Date(row.created_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
          answer: row.answer,
        }));
        const r = await fetch(`${API_BASE}/api/ai/pattern-alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkins }),
        });
        const d = await r.json();
        const alert = d.alert ?? null;
        localStorage.setItem(cacheKey, alert ?? '');
        setPatternAlert(alert);
      } catch {
        // non-critical
      }
    };
    run();
  }, [user]);

  const handleCheckinAnswer = async (answer: string) => {
    if (!checkin) return;
    setCheckinLoading(true);
    const act = checkin.activity;
    const distKm = (act.distance / 1000).toFixed(2);
    const durMin = Math.round(act.duration / 60);
    const paceStr = `${Math.floor(act.pace / 60)}:${String(Math.round(act.pace % 60)).padStart(2, '0')}/km`;
    const elevM = act.elevation > 0 ? Math.round(act.elevation) : null;
    try {
      const r = await fetch(`${API_BASE}/api/ai/post-run-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: { name: act.name, distance_km: distKm, duration_min: durMin, pace_str: paceStr, elevation_m: elevM },
          session: checkin.session,
          checkin_answer: answer,
          plan_goal: activePlan?.goal ?? null,
        }),
      });
      const d = await r.json();
      const reply = d.message ?? null;
      setCheckinReply(reply);

      // Persist to Supabase
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          await supabase.from('post_run_checkins').insert({
            user_id: u.id,
            activity_id: String(checkin.activity.id),
            question: checkin.question,
            answer,
            coach_reply: reply,
          });
        }
      } catch {
        // persistence failure is non-critical
      }
    } catch {
      setCheckinReply('Genial, apuntado. Seguimos mañana.');
    } finally {
      setCheckinLoading(false);
      localStorage.setItem(`checkin-${checkin.activity.id}`, '1');
    }
  };

  const dismissCheckin = () => {
    if (checkin) localStorage.setItem(`checkin-${checkin.activity.id}`, '1');
    setCheckin(null);
    setCheckinReply(null);
  };

  const handleCoachQuestion = async (key: string) => {
    setCoachQLoading(true);
    try {
      const acts = localActivities.slice(0, 12).map(a => ({
        date: new Date(a.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
        km: (a.distance / 1000).toFixed(1),
        pace_sec: a.pace,
      }));
      const planCtx = activePlan ? {
        goal: activePlan.goal,
        current_week: getPlanCurrentWeek(activePlan),
        total_weeks: activePlan.total_weeks,
      } : null;
      // Reuse cached checkins from Supabase if available
      let recentCheckins: { date: string; answer: string }[] = [];
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          const { data: rows } = await supabase
            .from('post_run_checkins')
            .select('created_at, answer')
            .eq('user_id', u.id)
            .order('created_at', { ascending: false })
            .limit(5);
          if (rows) {
            recentCheckins = rows.map(row => ({
              date: new Date(row.created_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
              answer: row.answer,
            }));
          }
        }
      } catch { /* non-critical */ }
      const r = await fetch(`${API_BASE}/api/ai/coach-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_key: key, activities: acts, plan: planCtx, recent_checkins: recentCheckins }),
      });
      const d = await r.json();
      setCoachQReply(d.answer ?? 'No he podido generar una respuesta ahora. Inténtalo de nuevo.');
    } catch {
      setCoachQReply('No pude conectar con el coach. Inténtalo de nuevo.');
    } finally {
      setCoachQLoading(false);
    }
  };

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
        activities: localActivities.slice(0, 10).map(a => ({ date: a.date, distance: a.distance, pace: a.pace })),
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
        // Fetch last 5 check-ins to give the AI personal feedback context
        let recentCheckins: { date: string; answer: string; coach_reply: string | null }[] = [];
        try {
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) {
            const { data: rows } = await supabase
              .from('post_run_checkins')
              .select('created_at, answer, coach_reply')
              .eq('user_id', u.id)
              .order('created_at', { ascending: false })
              .limit(5);
            if (rows) {
              recentCheckins = rows.map(row => ({
                date: new Date(row.created_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
                answer: row.answer,
                coach_reply: row.coach_reply,
              }));
            }
          }
        } catch {
          // non-critical: proceed without check-in history
        }

        const r = await fetch(`${API_BASE}/api/ai/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activities: localActivities.slice(0, 10), recent_checkins: recentCheckins }),
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

  const { planModifiedAt } = useCoachChat();

  // Load active training plan from Supabase
  const fetchActivePlan = useCallback(() => {
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

  useEffect(() => { fetchActivePlan(); }, [fetchActivePlan]);

  // Refetch cuando el coach mueve una sesión
  useEffect(() => {
    if (planModifiedAt > 0) fetchActivePlan();
  }, [planModifiedAt, fetchActivePlan]);

  // Confetti: fire once per day when today's session is first detected as completed
  useEffect(() => {
    if (!activePlan || !recommendation || recommendation.isRestDay || recommendation.source !== 'plan') return;
    const ctx = getTodayPlanContext(activePlan);
    if (!ctx) return;
    const completed = isSessionCompleted(ctx.session, ctx.week, activePlan, localActivities);
    if (!completed || confettiRef.current) return;
    const today = new Date().toISOString().split('T')[0];
    const key = `confetti-shown-${activePlan.id}-${today}`;
    if (localStorage.getItem(key)) return;
    confettiRef.current = true;
    localStorage.setItem(key, '1');
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localActivities.length, activePlan?.id, recommendation?.source]);

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const firstName   = displayName.split(' ')[0];
  const initials    = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatarUrl   = (athleteData?.profile_medium ?? athleteData?.profile ?? null) as string | null;
  const today = (() => {
    const s = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  if (initializing || loading) {
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

  if (!isConnected) {
    return (
      <div className="dash">
        <AppSidebar />
        <div className="dash__page">
          <div className="dash__main">
            <div className="dash__onboarding">
              <div className="dash__onboarding-welcome">
                <h1>Bienvenido{firstName ? `, ${firstName}` : ''} 👋</h1>
                <p>Sigue estos pasos para empezar a entrenar con inteligencia artificial</p>
              </div>

              <div className="dash__onboarding-steps">
                {/* Step 1 — Strava */}
                <div className="dash__onboarding-step dash__onboarding-step--active">
                  <div className="dash__onboarding-step-badge">1</div>
                  <div className="dash__onboarding-step-content">
                    <div className="dash__onboarding-step-header">
                      <span className="dash__onboarding-step-title">Conecta tu cuenta de Strava</span>
                      <span className="dash__onboarding-step-status">Pendiente</span>
                    </div>
                    <p className="dash__onboarding-step-desc">
                      Sincroniza tus actividades automáticamente para que la IA pueda analizarlas.
                    </p>
                    <StravaLogin />
                  </div>
                </div>

                {/* Step 2 — Plan */}
                <div className="dash__onboarding-step dash__onboarding-step--locked">
                  <div className="dash__onboarding-step-badge">2</div>
                  <div className="dash__onboarding-step-content">
                    <div className="dash__onboarding-step-header">
                      <span className="dash__onboarding-step-title">Crea tu plan de entrenamiento</span>
                      <span className="dash__onboarding-step-status dash__onboarding-step-status--locked">Siguiente</span>
                    </div>
                    <p className="dash__onboarding-step-desc">
                      La IA diseñará un plan personalizado según tu objetivo y nivel de forma.
                    </p>
                  </div>
                </div>
              </div>
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

  // 8-week km history — for the historical chart
  const weeklyKmHistory = (() => {
    const now = new Date();
    const dow = now.getDay();
    const daysToMon = dow === 0 ? -6 : 1 - dow;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToMon);
    return Array.from({ length: 8 }, (_, i) => {
      const offset = (i - 7) * 7;
      const mon = new Date(thisMonday); mon.setDate(thisMonday.getDate() + offset);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
      const km = localActivities
        .filter(a => { const d = new Date(a.date); return d >= mon && d <= sun; })
        .reduce((s, a) => s + a.distance / 1000, 0);
      return {
        label: mon.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        km: Math.round(km * 10) / 10,
        isCurrent: i === 7,
      };
    });
  })();

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

  // Training load level — compare last full week vs 4-week average
  const loadLevel = (() => {
    const lastWeekKm = weeklyKmHistory[6]?.km ?? 0;
    const prev4Avg = ([2, 3, 4, 5].reduce((s, i) => s + (weeklyKmHistory[i]?.km ?? 0), 0)) / 4;
    if (prev4Avg < 1) return null;
    const ratio = lastWeekKm / prev4Avg;
    if (ratio > 1.2) return { label: 'Alta', arrow: '↑', level: 'high' };
    if (ratio < 0.8) return { label: 'Baja', arrow: '↓', level: 'low' };
    return { label: 'Normal', arrow: '→', level: 'normal' };
  })();

  const todayCompleted = (() => {
    if (!activePlan || !recommendation || recommendation.isRestDay || recommendation.source !== 'plan') return false;
    const ctx = getTodayPlanContext(activePlan);
    if (!ctx) return false;
    return isSessionCompleted(ctx.session, ctx.week, activePlan, localActivities);
  })();

  const missedThisWeek = (!loadingPlan && activePlan) ? (() => {
    const cw = getPlanCurrentWeek(activePlan);
    const sessions = activePlan.weeks.find(w => w.week === cw)?.sessions ?? [];
    return sessions.filter(s => isSessionMissed(s, cw, activePlan, localActivities)).length;
  })() : 0;

  // ─── Computed notifications ───────────────────────────────────────────────
  const notifications: AppNotification[] = (() => {
    const items: AppNotification[] = [];

    // 1. Sesión pendiente hoy
    if (!loadingRec && !loadingPlan && recommendation && !recommendation.isRestDay && !todayCompleted) {
      items.push({
        id: 'session-today',
        icon: <Zap size={15} />,
        title: 'Sesión pendiente',
        body: `${recommendation.sessionType}${ recommendation.distance ? ` · ${recommendation.distance}` : ''}`,
        type: 'info',
      });
    }

    // 2. Sesión completada hoy
    if (todayCompleted && recommendation) {
      items.push({
        id: 'session-done',
        icon: <CheckCircle2 size={15} />,
        title: '¡Sesión completada!',
        body: `Has completado la sesión de hoy: ${recommendation.sessionType}`,
        type: 'success',
      });
    }

    // 3. Racha activa
    if (streak >= 3) {
      items.push({
        id: 'streak',
        icon: <Flame size={15} />,
        title: `${streak} días de racha`,
        body: 'Llevas varios días seguidos entrenando. ¡Sigue así!',
        type: 'success',
      });
    }

    // 4. Récord personal (mejor pace de esta semana vs histórico)
    if (localActivities.length >= 5) {
      const withPace = localActivities.filter(a => a.pace > 0);
      if (withPace.length >= 2) {
        const { mon } = getWeekBounds();
        const thisWeek = withPace.filter(a => new Date(a.date) >= mon);
        const prevBest = withPace
          .filter(a => new Date(a.date) < mon)
          .reduce((best, a) => (a.pace < best ? a.pace : best), Infinity);
        const weekBest = thisWeek.reduce((best, a) => (a.pace < best ? a.pace : best), Infinity);
        if (thisWeek.length > 0 && prevBest !== Infinity && weekBest < prevBest) {
          items.push({
            id: 'pr',
            icon: <Trophy size={15} />,
            title: 'Nuevo récord de pace',
            body: `Has conseguido tu mejor ritmo esta semana: ${formatPace(weekBest)}/km`,
            type: 'success',
          });
        }
      }
    }

    // 5. Sin actividad esta semana (martes o más tarde)
    const today = new Date();
    const dow = today.getDay();
    if (weekStats.count === 0 && dow >= 2) {
      items.push({
        id: 'no-activity',
        icon: <Calendar size={15} />,
        title: 'Sin actividad esta semana',
        body: 'Aún no has registrado ninguna salida. ¡Hoy es un buen día para empezar!',
        type: 'warning',
      });
    }

    // 6. Progreso del plan
    if (activePlan) {
      const currentWeek = getPlanCurrentWeek(activePlan);
      const totalWeeks = activePlan.weeks?.length ?? 0;
      if (totalWeeks > 0) {
        items.push({
          id: 'plan-progress',
          icon: <TrendingUp size={15} />,
          title: `Plan: semana ${currentWeek} de ${totalWeeks}`,
          body: `Llevas un ${Math.round((currentWeek / totalWeeks) * 100)}% del plan completado`,
          type: 'info',
        });
      }
    }

    return items;
  })();

  return (
    <div className="dash">
      {showConfetti && <Confetti />}
      <AppSidebar />
      <div className="dash__page">
        <div className="dash__main">

          {/* Saludo */}
          <div className="dash__greeting">
            <div className="dash__greeting-top">
              <div className="dash__greeting-left">
                <div className="dash__greeting-avatar">
                  {avatarUrl
                    ? <img src={avatarUrl} alt={displayName} />
                    : <span>{initials}</span>
                  }
                </div>
                <div>
                  <h2><span className="dash__greeting-hello">Hola,</span> {firstName}</h2>
                  <p>{today}</p>
                  {streak > 0 && (
                    <span className="dash__streak-pill">
                      <Flame size={13} strokeWidth={2} />
                      {streak} día{streak !== 1 ? 's' : ''} seguidos
                    </span>
                  )}
                </div>
              </div>
              <div className="dash__greeting-bell-wrap" ref={bellRef}>
                <button
                  className={`dash__greeting-bell${notifications.length > 0 ? ' dash__greeting-bell--active' : ''}`}
                  aria-label="Notificaciones"
                  onClick={() => setShowNotifications(v => !v)}
                >
                  <Bell size={20} strokeWidth={1.75} />
                  {notifications.length > 0 && (
                    <span className="dash__bell-badge">{notifications.length > 9 ? '9+' : notifications.length}</span>
                  )}
                </button>
                {showNotifications && (
                  <div className="dash__notif-panel">
                    <div className="dash__notif-header">
                      <span className="dash__notif-title">Notificaciones</span>
                      {notifications.length > 0 && (
                        <span className="dash__notif-count">{notifications.length}</span>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="dash__notif-empty">No tienes notificaciones nuevas</p>
                    ) : (
                      <ul className="dash__notif-list">
                        {notifications.map(n => (
                          <li key={n.id} className={`dash__notif-item dash__notif-item--${n.type}`}>
                            <span className="dash__notif-item-icon">{n.icon}</span>
                            <div className="dash__notif-item-body">
                              <span className="dash__notif-item-title">{n.title}</span>
                              <span className="dash__notif-item-text">{n.body}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Race hero + Week strip — 50/50 on desktop, stacked on mobile */}
          {!loadingPlan && activePlan && (() => {
            const raceDate = getRaceDate(activePlan);
            const daysLeft = getDaysUntil(raceDate);
            const meta = GOAL_META[activePlan.goal] ?? { label: activePlan.goal, dist: '' };
            const currentWeek = getPlanCurrentWeek(activePlan);
            const raceDateFmt = raceDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
            const weekSessions = activePlan.weeks.find(w => w.week === currentWeek)?.sessions ?? [];
            const todayDayNum = new Date().getDay() === 0 ? 7 : new Date().getDay();
            const DAY_LABELS_SHORT  = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
            const DAY_LABELS_LONG   = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
            const R = 17;
            const CIRC = 2 * Math.PI * R;

            return (
              <div className="dash__hero-week-grid">
                {/* Race hero card */}
                <div className="dash__race-hero" onClick={() => navigate('/training-plan')} role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('/training-plan')}>
                  {/* Ilustración de fondo */}
                  <img src={carreraImg} alt="" className="dash__race-hero-bg" aria-hidden="true" />
                  {/* Gradiente inferior */}
                  <div className="dash__race-hero-overlay" />
                  {/* Pill countdown — arriba a la derecha */}
                  <div className="dash__race-hero-pill">
                    <span className="dash__race-hero-pill-num">{daysLeft}</span>
                    <span className="dash__race-hero-pill-unit">días</span>
                  </div>
                  {/* Card blanca en la parte inferior */}
                  <div className="dash__race-hero-card">
                    <div className="dash__race-hero-card-left">
                      <span className="dash__race-hero-chip">{meta.label}</span>
                      <h3 className="dash__race-hero-title">{meta.dist} · {raceDateFmt}</h3>
                      <p className="dash__race-hero-sub">Semana {currentWeek} de {activePlan.total_weeks}</p>
                    </div>
                  </div>
                </div>

                {/* Weekly plan strip */}
                <div className="dash__week-strip">
                  <div className="dash__week-strip-header">
                    <span className="dash__week-strip-title">Semana {currentWeek}</span>
                    <button className="dash__week-strip-link" onClick={() => navigate('/training-plan')}>
                      Ver plan <ChevronRight size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="dash__week-strip-days">
                    {DAY_LABELS_SHORT.map((labelShort, i) => {
                      const label = labelShort;
                      const labelLong = DAY_LABELS_LONG[i];
                      const dayNum = i + 1;
                      const session = weekSessions.find(s => s.day_number === dayNum);
                      const isToday = dayNum === todayDayNum;
                      const isDone  = session ? isSessionCompleted(session, currentWeek, activePlan, localActivities) : false;
                      const isMissed = session ? isSessionMissed(session, currentWeek, activePlan, localActivities) : false;
                      const isRest  = !session;

                      let durLabel = '';
                      if (session) {
                        const dur = session.duration ?? '';
                        const kmMatch  = dur.match(/(\d+(?:\.\d+)?)\s*km/i);
                        const minMatch = dur.match(/(\d+)\s*min/i);
                        const hMatch   = dur.match(/(\d+(?:\.\d+)?)\s*h/i);
                        if (kmMatch)       durLabel = `${kmMatch[1]}k`;
                        else if (hMatch)   durLabel = `${hMatch[1]}h`;
                        else if (minMatch) { const m = parseInt(minMatch[1]); durLabel = m >= 60 ? `${Math.round(m/60)}h` : `${m}'`; }
                        else               durLabel = dur.slice(0, 4);
                      }

                      const fillPct = isDone ? 1 : (isToday && session) ? 0.35 : 0;
                      const dashFill   = CIRC * fillPct;
                      const dashGap    = CIRC * (1 - fillPct);

                      const stateClass = isDone ? ' dash__week-day--done'
                        : isMissed ? ' dash__week-day--missed'
                        : isToday  ? ' dash__week-day--today'
                        : isRest   ? ' dash__week-day--rest'
                        : '';

                      const clickable = !!session && !isDone;

                      return (
                        <div
                          key={dayNum}
                          className={`dash__week-day${stateClass}`}
                          onClick={clickable ? () => navigate(`/training-plan/session/${activePlan!.id}/${currentWeek}/${dayNum}`) : undefined}
                          role={clickable ? 'button' : undefined}
                          tabIndex={clickable ? 0 : undefined}
                          onKeyDown={clickable ? e => e.key === 'Enter' && navigate(`/training-plan/session/${activePlan!.id}/${currentWeek}/${dayNum}`) : undefined}
                        >
                          <span className="dash__week-day-label dash__week-day-label--short">{label}</span>
                          <span className="dash__week-day-label dash__week-day-label--long">{labelLong}</span>
                          <div className="dash__week-day-wrap">
                            {/* SVG ring */}
                            <svg className="dash__week-day-ring" viewBox="0 0 40 40" fill="none">
                              {/* track */}
                              <circle cx="20" cy="20" r={R}
                                className="dash__week-ring-track"
                                strokeDasharray={isRest ? '3 4' : undefined}
                              />
                              {/* fill arc — done (100%) or today pending (35%) */}
                              {(isDone || (isToday && session)) && (
                                <circle cx="20" cy="20" r={R}
                                  className="dash__week-ring-fill"
                                  strokeDasharray={`${dashFill} ${dashGap}`}
                                  strokeDashoffset={CIRC * 0.25}
                                />
                              )}
                            </svg>
                            {/* inner content */}
                            <div className="dash__week-day-inner">
                              {isRest
                                ? <Moon size={11} className="dash__week-day-rest-icon" />
                                : <span className="dash__week-day-text">{durLabel}</span>
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Plan progress */}
                  <div className="dash__week-strip-prog">
                    <div className="dash__week-strip-prog-bar">
                      <div className="dash__week-strip-prog-fill" style={{ width: `${Math.round((currentWeek / activePlan.total_weeks) * 100)}%` }} />
                    </div>
                    <span className="dash__week-strip-prog-label">Semana {currentWeek} de {activePlan.total_weeks}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Push notification opt-in banner — mobile, one-time */}
          {push.status === 'unsubscribed' && !pushBannerDismissed &&
           typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
            <div className="dash__push-banner">
              <span className="dash__push-banner-icon">🔔</span>
              <div className="dash__push-banner-text">
                <span className="dash__push-banner-title">Activa las notificaciones</span>
                <span className="dash__push-banner-sub">Recibe aviso cuando toque entrenar y al completar un entrenamiento.</span>
              </div>
              <div className="dash__push-banner-actions">
                <button
                  className="dash__push-banner-btn dash__push-banner-btn--primary"
                  disabled={push.loading}
                  onClick={() => {
                    const ctx = activePlan ? getTodayPlanContext(activePlan) : null;
                    const todaySession = ctx
                      ? { type: ctx.session.type, distance: ctx.session.duration ?? '' }
                      : null;
                    push.subscribe(
                      athleteData?.id ? String(athleteData.id) : undefined,
                      todaySession
                    );
                  }}
                >
                  {push.loading ? 'Activando…' : 'Activar'}
                </button>
                <button
                  className="dash__push-banner-btn dash__push-banner-btn--ghost"
                  onClick={() => {
                    localStorage.setItem('push-banner-dismissed', '1');
                    setPushBannerDismissed(true);
                  }}
                >
                  Ahora no
                </button>
              </div>
            </div>
          )}

          {/* Stat cards — 2-col row */}
          {(() => {
            const { mon } = getWeekBounds();
            const weekLabel = mon.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');

            return (
          <div className="dash__stats-row">
            <div className={`dash__stat-card dash__stat-card--km${weekStats.count === 0 ? ' dash__stat-card--empty' : ''}`}>
              <div className="dash__stat-card-top">
                <div>
                  <span className="dash__stat-card-label">Kilómetros</span>
                  <span className="dash__stat-card-week">Semana del {weekLabel}</span>
                </div>
                <FootprintsIcon size={20} strokeWidth={1.5} className="dash__stat-card-icon" />
              </div>
              <svg className="dash__sparkline" viewBox="0 0 70 36" preserveAspectRatio="none" aria-hidden="true">
                {weekDailyKm.map((km, i) => {
                  const max = Math.max(...weekDailyKm, 0.1);
                  const isEmpty = weekStats.count === 0;
                  const stub = Math.round(30 * 0.22);
                  const h = isEmpty ? 5 : km > 0 ? Math.max((km / max) * 30, 4) : stub;
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
                <div>
                  <span className="dash__stat-card-label">Carreras</span>
                  <span className="dash__stat-card-week">Semana del {weekLabel}</span>
                </div>
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
              {weekStats.count > 0 && <span className="dash__stat-card-sub">{formatDuration(weekStats.totalTime)} en total</span>}
            </div>

            <div className={`dash__stat-card dash__stat-card--time dash__stat-card--desktop-only${weekStats.count === 0 ? ' dash__stat-card--empty' : ''}`}>
              <div className="dash__stat-card-top">
                <div>
                  <span className="dash__stat-card-label">Tiempo</span>
                  <span className="dash__stat-card-week">Semana del {weekLabel}</span>
                </div>
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
            </div>
          </div>
          );
          })()}

          {/* Chart + Coach IA — side by side on desktop */}
          <div className="dash__chart-coach-grid">

          {/* 8-week km history chart */}
          {localActivities.length > 0 && (() => {
            const maxKm = Math.max(...weeklyKmHistory.map(w => w.km), 0.1);
            const totalKm = weeklyKmHistory.reduce((s, w) => s + w.km, 0);
            const bestWeekKm = Math.max(...weeklyKmHistory.map(w => w.km));
            const activeWeeks = weeklyKmHistory.filter(w => w.km > 0).length;
            const avgKm = activeWeeks > 0 ? totalKm / activeWeeks : 0;
            return (
              <div className="dash__weekly-chart">
                <div className="dash__weekly-chart-header">
                  <div>
                    <p className="dash__weekly-chart-title">Kilómetros semanales</p>
                    <p className="dash__weekly-chart-sub">Últimas 8 semanas</p>
                  </div>
                  <div className="dash__weekly-chart-kpi">
                    <div className="dash__weekly-chart-kpi-row">
                      <span className="dash__weekly-chart-kpi-value">{totalKm.toFixed(1)}</span>
                      <span className="dash__weekly-chart-kpi-unit">km</span>
                    </div>
                    <span className="dash__weekly-chart-kpi-label">últimas 8 semanas</span>
                  </div>
                </div>
                <div className="dash__weekly-chart-bars">
                  {weeklyKmHistory.map((w, i) => {
                    const barPct = w.km === 0 ? 2 : Math.max((w.km / maxKm) * 100, 6);
                    return (
                      <div key={i} className={`dash__weekly-bar${w.isCurrent ? ' dash__weekly-bar--current' : ''}`}>
                        <span className="dash__weekly-bar-value">{w.km > 0 ? w.km.toFixed(1) : ''}</span>
                        <div className="dash__weekly-bar-track">
                          <div className="dash__weekly-bar-fill" style={{ height: `${barPct}%` }} />
                        </div>
                        <span className="dash__weekly-bar-label">{w.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="dash__weekly-chart-stats">
                  <div className="dash__weekly-chart-stat">
                    <span className="dash__weekly-chart-stat-value">{bestWeekKm.toFixed(1)}</span>
                    <span className="dash__weekly-chart-stat-label">mejor semana</span>
                  </div>
                  <div className="dash__weekly-chart-stat">
                    <span className="dash__weekly-chart-stat-value">{avgKm.toFixed(1)}</span>
                    <span className="dash__weekly-chart-stat-label">media semanal</span>
                  </div>
                  <div className="dash__weekly-chart-stat">
                    <span className="dash__weekly-chart-stat-value">{activeWeeks}</span>
                    <span className="dash__weekly-chart-stat-label">semanas activas</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Coach IA */}
          <div className="dash__top-col">
              {(loadingRec || loadingPlan || recommendation) && (
                <div className="dash__ai">
                  <div className="dash__ai-header">
                      <span className="dash__ai-badge">
                        <Sparkles size={11} strokeWidth={2.5} />
                        Coach IA
                      </span>
                      <div className="dash__ai-header-right">
                        {(coachQOpen || coachQReply) ? (
                          <button
                            className="dash__ai-ask-close"
                            aria-label="Cerrar consulta"
                            onClick={() => { setCoachQOpen(false); setCoachQReply(null); }}
                          >← Volver</button>
                        ) : (
                          <>
                            {!loadingRec && !loadingPlan && loadLevel && (
                              <span className={`dash__ai-load-badge dash__ai-load-badge--${loadLevel.level}`}>
                                Carga: {loadLevel.label} {loadLevel.arrow}
                              </span>
                            )}
                            {!loadingRec && !loadingPlan && recommendation && (
                              <span className={`dash__ai-day-label${todayCompleted ? ' dash__ai-day-label--done' : ''}`}>
                                {recommendation.isRestDay ? 'Día de descanso' : todayCompleted ? '✓ Sesión completada' : recommendation.source === 'plan' ? 'Sesión del plan' : 'Sesión de hoy'}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {(coachQOpen || coachQReply) ? (
                      <div className="dash__ai-ask">
                        {coachQReply ? (
                          <>
                            <p className="dash__ai-ask-reply">{coachQReply}</p>
                            <button className="dash__ai-ask-again" onClick={() => setCoachQReply(null)}>
                              Otra pregunta
                            </button>
                          </>
                        ) : (
                          <div className="dash__ai-ask-chips">
                            {([
                              { key: 'fitness', label: '¿Cómo voy de forma?' },
                              { key: 'week',    label: '¿Cambio algo esta semana?' },
                              { key: 'goal',    label: '¿Voy bien para mi objetivo?' },
                              { key: 'rest',    label: '¿Descanso suficiente?' },
                            ] as const).map(q => (
                              <button
                                key={q.key}
                                className={`dash__ai-ask-chip${coachQLoading ? ' dash__ai-ask-chip--loading' : ''}`}
                                disabled={coachQLoading}
                                onClick={() => handleCoachQuestion(q.key)}
                              >
                                {coachQLoading ? <span className="dash__ai-ask-spinner" /> : q.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {patternAlert && (
                          <div className="dash__ai-pattern">
                            <span className="dash__ai-pattern-icon">📊</span>
                            <span className="dash__ai-pattern-text">{patternAlert}</span>
                            <button
                              className="dash__ai-pattern-close"
                              aria-label="Cerrar"
                              onClick={() => {
                                const today = new Date().toISOString().slice(0, 10);
                                localStorage.setItem(`pattern-alert-dismissed-${today}`, '1');
                                setPatternAlert(null);
                              }}
                            >✕</button>
                          </div>
                        )}

                        {(loadingRec || loadingPlan) ? (
                          <>
                            <div className="dash__ai-skeleton dash__ai-skeleton--card" />
                            <div className="dash__ai-skeleton dash__ai-skeleton--short" />
                          </>
                        ) : recommendation ? (
                          <>
                            {recommendation.isRestDay ? (
                              <>
                                <div className="dash__ai-rest">
                                  <span className="dash__ai-rest-icon">🌙</span>
                                  <span className="dash__ai-rest-label">Hoy toca descansar</span>
                                </div>
                                {activePlan && (() => {
                                  const next = getNextPlanSession(activePlan);
                                  if (!next) return null;
                                  const whenLabel = next.daysFromNow === 1 ? 'Mañana' : `En ${next.daysFromNow} días`;
                                  const infoText = [next.session.type, next.session.duration, next.session.pace_hint].filter(Boolean).join(' · ');
                                  return (
                                    <div className="dash__ai-next">
                                      <span className="dash__ai-next-when">{whenLabel}</span>
                                      <span className="dash__ai-next-info">{infoText}</span>
                                    </div>
                                  );
                                })()}
                              </>
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
                            <button className="dash__ai-ask-trigger" onClick={() => setCoachQOpen(true)}>
                              <Sparkles size={11} strokeWidth={2.5} />
                              Consultar al coach
                            </button>
                          </>
                        ) : null}
                      </>
                    )}
                </div>
              )}
          </div>

          </div>{/* end dash__chart-coach-grid */}

          {/* Motivational banner — shown when user has missed 2+ sessions this week */}
          {!loadingPlan && !loadingRec && activePlan && missedThisWeek >= 2 && (
            <div className={`dash__motivation-banner${missedThisWeek >= 3 ? ' dash__motivation-banner--warn' : ''}`}>
              <span className="dash__motivation-banner-emoji">{missedThisWeek >= 3 ? '💪' : '🎯'}</span>
              <div className="dash__motivation-banner-text">
                <span className="dash__motivation-banner-title">
                  {missedThisWeek >= 3 ? '¡El plan te necesita!' : '¡Puedes recuperarlo!'}
                </span>
                <span className="dash__motivation-banner-sub">
                  {missedThisWeek >= 3
                    ? `Llevas ${missedThisWeek} sesiones sin completar. ¿Retomamos o empezamos de cero?`
                    : `Te has saltado ${missedThisWeek} sesión${missedThisWeek !== 1 ? 'es' : ''}. Las próximas sesiones aún están a tiempo.`}
                </span>
              </div>
              <button className="dash__motivation-banner-btn" onClick={() => navigate('/training-plan')}>
                Ver plan
              </button>
            </div>
          )}

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

      {/* Post-run check-in toast */}
      {checkin && (
        <div className="dash__checkin">
          <div className="dash__checkin-header">
            <span className="dash__checkin-badge">
              <Sparkles size={10} strokeWidth={2.5} />
              Check-in
            </span>
            <button className="dash__checkin-close" onClick={dismissCheckin} aria-label="Cerrar">✕</button>
          </div>
          <div className="dash__checkin-activity">
            <span className="dash__checkin-activity-name">{checkin.activity.name}</span>
            <span className="dash__checkin-activity-meta">
              {(checkin.activity.distance / 1000).toFixed(1)} km
              {' · '}
              {Math.floor(checkin.activity.pace / 60)}:{String(Math.round(checkin.activity.pace % 60)).padStart(2, '0')}/km
            </span>
          </div>
          {checkinReply ? (
            <div className="dash__checkin-reply">
              <p className="dash__checkin-reply-text">{checkinReply}</p>
              <button className="dash__checkin-reply-close" onClick={dismissCheckin}>Cerrar</button>
            </div>
          ) : (
            <>
              <p className="dash__checkin-question">{checkin.question}</p>
              <div className="dash__checkin-chips">
                {checkin.chips.map(chip => (
                  <button
                    key={chip.value}
                    className={`dash__checkin-chip${checkinLoading ? ' dash__checkin-chip--disabled' : ''}`}
                    disabled={checkinLoading}
                    onClick={() => handleCheckinAnswer(chip.value)}
                  >
                    {checkinLoading ? <span className="dash__checkin-chip-loading" /> : chip.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
