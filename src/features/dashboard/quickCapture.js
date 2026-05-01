// Quick Capture — FAB modal to add a task / habit / journal / shopping item
// without navigating. Habit creation here is intentionally minimal — for full
// options (linked tools, streak goals, weekday picker, all-day) the user
// should open the Habits page proper.
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';

export function openQuickCapture() {
  haptic('light');
  const sel = document.getElementById('qc-type'); if (sel) sel.value = 'task';
  ['qc-task-name','qc-task-due','qc-journal-text','qc-shop-name','qc-habit-name','qc-habit-icon'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const p = document.getElementById('qc-task-priority'); if (p) p.value = 'medium';
  const k = document.getElementById('qc-habit-kind'); if (k) k.value = 'good';
  const b = document.getElementById('qc-habit-block'); if (b) b.value = 'morning';
  const m = document.getElementById('qc-habit-mode'); if (m) m.value = 'binary';
  // populate habit select
  const hsel = document.getElementById('qc-habit-sel');
  if (hsel) hsel.innerHTML = (S.habits || []).map(h => `<option value="${h.id}">${h.icon || '●'} ${h.name}</option>`).join('') || '<option value="">No habits yet</option>';
  qcUpdateFields();
  const modal = document.getElementById('m-quick-capture'); if (modal) modal.style.display = 'flex';
  setTimeout(() => document.getElementById('qc-task-name')?.focus(), 60);
}

export function qcUpdateFields() {
  const v = document.getElementById('qc-type')?.value || 'task';
  const map = {
    task: 'qc-task-fields',
    'habit-tick': 'qc-habit-tick-fields',
    habit: 'qc-habit-fields',
    journal: 'qc-journal-fields',
    shop: 'qc-shop-fields',
  };
  Object.entries(map).forEach(([k, id]) => { const el = document.getElementById(id); if (el) el.style.display = k === v ? '' : 'none'; });
}

export function saveQuickCapture() {
  const v = document.getElementById('qc-type')?.value || 'task';
  if (v === 'task') {
    const name = document.getElementById('qc-task-name')?.value.trim(); if (!name) return;
    const priority = document.getElementById('qc-task-priority')?.value || 'medium';
    const due = document.getElementById('qc-task-due')?.value || '';
    S.tasks.push({ id: uid(), name, priority, due, done: false, doneAt: null, projectId: null, parentId: null, notes: '', createdAt: today() });
    window.toast?.('Task added ✓');
  } else if (v === 'habit') {
    const name = document.getElementById('qc-habit-name')?.value.trim(); if (!name) return;
    const kind = document.getElementById('qc-habit-kind')?.value === 'bad' ? 'bad' : 'good';
    const block = document.getElementById('qc-habit-block')?.value || 'morning';
    const icon = document.getElementById('qc-habit-icon')?.value || (kind === 'bad' ? '🚫' : '●');
    const mode = kind === 'bad' ? 'binary' : (document.getElementById('qc-habit-mode')?.value || 'binary');
    S.habits.push({ id: uid(), name, kind, block, icon, mode, journalPrompt: true, allDay: false });
    window.toast?.(`Habit added: ${name} ✓`);
  } else if (v === 'habit-tick') {
    const id = document.getElementById('qc-habit-sel')?.value; if (!id) return;
    const h = S.habits.find(x => x.id === id);
    if (h?.kind === 'bad') {
      // Bad habit — open the avoided / indulged chooser instead.
      window.closeModal?.('m-quick-capture');
      window.openBadHabitLog?.(id);
      return;
    }
    if (!S.habitLog[today()]) S.habitLog[today()] = {};
    S.habitLog[today()][id] = true;
    window.awardXP?.('habit');
    window.toast?.('Habit ticked ✓');
  } else if (v === 'journal') {
    const text = document.getElementById('qc-journal-text')?.value.trim(); if (!text) return;
    S.journal.push({ id: uid(), habitId: '', type: 'note', datetime: new Date().toISOString().slice(0, 16), text });
    window.toast?.('Note saved ✓');
  } else if (v === 'shop') {
    const name = document.getElementById('qc-shop-name')?.value.trim(); if (!name) return;
    S.shopping.push({ id: uid(), name, qty: '', price: '', cat: 'Other', supermarket: '', checked: false });
    window.toast?.('Added to shopping ✓');
  }
  haptic('medium'); save(); window.closeModal?.('m-quick-capture');
  window.renderAll?.();
}
