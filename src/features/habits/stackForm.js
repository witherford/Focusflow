// Habit-stack child UI. Children are now references to existing habits in
// S.habits — pick one from the dropdown and tap "+" to add it. Stored as a
// list of habit IDs on the parent: `parent.children = ['h1', 'h2']`.
//
// Legacy stacks may have embedded child objects (`{ id, name, icon, ... }`);
// resolveChild() handles both shapes so old data keeps working.
import { S } from '../../core/state.js';

const editing = { 'habit-': [], 'qc-': [] };

function pickerId(prefix)   { return prefix + 'habit-stack-picker'; }
function listId(prefix)     { return prefix + 'habit-stack-list'; }

export function resolveChild(c) {
  if (!c) return null;
  if (typeof c === 'string') return S.habits.find(h => h.id === c) || null;
  return c; // legacy embedded object
}

function getEditingId() {
  return document.getElementById('habit-edit-id')?.value || '';
}

function isStackParent(h) { return !!h?.isStack && Array.isArray(h?.children); }

// All habits currently nested inside any stack — we exclude them from the
// picker so a child can only belong to one parent at a time.
function idsInAnyStackExcept(parentId) {
  const used = new Set();
  for (const h of S.habits) {
    if (!isStackParent(h)) continue;
    if (h.id === parentId) continue;
    for (const c of h.children) {
      if (typeof c === 'string') used.add(c);
      else if (c?.id) used.add(c.id);
    }
  }
  return used;
}

function populatePicker(prefix) {
  const sel = document.getElementById(pickerId(prefix)); if (!sel) return;
  const editId = prefix === 'habit-' ? getEditingId() : '';
  const used = idsInAnyStackExcept(editId);
  const already = new Set(editing[prefix].map(c => typeof c === 'string' ? c : c?.id).filter(Boolean));
  const candidates = (S.habits || []).filter(h => h.id !== editId && !h.isStack && !used.has(h.id) && !already.has(h.id));
  sel.innerHTML = candidates.length
    ? '<option value="">— pick a habit to add —</option>' + candidates.map(h => `<option value="${h.id}">${h.icon || '●'} ${h.name}</option>`).join('')
    : '<option value="">No habits available — create some first</option>';
}

function renderList(prefix) {
  const wrap = document.getElementById(listId(prefix)); if (!wrap) return;
  const list = editing[prefix];
  if (!list.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">No habits added yet — pick one above and tap +</div>';
    return;
  }
  wrap.innerHTML = list.map((c, i) => {
    const h = resolveChild(c);
    if (!h) {
      return `<div class="stack-child-chip" style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--surface);border:1px solid var(--rose);border-radius:var(--r-sm);margin-bottom:4px;font-size:13px;color:var(--rose)">⚠️ Missing habit <button type="button" class="btn btn-xs" onclick="removeHabitStackChild('${prefix}', ${i})" style="margin-left:auto">×</button></div>`;
    }
    const icon = h.icon || (h.kind === 'bad' ? '🚫' : '●');
    const meta = `${h.kind === 'bad' ? 'bad · ' : ''}${h.mode === 'counter' ? 'counter' : 'binary'}`;
    return `<div class="stack-child-chip" style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:4px;font-size:13px">
      <span style="color:var(--text3);font-family:'DM Mono',monospace;width:16px;text-align:center">${i + 1}</span>
      <span style="flex:1">${icon} ${h.name}</span>
      <span style="font-size:10px;color:var(--text3)">${meta}</span>
      <button type="button" class="btn btn-xs" onclick="removeHabitStackChild('${prefix}', ${i})" title="Remove" style="padding:2px 8px">×</button>
    </div>`;
  }).join('');
}

function refresh(prefix) { populatePicker(prefix); renderList(prefix); }

export function resetStackChildren(prefix = 'habit-') { editing[prefix] = []; refresh(prefix); }

// Add the habit currently selected in the picker.
export function addHabitStackChild(prefix = 'habit-') {
  const sel = document.getElementById(pickerId(prefix)); if (!sel) return;
  const id = sel.value; if (!id) return;
  if (editing[prefix].some(c => (typeof c === 'string' ? c : c?.id) === id)) return;
  editing[prefix].push(id);
  refresh(prefix);
}

export function removeHabitStackChild(prefix = 'habit-', idx) {
  editing[prefix].splice(idx, 1);
  refresh(prefix);
}

export function readStackChildren(prefix = 'habit-') {
  // Keep IDs as-is; preserve any legacy embedded objects too.
  return editing[prefix].slice();
}

export function populateStackChildren(prefix = 'habit-', children) {
  editing[prefix] = (children || []).slice();
  refresh(prefix);
}

export function toggleHabitStackFields(prefix = 'habit-') {
  const cb = document.getElementById(prefix + 'habit-is-stack');
  const wrap = document.getElementById(prefix + 'habit-stack-fields');
  if (!cb || !wrap) return;
  const on = cb.checked;
  wrap.style.display = on ? '' : 'none';
  // When turning on for the full Add Habit modal, hide rows that don't make
  // sense for a stack wrapper (linked-tool, mode, all-day, counter, streak goal).
  if (prefix === 'habit-') {
    const rowsToHide = [
      document.getElementById('habit-link-type')?.closest('.form-row'),
      document.getElementById('habit-mode')?.closest('.form-row'),
      document.getElementById('habit-allday')?.closest('.form-row'),
      document.getElementById('habit-counter-fields'),
      document.getElementById('habit-goal-mode')?.closest('.form-row'),
      document.getElementById('habit-goal-num-wrap'),
    ];
    rowsToHide.forEach(el => { if (el) el.style.display = on ? 'none' : ''; });
  }
  if (on) refresh(prefix);
}

// Helper for renderers: returns true if this habit is nested inside a stack
// and therefore should not appear standalone on the dashboard / Habits page.
export function isHabitInAnyStack(habitId) {
  for (const h of S.habits) {
    if (!isStackParent(h)) continue;
    for (const c of h.children) {
      const cid = typeof c === 'string' ? c : c?.id;
      if (cid === habitId) return true;
    }
  }
  return false;
}

window.toggleHabitStackFields = toggleHabitStackFields;
window.addHabitStackChild = addHabitStackChild;
window.removeHabitStackChild = removeHabitStackChild;
