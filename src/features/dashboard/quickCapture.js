// Quick Capture — FAB modal to add a task / habit / journal / shopping item
// without navigating. Habit creation here is intentionally minimal — for full
// options (linked tools, streak goals, weekday picker, all-day) the user
// should open the Habits page proper.
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { resetStackChildren, readStackChildren, populateStackChildren } from '../habits/stackForm.js';

const LINKED_ICON = { meditate: '🧘', train: '🏋️', deepwork: '🧠', sleep: '😴', journal: '📓', weight: '⚖️' };
function defaultLinkedConfig(linkedType) {
  if (linkedType === 'meditate') return { duration: 10, sound: '', guidedScriptId: null };
  if (linkedType === 'deepwork') return { mins: 25, breakMins: 5, label: '' };
  if (linkedType === 'train') return {};
  if (linkedType === 'sleep') return {};
  if (linkedType === 'journal') return { prompt: '' };
  if (linkedType === 'weight') return {};
  return null;
}

export function openQuickCapture() {
  haptic('light');
  const sel = document.getElementById('qc-type'); if (sel) sel.value = 'task';
  ['qc-task-name','qc-task-due','qc-journal-text','qc-shop-name','qc-habit-name','qc-habit-icon'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const p = document.getElementById('qc-task-priority'); if (p) p.value = 'medium';
  const k = document.getElementById('qc-habit-kind'); if (k) k.value = 'good';
  const b = document.getElementById('qc-habit-block'); if (b) b.value = 'morning';
  const m = document.getElementById('qc-habit-mode'); if (m) m.value = 'binary';
  const lt = document.getElementById('qc-habit-link-type'); if (lt) lt.value = '';
  const stk = document.getElementById('qc-is-stack'); if (stk) stk.checked = false;
  const stkW = document.getElementById('qc-stack-fields'); if (stkW) stkW.style.display = 'none';
  resetStackChildren('qc-');
  window.populateDuplicateFromSelect?.('qc-');
  qcUpdateFields();
  const modal = document.getElementById('m-quick-capture'); if (modal) modal.style.display = 'flex';
  setTimeout(() => document.getElementById('qc-task-name')?.focus(), 60);
}

export function qcUpdateFields() {
  const v = document.getElementById('qc-type')?.value || 'task';
  const map = {
    task: 'qc-task-fields',
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
    const linkedType = document.getElementById('qc-habit-link-type')?.value || null;
    const isStack = !!document.getElementById('qc-is-stack')?.checked;
    const userIcon = document.getElementById('qc-habit-icon')?.value;
    const icon = userIcon || (kind === 'bad' ? '🚫' : (linkedType ? LINKED_ICON[linkedType] : (isStack ? '🧩' : '●')));
    let mode = kind === 'bad' ? 'binary' : (document.getElementById('qc-habit-mode')?.value || 'binary');
    if (linkedType || isStack) mode = 'binary';
    const habit = { id: uid(), name, kind, block, icon, mode, journalPrompt: true, allDay: false };
    if (linkedType && !isStack) {
      habit.linkedType = linkedType;
      habit.linkedConfig = defaultLinkedConfig(linkedType);
    }
    if (isStack) {
      habit.isStack = true;
      habit.children = readStackChildren('qc-');
    }
    S.habits.push(habit);
    window.toast?.(`Habit added: ${name} ✓`);
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
