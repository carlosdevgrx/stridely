// Constantes globales

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
export const STRAVA_OAUTH_URL = 'https://www.strava.com/oauth/authorize';

export const STORAGE_KEYS = {
  USER: 'stridely_user',
  STRAVA_TOKEN: 'stridely_strava_token',
  WORKOUTS: 'stridely_workouts',
  PREFERENCES: 'stridely_preferences',
} as const;

export const WORKOUT_TYPES = {
  RUN: 'run',
  TRAIL: 'trail',
  RACE: 'race',
} as const;

export const RECOMMENDATION_TYPES = {
  TRAINING: 'training',
  NUTRITION: 'nutrition',
  RECOVERY: 'recovery',
  RACE_PREP: 'race_prep',
} as const;

export const PRIORITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
