// Streak freeze — 1 token granted per 14 consecutive perfect days, auto-consumed
// on the first missed day after a streak. Prevents streak loss on a single slip.
// Per-habit: h.freezeTokens, h.freezeUsedDates[]
import { S } from '../../core/state.js';
import { metOn } from './counterMode.js';

const EARN_EVERY = 14;
const MAX_TOKENS = 3;

function dateKey(offsetDays) {
  return new Date(Date.now() - offsetDays * 864e5).toISOString().split('T')[0];
}

export function ensureFreezeFields(h) {
  if (h.freezeTokens == null) h.freezeTokens = 0;
  if (!Array.isArray(h.freezeUsedDates)) h.freezeUsedDates = [];
  if (h.freezeLastEarnedStreak == null) h.freezeLastEarnedStreak = 0;
}

// Match the helper in habits/page.js (kept here as a tiny dup so the freeze
// engine can be unit-tested in isolation without circular imports).
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function isHabitActiveOnDate(h, dateStr) {
  if (!h?.activeDays || !Array.isArray(h.activeDays) || h.activeDays.length === 0) return true;
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  return h.activeDays.includes(WEEKDAY_SHORT[dow]);
}

// Returns the adjusted streak, taking freeze tokens into account.
// Earns a token every EARN_EVERY consecutive "met or frozen" days.
// Days where the habit isn't scheduled (per `activeDays`) are skipped — they
// don't count toward the streak but they don't break it either.
export function computeStreakWithFreeze(h) {
  ensureFreezeFields(h);
  let streak = 0;
  const newlyFrozen = [];
  for (let i = 0; i < 365; i++) {
    const k = dateKey(i);
    if (!isHabitActiveOnDate(h, k)) continue;       // off-day: skip
    if (metOn(h, k)) { streak++; continue; }
    // Already auto-frozen earlier
    if (h.freezeUsedDates.includes(k)) { streak++; continue; }
    // Can we auto-freeze today's break?
    if (h.freezeTokens > 0 && i > 0) {
      h.freezeTokens = Math.max(0, h.freezeTokens - 1);
      newlyFrozen.push(k);
      h.freezeUsedDates.push(k);
      streak++;
      continue;
    }
    break;
  }
  // Earn tokens for consecutive 14-day chunks — only credit new ones.
  const earnedTotal = Math.floor(streak / EARN_EVERY);
  const previouslyEarned = h.freezeLastEarnedStreak || 0;
  const prevEarnTotal = Math.floor(previouslyEarned / EARN_EVERY);
  const credit = Math.max(0, earnedTotal - prevEarnTotal);
  if (credit > 0) h.freezeTokens = Math.min(MAX_TOKENS, (h.freezeTokens || 0) + credit);
  if (streak > previouslyEarned) h.freezeLastEarnedStreak = streak;
  return { streak, tokens: h.freezeTokens, newlyFrozen };
}
