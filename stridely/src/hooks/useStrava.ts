// Hook para gestionar conexión con Strava

import { useState, useEffect, useCallback } from 'react';
import type { Workout } from '../types';
import { stravaClient } from '../services/strava/client';
import { supabase } from '../services/supabase/client';

export const useStrava = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Workout[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Verificar si el usuario tiene Strava conectado en Supabase
  useEffect(() => {
    const checkConnection = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('strava_connections')
        .select('access_token')
        .eq('user_id', user.id)
        .single();

      setIsConnected(!!data?.access_token);
    };
    checkConnection();
  }, []);

  const getStravaToken = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión de usuario');

    const { data, error } = await supabase
      .from('strava_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .single();

    if (error || !data?.access_token) {
      throw new Error('Cuenta de Strava no conectada');
    }
    return data.access_token;
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
    fetchActivities,
    disconnectStrava,
    logout,
  };
};
