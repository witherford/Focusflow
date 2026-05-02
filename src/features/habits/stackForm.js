// Habit-stack child UI. Children are now references to existing habits in
// S.habits — pick one from the dropdown and tap "+" to add it. Stored as a
// list of habit IDs on the parent: `parent.children = ['h1', 'h2']`.
//
// Legacy stacks may have embedded child objects (`{ id, name, icon, ... }`);
// resolveChild() handles both shapes so old data keeps working.
import { S } from '../../core/state.js';
import { attachReorder, reorderArr } from '../../ui/dragReorder.js';

const editing = { 'habit-': [], 'qc-': [] };
const reorderDetach = { 'habit-': null, 'qc-': null };

function pickerId(prefix) { return prefix + 'stack-picker'; }
function listId(prefix)   { return prefix + 'stack-list'; }
function cbId(prefix)     { return prefix + 'is-stack'; }
function wrapId(prefix)   { return prefix + 'stack-fields'; }

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
  const newOpt = '<option value="__new__">＋ Create a new habit to add to stack…</option>';
  sel.innerHTML = candidates.length
    ? '<option value="">— pick a habit to add —</option>' + newOpt + candidates.map(h => `<option value="${h.id}">${h.icon || '●'} ${h.name}</option>`).join('')
    : '<option value="">— no existing habits to pick —</option>' + newOpt;
}

function renderList(prefix) {
  const wrap = document.getElementById(listId(prefix)); if (!wrap) return;
  const list = editing[prefix];
  if (reorderDetach[prefix]) { try { reorderDetach[prefix](); } catch {} reorderDetach[prefix] = null; }
  if (!list.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">No habits added yet — pick one above and tap +</div>';
    return;
  }
  wrap.innerHTML = list.map((c, i) => {
    const h = resolveChild(c);
    if (!h) {
      return `<div class="stack-child-chip stack-child-row" data-stack-child-idx="${i}" style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--surface);border:1px solid var(--rose);border-radius:var(--r-sm);margin-bottom:4px;font-size:13px;color:var(--rose)"><span class="stack-drag-handle" style="cursor:grab;padding:0 4px;color:var(--text3);user-select:none;touch-action:none" title="Drag to reorder">≡</span>⚠️ Missing habit <button type="button" class="btn btn-xs" onclick="removeHabitStackChild('${prefix}', ${i})" style="margin-left:auto">×</button></div>`;
    }
    const icon = h.icon || (h.kind === 'bad' ? '🚫' : '●');
    const meta = `${h.kind === 'bad' ? 'bad · ' : ''}${h.mode === 'counter' ? 'counter' : 'binary'}`;
    return `<div class="stack-child-chip stack-child-row" data-stack-child-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:4px;font-size:13px">
      <span class="stack-drag-handle" style="cursor:grab;color:var(--text3);user-select:none;touch-action:none;font-size:14px;line-height:1" title="Drag to reorder">≡</span>
      <span style="color:var(--text3);font-family:'DM Mono',monospace;width:16px;text-align:center">${i + 1}</span>
      <span style="flex:1">${icon} ${h.name}</span>
      <span style="font-size:10px;color:var(--text3)">${meta}</span>
      <button type="button" class="btn btn-xs" onclick="removeHabitStackChild('${prefix}', ${i})" title="Remove" style="padding:2px 8px">×</button>
    </div>`;
  }).join('');
  reorderDetach[prefix] = attachReorder(wrap, {
    itemSelector: '.stack-child-row',
    handleSelector: '.stack-drag-handle',
    onReorder: (from, to) => {
      reorderArr(editing[prefix], from, to);
      refresh(prefix);
    },
  });
}

function refresh(prefix) { populatePicker(prefix); renderList(prefix); }

export function resetStackChildren(prefix = 'habit-') { editing[prefix] = []; refresh(prefix); }

// Module-level "child creation in progress" context. Set when the user picks
// "+ Create a new habit" inside a stack picker — saveHabit() then knows to
// resume the parent stack form after the child is created.
let childCreation = null;
export function consumeChildCreationContext() {
  const c = childCreation; childCreation = null; return c;
}
export function isInChildCreation() { return !!childCreation; }

