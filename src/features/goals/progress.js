// Goal progress rollup — milestones + linked tasks + linked-habit streaks + optional minute target.
import { S, today } from '../../core/state.js';
import { metOn } from '../habits/counterMode.js';

export function linkedTasks(goalId) {
  return (S.tasks || []).filter(t => t.goalId === goalId);
}

export function linkedHabits(goalId) {
  return (S.habits || []).filter(h => h.goalId === goalId);
}

export function accruedMinutesFor(goalId) {
  const taskMin = linkedTasks(goalId).reduce((sum, t) => sum + (t.accruedMinutes || 0), 0);
  const goal = (S.goals || []).find(g => g.id === goalId);
  let msMin = 0;
  if (goal && Array.isArray(goal.milestones)) {
    for (const m of goal.milestones) {
      msMin += m.accruedMinutes || 0;
      for (const s of (m.steps || [])) msMin += s.accruedMinutes || 0;
    }
  }
  return taskMin + msMin;
}

// 7-day completion rate for a habit (0..1)
export function habitWeekHitRate(h) {
  let hit = 0;
  for (let i = 0; i < 7; i++) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    if (metOn(h, k)) hit++;
  }
  return hit / 7;
}

// Returns { done, total, pct } blending milestones + linked tasks + habit consistency.
export function goalProgress(goal) {
  const ms = goal.milestones || [];
  const msDone = ms.filter(m => m.done).length;
  // Steps fold in as fractional progress: each milestone with N steps contributes
  // (stepsDone / N) toward "done" alongside its own done flag.
  let stepDone = 0, stepTotal = 0;
  for (const m of ms) {
    if (Array.isArray(m.steps) && m.steps.length) {
      stepTotal += m.steps.length;
      stepDone += m.steps.filter(s => s.done).length;
    }
  }
  const tasks = linkedTasks(goal.id);
  const taskDone = tasks.filter(t => t.done).length;
  const habits = linkedHabits(goal.id);

  let done = msDone + taskDone + stepDone;
  let total = ms.length + tasks.length + stepTotal;

  // Each linked habit contributes its 7-day hit rate (0..1) into both done and total.
  for (const h of habits) {
    done += habitWeekHitRate(h);
    total += 1;
  }

  if (goal.minuteTarget) {
    const mins = accruedMinutesFor(goal.id);
    const minPct = Math.min(1, mins / goal.minuteTarget);
    done += minPct;
    total += 1;
  }

  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, minutes: accruedMinutesFor(goal.id), habits: habits.length };
}

// Count of tasks across all projects that are linked to any goal.
export function tasksTowardGoals() {
  const tasks = (S.tasks || []).filter(t => t.goalId);
  return { total: tasks.length, done: tasks.filter(t => t.done).length };
}
