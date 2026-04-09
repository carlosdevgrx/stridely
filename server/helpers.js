/**
 * Pure calculation helpers — no Express, no Groq, no side effects.
 * Extracted from index.js so they can be unit-tested independently.
 */

/**
 * Returns days since the last activity.
 * @param {Array<{date: string}>} activities - sorted or unsorted list of activities
 * @param {Date} [now] - reference date (defaults to current time, injectable for testing)
 * @returns {number} days since last run, or -1 if no activities
 */
function daysSinceLastRun(activities, now = new Date()) {
  if (!Array.isArray(activities) || activities.length === 0) return -1;
  const sorted = [...activities].sort((a, b) => new Date(b.date) - new Date(a.date));
  const lastDate = sorted[0]?.date ? new Date(sorted[0].date) : null;
  if (!lastDate) return -1;
  const diffMs = now - lastDate;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Returns the average pace (seconds/km) across all activities that have pace > 0.
 * @param {Array<{pace?: number}>} activities
 * @returns {number} average pace in seconds/km, or 0 if none
 */
function avgPace(activities) {
  if (!Array.isArray(activities)) return 0;
  const paced = activities.filter(a => (a.pace ?? 0) > 0);
  if (paced.length === 0) return 0;
  return paced.reduce((s, a) => s + a.pace, 0) / paced.length;
}

/**
 * Groups activities into weekly buckets (Mon–Sun) and returns km per week
 * for the last `numWeeks` weeks, sorted oldest → newest.
 * @param {Array<{date: string, distance?: number}>} activities
 * @param {number} [numWeeks=8]
 * @param {Date} [now]
 * @returns {Array<{weekStart: string, km: number}>}
 */
function weeklyKmProgression(activities, numWeeks = 8, now = new Date()) {
  if (!Array.isArray(activities)) return [];
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - numWeeks * 7);

  const buckets = {};
  for (const a of activities) {
    if (!a.date) continue;
    const d = new Date(a.date);
    if (d < cutoff) continue;
    const dow = d.getDay();
    const daysToMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(d);
    mon.setDate(d.getDate() + daysToMon);
    const key = mon.toISOString().slice(0, 10);
    buckets[key] = (buckets[key] ?? 0) + ((a.distance ?? 0) / 1000);
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, km]) => ({ weekStart, km }));
}

/**
 * Returns whether the runner did a quality session (pace faster than avgPace)
 * in the last `days` days.
 * @param {Array<{date: string, pace?: number}>} activities
 * @param {number} referencePace - average pace in sec/km
 * @param {number} [days=4]
 * @param {Date} [now]
 * @returns {boolean}
 */
function hasRecentQualitySession(activities, referencePace, days = 4, now = new Date()) {
  if (!Array.isArray(activities) || referencePace <= 0) return false;
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);
  return activities.some(a =>
    a.date && new Date(a.date) >= cutoff && (a.pace ?? 0) > 0 && a.pace < referencePace
  );
}

/**
 * Computes the current week number (1-based) of a training plan.
 * Uses UTC dates to avoid timezone drift.
 * @param {{ started_at: string, total_weeks: number }} plan
 * @param {Date} [now]
 * @returns {number}
 */
function planCurrentWeek(plan, now = new Date()) {
  const [sy, sm, sd] = plan.started_at.split('-').map(Number);
  const startUTC = Date.UTC(sy, sm - 1, sd);
  const startDow = new Date(startUTC).getUTCDay();
  const daysToMonday = startDow === 0 ? -6 : 1 - startDow;
  const planMondayUTC = startUTC + daysToMonday * 86400000;
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.min(Math.floor((todayUTC - planMondayUTC) / 86400000 / 7) + 1, plan.total_weeks);
}

module.exports = {
  daysSinceLastRun,
  avgPace,
  weeklyKmProgression,
  hasRecentQualitySession,
  planCurrentWeek,
};