// Snapshot every habit-form input the user might have touched, so we can
// restore the parent stack form after creating a child habit.
function captureParentStash(prefix) {
  if (prefix !== 'habit-') return null; // QC form is too minimal for this flow
  const ids = ['habit-edit-id','habit-name','habit-kind','habit-block','habit-icon','habit-mode','habit-target','habit-unit','habit-step','habit-unit-preset','habit-why','habit-link-type','habit-goal','habit-goal-mode','habit-goal-days','linked-med-dur','linked-med-sound','linked-med-guided','linked-dw-work','linked-dw-break','linked-dw-label','linked-sleep-target','linked-journal-prompt'];
  const fields = {};
  ids.forEach(id => { const el = document.getElementById(id); if (el) fields[id] = el.value; });
  const checks = ['habit-cumulative','habit-journal-prompt','habit-allday','habit-is-stack'];
  const checkVals = {};
  checks.forEach(id => { const el = document.getElementById(id); if (el) checkVals[id] = el.checked; });
  // Active-day pills
  const days = [...document.querySelectorAll('#habit-weekday-picker input[type=checkbox]')].map(el => ({ d: el.dataset.day, on: el.checked }));
  return { fields, checkVals, days, children: editing[prefix].slice() };
}

function applyParentStash(stash) {
  if (!stash) return;
  Object.entries(stash.fields).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });
  Object.entries(stash.checkVals).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.checked = v; });
  stash.days.forEach(({ d, on }) => { const el = document.querySelector(`#habit-weekday-picker input[data-day="${d}"]`); if (el) el.checked = on; });
}

// Reopen the Add/Edit Habit modal with the parent's stashed state, then
// append the freshly-created child habit's id to its children list.
function resumeParentForm(stash, newChildId) {
  const editId = stash.fields['habit-edit-id'];
  if (editId) window.openEditHabit?.(editId);
  else window.openAddHabit?.();
  // openAddHabit / openEditHabit have just finished — synchronously override
  // their freshly-reset values with what the user had typed before the detour.
  applyParentStash(stash);
  document.getElementById('habit-is-stack').checked = true;
  populateStackChildren('habit-', [...(stash.children || []), newChildId]);
  toggleHabitStackFields('habit-');
  // Re-run the linked / counter / kind toggles in case visibility depends on them
  window.toggleCounterFields?.();
  window.updateLinkedHabitFields?.();
  window.updateHabitGoalFields?.();
  window.updateHabitKindFields?.();
}

// Add the habit currently selected in the picker.
export function addHabitStackChild(prefix = 'habit-') {
  const sel = document.getElementById(pickerId(prefix)); if (!sel) return;
  const id = sel.value; if (!id) return;
  if (id === '__new__') {
    if (prefix === 'qc-') {
      window.toast?.('Use the Habits page to create a new habit inside a stack');
      return;
    }
    childCreation = { prefix, stash: captureParentStash(prefix) };
    // Re-open the modal as a fresh "Add Habit" with a banner indicating the
    // new habit will be added to the parent stack on save.
    window.openAddHabit?.();
    const titleEl = document.getElementById('m-habit-title');
    if (titleEl) titleEl.textContent = '＋ Add habit (will be added to stack)';
    // A child habit can't itself be a stack — and the duplicate-from row
    // would clutter the focused flow.
    const stackRow = document.getElementById('habit-is-stack')?.closest('.form-row');
    if (stackRow) stackRow.style.display = 'none';
    const dupRow = document.getElementById('habit-duplicate-row');
    if (dupRow) dupRow.style.display = '';
    // Insert a small "back" link near the title so the user can bail out
    insertChildCreationCancelLink();
    return;
  }
  if (editing[prefix].some(c => (typeof c === 'string' ? c : c?.id) === id)) return;
  editing[prefix].push(id);
  refresh(prefix);
}

function insertChildCreationCancelLink() {
  if (document.getElementById('habit-cancel-child-link')) return;
  const titleEl = document.getElementById('m-habit-title'); if (!titleEl) return;
  const link = document.createElement('button');
  link.id = 'habit-cancel-child-link';
  link.type = 'button';
  link.className = 'btn btn-xs';
  link.style.cssText = 'margin-left:8px;font-size:11px;vertical-align:middle';
  link.textContent = '← Back to stack';
  link.onclick = () => {
    const ctx = consumeChildCreationContext(); if (!ctx) return;
    resumeParentForm(ctx.stash, null); // null → nothing appended
    // resumeParentForm calls openEditHabit/openAddHabit which inserts a fresh
    // title; remove the leftover link if it survived.
    document.getElementById('habit-cancel-child-link')?.remove();
  };
  titleEl.appendChild(link);
}

// Public helper — page.js's saveHabit calls this after pushing a new habit
// while in child-creation mode, so the modal flips back to the parent stack
// form with the new habit's id appended to the children list.
export function resumeParentAfterChildSave(ctx, newChildId) {
  if (!ctx?.stash) return;
  resumeParentForm(ctx.stash, newChildId);
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
  const cb = document.getElementById(cbId(prefix));
  const wrap = document.getElementById(wrapId(prefix));
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
