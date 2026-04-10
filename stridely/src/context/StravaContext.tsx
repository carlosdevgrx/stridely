import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase/client';

interface StravaContextValue {
  isConnected: boolean;
  initializing: boolean;
  athleteData: Record<string, unknown> | null;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setAthleteData: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
}

const StravaContext = createContext<StravaContextValue | null>(null);

export const StravaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [athleteData, setAthleteData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setInitializing(false);
        return;
      }
      const { data } = await supabase
        .from('strava_connections')
        .select('access_token, athlete_data')
        .eq('user_id', user.id)
        .single();
      if (!cancelled) {
        setIsConnected(!!data?.access_token);
        setAthleteData((data?.athlete_data as Record<string, unknown>) ?? null);
        setInitializing(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  return (
    <StravaContext.Provider value={{ isConnected, initializing, athleteData, setIsConnected, setAthleteData }}>
      {children}
    </StravaContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useStravaContext = (): StravaContextValue => {
  const ctx = useContext(StravaContext);
  if (!ctx) throw new Error('useStravaContext must be used inside StravaProvider');
  return ctx;
};
