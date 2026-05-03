// Habits page — orchestrates rendering, gestures, modal forms, and CRUD.
// Schedule helpers, streak math, and the linked-flow dispatch live in sibling
// modules (schedule.js, streaks.js, linkedFlow.js).
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { isCounter, isCumulative, countFor, metOn, increment, complete, reset } from './counterMode.js';
import { attachHabitGestures } from './gestures.js';
import { promptHabitJournal } from './journalPrompt.js';
import { attachReorder, reorderArr } from '../../ui/dragReorder.js';
import {
  isHabitActiveToday,
  readWeekdayPickerValue,
  setWeekdayPickerValue,
} from './schedule.js';
import {
  streakStatusBadge,
  linkedHabitBadge,
  calcStreak,
  calcBadStreak,
  renderHabitHeatmap,
  weeklyCompletion,
  streakGoalTarget,
} from './streaks.js';
import { openLinkedHabit, markHabitDoneFromFlow } from './linkedFlow.js';
import { resetStackChildren, readStackChildren, populateStackChildren, toggleHabitStackFields, isHabitInAnyStack, resolveChild, consumeChildCreationContext, isInChildCreation, resumeParentAfterChildSave } from './stackForm.js';

// Re-export the helpers main.js / other features import from here so existing
// import paths (`features/habits/page.js`) keep working.
export {
  isHabitActiveOnDate,
  isHabitActiveToday,
  readWeekdayPickerValue,
  setWeekdayPickerValue,
} from './schedule.js';
export {
  streakStatusBadge,
  linkedHabitBadge,
  calcStreak,
  calcBadStreak,
  renderHabitHeatmap,
  weeklyCompletion,
  streakGoalTarget,
} from './streaks.js';
export { openLinkedHabit, markHabitDoneFromFlow } from './linkedFlow.js';

const BLOCKS = ['morning', 'afternoon', 'evening', 'allday'];
let hbOpen = { morning: true, afternoon: true, evening: true, allday: true };
const blockIcons = { morning: '☀️', afternoon: '🌤', evening: '🌙', allday: '⏳' };
const blockLabels = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', allday: 'All day' };

export function collapseHabits() { BLOCKS.forEach(b => hbOpen[b] = false); renderHabitsToday(); }
export function expandHabits()   { BLOCKS.forEach(b => hbOpen[b] = true); renderHabitsToday(); }
export function toggleHabitBlock(b) { hbOpen[b] = !hbOpen[b]; renderHabitsToday(); }

// Is a habit "done" for today? Works for both binary and counter modes.
export function doneToday(h) { return metOn(h, today()); }

export function updateHabitGoalFields() {
  const mode = document.getElementById('habit-goal-mode')?.value || '';
  const numWrap = document.getElementById('habit-goal-num-wrap');
  const autoInfo = document.getElementById('habit-goal-auto-info');
  if (numWrap) numWrap.style.display = mode === 'number' ? '' : 'none';
  if (autoInfo) autoInfo.style.display = mode === 'auto' ? '' : 'none';
}

