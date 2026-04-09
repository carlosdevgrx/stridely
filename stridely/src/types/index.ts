// Types principales de la aplicación

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

export interface PlanSession {
  day_number: number;
  type: string;
  duration: string;
  description: string;
  intensity?: string;
  pace_hint?: string;
}

export interface PlanWeek {
  week: number;
  sessions: PlanSession[];
}

export interface StoredPlan {
  id: string;
  goal: string; // '5km' | '10km' | 'half' | 'marathon'
  sessions_per_week: number;
  total_weeks: number;
  weeks: PlanWeek[];
  started_at: string;
}

export interface ActivityDetail extends Workout {
  polyline: string | null;
  elapsedTime: number;
  avgSpeed: number;
  maxSpeed: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  calories: number | null;
  splitsMetric: SplitMetric[];
  startLat: number | null;
  startLng: number | null;
}

export interface SplitMetric {
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_difference: number;
  average_speed: number;
  average_heartrate?: number;
  split: number;
}



