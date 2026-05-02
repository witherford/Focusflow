// Linked-habit dispatch — tapping a "linked" habit sets a transient flow flag,
// navigates to the right page, and applies its saved config. The corresponding
// session logger (med/dw/training) calls markHabitDoneFromFlow on save to tick
// the habit + award XP.
//
// The flag lives on `window` only — if the user reloads before finishing,
// the context is lost (acceptable; they tap the habit again).
import { S, today, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';

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
  } else if (h.linkedType === 'medication') {
    window.goPage?.('medication');
    window.toast?.('💊 Medication');
  } else if (h.linkedType === 'diet') {
    // Ticking a diet-linked habit logs its meal directly + ticks the habit.
    if (h.linkedRefId && window.logMealFromHabitTick) {
      window.logMealFromHabitTick(h.linkedRefId);
    }
    if (!S.habitLog[today()]) S.habitLog[today()] = {};
    const wasDone = !!S.habitLog[today()][h.id];
    S.habitLog[today()][h.id] = true;
    if (!wasDone) {
      haptic('medium');
      window.awardXP?.('habit');
      window.toast?.(`✓ Logged: ${h.name}`);
    }
    save();
    window.renderHabitsToday?.(); window.renderHabitsAll?.(); window.renderDash?.();
  }
}

function applyLinkedSleepConfig(cfg) {
  if (cfg.targetHrs) window.toast?.(`😴 Sleep — target ${cfg.targetHrs}h`);
  else window.toast?.('😴 Log tonight\'s sleep');
}

function applyLinkedJournalConfig(cfg) {
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
  window.toast?.('⚖️ Log today\'s weight');
}

function applyLinkedMeditationConfig(cfg) {
  if (typeof window.playAmbient === 'function') window.playAmbient(cfg.sound || '');
  document.querySelectorAll('.med-sound-btn').forEach(b => b.classList.toggle('active', b.dataset.sound === (cfg.sound || '')));
  if (cfg.guidedScriptId && typeof window.selectGuided === 'function') window.selectGuided(cfg.guidedScriptId);
  else if (typeof window.clearGuided === 'function') window.clearGuided();
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

// Called by med / dw / training loggers on session save. Auto-ticks the habit,
// awards XP, refreshes UI. No-op if the flow doesn't match or has expired.
export function markHabitDoneFromFlow(kind) {
  const flow = window._ffSessionFlow;
  if (!flow || flow.kind !== kind) return false;
  if (Date.now() - (flow.setAt || 0) > FLOW_TTL_MS) { window._ffSessionFlow = null; return false; }
  const h = (S.habits || []).find(x => x.id === flow.habitId);
  if (!h) { window._ffSessionFlow = null; return false; }
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
  // Render functions live in page.js and are exposed on window at boot —
  // call via window to avoid a circular import.
  window.renderHabitsToday?.();
  window.renderHabitsAll?.();
  window.renderDash?.();
  return true;
}
