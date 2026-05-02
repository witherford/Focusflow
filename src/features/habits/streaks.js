// Streak calculation, status badge, and heatmap for habits.
import { S } from '../../core/state.js';
import { tierFor, DEFAULT_TIERS } from './tierStreak.js';
import { metOn } from './counterMode.js';
import { computeStreakWithFreeze } from './streakFreeze.js';

const AUTO_BRACKETS = [7, 14, 30, 60, 100, 200, 365];

// Returns the current goal target for a habit. For auto-incremental, walks
// the bracket list and returns the next bracket above the current streak.
export function streakGoalTarget(h, streak) {
  if (!h?.streakGoalMode) return 0;
  if (h.streakGoalMode === 'number') return Math.max(1, parseInt(h.streakGoalDays) || 0);
  if (h.streakGoalMode === 'auto') {
    for (const b of AUTO_BRACKETS) if (streak < b) return b;
    return AUTO_BRACKETS[AUTO_BRACKETS.length - 1];
  }
  return 0;
}

export function streakStatusBadge(h) {
  const streak = calcStreak(h.id);
  const target = streakGoalTarget(h, streak);
  if (!target) {
    if (streak <= 0) {
      return `<span class="streak-status" title="No streak yet"><span class="ss-num ss-num-empty">—</span></span>`;
    }
    return `<span class="streak-status" title="Current streak"><span class="ss-num">${streak}</span><span class="ss-flame">🔥</span></span>`;
  }
  const pct = Math.min(100, Math.round(streak / target * 100));
  const colour = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--teal)' : 'var(--violet)';
  return `<span class="streak-status" title="${streak} / ${target}-day goal">
    <span class="ss-bar"><span class="ss-bar-fill" style="width:${pct}%;background:${colour}"></span></span>
    <span class="ss-num">${streak}/${target}</span>
  </span>`;
}

// Compact badge shown on a linked habit's row. e.g. "🔗 meditate · 15m".
export function linkedHabitBadge(h) {
  if (!h?.linkedType) return '';
  const cfg = h.linkedConfig || {};
  const tag = h.linkedType;
  let suffix = '';
  if (tag === 'meditate' && cfg.duration) suffix = ' · ' + cfg.duration + 'm';
  else if (tag === 'deepwork' && cfg.mins) suffix = ' · ' + cfg.mins + 'm';
  else if (tag === 'sleep' && cfg.targetHrs) suffix = ' · ' + cfg.targetHrs + 'h';
  return `<span class="link-badge" title="Tap the habit to launch its tool">🔗 ${tag}${suffix}</span>`;
}

// Streak = consecutive days from today backward where the habit was "met" (with auto-freeze).
// Bad habits use a different rule: streak = consecutive days back without an "indulged" entry.
export function calcStreak(id) {
  const h = S.habits.find(x => x.id === id); if (!h) return 0;
  if (h.kind === 'bad') return calcBadStreak(h);
  const { streak } = computeStreakWithFreeze(h);
  h.tier = tierFor(streak, h.tierBase || DEFAULT_TIERS);
  return streak;
}

export function calcBadStreak(h) {
  const log = S.badHabitLog || {};
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    const v = log[k]?.[h.id];
    if (v === 'indulged') break;
    if (v === 'avoided') streak++;
    // Unmarked days neither break nor count toward the streak.
  }
  return streak;
}

// Weekly completion for a habit — Mon→Sun. Returns { done, target } where
// target = number of active weekdays for the habit (defaults to 7).
export function weeklyCompletion(habitId) {
  const h = S.habits.find(x => x.id === habitId); if (!h) return { done: 0, target: 7 };
  // UTC-ISO keys to match S.habitLog convention. Walk from Monday → today.
  const todayK = new Date().toISOString().split('T')[0];
  const todayDow = new Date(todayK + 'T00:00:00Z').getUTCDay();
  const daysSinceMon = todayDow === 0 ? 6 : todayDow - 1;
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activeDays = Array.isArray(h.activeDays) && h.activeDays.length ? h.activeDays : null;
  let target = 0, done = 0;
  for (let off = 0; off <= 6; off++) {
    const back = daysSinceMon - off; // off=0 → Monday (back=daysSinceMon)
    const inFuture = back < 0;       // future days this week — count toward target only
    const k = new Date(Date.now() - Math.max(0, back) * 864e5).toISOString().split('T')[0];
    const dow = dayShort[(off + 1) % 7]; // off=0 → Mon, off=6 → Sun
    if (activeDays && !activeDays.includes(dow)) continue;
    target++;
    if (inFuture) continue;
    if (h.kind === 'bad') {
      if ((S.badHabitLog || {})[k]?.[h.id] === 'avoided') done++;
    } else {
      if (metOn(h, k)) done++;
    }
  }
  if (!target) target = 7;
  return { done, target };
}

export function renderHabitHeatmap() {
  window.renderHM('heatmap-grid', parseInt(document.getElementById('hm-months')?.value || 1) * 30, k => {
    const total = S.habits.length;
    if (!total) return { l: 0, title: k + ': 0/0' };
    const done = S.habits.filter(h => metOn(h, k)).length;
    const pct = done / total;
    return { l: done === 0 ? 0 : pct < .25 ? 1 : pct < .5 ? 2 : pct < 1 ? 3 : 4, title: k + ': ' + done + '/' + total };
  });
}