// Render a single card body; used by both morning/afternoon/evening and the flat list.
function renderHabitCard(h, { flat = false } = {}) {
  const counter = isCounter(h);
  const count = counter ? countFor(h) : 0;
  const target = h.target || 1;
  const done = doneToday(h);
  const pct = counter && target > 0 ? Math.min(100, Math.round(count / target * 100)) : (done ? 100 : 0);
  const streak = calcStreak(h.id);
  const wk = weeklyCompletion(h.id);
  const goal = streakGoalTarget(h, streak);
  const streakText = goal > 0
    ? `${streak} / ${goal}`
    : `${streak} day${streak === 1 ? '' : 's'}`;
  const meta = counter
    ? `${count}${isCumulative(h) ? '' : '/' + target}${h.unit ? ' ' + h.unit : ''} · ${streakText}`
    : streakText;

  // Binary habits get a weekly-completion ring (e.g. 1/7) so progress is visible
  // without needing to tap into the habit. Counter habits keep their value-ring.
  const wkPct = wk.target ? Math.min(100, Math.round(wk.done / wk.target * 100)) : 0;
  const wkColor = wkPct >= 100 ? 'var(--green)' : wkPct >= 50 ? 'var(--teal)' : 'var(--violet)';
  const ring = counter
    ? `<svg class="habit-ring" width="40" height="40" viewBox="0 0 40 40">
         <circle class="ring-track" cx="20" cy="20" r="16" />
         <circle class="ring-fill"  cx="20" cy="20" r="16"
                 style="stroke-dasharray:100.5;stroke-dashoffset:${100.5 * (1 - pct/100)}" />
         <text x="20" y="24" text-anchor="middle" class="ring-num">${count}</text>
       </svg>`
    : `<svg class="habit-ring${done ? ' done' : ''}" width="40" height="40" viewBox="0 0 40 40" title="${wk.done}/${wk.target} this week">
         <circle class="ring-track" cx="20" cy="20" r="16" />
         <circle cx="20" cy="20" r="16" fill="none" stroke="${wkColor}" stroke-width="3"
                 stroke-linecap="round"
                 stroke-dasharray="100.5" stroke-dashoffset="${(100.5 * (1 - wkPct/100)).toFixed(1)}"
                 style="transform:rotate(-90deg);transform-origin:20px 20px;transition:stroke-dashoffset .3s" />
         <text x="20" y="24" text-anchor="middle" class="ring-num" style="font-size:11px">${wk.done}/${wk.target}</text>
       </svg>`;

  const blockBadge = flat ? `<span class="badge badge-violet">${h.block}</span>` : '';
  const linkBadge = linkedHabitBadge(h);
  const xpAward = (window.XP_TABLE && window.XP_TABLE.habit) || 10;
  const xpChip = `<span class="xp-chip" title="XP awarded on completion">+${xpAward} XP</span>`;

  // Gestures attach to .habit-tap (the inner zone), NOT the row. Edit/delete
  // buttons live as siblings of .habit-tap, so pointer events on a button
  // physically cannot bubble into the gesture handler.
  const stackChildren = h.isStack && Array.isArray(h.children) && h.children.length
    ? `<div class="stack-children" style="margin:6px 0 4px 14px;padding-left:10px;border-left:2px solid var(--border)">${
        h.children.map(c => {
          const child = resolveChild(c); if (!child) return '';
          const cdone = doneToday(child);
          const cIcon = child.icon || (child.kind === 'bad' ? '🚫' : '●');
          return `<div class="stack-child" onclick="event.stopPropagation();toggleHabit('${child.id}')" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:13px"><div class="tb-check ${cdone ? 'done' : ''}" style="width:18px;height:18px;line-height:18px;font-size:11px">${cdone ? '✓' : '·'}</div><span style="flex:1">${cIcon} ${child.name}</span><span style="font-size:10px;color:var(--text3)">${child.mode === 'counter' ? 'counter' : 'binary'}${child.kind === 'bad' ? ' · bad' : ''}</span></div>`;
        }).join('')
      }</div>`
    : '';
  const stackBadge = h.isStack ? ' <span class="mode-chip">stack</span>' : '';
  return `<div class="habit-row${done ? ' done' : ''}" data-habit-id="${h.id}">
    <div class="habit-tap">
      ${ring}
      <div class="habit-info">
        <div class="habit-name">${h.icon || '●'} ${h.name}${counter ? ' <span class="mode-chip">counter</span>' : ''}${isCumulative(h) ? ' <span class="mode-chip">cumulative</span>' : ''}${stackBadge}${linkBadge}${xpChip}</div>
        <div class="habit-meta">${meta}</div>
      </div>
      ${blockBadge}
      ${streakStatusBadge(h)}
    </div>
    ${stackChildren}
    <button class="btn-icon" data-habit-action="edit" data-id="${h.id}" aria-label="Edit habit">✏️</button>
    <button class="btn-icon danger" data-habit-action="del" data-id="${h.id}" aria-label="Delete habit">✕</button>
  </div>`;
}

function wireGestures(container) {
  if (!container) return;
  container.querySelectorAll('.habit-row').forEach(row => {
    const id = row.dataset.habitId; if (!id) return;
    const h = S.habits.find(x => x.id === id); if (!h) return;
    const tap = row.querySelector('.habit-tap');
    if (!tap) return;
    attachHabitGestures(tap, {
      onTap:        () => handleTap(h),
      onDoubleTap:  () => handleDoubleTap(h),
      onTripleTap:  () => handleTripleTap(h),
      onLongPress:  () => handleLongPress(h),
    });
  });

  // One delegated click handler on the container for edit/delete buttons.
  if (!container._habitActionWired) {
    container._habitActionWired = true;
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-habit-action]'); if (!btn) return;
      e.stopPropagation();
      const id = btn.dataset.id;
      if (btn.dataset.habitAction === 'edit') openEditHabit(id);
      else if (btn.dataset.habitAction === 'del') deleteHabit(id);
    });
  }
}

function handleTap(h) {
  // Stack parents are not directly toggleable — completion is derived from
  // children. Tapping the row is a no-op (user taps the children to tick).
  if (h.isStack) return;
  // Linked habits route to their tool with the saved config pre-applied.
  // Double-tap / triple-tap / long-press still let the user manually override.
  if (h.linkedType) { openLinkedHabit(h); return; }
  if (isCounter(h)) {
    const prev = countFor(h);
    const n = increment(h);
    haptic('light');
    const target = h.target || 1;
    if (n >= target && prev < target && !isCumulative(h)) haptic('medium');
  } else {
    toggleHabit(h.id);
    return;
  }
  save(); renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
}

function handleDoubleTap(h) {
  const wasMet = doneToday(h);
  complete(h);
  haptic('medium');
  if (!wasMet) window.awardXP?.('habit');
  save(); renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
}

// Triple-tap = complete AND open the journal/reflection prompt.
function handleTripleTap(h) {
  const wasMet = doneToday(h);
  complete(h);
  haptic('heavy');
  if (!wasMet) window.awardXP?.('habit');
  save(); renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
  promptHabitJournal(h, { force: true });
}

function handleLongPress(h) {
  reset(h);
  haptic('heavy');
  save(); renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
}

// Filter that puts a habit in the All-day block when its block is "allday"
// OR when h.allDay is set (the legacy boolean still seen on older data).
// Also filters out habits whose activeDays don't include today.
function habitInBlock(h, block) {
  if (!isHabitActiveToday(h)) return false;
  if (isHabitInAnyStack(h.id)) return false;
  if (block === 'allday') return h.block === 'allday' || h.allDay === true;
  if (h.allDay === true) return false;
  return h.block === block;
}

export function renderHabitsToday() {
  BLOCKS.forEach(b => {
    const el = document.getElementById('h-' + b); if (!el) return;
    const bH = S.habits.filter(h => habitInBlock(h, b));
    const doneCount = bH.filter(h => doneToday(h)).length;
    const pct = bH.length ? Math.round(doneCount / bH.length * 100) : 0;
    const open = hbOpen[b] !== false;
    const barColor = pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--teal)' : 'var(--violet)';
    el.innerHTML = `<div class="card" style="margin-bottom:10px">
      <div class="card-header" style="margin-bottom:8px;cursor:pointer" onclick="toggleHabitBlock('${b}')">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span style="font-size:18px">${blockIcons[b]}</span>
          <span class="card-title" style="margin:0">${blockLabels[b]}</span>
          <span style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">${doneCount}/${bH.length}</span>
          ${bH.length ? `
            <div class="block-progress" style="flex:1;min-width:60px;display:flex;align-items:center;gap:6px;margin-left:4px">
              <div class="progress-track" style="flex:1;margin:0;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div class="fill" style="background:${barColor};width:${pct}%;height:100%;transition:width 0.3s"></div></div>
              <span style="font-size:11px;color:${pct === 100 ? 'var(--green)' : 'var(--text3)'};font-family:'DM Mono',monospace;min-width:32px;text-align:right">${pct}%</span>
            </div>` : ''}
        </div>
        <span style="color:var(--text3);font-size:12px;flex-shrink:0">${open ? '▾' : '▸'}</span>
      </div>
      ${open ? (bH.length ? `<div style="padding-top:4px" data-block-list="${b}">${bH.map(h => renderHabitCard(h)).join('')}</div>` : '<div style="color:var(--text3);font-size:13px;padding:4px">No habits here yet</div>') : ''}
    </div>`;
    wireGestures(el);
    // Per-block drag-to-reorder. Reordering happens within the block — the
    // overall S.habits array is reshuffled so the block's habits maintain
    // their new relative order.
    const listEl = el.querySelector(`[data-block-list="${b}"]`);
    if (listEl && bH.length > 1) {
      attachReorder(listEl, {
        itemSelector: '.habit-row',
        onReorder: (from, to) => {
          const blockIds = bH.map(h => h.id);
          const movedId = blockIds[from];
          const targetId = blockIds[to];
          const fromGlobal = S.habits.findIndex(h => h.id === movedId);
          let toGlobal = S.habits.findIndex(h => h.id === targetId);
          if (fromGlobal < 0 || toGlobal < 0) return;
          if (fromGlobal < toGlobal) toGlobal -= 1;
          const [item] = S.habits.splice(fromGlobal, 1);
          S.habits.splice(Math.max(0, Math.min(S.habits.length, toGlobal + (from < to ? 1 : 0))), 0, item);
          save(); renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
        },
      });
    }
  });
}

export function renderHabitsAll() {
  const el = document.getElementById('h-all-list'); if (!el) return;
  const flatList = S.habits.filter(h => !isHabitInAnyStack(h.id));
  if (flatList.length) {
    el.innerHTML = flatList.map(h => renderHabitCard(h, { flat: true })).join('');
  } else {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">✅</div><div class="es-title">No habits yet</div><div class="es-sub">Pick a starter or craft your own</div><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:420px;margin:0 auto">${renderHabitTemplateChips()}</div><div style="margin-top:12px"><button class="btn btn-primary btn-sm" onclick="openAddHabit()">+ Custom habit</button></div></div>`;
  }
  wireGestures(el);
  if (!el._reorderWired && S.habits.length) {
    el._reorderWired = true;
    attachReorder(el, {
      itemSelector: '.habit-row',
      onReorder: (from, to) => {
        reorderArr(S.habits, from, to);
        save(); renderHabitsAll(); renderHabitsToday(); window.renderDash?.();
      }
    });
  }
}

