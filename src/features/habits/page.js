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

// Compact badge shown on a linked habit's row. e.g. "🔗 meditate · 15m".
export function linkedHabitBadge(h) {
  if (!h?.linkedType) return '';
  const cfg = h.linkedConfig || {};
  const tag = h.linkedType;
  let suffix = '';
  if (tag === 'meditate' && cfg.duration) suffix = ' · ' + cfg.duration + 'm';
  else if (tag === 'deepwork' && cfg.mins) suffix = ' · ' + cfg.mins + 'm';
  else if (tag === 'sleep' && cfg.targetHrs) suffix = ' · ' + cfg.targetHrs + 'h';
  return `<span class="link-badge" title="Tap the habit to launch its tool">🔗 ${tag}${suffix}</span>`;
}

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
  const linkBadge = linkedHabitBadge(h);

  // Gestures attach to .habit-tap (the inner zone), NOT the row. The
  // edit / delete buttons live as siblings of .habit-tap, so pointer events
  // on a button physically cannot bubble into the gesture handler.
  return `<div class="habit-row${done ? ' done' : ''}" data-habit-id="${h.id}">
    <div class="habit-tap">
      ${ring}
      <div class="habit-info">
        <div class="habit-name">${h.icon || '●'} ${h.name}${counter ? ' <span class="mode-chip">counter</span>' : ''}${isCumulative(h) ? ' <span class="mode-chip">cumulative</span>' : ''}${linkBadge}</div>
        <div class="habit-meta">${meta}</div>
      </div>
      ${blockBadge}
      ${streakBadge(streak, h.tierBase || DEFAULT_TIERS)}
    </div>
    <button class="btn-icon" data-habit-action="edit" data-id="${h.id}" aria-label="Edit habit">✏️</button>
    <button class="btn-icon danger" data-habit-action="del" data-id="${h.id}" aria-label="Delete habit">✕</button>
  </div>`;
}

// Wire gesture handlers to the .habit-tap inner zone of each row. Action
// buttons (✏️ / 🗑) are siblings of .habit-tap, so pointer events on them
// never reach the gesture handler — no fancy stopPropagation gymnastics
// needed.
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
  // Linked habits route to their tool with the saved config pre-applied.
  // Double-tap / triple-tap / long-press still let the user manually
  // override (mark done without doing the activity, etc.).
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

// ── Linked habit dispatch ────────────────────────────────────────────────────
// Tapping a linked habit sets a transient flow flag, navigates to the right
// page, and applies the saved config. The corresponding logger reads the
// flag on session-save and ticks the habit done + awards XP.
//
// The flag lives on `window` only — if the user reloads before finishing the
// session, the flow context is lost (acceptable; they can tap the habit
// again to reset the context).
const FLOW_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function openLinkedHabit(h) {
  if (!h?.linkedType) return;
  window._ffSessionFlow = { habitId: h.id, kind: h.linkedType, setAt: Date.now() };
  const cfg = h.linkedConfig || {};
  if (h.linkedType === 'meditate') {
    window.goPage?.('meditation');
    setTimeout(() => applyLinkedMeditationConfig(cfg), 60);
  } else if (h.linkedType === 'deepwork') {
    window.goPage?.('deepwork');
    setTimeout(() => applyLinkedDeepworkConfig(cfg), 60);
  } else if (h.linkedType === 'train') {
    window.goPage?.('fitness');
  } else if (h.linkedType === 'sleep') {
    window.goPage?.('sleep');
    setTimeout(() => applyLinkedSleepConfig(cfg), 60);
  } else if (h.linkedType === 'journal') {
    // Journal lives behind a modal — open the modal directly. The journal
    // page must be the active page so the modal's parent exists.
    window.goPage?.('journal');
    setTimeout(() => applyLinkedJournalConfig(cfg), 60);
  } else if (h.linkedType === 'weight') {
    window.goPage?.('weight');
    setTimeout(() => applyLinkedWeightConfig(cfg), 60);
  }
}

function applyLinkedSleepConfig(cfg) {
  // Sleep page renders form fields that already default to today's date and
  // sensible bedtimes. Only thing to surface is a target-hours hint.
  if (cfg.targetHrs) window.toast?.(`😴 Sleep — target ${cfg.targetHrs}h`);
  else window.toast?.('😴 Log tonight\'s sleep');
}

function applyLinkedJournalConfig(cfg) {
  // Open the existing journal entry modal pre-filled with the prompt as
  // placeholder text, then focus the textarea.
  if (typeof window.openAddJournal === 'function') window.openAddJournal();
  setTimeout(() => {
    const ta = document.getElementById('j-text');
    if (ta) {
      if (cfg.prompt) ta.placeholder = cfg.prompt;
      ta.focus();
    }
  }, 80);
  window.toast?.('📓 New journal entry');
}

function applyLinkedWeightConfig(_cfg) {
  // Weight page already renders a fresh log form. Just announce.
  window.toast?.('⚖️ Log today\'s weight');
}

