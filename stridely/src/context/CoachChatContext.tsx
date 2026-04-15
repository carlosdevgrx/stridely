import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id:      string;
  role:    'user' | 'assistant';
  content: string;
  ts:      number; // timestamp local para ordenar
}

// Contexto para pasar datos del corredor al coach (plan + actividades recientes)
export interface CoachContext {
  plan_goal?:          string;
  current_week?:       number;
  total_weeks?:        number;
  upcoming_session?:   string;
  recent_activities?:  Array<{ distance?: number; duration?: number; pace?: number }>;
}

interface CoachChatState {
  isOpen:      boolean;
  messages:    ChatMessage[];
  isLoading:   boolean;
  coachCtx:    CoachContext;
  open:        () => void;
  close:       () => void;
  toggle:      () => void;
  sendMessage: (text: string) => Promise<void>;
  setCoachCtx: (ctx: CoachContext) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CoachChatContext = createContext<CoachChatState | null>(null);

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CoachChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen,    setIsOpen]    = useState(false);
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [coachCtx,  setCoachCtx]  = useState<CoachContext>({});

  const open   = useCallback(() => setIsOpen(true),  []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Obtener user_id desde Supabase auth
    const { supabase } = await import('../services/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    // Añadir mensaje del usuario inmediatamente
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

      const assistantMsg: ChatMessage = {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: res.ok
          ? data.reply
          : (data.error ?? 'No he podido procesar tu mensaje. Inténtalo de nuevo.'),
        ts: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
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
      isOpen, messages, isLoading, coachCtx,
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
