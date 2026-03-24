// Hook para gestionar conexión con Strava

import { useState, useEffect, useCallback } from 'react';
import type { Workout } from '../types';
import { storageService } from '../services/storage/localStorage';
import { stravaClient } from '../services/strava/client';

export const useStrava = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Workout[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Verificar si hay token en localStorage
  useEffect(() => {
    const token = localStorage.getItem('strava_token');
    setIsAuthenticated(!!token);
  }, []);

  // Traer actividades
  const fetchActivities = useCallback(async (accessToken?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Prioridad: token pasado > localStorage > .env
      const token = accessToken || localStorage.getItem('strava_token') || storageService.getStravaToken();
      
      if (!token) {
        throw new Error('No hay token de acceso. Por favor conecta tu cuenta de Strava.');
      }

      console.log('Obteniendo actividades de Strava...');
      stravaClient.setAccessToken(token);
      const data = await stravaClient.getActivities();
      
      console.log(`Se encontraron ${data.length} actividades`);
      
      // Mapear actividades de Strava a nuestro formato
      const workouts = data.map((activity: any) => stravaClient.mapStravaActivityToWorkout(activity));
      setActivities(workouts);
      storageService.setWorkouts(workouts);

      return workouts;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al traer actividades';
      console.error('Error fetching activities:', message);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('strava_token');
    localStorage.removeItem('strava_athlete');
    storageService.clearStravaToken();
    setActivities([]);
    setIsAuthenticated(false);
  }, []);

  return {
    loading,
    error,
    activities,
    isAuthenticated,
    fetchActivities,
    logout,
  };
};
