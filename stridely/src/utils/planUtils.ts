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
 * Classifies the duration/volume of a session.
 * Returns 'time' for minute-based, 'distance' for km-based, 'interval' for repetition-based.
 */
export function classifyDuration(duration: string): 'time' | 'distance' | 'interval' {
  if (/\d+\s*[xX×]\s*\d+/i.test(duration)) return 'interval';
  if (/\bkm\b/i.test(duration)) return 'distance';
  return 'time';
}

/**
 * Estimates total session time (with ~20% warmup/cooldown overhead) for distance-based sessions.
 * Requires pace_hint in "X:XX-X:XX/km" or "X:XX/km" format.
 * Returns a "~XX min" string when computable, or null otherwise.
 */
export function estimateSessionTime(duration: string, paceHint?: string): string | null {
  const kmMatch = duration.match(/(\d+(?:\.\d+)?)\s*km/i);
  if (!kmMatch) return null;
  const km = parseFloat(kmMatch[1]);

  if (!paceHint) return null;

  let paceMinPerKm: number | null = null;
  const rangeMatch = paceHint.match(/(\d+):(\d+)\s*[-–]\s*(\d+):(\d+)/);
  if (rangeMatch) {
    const p1 = parseInt(rangeMatch[1]) + parseInt(rangeMatch[2]) / 60;
    const p2 = parseInt(rangeMatch[3]) + parseInt(rangeMatch[4]) / 60;
    paceMinPerKm = (p1 + p2) / 2;
  } else {
    const singleMatch = paceHint.match(/(\d+):(\d+)/);
    if (singleMatch) paceMinPerKm = parseInt(singleMatch[1]) + parseInt(singleMatch[2]) / 60;
  }

  if (paceMinPerKm === null) return null;
  const totalMin = Math.round(km * paceMinPerKm * 1.2);
  return `~${totalMin} min`;
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
 * Sessions scheduled before the plan's started_at date are never considered missed
 * (they existed on paper but the user hadn't started the plan yet).
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
  // Never mark as missed if the session was scheduled before the plan was created
  const [py, pm, pd] = plan.started_at.split('-').map(Number);
  const planCreated = new Date(py, pm - 1, pd);
  planCreated.setHours(0, 0, 0, 0);
  if (sessionDate < planCreated) return false;
  return sessionDate < today;
}
