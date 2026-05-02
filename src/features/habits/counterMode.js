// Counter-mode helpers — Phase 4
// Supports two flavors:
//  - non-cumulative: daily target (e.g. 8 glasses, resets each day)
//  - cumulative:     long-running total (e.g. "read 50 books")

import { S, today } from '../../core/state.js';

export function isCounter(habit) { return habit?.mode === 'counter'; }
export function isCumulative(habit) { return habit?.cumulative === true; }

export function isStack(habit) { return !!habit?.isStack && Array.isArray(habit?.children); }

// Resolve a stack child entry (id-string or legacy embedded object) to a
// habit-shaped object that metOn / countFor can consume.
function resolveStackChild(c) {
  if (!c) return null;
  if (typeof c === 'string') return S.habits.find(h => h.id === c) || null;
  return c;
}

// True when every child of a stack is met on the given date.
export function stackMet(parent, dateKey) {
  if (!isStack(parent) || !parent.children.length) return false;
  return parent.children.every(c => {
    const h = resolveStackChild(c);
    return h ? metOn(h, dateKey) : false;
  });
}

// Current count for a habit (today for daily counter; total for cumulative).
export function countFor(habit) {
  if (!habit) return 0;
  if (isStack(habit)) return habit.children.filter(c => {
    const h = resolveStackChild(c); return h && metOn(h, today());
  }).length;
  if (isCumulative(habit)) {
    // Sum all days for cumulative mode
    let sum = 0;
    for (const k of Object.keys(S.habitLog || {})) {
      const v = S.habitLog[k]?.[habit.id];
      if (typeof v === 'number') sum += v;
    }
    return sum;
  }
  const v = S.habitLog[today()]?.[habit.id];
  return typeof v === 'number' ? v : (v ? (habit.target || 1) : 0);
}

// Did the habit meet its goal on a given date (for streak scoring)?
export function metOn(habit, dateKey) {
  if (isStack(habit)) return stackMet(habit, dateKey);
  const v = S.habitLog[dateKey]?.[habit.id];
  if (v == null || v === false) return false;
  if (typeof v === 'boolean') return v === true;
  const target = habit.target || 1;
  if (isCumulative(habit)) return v > 0;           // any delta today counts
  if (isCounter(habit))     return v >= target;     // must hit target
  return Boolean(v);
}

// Apply an increment (delta) to today's log. Clamps to target for non-cumulative.
export function increment(habit, delta) {
  const step = delta ?? (habit.incrementStep || 1);
  const k = today();
  if (!S.habitLog[k]) S.habitLog[k] = {};
  const cur = typeof S.habitLog[k][habit.id] === 'number' ? S.habitLog[k][habit.id] : 0;
  const next = cur + step;
  if (!isCumulative(habit) && habit.target) {
    S.habitLog[k][habit.id] = Math.max(0, Math.min(habit.target, next));
  } else {
    S.habitLog[k][habit.id] = Math.max(0, next);
  }
  return S.habitLog[k][habit.id];
}

// Mark complete: set to target (daily) or add step (cumulative — a one-off "log event").
export function complete(habit) {
  const k = today();
  if (!S.habitLog[k]) S.habitLog[k] = {};
  if (isCumulative(habit)) {
    return increment(habit, habit.incrementStep || 1);
  }
  S.habitLog[k][habit.id] = habit.target || 1;
  return S.habitLog[k][habit.id];
}

// Reset today's count to 0.
export function reset(habit) {
  const k = today();
  if (!S.habitLog[k]) S.habitLog[k] = {};
  S.habitLog[k][habit.id] = 0;
  return 0;
}