function renderHabitTemplateChips() {
  const tmpl = window._habitTemplates || [];
  return tmpl.map((t, i) => `<button class="btn btn-sm" onclick="_applyHabitTemplateByIdx(${i})">${t.icon} ${t.name}</button>`).join('');
}

// Find a habit by id, walking into stack children too.
function findHabit(id) {
  let h = S.habits.find(x => x.id === id); if (h) return h;
  for (const p of S.habits) if (p.isStack && Array.isArray(p.children)) {
    const c = p.children.find(x => x.id === id); if (c) return c;
  }
  return null;
}

// Binary toggle (legacy) — kept for dashboard toggle + non-gesture callers.
export function toggleHabit(id) {
  const h = findHabit(id); if (!h) return;
  if (isCounter(h)) { handleTap(h); return; }
  if (!S.habitLog[today()]) S.habitLog[today()] = {};
  const nowOn = !S.habitLog[today()][id];
  S.habitLog[today()][id] = nowOn;
  haptic(nowOn ? 'medium' : 'light');
  if (nowOn) window.awardXP?.('habit');
  save(); renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
}

function populateHabitGoalSelect(selectedId) {
  const sel = document.getElementById('habit-goal'); if (!sel) return;
  sel.innerHTML = '<option value="">— none —</option>' + (S.goals || []).map(g => `<option value="${g.id}"${g.id === selectedId ? ' selected' : ''}>${g.name}</option>`).join('');
}

