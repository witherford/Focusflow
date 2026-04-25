// CSV exporters — tasks, deep-work sessions, journal entries, weight log.
import { S, today } from './state.js';

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCSV(rows) {
  return rows.map(r => r.map(csvEscape).join(',')).join('\n');
}

function download(name, content) {
  const b = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportTasksCSV() {
  const rows = [['id', 'name', 'notes', 'priority', 'due', 'project', 'goal', 'done', 'doneAt', 'accruedMinutes']];
  for (const t of (S.tasks || [])) {
    const proj = t.projectId ? S.projects.find(p => p.id === t.projectId)?.name : '';
    const goal = t.goalId ? S.goals.find(g => g.id === t.goalId)?.name : '';
    rows.push([t.id, t.name, t.notes || '', t.priority || '', t.due || '', proj || '', goal || '', t.done ? '1' : '0', t.doneAt || '', t.accruedMinutes || 0]);
  }
  download(`focusflow-tasks-${today()}.csv`, toCSV(rows));
}

export function exportDwSessionsCSV() {
  const rows = [['date', 'minutes', 'label', 'taskId', 'goalId', 'ts']];
  for (const s of (S.deepwork?.sessions || [])) {
    rows.push([s.date, s.min, s.label || '', s.taskId || '', s.goalId || '', s.ts || '']);
  }
  download(`focusflow-focus-sessions-${today()}.csv`, toCSV(rows));
}

export function exportJournalCSV() {
  const rows = [['id', 'datetime', 'habitId', 'type', 'text']];
  for (const j of (S.journal || [])) {
    rows.push([j.id, j.datetime || '', j.habitId || '', j.type || '', j.text || '']);
  }
  download(`focusflow-journal-${today()}.csv`, toCSV(rows));
}

export function exportWeightCSV() {
  const rows = [['date', 'kg']];
  for (const w of (S.profile?.weightLog || [])) rows.push([w.date, w.kg]);
  download(`focusflow-weight-${today()}.csv`, toCSV(rows));
}

export function exportCSVAll() {
  exportTasksCSV();
  exportDwSessionsCSV();
  exportJournalCSV();
  exportWeightCSV();
  window.toast?.('CSV bundle downloaded ✓');
}

window.exportTasksCSV = exportTasksCSV;
window.exportDwSessionsCSV = exportDwSessionsCSV;
window.exportJournalCSV = exportJournalCSV;
window.exportWeightCSV = exportWeightCSV;
window.exportCSVAll = exportCSVAll;
