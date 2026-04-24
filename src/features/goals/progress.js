// Goal progress rollup — Phase 5
// Combines: milestone completion + linked-task completion + optional deepwork minutes.
import { S } from '../../core/state.js';

export function linkedTasks(goalId) {
  return (S.tasks || []).filter(t => t.goalId === goalId);
}

export function accruedMinutesFor(goalId) {
  return linkedTasks(goalId).reduce((sum, t) => sum + (t.accruedMinutes || 0), 0);
}

// Returns { done, total, pct } blending milestones + linked tasks.
// If goal.minuteTarget is set, minute progress is folded in too.
export function goalProgress(goal) {
  const ms = goal.milestones || [];
  const msDone = ms.filter(m => m.done).length;
  const tasks = linkedTasks(goal.id);
  const taskDone = tasks.filter(t => t.done).length;

  let done = msDone + taskDone;
  let total = ms.length + tasks.length;

  if (goal.minuteTarget) {
    const mins = accruedMinutesFor(goal.id);
    const minPct = Math.min(1, mins / goal.minuteTarget);
    done += minPct;
    total += 1;
  }

  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, minutes: accruedMinutesFor(goal.id) };
}

// Count of tasks across all projects that are linked to any goal.
export function tasksTowardGoals() {
  const tasks = (S.tasks || []).filter(t => t.goalId);
  return { total: tasks.length, done: tasks.filter(t => t.done).length };
}