function populateLinkedGuidedSelect(selectedId) {
  const sel = document.getElementById('linked-med-guided'); if (!sel) return;
  const lib = window.GUIDED_LIBRARY || [];
  sel.innerHTML = '<option value="">— None (silent) —</option>' + lib.map(g => `<option value="${g.id}"${g.id === selectedId ? ' selected' : ''}>${g.icon} ${g.name} (${g.mins}m default)</option>`).join('');
}

// Show / hide fields based on whether the habit is good or bad. Bad habits
// don't support linked tools, counters, all-day, or streak goals.
export function updateHabitKindFields() {
  const isBad = (document.getElementById('habit-kind')?.value === 'bad');
  const linkRow = document.getElementById('habit-link-type')?.closest('.form-row');
  const linkInfo = document.getElementById('habit-link-type')?.parentElement?.nextElementSibling;
  const badInfo = document.getElementById('habit-kind-bad-info');
  if (linkRow) linkRow.style.display = isBad ? 'none' : '';
  if (linkInfo && linkInfo.style) linkInfo.style.display = isBad ? 'none' : '';
  if (badInfo) badInfo.style.display = isBad ? '' : 'none';
  if (isBad) {
    ['meditate','train','deepwork','sleep','journal','weight','medication','diet'].forEach(k => {
      const el = document.getElementById('linked-config-' + k); if (el) el.style.display = 'none';
    });
    const lt = document.getElementById('habit-link-type'); if (lt) lt.value = '';
    const modeRow = document.getElementById('habit-mode')?.closest('.form-row');
    const allDayRow = document.getElementById('habit-allday')?.closest('.form-row');
    const counterWrap = document.getElementById('habit-counter-fields');
    if (modeRow) modeRow.style.display = 'none';
    if (allDayRow) allDayRow.style.display = 'none';
    if (counterWrap) counterWrap.style.display = 'none';
    const adEl = document.getElementById('habit-allday'); if (adEl) adEl.checked = false;
  } else {
    const modeRow = document.getElementById('habit-mode')?.closest('.form-row');
    const allDayRow = document.getElementById('habit-allday')?.closest('.form-row');
    if (modeRow) modeRow.style.display = '';
    if (allDayRow) allDayRow.style.display = '';
    updateLinkedHabitFields();
  }
}

export function updateLinkedHabitFields() {
  const v = document.getElementById('habit-link-type')?.value || '';
  ['meditate', 'train', 'deepwork', 'sleep', 'journal', 'weight', 'medication', 'diet'].forEach(k => {
    const el = document.getElementById('linked-config-' + k);
    if (el) el.style.display = v === k ? '' : 'none';
  });
  // Populate ref pickers if needed
  if (v === 'medication') {
    const ref = document.getElementById('linked-med-ref');
    if (ref && window.listMedsForPicker) {
      const cur = ref.value;
      const items = window.listMedsForPicker();
      ref.innerHTML = items.length
        ? items.map(m => `<option value="${m.id}">${m.kind === 'supplement' ? '🌿' : '💊'} ${m.name}</option>`).join('')
        : '<option value="">— add a medication on the Medication page first —</option>';
      if (cur) ref.value = cur;
    }
  }
  if (v === 'diet') {
    const ref = document.getElementById('linked-diet-ref');
    if (ref && window.listMealsForPicker) {
      const cur = ref.value;
      const items = window.listMealsForPicker();
      ref.innerHTML = items.length
        ? items.map(m => `<option value="${m.id}">🍽 ${m.name}</option>`).join('')
        : '<option value="">— add a meal on the Diet page first —</option>';
      if (cur) ref.value = cur;
    }
  }
  const linked = !!v;
  const modeRow = document.getElementById('habit-mode')?.closest('.form-row');
  const allDayRow = document.getElementById('habit-allday')?.closest('.form-row');
  const counterWrap = document.getElementById('habit-counter-fields');
  if (modeRow) modeRow.style.display = linked ? 'none' : '';
  if (allDayRow) allDayRow.style.display = linked ? 'none' : '';
  if (counterWrap) counterWrap.style.display = linked ? 'none' : counterWrap.style.display;
  if (linked) {
    const modeSel = document.getElementById('habit-mode'); if (modeSel) modeSel.value = 'binary';
    const adEl = document.getElementById('habit-allday'); if (adEl) adEl.checked = false;
  }
}

