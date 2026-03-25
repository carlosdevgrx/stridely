/**
 * Strava Service - Integración con API de Strava
 */

import type { Workout } from '../../types';

export class StravaClient {
  private accessToken: string | null = null;
  private baseUrl = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/strava`;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  async getActivities(before?: number, after?: number, page: number = 1, perPage: number = 30) {
    if (!this.accessToken) {
      throw new Error('Strava access token not set');
    }

    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (before) params.append('before', before.toString());
    if (after) params.append('after', after.toString());

    try {
      const response = await fetch(`${this.baseUrl}/activities?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch activities: ${error.error}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }
  }

  async getAthleteProfile() {
    if (!this.accessToken) {
      throw new Error('Strava access token not set');
    }

    try {
      const response = await fetch(`${this.baseUrl}/athlete`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch athlete profile');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching athlete:', error);
      throw error;
    }
  }

  async getActivityById(id: string) {
    if (!this.accessToken) throw new Error('Strava access token not set');
    const response = await fetch(`${this.baseUrl}/activities/${id}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to fetch activity detail');
    return response.json();
  }

  mapStravaActivityToWorkout(activity: any): Workout {
    return {
      id: activity.id.toString(),
      name: activity.name,
      distance: activity.distance,
      duration: activity.moving_time,
      pace: activity.distance > 0 ? activity.moving_time / (activity.distance / 1000) : 0,
      date: new Date(activity.start_date),
      type: activity.sport_type === 'Run' ? 'run' : 'trail',
      elevation: activity.total_elevation_gain || 0,
    };
  }
}

export const stravaClient = new StravaClient();
