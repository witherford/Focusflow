// Recurring tasks — when a task with `repeat` is completed, spawn the next instance.
// Repeat values: 'daily' | 'weekly' | 'monthly' | 'yearly' | { every: N, unit: 'd'|'w'|'m'|'y' }
import { S, uid, today } from '../../core/state.js';

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

export function nextDueDate(currentISO, repeat) {
  if (!repeat) return null;
  const base = currentISO ? new Date(currentISO + 'T00:00:00') : new Date();
  const d = new Date(base);
  const r = typeof repeat === 'string' ? { every: 1, unit: repeat[0] } : repeat;
  const n = Math.max(1, r.every || 1);
  switch ((r.unit || 'd')[0]) {
    case 'd': d.setDate(d.getDate() + n); break;
    case 'w': d.setDate(d.getDate() + n * 7); break;
    case 'm': d.setMonth(d.getMonth() + n); break;
    case 'y': d.setFullYear(d.getFullYear() + n); break;
    default: d.setDate(d.getDate() + 1);
  }
  return ymd(d);
}

// Returns the spawned next task, or null if not recurring.
export function spawnNextOccurrence(task) {
  if (!task?.repeat) return null;
  const next = {
    id: uid(),
    name: task.name,
    notes: task.notes || '',
    priority: task.priority || 'medium',
    due: nextDueDate(task.due || today(), task.repeat),
    projectId: task.projectId || null,
    parentId: null,           // children don't carry over by default
    goalId: task.goalId || null,
    done: false,
    doneAt: null,
    expanded: false,
    createdAt: Date.now(),
    accruedMinutes: 0,
    repeat: task.repeat,
    seriesId: task.seriesId || task.id,  // chain id so we can group occurrences
  };
  S.tasks.push(next);
  return next;
}

export function snooze(task, kind) {
  if (!task) return;
  const d = task.due ? new Date(task.due + 'T00:00:00') : new Date();
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  let target;
  if (kind === '+1d') { target = new Date(Math.max(d.getTime(), today0.getTime())); target.setDate(target.getDate() + 1); }
  else if (kind === '+3d') { target = new Date(Math.max(d.getTime(), today0.getTime())); target.setDate(target.getDate() + 3); }
  else if (kind === '+1w') { target = new Date(Math.max(d.getTime(), today0.getTime())); target.setDate(target.getDate() + 7); }
  else if (kind === 'next-mon') {
    const dow = today0.getDay(); // 0=Sun
    const offs = ((1 - dow + 7) % 7) || 7;
    target = new Date(today0); target.setDate(today0.getDate() + offs);
  } else if (kind === 'today') {
    target = new Date(today0);
  } else if (kind === 'tomorrow') {
    target = new Date(today0); target.setDate(today0.getDate() + 1);
  } else { target = new Date(today0); target.setDate(today0.getDate() + 1); }
  task.due = ymd(target);
}