export function populateDuplicateFromSelect(prefix = 'habit-') {
  const sel = document.getElementById(prefix + 'duplicate-from'); if (!sel) return;
  const editId = prefix === 'habit-' ? (document.getElementById('habit-edit-id')?.value || '') : '';
  const opts = (S.habits || [])
    .filter(h => h.id !== editId)
    .map(h => `<option value="${h.id}">${h.icon || '●'} ${h.name}${h.isStack ? ' 🧩' : ''}</option>`)
    .join('');
  sel.innerHTML = '<option value="">— don’t duplicate —</option>' + opts;
  sel.value = '';
}

// Apply the chosen source habit's settings into the open form. The user can
// then tweak fields before saving. The new habit always starts fresh — it
// gets a new id (editId stays '') so streak / completion / history don't
// transfer.
export function duplicateFromHabit(prefix = 'habit-') {
  const sel = document.getElementById(prefix + 'duplicate-from'); if (!sel) return;
  const id = sel.value; if (!id) return;
  const src = S.habits.find(h => h.id === id); if (!src) return;
  const suffix = ' (copy)';
  if (prefix === 'habit-') {
    document.getElementById('habit-edit-id').value = '';
    document.getElementById('m-habit-title').textContent = 'Add Habit (duplicating)';
    document.getElementById('habit-name').value = (src.name || '') + suffix;
    document.getElementById('habit-icon').value = src.icon || '';
    const kindSel = document.getElementById('habit-kind'); if (kindSel) kindSel.value = src.kind === 'bad' ? 'bad' : 'good';
    document.getElementById('habit-block').value = src.block || 'morning';
    const modeSel = document.getElementById('habit-mode'); if (modeSel) modeSel.value = src.mode || 'binary';
    const targetEl = document.getElementById('habit-target'); if (targetEl) targetEl.value = src.target ?? '';
    const unitEl = document.getElementById('habit-unit'); if (unitEl) unitEl.value = src.unit || '';
    const stepEl = document.getElementById('habit-step'); if (stepEl) stepEl.value = src.incrementStep ?? '';
    const cumEl = document.getElementById('habit-cumulative'); if (cumEl) cumEl.checked = !!src.cumulative;
    const jpEl = document.getElementById('habit-journal-prompt'); if (jpEl) jpEl.checked = src.journalPrompt !== false;
    const adEl = document.getElementById('habit-allday'); if (adEl) adEl.checked = !!src.allDay;
    const wyEl = document.getElementById('habit-why'); if (wyEl) wyEl.value = src.whyMatters || '';
    const lt = document.getElementById('habit-link-type'); if (lt) lt.value = src.linkedType || '';
    const lc = src.linkedConfig || {};
    const lmd = document.getElementById('linked-med-dur'); if (lmd) lmd.value = lc.duration ?? 10;
    const lms = document.getElementById('linked-med-sound'); if (lms) lms.value = lc.sound || '';
    populateLinkedGuidedSelect(lc.guidedScriptId || '');
    const ldw = document.getElementById('linked-dw-work'); if (ldw) ldw.value = lc.mins ?? 25;
    const ldb = document.getElementById('linked-dw-break'); if (ldb) ldb.value = lc.breakMins ?? 5;
    const ldl = document.getElementById('linked-dw-label'); if (ldl) ldl.value = lc.label || '';
    const lst = document.getElementById('linked-sleep-target'); if (lst) lst.value = lc.targetHrs ?? '';
    const ljp = document.getElementById('linked-journal-prompt'); if (ljp) ljp.value = lc.prompt || '';
    const sgm = document.getElementById('habit-goal-mode'); if (sgm) sgm.value = src.streakGoalMode || '';
    const sgd = document.getElementById('habit-goal-days'); if (sgd) sgd.value = src.streakGoalDays ?? '';
    setWeekdayPickerValue(src.activeDays);
    populateHabitGoalSelect(src.goalId || '');
    // Duplicating always creates a non-stack child by default — the user can
    // re-enable stack mode and re-pick children if they want. Streak / log /
    // history are intentionally not copied.
    const stkCB = document.getElementById('habit-is-stack'); if (stkCB) stkCB.checked = false;
    resetStackChildren('habit-');
    toggleHabitStackFields('habit-');
    toggleCounterFields();
    updateLinkedHabitFields();
    updateHabitGoalFields();
    updateHabitKindFields();
  } else if (prefix === 'qc-') {
    document.getElementById('qc-habit-name').value = (src.name || '') + suffix;
    const k = document.getElementById('qc-habit-kind'); if (k) k.value = src.kind === 'bad' ? 'bad' : 'good';
    const b = document.getElementById('qc-habit-block'); if (b) b.value = src.block || 'morning';
    const i = document.getElementById('qc-habit-icon'); if (i) i.value = src.icon || '';
    const m = document.getElementById('qc-habit-mode'); if (m) m.value = src.mode || 'binary';
    const lt = document.getElementById('qc-habit-link-type'); if (lt) lt.value = src.linkedType || '';
  }
}

