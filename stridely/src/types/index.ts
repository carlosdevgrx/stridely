// Types principales de la aplicación

export interface User {
  id: string;
  name: string;
  email: string;
  stravaId?: string;
  createdAt: Date;
}

export interface Workout {
  id: string;
  name: string;
  distance: number;
  duration: number;
  pace: number;
  date: Date;
  type: 'run' | 'trail' | 'race';
  elevation: number;
}

export interface TrainingPlan {
  id: string;
  name: string;
  goal: string;
  startDate: Date;
  endDate: Date;
  workouts: Workout[];
}

export interface AIRecommendation {
  id: string;
  type: 'training' | 'nutrition' | 'recovery' | 'race_prep';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
