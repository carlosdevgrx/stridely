import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id:      string;
  role:    'user' | 'assistant' | 'system';
  content: string;
  ts:      number;
}

export interface CoachWeekSession {
  day_number:  number;
  type:        string;
  duration:    string;
  description: string;
  intensity?:  string;
  pace_hint?:  string;
  completed?:  boolean; // calculado en el frontend
}

export interface CoachContext {
  plan_goal?:          string;
  plan_id?:            string;
  current_week?:       number;
  total_weeks?:        number;
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
  planModifiedAt: number | null; // timestamp — componentes lo observan para refetch
  open:           () => void;
  close:          () => void;
  toggle:         () => void;
  sendMessage:    (text: string) => Promise<void>;
  setCoachCtx:    (ctx: CoachContext) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CoachChatContext = createContext<CoachChatState | null>(null);

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CoachChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen,         setIsOpen]         = useState(false);
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [coachCtx,       setCoachCtx]       = useState<CoachContext>({});
  const [planModifiedAt, setPlanModifiedAt] = useState<number | null>(null);

  const open   = useCallback(() => setIsOpen(true),      []);
  const close  = useCallback(() => setIsOpen(false),     []);
  const toggle = useCallback(() => setIsOpen(v => !v),   []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const { supabase } = await import('../services/supabase/client');
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
      const res  = await fetch(`${API_BASE}/api/ai/coach-chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          user_id: userId,
          message: text.trim(),
          context: Object.keys(coachCtx).length > 0 ? coachCtx : undefined,
        }),
      });

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: res.ok
          ? data.reply
          : (data.error ?? 'No he podido procesar tu mensaje. Inténtalo de nuevo.'),
        ts: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Si el coach modificó el plan, añadir mensaje de sistema y notificar
      if (res.ok && data.action_applied && data.action_detail) {
        const sysMsg: ChatMessage = {
          id:      crypto.randomUUID(),
          role:    'system',
          content: `✓ ${data.action_detail.description}`,
          ts:      Date.now(),
        };
        setMessages(prev => [...prev, sysMsg]);
        setPlanModifiedAt(Date.now());
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
  }, [isLoading, coachCtx]);

  return (
    <CoachChatContext.Provider value={{
      isOpen, messages, isLoading, coachCtx, planModifiedAt,
      open, close, toggle, sendMessage, setCoachCtx,
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
