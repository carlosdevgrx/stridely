/**
 * Local Storage Service - Gestión de persistencia de datos
 */

import { STORAGE_KEYS } from '../../constants';
import type { User, Workout } from '../../types';

class LocalStorageService {
  setUser(user: User): void {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  getUser(): User | null {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  }

  clearUser(): void {
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  setStravaToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.STRAVA_TOKEN, token);
  }

  getStravaToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.STRAVA_TOKEN);
  }

  clearStravaToken(): void {
    localStorage.removeItem(STORAGE_KEYS.STRAVA_TOKEN);
  }

  setWorkouts(workouts: Workout[]): void {
    localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
  }

  getWorkouts(): Workout[] {
    const workouts = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
    return workouts ? JSON.parse(workouts) : [];
  }

  clearWorkouts(): void {
    localStorage.removeItem(STORAGE_KEYS.WORKOUTS);
  }

  clearAll(): void {
    localStorage.clear();
  }
}

export const storageService = new LocalStorageService();
