// Workout logger — opens a modal pre-filled from the active routine's "today"
// (or a chosen day label), records sets per exercise, then writes to both
// S.training.history and S.fitness.sessions.
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { ROUTINE_LIBRARY, getRoutine, dayLabelForDate, lastSessionOf, suggestNextWeight } from './routines.js';

let _state = { routineId: null, dayLabel: null, exercises: [] };

function ensureTraining() {
  if (!S.training) S.training = { activeRoutineId: null, customRoutines: [], history: [], autoHabit: true };
  if (!Array.isArray(S.training.customRoutines)) S.training.customRoutines = [];
  if (!Array.isArray(S.training.history)) S.training.history = [];
  return S.training;
}

export function activeRoutine() {
  const t = ensureTraining();
  return getRoutine(t.activeRoutineId, t.customRoutines);
}

export function activateRoutine(id) {
  const t = ensureTraining();
  t.activeRoutineId = id;
  save();
  // Optional auto-habit creation — prompt once per activation.
  if (t.autoHabit !== false && !t._habitsCreatedFor?.includes(id)) {
    if (confirm('Create matching daily habits for each scheduled training day?')) {
      createTrainingHabits(id);
      t._habitsCreatedFor = [...(t._habitsCreatedFor || []), id];
      save();
    }
  }
  window.toast?.('Routine activated ✓');
  window.renderTraining?.();
}

function createTrainingHabits(routineId) {
  const r = getRoutine(routineId, S.training.customRoutines); if (!r) return;
  const seen = new Set();
  for (const dl of r.schedule) {
    if (dl === 'rest' || seen.has(dl)) continue;
    seen.add(dl);
    if (!S.habits.find(h => h._trainingDay === dl && h._routineId === routineId)) {
      S.habits.push({
        id: uid(),
        name: `Train · ${r.name} (${dl})`,
        block: 'afternoon',
        icon: '🏋️',
        mode: 'binary',
        _trainingDay: dl,
        _routineId: routineId,
      });
    }
  }
  save();
}

// ── Logger UI ────────────────────────────────────────────────────────────────
export function openWorkoutLogger(forcedDayLabel) {
  ensureTraining();
  const r = activeRoutine();
  if (!r) { window.toast?.('Activate a routine first'); return; }
  const dl = forcedDayLabel || dayLabelForDate(r, new Date());
  if (dl === 'rest') {
    if (!confirm('Today is a rest day in this routine. Log a workout anyway?')) return;
  }
  const dayPlan = r.days?.[dl] || [];
  const last = lastSessionOf(r.id, dl, S.training.history);
  _state = {
    routineId: r.id,
    dayLabel: dl === 'rest' ? Object.keys(r.days || {})[0] || 'A' : dl,
    exercises: dayPlan.map(ex => {
      const suggested = suggestNextWeight(ex, r.progression, last);
      return {
        exercise: ex.exercise,
        targetSets: ex.sets,
        targetReps: ex.reps,
        weight: suggested,
        sets: Array.from({ length: ex.sets }, () => ({ reps: ex.reps, weight: suggested, done: false })),
      };
    }),
  };
  ensureLoggerModal();
  renderLoggerModal();
  document.getElementById('m-workout').style.display = 'flex';
}

function ensureLoggerModal() {
  if (document.getElementById('m-workout')) return;
  const html = `<div class="modal-overlay" id="m-workout" style="display:none"><div class="modal" style="max-width:540px">
    <div class="modal-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="modal-title" id="wo-title" style="margin:0">Workout</div>
      <span style="font-size:11px;color:var(--text3)" id="wo-meta"></span>
    </div>
    <div id="wo-exercises" style="display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow-y:auto"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-primary" style="flex:1" onclick="saveWorkout()">💾 Save workout</button>
      <button class="btn" onclick="closeModal('m-workout')">Cancel</button>
    </div>
  </div></div>`;
  const wrap = document.createElement('div'); wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
}

function renderLoggerModal() {
  const r = activeRoutine();
  document.getElementById('wo-title').textContent = `${r?.name || 'Workout'} · ${_state.dayLabel}`;
  document.getElementById('wo-meta').textContent = today();
  const wrap = document.getElementById('wo-exercises');
  wrap.innerHTML = _state.exercises.map((ex, i) => `
    <div class="wo-exercise">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-weight:600">${ex.exercise}</span>
        <span style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">${ex.targetSets}×${ex.targetReps}</span>
        <span style="flex:1"></span>
        <input type="number" step="0.5" inputmode="decimal" value="${ex.weight}" oninput="setExerciseWeight(${i}, this.value)" style="width:80px;font-family:'DM Mono',monospace" placeholder="kg">
        <span style="font-size:11px;color:var(--text3)">kg</span>
      </div>
      <div class="wo-sets" style="display:flex;flex-wrap:wrap;gap:6px">
        ${ex.sets.map((s, j) => `
          <button class="wo-set ${s.done ? 'done' : ''}" onclick="toggleWorkoutSet(${i},${j})">
            <span class="wo-set-reps">${s.reps}</span>
          </button>
        `).join('')}
        <button class="wo-set wo-set-add" onclick="addWorkoutSet(${i})">+</button>
      </div>
    </div>
  `).join('') || '<div class="caption" style="text-align:center;padding:14px">No exercises planned for this day. Edit the routine in Settings → Routines (coming).</div>';
}

