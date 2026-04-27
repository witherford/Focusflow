// Habits — Phase 4: counter mode, gestures, tiered streaks
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { tierFor, streakBadge, DEFAULT_TIERS } from './tierStreak.js';
import { isCounter, isCumulative, countFor, metOn, increment, complete, reset } from './counterMode.js';
import { attachHabitGestures } from './gestures.js';
import { promptHabitJournal } from './journalPrompt.js';
import { computeStreakWithFreeze } from './streakFreeze.js';
import { attachReorder, reorderArr } from '../../ui/dragReorder.js';

let hbOpen = { morning: true, afternoon: true, evening: true };
const blockIcons = { morning: '☀️', afternoon: '🌤', evening: '🌙' };

export function collapseHabits() { hbOpen = { morning: false, afternoon: false, evening: false }; renderHabitsToday(); }
export function expandHabits() { hbOpen = { morning: true, afternoon: true, evening: true }; renderHabitsToday(); }
export function toggleHabitBlock(b) { hbOpen[b] = !hbOpen[b]; renderHabitsToday(); }

// Is a habit "done" for today? Works for both binary and counter modes.
export function doneToday(h) { return metOn(h, today()); }

// Render a single card body; used by both morning/afternoon/evening and the flat list.
function renderHabitCard(h, { flat = false } = {}) {
  const counter = isCounter(h);
  const count = counter ? countFor(h) : 0;
  const target = h.target || 1;
  const done = doneToday(h);
  const pct = counter && target > 0 ? Math.min(100, Math.round(count / target * 100)) : (done ? 100 : 0);
  const streak = calcStreak(h.id);
  const meta = counter
    ? `${count}${isCumulative(h) ? '' : '/' + target}${h.unit ? ' ' + h.unit : ''} · Streak ${streak}d`
    : `Streak: ${streak} day${streak === 1 ? '' : 's'}`;

  // Progress ring for counter, circle check for binary
  const ring = counter
    ? `<svg class="habit-ring" width="40" height="40" viewBox="0 0 40 40">
         <circle class="ring-track" cx="20" cy="20" r="16" />
         <circle class="ring-fill"  cx="20" cy="20" r="16"
                 style="stroke-dasharray:100.5;stroke-dashoffset:${100.5 * (1 - pct/100)}" />
         <text x="20" y="24" text-anchor="middle" class="ring-num">${count}</text>
       </svg>`
    : `<div class="habit-check${done ? ' checked' : ''}">✓</div>`;

  const blockBadge = flat ? `<span class="badge badge-violet">${h.block}</span>` : '';

  return `<div class="habit-row${done ? ' done' : ''}" data-habit-id="${h.id}">
    ${ring}
    <div class="habit-info">
      <div class="habit-name">${h.icon || '●'} ${h.name}${counter ? ' <span class="mode-chip">counter</span>' : ''}${isCumulative(h) ? ' <span class="mode-chip">cumulative</span>' : ''}</div>
      <div class="habit-meta">${meta}</div>
    </div>
    ${blockBadge}
    ${streakBadge(streak, h.tierBase || DEFAULT_TIERS)}
    <button class="btn-icon" data-habit-action="edit" data-id="${h.id}">✏️</button>
    <button class="btn-icon danger" data-habit-action="del" data-id="${h.id}">✕</button>
  </div>`;
}

// Wire gesture handlers to all .habit-row elements inside a container.
function wireGestures(container) {
  if (!container) return;
  container.querySelectorAll('.habit-row').forEach(row => {
    const id = row.dataset.habitId; if (!id) return;
    const h = S.habits.find(x => x.id === id); if (!h) return;
    attachHabitGestures(row, {
      onTap: ({ event }) => {
        if (event.target.closest('[data-habit-action]')) return;
        handleTap(h);
      },
      onDoubleTap: ({ event }) => {
        if (event.target.closest('[data-habit-action]')) return;
        handleDoubleTap(h);
      },
      onTripleTap: ({ event }) => {
        if (event.target.closest('[data-habit-action]')) return;
        handleTripleTap(h);
      },
      onLongPress: ({ event }) => {
        if (event.target.closest('[data-habit-action]')) return;
        handleLongPress(h);
      },
    });
  });
  // Delegate edit/delete clicks — attach ONCE per container (idempotent).
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

export function renderHabitsToday() {
  ['morning', 'afternoon', 'evening'].forEach(b => {
    const el = document.getElementById('h-' + b); if (!el) return;
    const bH = S.habits.filter(h => h.block === b);
    const doneCount = bH.filter(h => doneToday(h)).length;
    const pct = bH.length ? Math.round(doneCount / bH.length * 100) : 0;
    const open = hbOpen[b] !== false;
    const barColor = pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--teal)' : 'var(--violet)';
    el.innerHTML = `<div class="card" style="margin-bottom:10px">
      <div class="card-header" style="margin-bottom:8px;cursor:pointer" onclick="toggleHabitBlock('${b}')">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span style="font-size:18px">${blockIcons[b]}</span>
          <span class="card-title" style="margin:0;text-transform:capitalize">${b}</span>
          <span style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">${doneCount}/${bH.length}</span>
          ${bH.length ? `
            <div class="block-progress" style="flex:1;min-width:60px;display:flex;align-items:center;gap:6px;margin-left:4px">
              <div class="progress-track" style="flex:1;margin:0;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div class="fill" style="background:${barColor};width:${pct}%;height:100%;transition:width 0.3s"></div></div>
              <span style="font-size:11px;color:${pct === 100 ? 'var(--green)' : 'var(--text3)'};font-family:'DM Mono',monospace;min-width:32px;text-align:right">${pct}%</span>
            </div>` : ''}
        </div>
        <span style="color:var(--text3);font-size:12px;flex-shrink:0">${open ? '▾' : '▸'}</span>
      </div>
      ${open ? (bH.length ? `<div style="padding-top:4px">${bH.map(h => renderHabitCard(h)).join('')}</div>` : '<div style="color:var(--text3);font-size:13px;padding:4px">No habits here yet</div>') : ''}
    </div>`;
    wireGestures(el);
  });
}

