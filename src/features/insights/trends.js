// Insights trends — pure data helpers.
import { S, today } from '../../core/state.js';
import { metOn } from '../habits/counterMode.js';

export function dateKey(offsetDays = 0) {
  return new Date(Date.now() - offsetDays * 864e5).toISOString().split('T')[0];
}

export function habitCompletionByWeek(weeks = 8) {
  const out = [];
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  for (let w = weeks - 1; w >= 0; w--) {
    let done = 0, total = 0;
    for (let d = 0; d < 7; d++) {
      const k = dateKey(w * 7 + d);
      for (const h of S.habits) {
        total++;
        if (metOn(h, k)) done++;
      }
    }
    out.push({ weekOffset: w, done, total, pct: total ? Math.round(done / total * 100) : 0 });
  }
  return out;
}

export function dwMinutesByDay(days = 30) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dateKey(i);
    const min = (S.deepwork?.sessions || []).filter(s => s.date === k).reduce((a, s) => a + (s.min || 0), 0);
    out.push({ date: k, min });
  }
  return out;
}

export function medMinutesByDay(days = 30) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dateKey(i);
    const min = (S.meditation?.sessions || []).filter(s => s.date === k).reduce((a, s) => a + (s.min || 0), 0);
    out.push({ date: k, min });
  }
  return out;
}

export function fitnessWeightVolumeByWeek(weeks = 8) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    let vol = 0;
    for (let d = 0; d < 7; d++) {
      const k = dateKey(w * 7 + d);
      (S.fitness?.sessions || []).filter(s => s.date === k && (s.sets || s.reps || s.weight)).forEach(s => {
        vol += (s.sets || 0) * (s.reps || 0) * (s.weight || 0);
      });
    }
    out.push({ weekOffset: w, volume: Math.round(vol) });
  }
  return out;
}

// Bin completed-task and focus-session events by hour-of-day (0-23).
export function productivityByHour(days = 30) {
  const bins = Array(24).fill(0);
  const since = Date.now() - days * 864e5;
  for (const s of (S.deepwork?.sessions || [])) {
    if (s.ts && s.ts >= since) {
      const h = new Date(s.ts).getHours();
      bins[h] += (s.min || 0);
    }
  }
  // Tasks completed: weight by 30 "minutes-equivalent" each
  for (const t of (S.tasks || [])) {
    if (t.done && t.doneAt) {
      const ts = new Date(t.doneAt).getTime();
      if (ts >= since) {
        // No exact time on completion — distribute evenly across day; skip
      }
    }
  }
  return bins;
}

export function weekSummary() {
  const habits = habitCompletionByWeek(1)[0] || { done: 0, total: 0, pct: 0 };
  let dwMin = 0; dwMinutesByDay(7).forEach(d => dwMin += d.min);
  let medMin = 0; medMinutesByDay(7).forEach(d => medMin += d.min);
  const tasks = (S.tasks || []).filter(t => t.done && t.doneAt && t.doneAt >= dateKey(6)).length;
  // best/worst habit this week
  const perHabit = S.habits.map(h => {
    let hit = 0; for (let d = 0; d < 7; d++) if (metOn(h, dateKey(d))) hit++;
    return { id: h.id, name: h.name, hit };
  }).sort((a, b) => b.hit - a.hit);
  const top = perHabit[0];
  const worst = [...perHabit].reverse().find(x => x.hit < 7) || null;
  // journal word count
  const jw = (S.journal || []).filter(j => j.datetime && j.datetime >= dateKey(6)).reduce((a, j) => a + (j.text || '').trim().split(/\s+/).filter(Boolean).length, 0);
  return { habits, dwMin, medMin, tasks, top, worst, journalWords: jw };
}