function applyLinkedMeditationConfig(cfg) {
  // Apply ambient sound first.
  if (typeof window.playAmbient === 'function') window.playAmbient(cfg.sound || '');
  document.querySelectorAll('.med-sound-btn').forEach(b => b.classList.toggle('active', b.dataset.sound === (cfg.sound || '')));
  // Then guided script (this also pre-fills duration with the script's default).
  if (cfg.guidedScriptId && typeof window.selectGuided === 'function') window.selectGuided(cfg.guidedScriptId);
  else if (typeof window.clearGuided === 'function') window.clearGuided();
  // The user's saved duration takes priority — apply it last.
  const dur = document.getElementById('med-dur'); if (dur && cfg.duration) dur.value = cfg.duration;
  if (typeof window.medReset === 'function') window.medReset();
  window.toast?.('🧘 Meditation pre-loaded — hit ▶ when ready');
}

function applyLinkedDeepworkConfig(cfg) {
  const w = document.getElementById('dw-work'); if (w && cfg.mins) w.value = cfg.mins;
  const b = document.getElementById('dw-break'); if (b && cfg.breakMins) b.value = cfg.breakMins;
  const lbl = document.getElementById('dw-label'); if (lbl) lbl.value = cfg.label || lbl.value;
  if (typeof window.dwReset === 'function') window.dwReset();
  window.toast?.('🧠 Deep-work pre-loaded — hit ▶ when ready');
}

// Called by med / dw / training loggers on session save. Auto-ticks the
// habit, awards XP, refreshes UI. No-op if the flow doesn't match or has
// expired.
export function markHabitDoneFromFlow(kind) {
  const flow = window._ffSessionFlow;
  if (!flow || flow.kind !== kind) return false;
  if (Date.now() - (flow.setAt || 0) > FLOW_TTL_MS) { window._ffSessionFlow = null; return false; }
  const h = (S.habits || []).find(x => x.id === flow.habitId);
  if (!h) { window._ffSessionFlow = null; return false; }
  // Tick today (binary)
  if (!S.habitLog[today()]) S.habitLog[today()] = {};
  const wasDone = !!S.habitLog[today()][h.id];
  S.habitLog[today()][h.id] = true;
  if (!wasDone) {
    haptic('medium');
    window.awardXP?.('habit');
    window.toast?.(`✓ Habit ticked: ${h.name}`);
  }
  window._ffSessionFlow = null;
  save();
  renderHabitsToday(); renderHabitsAll(); window.renderDash?.();
  return true;
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

function populateLinkedGuidedSelect(selectedId) {
  const sel = document.getElementById('linked-med-guided'); if (!sel) return;
  const lib = window.GUIDED_LIBRARY || [];
  sel.innerHTML = '<option value="">— None (silent) —</option>' + lib.map(g => `<option value="${g.id}"${g.id === selectedId ? ' selected' : ''}>${g.icon} ${g.name} (${g.mins}m default)</option>`).join('');
}

// Show / hide the per-type config block based on the dropdown choice. Also
// hides the regular mode + all-day fields when the habit is linked, since
// linked habits are always binary "did the activity = done".
export function updateLinkedHabitFields() {
  const v = document.getElementById('habit-link-type')?.value || '';
  ['meditate', 'train', 'deepwork', 'sleep', 'journal', 'weight'].forEach(k => {
    const el = document.getElementById('linked-config-' + k);
    if (el) el.style.display = v === k ? '' : 'none';
  });
  const linked = !!v;
  // When linked: force binary mode and hide all-day / counter / mode controls.
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
  // Linked-habit defaults
  const lt = document.getElementById('habit-link-type'); if (lt) lt.value = '';
  const lmd = document.getElementById('linked-med-dur'); if (lmd) lmd.value = 10;
  const lms = document.getElementById('linked-med-sound'); if (lms) lms.value = '';
  populateLinkedGuidedSelect('');
  const ldw = document.getElementById('linked-dw-work'); if (ldw) ldw.value = 25;
  const ldb = document.getElementById('linked-dw-break'); if (ldb) ldb.value = 5;
  const ldl = document.getElementById('linked-dw-label'); if (ldl) ldl.value = '';
  const lst = document.getElementById('linked-sleep-target'); if (lst) lst.value = '';
  const ljp = document.getElementById('linked-journal-prompt'); if (ljp) ljp.value = '';
  populateHabitGoalSelect('');
  toggleCounterFields();
  updateLinkedHabitFields();
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
  // Linked-habit fields
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
  populateHabitGoalSelect(h.goalId || '');
  toggleCounterFields();
  updateLinkedHabitFields();
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
  }
  // Linked habits are always binary toggles, never counters / all-day.
  const effectiveMode = linkedType ? 'binary' : (allDay ? 'counter' : mode);
  const linkedIconMap = { meditate: '🧘', train: '🏋️', deepwork: '🧠', sleep: '😴', journal: '📓', weight: '⚖️' };
  const data = {
    name,
    block: document.getElementById('habit-block').value,
    icon: document.getElementById('habit-icon').value || (linkedIconMap[linkedType] || '●'),
    mode: effectiveMode,
    journalPrompt,
    goalId,
    allDay: linkedType ? false : allDay,
    whyMatters,
    linkedType,
    linkedConfig,
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
window.updateLinkedHabitFields = updateLinkedHabitFields;
window.openLinkedHabit = openLinkedHabit;
window.markHabitDoneFromFlow = markHabitDoneFromFlow;
window.applyUnitPreset = applyUnitPreset;
window.doneToday = doneToday;