export function openAddHabit() {
  document.getElementById('m-habit-title').textContent = 'Add Habit';
  document.getElementById('habit-edit-id').value = '';
  document.getElementById('habit-name').value = '';
  document.getElementById('habit-icon').value = '';
  const kindSel = document.getElementById('habit-kind'); if (kindSel) kindSel.value = 'good';
  document.getElementById('habit-block').value = 'morning';
  const modeSel = document.getElementById('habit-mode'); if (modeSel) modeSel.value = 'binary';
  ['habit-target','habit-unit','habit-step'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cumEl = document.getElementById('habit-cumulative'); if (cumEl) cumEl.checked = false;
  const jpEl = document.getElementById('habit-journal-prompt'); if (jpEl) jpEl.checked = true;
  const adEl = document.getElementById('habit-allday'); if (adEl) adEl.checked = false;
  const upEl = document.getElementById('habit-unit-preset'); if (upEl) upEl.value = '';
  const wyEl = document.getElementById('habit-why'); if (wyEl) wyEl.value = '';
  const lt = document.getElementById('habit-link-type'); if (lt) lt.value = '';
  const lmd = document.getElementById('linked-med-dur'); if (lmd) lmd.value = 10;
  const lms = document.getElementById('linked-med-sound'); if (lms) lms.value = '';
  populateLinkedGuidedSelect('');
  const ldw = document.getElementById('linked-dw-work'); if (ldw) ldw.value = 25;
  const ldb = document.getElementById('linked-dw-break'); if (ldb) ldb.value = 5;
  const ldl = document.getElementById('linked-dw-label'); if (ldl) ldl.value = '';
  const lst = document.getElementById('linked-sleep-target'); if (lst) lst.value = '';
  const ljp = document.getElementById('linked-journal-prompt'); if (ljp) ljp.value = '';
  const sgm = document.getElementById('habit-goal-mode'); if (sgm) sgm.value = '';
  const sgd = document.getElementById('habit-goal-days'); if (sgd) sgd.value = '';
  setWeekdayPickerValue(null);
  populateHabitGoalSelect('');
  const stkCB = document.getElementById('habit-is-stack'); if (stkCB) stkCB.checked = false;
  resetStackChildren('habit-');
  toggleHabitStackFields('habit-');
  populateDuplicateFromSelect('habit-');
  const dupRow = document.getElementById('habit-duplicate-row'); if (dupRow) dupRow.style.display = '';
  toggleCounterFields();
  updateLinkedHabitFields();
  updateHabitGoalFields();
  updateHabitKindFields();
  document.getElementById('m-habit').style.display = 'flex';
}

export function openEditHabit(id) {
  const h = S.habits.find(x => x.id === id); if (!h) return;
  document.getElementById('m-habit-title').textContent = 'Edit Habit';
  document.getElementById('habit-edit-id').value = id;
  document.getElementById('habit-name').value = h.name;
  document.getElementById('habit-icon').value = h.icon || '';
  const kindSel = document.getElementById('habit-kind'); if (kindSel) kindSel.value = h.kind === 'bad' ? 'bad' : 'good';
  document.getElementById('habit-block').value = h.block || 'morning';
  const modeSel = document.getElementById('habit-mode'); if (modeSel) modeSel.value = h.mode || 'binary';
  const targetEl = document.getElementById('habit-target'); if (targetEl) targetEl.value = h.target ?? '';
  const unitEl = document.getElementById('habit-unit'); if (unitEl) unitEl.value = h.unit || '';
  const stepEl = document.getElementById('habit-step'); if (stepEl) stepEl.value = h.incrementStep ?? '';
  const cumEl = document.getElementById('habit-cumulative'); if (cumEl) cumEl.checked = !!h.cumulative;
  const jpEl = document.getElementById('habit-journal-prompt'); if (jpEl) jpEl.checked = h.journalPrompt !== false;
  const adEl = document.getElementById('habit-allday'); if (adEl) adEl.checked = !!h.allDay;
  const wyEl = document.getElementById('habit-why'); if (wyEl) wyEl.value = h.whyMatters || '';
  const lt = document.getElementById('habit-link-type'); if (lt) lt.value = h.linkedType || '';
  const lc = h.linkedConfig || {};
  const lmd = document.getElementById('linked-med-dur'); if (lmd) lmd.value = lc.duration ?? 10;
  const lms = document.getElementById('linked-med-sound'); if (lms) lms.value = lc.sound || '';
  populateLinkedGuidedSelect(lc.guidedScriptId || '');
  const ldw = document.getElementById('linked-dw-work'); if (ldw) ldw.value = lc.mins ?? 25;
  const ldb = document.getElementById('linked-dw-break'); if (ldb) ldb.value = lc.breakMins ?? 5;
  const ldl = document.getElementById('linked-dw-label'); if (ldl) ldl.value = lc.label || '';
  const lst = document.getElementById('linked-sleep-target'); if (lst) lst.value = lc.targetHrs ?? '';
  const ljp = document.getElementById('linked-journal-prompt'); if (ljp) ljp.value = lc.prompt || '';
  const lmref = document.getElementById('linked-med-ref'); if (lmref) lmref.value = h.linkedRefId || lc.refId || '';
  const ldref = document.getElementById('linked-diet-ref'); if (ldref) ldref.value = h.linkedRefId || lc.refId || '';
  const sgm = document.getElementById('habit-goal-mode'); if (sgm) sgm.value = h.streakGoalMode || '';
  const sgd = document.getElementById('habit-goal-days'); if (sgd) sgd.value = h.streakGoalDays ?? '';
  setWeekdayPickerValue(h.activeDays);
  populateHabitGoalSelect(h.goalId || '');
  const stkCB = document.getElementById('habit-is-stack'); if (stkCB) stkCB.checked = !!h.isStack;
  if (h.isStack) populateStackChildren('habit-', h.children || []);
  else resetStackChildren('habit-');
  toggleHabitStackFields('habit-');
  // Hide the duplicate-from row when editing — duplication only makes sense
  // for new habits.
  const dupRow = document.getElementById('habit-duplicate-row');
  if (dupRow) dupRow.style.display = 'none';
  toggleCounterFields();
  updateLinkedHabitFields();
  updateHabitGoalFields();
  updateHabitKindFields();
  document.getElementById('m-habit').style.display = 'flex';
}

export function toggleCounterFields() {
  const modeSel = document.getElementById('habit-mode'); if (!modeSel) return;
  const wrap = document.getElementById('habit-counter-fields'); if (!wrap) return;
  const allDay = !!document.getElementById('habit-allday')?.checked;
  wrap.style.display = (modeSel.value === 'counter' || allDay) ? '' : 'none';
}

export function toggleAllDayHabit() {
  const allDay = !!document.getElementById('habit-allday')?.checked;
  const modeSel = document.getElementById('habit-mode');
  if (allDay && modeSel) modeSel.value = 'counter';
  toggleCounterFields();
}

export function applyUnitPreset() {
  const v = document.getElementById('habit-unit-preset')?.value;
  if (!v) return;
  const u = document.getElementById('habit-unit'); if (u) u.value = v;
  const target = document.getElementById('habit-target');
  const step = document.getElementById('habit-step');
  const defs = { ml: { t: 2000, s: 250 }, l: { t: 2, s: 0.25 }, glasses: { t: 8, s: 1 }, cups: { t: 6, s: 1 }, minutes: { t: 30, s: 5 }, hours: { t: 1, s: 0.25 }, steps: { t: 10000, s: 500 }, miles: { t: 5, s: 0.5 }, km: { t: 8, s: 1 }, pages: { t: 20, s: 5 }, reps: { t: 100, s: 10 }, sets: { t: 10, s: 1 } };
  const d = defs[v]; if (!d) return;
  if (target && !target.value) target.value = d.t;
  if (step && !step.value) step.value = d.s;
}

export function saveHabit() {
  const name = document.getElementById('habit-name').value.trim(); if (!name) return;
  const editId = document.getElementById('habit-edit-id').value;
  const mode = document.getElementById('habit-mode')?.value || 'binary';
  const target = parseInt(document.getElementById('habit-target')?.value) || undefined;
  const unit = document.getElementById('habit-unit')?.value.trim() || undefined;
  const step = parseInt(document.getElementById('habit-step')?.value) || undefined;
  const cumulative = !!document.getElementById('habit-cumulative')?.checked;
  const journalPrompt = document.getElementById('habit-journal-prompt')?.checked !== false;
  const goalId = document.getElementById('habit-goal')?.value || null;
  const allDay = !!document.getElementById('habit-allday')?.checked;
  const whyMatters = (document.getElementById('habit-why')?.value || '').trim();
  const linkedType = document.getElementById('habit-link-type')?.value || null;
  let linkedConfig = null;
  if (linkedType === 'meditate') {
    linkedConfig = {
      duration: parseInt(document.getElementById('linked-med-dur')?.value) || 10,
      sound: document.getElementById('linked-med-sound')?.value || '',
      guidedScriptId: document.getElementById('linked-med-guided')?.value || null,
    };
  } else if (linkedType === 'deepwork') {
    linkedConfig = {
      mins: parseInt(document.getElementById('linked-dw-work')?.value) || 25,
      breakMins: parseInt(document.getElementById('linked-dw-break')?.value) || 5,
      label: (document.getElementById('linked-dw-label')?.value || '').trim(),
    };
  } else if (linkedType === 'train') {
    linkedConfig = {};
  } else if (linkedType === 'sleep') {
    const t = parseFloat(document.getElementById('linked-sleep-target')?.value);
    linkedConfig = { targetHrs: isFinite(t) && t > 0 ? t : undefined };
  } else if (linkedType === 'journal') {
    linkedConfig = { prompt: (document.getElementById('linked-journal-prompt')?.value || '').trim() };
  } else if (linkedType === 'weight') {
    linkedConfig = {};
  } else if (linkedType === 'medication') {
    linkedConfig = { refId: document.getElementById('linked-med-ref')?.value || null };
  } else if (linkedType === 'diet') {
    linkedConfig = { refId: document.getElementById('linked-diet-ref')?.value || null };
  }
  // Linked habits are always binary toggles, never counters / all-day.
  const effectiveMode = linkedType ? 'binary' : (allDay ? 'counter' : mode);
  const linkedIconMap = { meditate: '🧘', train: '🏋️', deepwork: '🧠', sleep: '😴', journal: '📓', weight: '⚖️', medication: '💊', diet: '🍽' };
  const linkedRefId = (linkedType === 'medication' || linkedType === 'diet') ? (linkedConfig?.refId || null) : null;
  const kind = document.getElementById('habit-kind')?.value === 'bad' ? 'bad' : 'good';
  const data = {
    name,
    kind,
    block: document.getElementById('habit-block').value,
    icon: document.getElementById('habit-icon').value || (kind === 'bad' ? '🚫' : (linkedIconMap[linkedType] || (document.getElementById('habit-is-stack')?.checked ? '🧩' : '●'))),
    mode: kind === 'bad' ? 'binary' : effectiveMode,
    journalPrompt,
    goalId,
    allDay: (linkedType || kind === 'bad') ? false : allDay,
    whyMatters,
    linkedType,
    linkedConfig,
    linkedRefId,
    streakGoalMode: document.getElementById('habit-goal-mode')?.value || null,
    streakGoalDays: parseInt(document.getElementById('habit-goal-days')?.value) || null,
    activeDays: readWeekdayPickerValue(),
  };
  if (mode === 'counter') {
    if (target) data.target = target;
    if (unit) data.unit = unit;
    if (step) data.incrementStep = step;
    data.cumulative = cumulative;
  } else {
    delete data.target; delete data.unit; delete data.incrementStep; delete data.cumulative;
  }
  const isStackChecked = !!document.getElementById('habit-is-stack')?.checked;
  if (isStackChecked) {
    data.isStack = true;
    data.children = readStackChildren('habit-');
    data.mode = 'binary';
    data.linkedType = null;
    data.linkedConfig = null;
    delete data.target; delete data.unit; delete data.incrementStep; delete data.cumulative;
    data.streakGoalMode = null; data.streakGoalDays = null;
  } else {
    data.isStack = false;
    data.children = null;
  }
  let savedId = editId;
  if (editId) { const h = S.habits.find(x => x.id === editId); if (h) Object.assign(h, data); }
  else { savedId = uid(); S.habits.push({ id: savedId, ...data }); }
  save();
  // If we're inside the "Create new habit to add to stack" flow, don't close
  // the modal — resume the parent stack form with the new habit appended.
  if (isInChildCreation()) {
    const ctx = consumeChildCreationContext();
    document.getElementById('habit-cancel-child-link')?.remove();
    resumeParentAfterChildSave(ctx, savedId);
    renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
    return;
  }
  window.closeModal('m-habit'); renderHabitsToday(); renderHabitsAll();
}

export function deleteHabit(id) {
  const idx = S.habits.findIndex(h => h.id === id); if (idx < 0) return;
  const removed = S.habits[idx];
  S.habits.splice(idx, 1);
  save(); renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
  window.toastUndo?.(`Deleted "${removed.name}"`, () => {
    S.habits.splice(idx, 0, removed);
    save(); renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
  });
}

// Expose
window.renderHabitsToday = renderHabitsToday;
window.renderHabitsAll = renderHabitsAll;
window.toggleHabit = toggleHabit;
window.openAddHabit = openAddHabit;
window.openEditHabit = openEditHabit;
window.saveHabit = saveHabit;
window.deleteHabit = deleteHabit;
window.calcStreak = calcStreak;
window.collapseHabits = collapseHabits;
window.expandHabits = expandHabits;
window.toggleHabitBlock = toggleHabitBlock;
window.renderHabitHeatmap = renderHabitHeatmap;
window.toggleCounterFields = toggleCounterFields;
window.toggleAllDayHabit = toggleAllDayHabit;
window.updateLinkedHabitFields = updateLinkedHabitFields;
window.updateHabitKindFields = updateHabitKindFields;
window.calcBadStreak = calcBadStreak;
window.updateHabitGoalFields = updateHabitGoalFields;
window.openLinkedHabit = openLinkedHabit;
window.markHabitDoneFromFlow = markHabitDoneFromFlow;
window.applyUnitPreset = applyUnitPreset;
window.doneToday = doneToday;
window.duplicateFromHabit = duplicateFromHabit;
window.populateDuplicateFromSelect = populateDuplicateFromSelect;
