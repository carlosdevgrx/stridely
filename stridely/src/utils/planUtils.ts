import { toYMD } from './formatters';
import type { Workout, PlanSession, StoredPlan } from '../types';

/**
 * Returns the calendar date of a given session (week + day_number) in a plan.
 * Anchors to the Monday of the week the plan started so that calculations
 * match getPlanCurrentWeek exactly.
 */
export function getSessionDate(startedAt: string, week: number, dayNumber: number): Date {
  const start = new Date(startedAt + 'T12:00:00');
  const dow = start.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const planMonday = new Date(start);
  planMonday.setDate(start.getDate() + daysToMonday);
  const sessionDate = new Date(planMonday);
  sessionDate.setDate(planMonday.getDate() + (week - 1) * 7 + (dayNumber - 1));
  return sessionDate;
}

/**
 * Returns the current week number (1-based) of a training plan.
 * Uses Date.UTC to be immune to DST transitions.
 */
export function getPlanCurrentWeek(plan: StoredPlan): number {
  const [sy, sm, sd] = plan.started_at.split('-').map(Number);
  const startUTC = Date.UTC(sy, sm - 1, sd);
  const startDow = new Date(startUTC).getUTCDay();
  const daysToMonday = startDow === 0 ? -6 : 1 - startDow;
  const planMondayUTC = startUTC + daysToMonday * 86400000;
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((todayUTC - planMondayUTC) / 86400000);
  return Math.min(Math.floor(diffDays / 7) + 1, plan.total_weeks);
}

/**
 * Parses a human-readable duration string like "30-40 min" or "45 min"
 * and returns the value in minutes (average of range if range given).
 */
export function parsePlanDurationMin(s: string): number {
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)\s*min/i);
  if (range) return (parseInt(range[1]) + parseInt(range[2])) / 2;
  const single = s.match(/(\d+)\s*min/i);
  if (single) return parseInt(single[1]);
  return 0;
}

/**
 * Finds the Strava activity that best matches a planned session.
 * Accepts activities done ±1 day from the planned date.
 * Prevents double-matching: if another session is strictly closer to the
 * activity, returns null. Also rejects activities shorter than 55% of the
 * planned duration (avoids matching warm-up jogs to long runs).
 */
export function findMatchingActivity(
  session: PlanSession,
  weekNum: number,
  plan: StoredPlan,
  activities: Workout[],
): Workout | null {
  const sessionDate = getSessionDate(plan.started_at, weekNum, session.day_number);
  const sessionMs = sessionDate.getTime();
  const dayMs = 86400000;

  const candidateDates = new Set([
    toYMD(new Date(sessionMs - dayMs)),
    toYMD(new Date(sessionMs)),
    toYMD(new Date(sessionMs + dayMs)),
  ]);

  const act = activities.find(a => candidateDates.has(toYMD(a.date as unknown as string)));
  if (!act) return null;

  const actMs = new Date(act.date as unknown as string).getTime();
  const myDist = Math.abs(actMs - sessionMs);

  for (const planWeek of plan.weeks) {
    for (const s of planWeek.sessions) {
      if (planWeek.week === weekNum && s.day_number === session.day_number) continue;
      const otherMs = new Date(getSessionDate(plan.started_at, planWeek.week, s.day_number)).getTime();
      const otherDist = Math.abs(actMs - otherMs);
      if (otherDist < myDist) return null;
      if (otherDist === myDist && otherMs < actMs && sessionMs > actMs) return null;
    }
  }

  const plannedMin = parsePlanDurationMin(session.duration);
  if (plannedMin > 0 && act.duration / 60 < plannedMin * 0.55) return null;

  return act;
}

/**
 * Returns true if a matching Strava activity exists for the given session.
 */
export function isSessionCompleted(
  session: PlanSession,
  weekNum: number,
  plan: StoredPlan,
  activities: Workout[],
): boolean {
  return findMatchingActivity(session, weekNum, plan, activities) !== null;
}

/**
 * Returns true if the session date is in the past and no matching activity exists.
 */
export function isSessionMissed(
  session: PlanSession,
  weekNum: number,
  plan: StoredPlan,
  activities: Workout[],
): boolean {
  if (isSessionCompleted(session, weekNum, plan, activities)) return false;
  const sessionDate = getSessionDate(plan.started_at, weekNum, session.day_number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  sessionDate.setHours(0, 0, 0, 0);
  return sessionDate < today;
}