export function renderHabitsAll() {
  const el = document.getElementById('h-all-list'); if (!el) return;
  if (S.habits.length) {
    el.innerHTML = S.habits.map(h => renderHabitCard(h, { flat: true })).join('');
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
  // Lazy import-safe — templates module attaches to window
  const tmpl = window._habitTemplates || [];
  return tmpl.map((t, i) => `<button class="btn btn-sm" onclick="_applyHabitTemplateByIdx(${i})">${t.icon} ${t.name}</button>`).join('');
}

// Binary toggle (legacy) — kept for dashboard toggle + non-gesture callers.
export function toggleHabit(id) {
  const h = S.habits.find(x => x.id === id); if (!h) return;
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

export function openAddHabit() {
  document.getElementById('m-habit-title').textContent = 'Add Habit';
  document.getElementById('habit-edit-id').value = '';
  document.getElementById('habit-name').value = '';
  document.getElementById('habit-icon').value = '';
  document.getElementById('habit-block').value = 'morning';
  const modeSel = document.getElementById('habit-mode'); if (modeSel) modeSel.value = 'binary';
  ['habit-target','habit-unit','habit-step'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cumEl = document.getElementById('habit-cumulative'); if (cumEl) cumEl.checked = false;
  const jpEl = document.getElementById('habit-journal-prompt'); if (jpEl) jpEl.checked = true;
  const adEl = document.getElementById('habit-allday'); if (adEl) adEl.checked = false;
  const upEl = document.getElementById('habit-unit-preset'); if (upEl) upEl.value = '';
  const wyEl = document.getElementById('habit-why'); if (wyEl) wyEl.value = '';
  populateHabitGoalSelect('');
  toggleCounterFields();
  document.getElementById('m-habit').style.display = 'flex';
}

export function openEditHabit(id) {
  const h = S.habits.find(x => x.id === id); if (!h) return;
  document.getElementById('m-habit-title').textContent = 'Edit Habit';
  document.getElementById('habit-edit-id').value = id;
  document.getElementById('habit-name').value = h.name;
  document.getElementById('habit-icon').value = h.icon || '';
  document.getElementById('habit-block').value = h.block || 'morning';
  const modeSel = document.getElementById('habit-mode'); if (modeSel) modeSel.value = h.mode || 'binary';
  const targetEl = document.getElementById('habit-target'); if (targetEl) targetEl.value = h.target ?? '';
  const unitEl = document.getElementById('habit-unit'); if (unitEl) unitEl.value = h.unit || '';
  const stepEl = document.getElementById('habit-step'); if (stepEl) stepEl.value = h.incrementStep ?? '';
  const cumEl = document.getElementById('habit-cumulative'); if (cumEl) cumEl.checked = !!h.cumulative;
  const jpEl = document.getElementById('habit-journal-prompt'); if (jpEl) jpEl.checked = h.journalPrompt !== false;
  const adEl = document.getElementById('habit-allday'); if (adEl) adEl.checked = !!h.allDay;
  const wyEl = document.getElementById('habit-why'); if (wyEl) wyEl.value = h.whyMatters || '';
  populateHabitGoalSelect(h.goalId || '');
  toggleCounterFields();
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
  // Sensible defaults for step + target when nothing set
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
  const data = {
    name,
    block: document.getElementById('habit-block').value,
    icon: document.getElementById('habit-icon').value || '●',
    mode: allDay ? 'counter' : mode,
    journalPrompt,
    goalId,
    allDay,
    whyMatters,
  };
  if (mode === 'counter') {
    if (target) data.target = target;
    if (unit) data.unit = unit;
    if (step) data.incrementStep = step;
    data.cumulative = cumulative;
  } else {
    delete data.target; delete data.unit; delete data.incrementStep; delete data.cumulative;
  }
  if (editId) { const h = S.habits.find(x => x.id === editId); if (h) Object.assign(h, data); }
  else S.habits.push({ id: uid(), ...data });
  save(); window.closeModal('m-habit'); renderHabitsToday(); renderHabitsAll();
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

// Streak = consecutive days from today backward where the habit was "met" (with auto-freeze).
export function calcStreak(id) {
  const h = S.habits.find(x => x.id === id); if (!h) return 0;
  const { streak } = computeStreakWithFreeze(h);
  h.tier = tierFor(streak, h.tierBase || DEFAULT_TIERS);
  return streak;
}

export function renderHabitHeatmap() {
  window.renderHM('heatmap-grid', parseInt(document.getElementById('hm-months')?.value || 1) * 30, k => {
    const total = S.habits.length;
    if (!total) return { l: 0, title: k + ': 0/0' };
    const done = S.habits.filter(h => metOn(h, k)).length;
    const pct = done / total;
    return { l: done === 0 ? 0 : pct < .25 ? 1 : pct < .5 ? 2 : pct < 1 ? 3 : 4, title: k + ': ' + done + '/' + total };
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
window.applyUnitPreset = applyUnitPreset;
window.doneToday = doneToday;
