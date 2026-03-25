// Hook para gestionar conexión con Strava

import { useState, useEffect, useCallback } from 'react';
import type { Workout } from '../types';
import { stravaClient } from '../services/strava/client';
import { supabase } from '../services/supabase/client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const useStrava = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Workout[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [athleteData, setAthleteData] = useState<Record<string, unknown> | null>(null);

  // Verificar si el usuario tiene Strava conectado en Supabase
  useEffect(() => {
    const checkConnection = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('strava_connections')
        .select('access_token, athlete_data')
        .eq('user_id', user.id)
        .single();

      setIsConnected(!!data?.access_token);
      setAthleteData((data?.athlete_data as Record<string, unknown>) ?? null);
    };
    checkConnection();
  }, []);

  const getStravaToken = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión de usuario');

    const { data, error } = await supabase
      .from('strava_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single();

    if (error || !data?.access_token) {
      throw new Error('Cuenta de Strava no conectada');
    }

    // Token still valid (more than 5 minutes left)
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (data.expires_at && data.expires_at > nowSeconds + 300) {
      return data.access_token;
    }

    // Token expired or expiring soon — refresh it
    if (!data.refresh_token) throw new Error('No hay refresh token de Strava. Vuelve a conectar tu cuenta.');

    const refreshRes = await fetch(`${API_BASE}/api/strava/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: data.refresh_token }),
    });

    if (!refreshRes.ok) {
      throw new Error('No se pudo renovar el token de Strava. Reconecta tu cuenta.');
    }

    const newTokens = await refreshRes.json();

    // Persist new tokens in Supabase
    await supabase
      .from('strava_connections')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: newTokens.expires_at,
      })
      .eq('user_id', user.id);

    return newTokens.access_token;
  };

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getStravaToken();
      stravaClient.setAccessToken(token);
      const data = await stravaClient.getActivities();

      const workouts = data.map((activity: any) => stravaClient.mapStravaActivityToWorkout(activity));
      setActivities(workouts);
      return workouts;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al traer actividades';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectStrava = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('strava_connections').delete().eq('user_id', user.id);
    setActivities([]);
    setIsConnected(false);
    setAthleteData(null);
  }, []);

  // Logout legacy (kept for compatibility)
  const logout = useCallback(() => {
    setActivities([]);
    setIsConnected(false);
  }, []);

  return {
    loading,
    error,
    activities,
    isConnected,
    athleteData,
    fetchActivities,
    disconnectStrava,
    logout,
  };
};