export function setExerciseWeight(idx, val) {
  const ex = _state.exercises[idx]; if (!ex) return;
  const v = parseFloat(val) || 0;
  ex.weight = v;
  // Also update each set's weight (user can override per-set later via long-press if we add it).
  ex.sets.forEach(s => { if (!s.done) s.weight = v; });
}

export function toggleWorkoutSet(i, j) {
  const ex = _state.exercises[i]; if (!ex) return;
  const s = ex.sets[j]; if (!s) return;
  s.done = !s.done;
  if (s.done) { s.weight = ex.weight; s.reps = s.reps || ex.targetReps; haptic('light'); }
  renderLoggerModal();
}

export function addWorkoutSet(i) {
  const ex = _state.exercises[i]; if (!ex) return;
  ex.sets.push({ reps: ex.targetReps, weight: ex.weight, done: false });
  renderLoggerModal();
}

export function saveWorkout() {
  ensureTraining();
  const r = activeRoutine(); if (!r) return;
  const completed = _state.exercises.filter(ex => ex.sets.some(s => s.done));
  if (!completed.length) { window.toast?.('Mark at least one set as done'); return; }
  const sessionEntry = {
    id: uid(),
    routineId: r.id,
    dayLabel: _state.dayLabel,
    date: today(),
    ts: Date.now(),
    exercises: _state.exercises.map(ex => ({
      exercise: ex.exercise,
      weight: ex.weight,
      sets: ex.sets.filter(s => s.done).map(s => ({ reps: s.reps, weight: s.weight })),
    })),
  };
  S.training.history.push(sessionEntry);

  // Also push a summary to S.fitness.sessions so the existing log + Insights pick it up.
  if (!S.fitness) S.fitness = { modalities: [], sessions: [], prs: [] };
  const totalSets = sessionEntry.exercises.reduce((a, e) => a + e.sets.length, 0);
  const totalReps = sessionEntry.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.reps || 0), 0), 0);
  const heaviest = sessionEntry.exercises.reduce((mx, e) => Math.max(mx, e.weight || 0), 0);
  const volume = sessionEntry.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.reps || 0) * (s.weight || 0), 0), 0);
  S.fitness.sessions.push({
    id: uid(),
    modId: '_training_' + r.id,
    type: 'weightlifting',
    date: today(),
    ts: Date.now(),
    sets: totalSets,
    reps: totalReps,
    weight: heaviest,
    volume,
    notes: `${r.name} · ${_state.dayLabel}`,
    routineId: r.id, dayLabel: _state.dayLabel,
  });

  // PR per exercise (heaviest weight at any rep count)
  if (!Array.isArray(S.fitness.prs)) S.fitness.prs = [];
  for (const e of sessionEntry.exercises) {
    const topSet = (e.sets || []).reduce((mx, s) => ((s.weight || 0) > (mx?.weight || 0) ? s : mx), null);
    if (!topSet) continue;
    const prior = S.fitness.prs.filter(p => p.exercise === e.exercise && p.reps === topSet.reps);
    const max = prior.reduce((mx, p) => Math.max(mx, p.weight || 0), 0);
    if ((topSet.weight || 0) > max) {
      S.fitness.prs.push({ exercise: e.exercise, reps: topSet.reps, weight: topSet.weight, date: today(), routineId: r.id });
      window.toast?.(`🏆 PR: ${e.exercise} ${topSet.weight}kg × ${topSet.reps}`);
    }
  }

  // Tick the training habit for today (if any).
  const dl = _state.dayLabel;
  const trHabit = S.habits.find(h => h._routineId === r.id && h._trainingDay === dl);
  if (trHabit) {
    if (!S.habitLog[today()]) S.habitLog[today()] = {};
    S.habitLog[today()][trHabit.id] = true;
  }

  // Accrue minutes to a linked training goal (best-effort: the first goal with category 'training' or matching routineId).
  const linkedGoal = (S.goals || []).find(g => g.category === 'training' || g._routineId === r.id);
  if (linkedGoal) {
    // Estimate minutes from set count (90s/set average).
    const minutes = Math.max(5, Math.round(totalSets * 1.5));
    linkedGoal.accruedMinutes = (linkedGoal.accruedMinutes || 0) + minutes;
  }

  save();
  window.awardXP?.('fitSession');
  window.closeModal?.('m-workout');
  window.toast?.('Workout saved ✓');
  window.renderTraining?.();
  window.renderDash?.();
}

if (typeof window !== 'undefined') {
  window.openWorkoutLogger = openWorkoutLogger;
  window.saveWorkout = saveWorkout;
  window.toggleWorkoutSet = toggleWorkoutSet;
  window.addWorkoutSet = addWorkoutSet;
  window.setExerciseWeight = setExerciseWeight;
  window.activateRoutine = activateRoutine;
  window.activeRoutine = activeRoutine;
}
