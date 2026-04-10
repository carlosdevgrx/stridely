import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const ERROR_TRANSLATIONS: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos',
  'Invalid email or password': 'Email o contraseña incorrectos',
  'Email not confirmed': 'Debes confirmar tu email antes de iniciar sesión',
  'User already registered': 'Ya existe una cuenta con ese email',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
  'Unable to validate email address: invalid format': 'El formato del email no es válido',
  'For security purposes, you can only request this once every 60 seconds': 'Por seguridad, espera 60 segundos antes de volver a intentarlo',
  'Email rate limit exceeded': 'Se ha superado el límite de intentos. Inténtalo más tarde',
  'over_email_send_rate_limit': 'Se ha superado el límite de emails. Inténtalo más tarde',
  'signup_disabled': 'El registro está desactivado temporalmente',
};

const translateError = (msg: string): string => {
  for (const [key, translation] of Object.entries(ERROR_TRANSLATIONS)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return translation;
  }
  return msg;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // If Supabase can't refresh the session (invalid refresh token), sign out cleanly
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        supabase.auth.signOut();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    return { error: error ? translateError(error.message) : null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateError(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const deleteAccount = async (): Promise<{ error: string | null }> => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return { error: 'No hay sesión activa' };
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
      const res = await fetch(`${serverUrl}/api/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentSession.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error ?? 'Error al eliminar la cuenta' };
      await supabase.auth.signOut();
      return { error: null };
    } catch {
      return { error: 'Error de conexión. Inténtalo de nuevo.' };
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signUp, signIn, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
};
