import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase/client';
import { getPlanCurrentWeek, isSessionCompleted } from '../utils/planUtils';
import type { StoredPlan, Workout } from '../types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ActionDetail {
  type:                 'move_session';
  from_day:             number;
  to_day:               number;
  session_type:         string;
  session_duration?:    string;
  session_intensity?:   string;
  session_description?: string;
  description:          string;
}

export interface ChatMessage {
  id:      string;
  role:    'user' | 'assistant' | 'system';
  content: string;
  meta?:   ActionDetail;
  ts:      number;
}

export interface CoachWeekSession {
  day_number:  number;
  type:        string;
  duration:    string;
  description: string;
  intensity?:  string;
  pace_hint?:  string;
  completed?:  boolean;
}

export interface CoachContext {
  plan_goal?:          string;
  plan_id?:            string;
  current_week?:       number;
  total_weeks?:        number;
  last_week?:          number;
  last_day?:           number;  // max day_number in the last week (race/end day)
  today_day_number?:   number;
  week_sessions?:      CoachWeekSession[];
  upcoming_session?:   string;
  recent_activities?:  Array<{ distance?: number; duration?: number; pace?: number }>;
}

interface CoachChatState {
  isOpen:         boolean;
  messages:       ChatMessage[];
  isLoading:      boolean;
  coachCtx:       CoachContext;
  planModifiedAt: number;
  open:           () => void;
  close:          () => void;
  toggle:         () => void;
  sendMessage:    (text: string) => Promise<void>;
  setCoachCtx:    (ctx: CoachContext) => void;
  refreshPlan:    () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CoachChatContext = createContext<CoachChatState | null>(null);

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCoachCtx(plan: StoredPlan, activities: Workout[]): CoachContext {
  const todayDow    = new Date().getDay();
  const todayDayNum = todayDow === 0 ? 7 : todayDow;
  const currentWeek = getPlanCurrentWeek(plan);

  const weekSessions = (plan.weeks.find(w => w.week === currentWeek)?.sessions ?? [])
    .map(s => ({
      ...s,
      completed: isSessionCompleted(s, currentWeek, plan, activities),
    }));

  // Last week = last entry in the plan; last day = max day_number of that week
  const lastWeek = plan.weeks.reduce((max, w) => w.week > max ? w.week : max, 1);
  const lastWeekSessions = plan.weeks.find(w => w.week === lastWeek)?.sessions ?? [];
  const lastDay = lastWeekSessions.reduce((max, s) => (s.day_number ?? 0) > max ? (s.day_number ?? 0) : max, 1);

  const next = weekSessions.find(s => !s.completed && (s.day_number ?? 0) >= todayDayNum);

  return {
    plan_goal:        plan.goal,
    plan_id:          plan.id,
    current_week:     currentWeek,
    total_weeks:      plan.total_weeks,
    last_week:        lastWeek,
    last_day:         lastDay,
    today_day_number: todayDayNum,
    week_sessions:    weekSessions,
    upcoming_session: next ? `${next.type} ${next.duration}` : undefined,
    recent_activities: activities.slice(0, 8).map(a => ({
      distance: a.distance,
      duration: a.duration,
      pace:     a.pace,
    })),
  };
}

/** Obtiene el access_token de Strava (con refresh si está caducado) */
async function getStravaToken(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('strava_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data?.access_token) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (data.expires_at && data.expires_at > nowSeconds + 300) return data.access_token;

  if (!data.refresh_token) return null;

  try {
    const refreshRes = await fetch(`${API_BASE}/api/strava/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: data.refresh_token }),
    });
    if (!refreshRes.ok) return null;
    const newTokens = await refreshRes.json();
    await supabase
      .from('strava_connections')
      .update({ access_token: newTokens.access_token, refresh_token: newTokens.refresh_token, expires_at: newTokens.expires_at })
      .eq('user_id', user.id);
    return newTokens.access_token;
  } catch {
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CoachChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen,         setIsOpen]         = useState(false);
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [coachCtx,       setCoachCtx]       = useState<CoachContext>({});
  const [planModifiedAt, setPlanModifiedAt] = useState<number>(0);

  // Refs para el fetch autónomo — los guardamos para reusar en refreshPlan
  const planRef        = useRef<StoredPlan | null>(null);
  const activitiesRef  = useRef<Workout[]>([]);

  // ── Carga autónoma del plan y actividades ──────────────────────────────────
  const loadPlanContext = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    // Plan activo
    const { data: planData } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!planData) return;
    planRef.current = planData as StoredPlan;

    // Actividades desde Strava API (misma ruta que useStrava)
    const token = await getStravaToken();
    let acts: Workout[] = [];
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/api/strava/activities?page=1&per_page=20`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const raw = await res.json();
          acts = (raw as Array<{ sport_type: string; id: number; name: string; distance: number; moving_time: number; total_elevation_gain?: number; start_date: string }>)
            .filter(a => ['Run', 'TrailRun', 'VirtualRun'].includes(a.sport_type))
            .map(a => ({
              id:        String(a.id),
              name:      a.name,
              distance:  a.distance,
              duration:  a.moving_time,
              pace:      a.distance > 0 ? a.moving_time / (a.distance / 1000) : 0,
              date:      new Date(a.start_date),
              type:      'run' as const,
              elevation: a.total_elevation_gain ?? 0,
            }));
        }
      } catch { /* sin actividades — no bloqueante */ }
    }
    activitiesRef.current = acts;

    setCoachCtx(buildCoachCtx(planData as StoredPlan, acts));
  }, []);

  // Carga al montar y cuando cambia la sesión de auth
  useEffect(() => {
    loadPlanContext();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadPlanContext();
    });
    return () => subscription.unsubscribe();
  }, [loadPlanContext]);

  // Recarga el plan tras una modificación del coach (o llamada externa)
  const refreshPlan = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const { data: planData } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!planData) return;
    planRef.current = planData as StoredPlan;
    setCoachCtx(buildCoachCtx(planData as StoredPlan, activitiesRef.current));
  }, []);

  const open   = useCallback(() => setIsOpen(true),    []);
  const close  = useCallback(() => setIsOpen(false),   []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const userMsg: ChatMessage = {
      id:      crypto.randomUUID(),
      role:    'user',
      content: text.trim(),
      ts:      Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/coach-chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          user_id: userId,
          message: text.trim(),
          context: Object.keys(coachCtx).length > 0 ? coachCtx : undefined,
        }),
      });

      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          id:      crypto.randomUUID(),
          role:    'assistant',
          content: res.ok
            ? data.reply
            : (data.error ?? 'No he podido procesar tu mensaje. Inténtalo de nuevo.'),
          ts: Date.now(),
        },
      ]);

      // Si el coach modificó el plan → confirmar, recargar y notificar
      if (res.ok && data.action_applied && data.action_detail) {
        setMessages(prev => [
          ...prev,
          {
            id:      crypto.randomUUID(),
            role:    'system',
            content: data.action_detail.description,
            meta:    data.action_detail as ActionDetail,
            ts:      Date.now(),
          },
        ]);
        const now = Date.now();
        setPlanModifiedAt(now);
        refreshPlan();
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id:      crypto.randomUUID(),
          role:    'assistant',
          content: 'No he podido conectarme. Comprueba tu conexión e inténtalo de nuevo.',
          ts:      Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, coachCtx, refreshPlan]);

  return (
    <CoachChatContext.Provider value={{
      isOpen, messages, isLoading, coachCtx, planModifiedAt,
      open, close, toggle, sendMessage, setCoachCtx, refreshPlan,
    }}>
      {children}
    </CoachChatContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCoachChat(): CoachChatState {
  const ctx = useContext(CoachChatContext);
  if (!ctx) throw new Error('useCoachChat must be used inside CoachChatProvider');
  return ctx;
}

