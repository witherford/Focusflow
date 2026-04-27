// Progressive overload, deload tracking, 1RM estimation, plate math.
import { S } from '../../core/state.js';

// ── Defaults ────────────────────────────────────────────────────────────────
// Per-lift increment in kg, applied when the previous session hit all reps.
// Smaller increments for the upper-body lifts; larger for the legs / pull.
// Falls through to DEFAULT_RATE if no exact match.
export const DEFAULT_RATES = {
  'Squat': 5, 'Deadlift': 5, 'Romanian DL': 5, 'Romanian Deadlift': 5,
  'Bench Press': 2.5, 'Barbell Row': 2.5, 'Pendlay Row': 2.5,
  'Overhead Press': 1.0, 'OHP': 1.0,
  'Incline DB Press': 1.0, 'Lateral Raise': 1.0, 'Curl': 1.0, 'Barbell Curl': 1.0,
  'Triceps Pushdown': 1.0, 'Skull Crushers': 1.0,
};
export const DEFAULT_RATE = 2.5;

// Standard plate set on each side (kg). User can override per-routine later.
export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

const DELOAD_THRESHOLD = 3;     // consecutive fails before a deload
const DELOAD_FACTOR = 0.9;      // drop to 90 % of failed weight

// ── Starting weights ────────────────────────────────────────────────────────
function ensureStarting() {
  if (!S.training) S.training = {};
  if (!S.training.startingWeights) S.training.startingWeights = {};
  return S.training.startingWeights;
}

export function setStartingWeight(exercise, kg) {
  const sw = ensureStarting();
  const v = parseFloat(kg);
  if (!isFinite(v) || v < 0) return;
  sw[exercise] = v;
}

export function getStartingWeight(exercise, fallback = 0) {
  const sw = ensureStarting();
  if (sw[exercise] != null) return sw[exercise];
  return fallback;
}

// Set of "compound" lifts the wizard prompts for. Aliases reduce duplication.
export const COMPOUND_LIFTS = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row'];

// ── Deload tracking ─────────────────────────────────────────────────────────
// Key by `${routineId}:${exercise}` → integer count of consecutive fails.
function ensureFails() {
  if (!S.training) S.training = {};
  if (!S.training.consecutiveFails) S.training.consecutiveFails = {};
  return S.training.consecutiveFails;
}

export function failKey(routineId, exercise) {
  return `${routineId || '_'}:${exercise || '_'}`;
}

export function getConsecutiveFails(routineId, exercise) {
  return ensureFails()[failKey(routineId, exercise)] || 0;
}

export function recordSessionOutcome(routineId, exercise, success) {
  const fails = ensureFails();
  const k = failKey(routineId, exercise);
  if (success) fails[k] = 0;
  else fails[k] = (fails[k] || 0) + 1;
  return fails[k];
}

// ── Progression suggestion ──────────────────────────────────────────────────
// Returns { weight, deloaded, reason } for the next session of `exerciseSpec`
// (the routine's plan entry: { exercise, sets, reps, start }).
// `lastSession` is the most recent training history entry for that day-label.
// `routine` is the active routine (for progression scheme + per-lift overrides).
export function suggestNext(exerciseSpec, routine, lastSession) {
  const exName = exerciseSpec.exercise;
  const startSeed = getStartingWeight(exName, exerciseSpec.start || 0);
  if (!lastSession) return { weight: startSeed, deloaded: false, reason: 'starting' };
  const prev = (lastSession.exercises || []).find(e => e.exercise === exName);
  if (!prev) return { weight: startSeed, deloaded: false, reason: 'no-prev' };
  const lastWeight = prev.weight || startSeed;

  const targetReps = exerciseSpec.reps || 0;
  const targetSets = exerciseSpec.sets || 0;
  const completedSets = (prev.sets || []).filter(s => (s.reps || 0) >= targetReps).length;
  const allHit = targetSets > 0 && completedSets >= targetSets;

  const fails = recordSessionOutcome(routine?.id, exName, allHit);
  if (allHit) {
    const inc = perLiftRate(exName, routine);
    return { weight: lastWeight + inc, deloaded: false, reason: 'progress' };
  }
  if (fails >= DELOAD_THRESHOLD) {
    // Deload: drop to 90 % rounded to the nearest 2.5 kg, reset fail count.
    const dl = roundDown(lastWeight * DELOAD_FACTOR, 2.5);
    ensureFails()[failKey(routine?.id, exName)] = 0;
    return { weight: Math.max(0, dl), deloaded: true, reason: `deload after ${fails} fails` };
  }
  return { weight: lastWeight, deloaded: false, reason: `hold (${fails}/${DELOAD_THRESHOLD} fails)` };
}

function roundDown(v, step) { return Math.floor(v / step) * step; }

export function perLiftRate(exercise, routine) {
  const explicit = routine?.rates?.[exercise];
  if (typeof explicit === 'number') return explicit;
  if (DEFAULT_RATES[exercise] != null) return DEFAULT_RATES[exercise];
  // Fuzzy match — if exercise contains a known compound name
  for (const k of Object.keys(DEFAULT_RATES)) {
    if (exercise.toLowerCase().includes(k.toLowerCase())) return DEFAULT_RATES[k];
  }
  return DEFAULT_RATE;
}

// ── 1RM estimator (Epley) ───────────────────────────────────────────────────
// 1RM ≈ weight × (1 + reps/30). Falls back to 0 for unworkable inputs.
export function estimate1RM(weight, reps) {
  weight = parseFloat(weight) || 0; reps = parseInt(reps) || 0;
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// Top set 1RM across all exercises in a session.
export function bestSet1RM(exercises) {
  let best = { exercise: '', e1rm: 0, weight: 0, reps: 0 };
  for (const ex of (exercises || [])) {
    for (const s of (ex.sets || [])) {
      const e = estimate1RM(s.weight || 0, s.reps || 0);
      if (e > best.e1rm) best = { exercise: ex.exercise, e1rm: e, weight: s.weight || 0, reps: s.reps || 0 };
    }
  }
  return best;
}

// ── Plate calculator ────────────────────────────────────────────────────────
// Greedy split of (target - bar) / 2 into available plates.
// Returns { ok, perSide: [25, 10, 2.5], remainder }.
export function calcPlates(target, bar = DEFAULT_BAR_KG, plates = DEFAULT_PLATES) {
  target = parseFloat(target) || 0;
  if (target <= bar) return { ok: target === bar, perSide: [], remainder: 0 };
  let need = (target - bar) / 2;
  const perSide = [];
  for (const p of plates) {
    while (need >= p - 1e-9) {
      perSide.push(p); need = Math.round((need - p) * 1000) / 1000;
    }
  }
  return { ok: Math.abs(need) < 1e-6, perSide, remainder: need };
}

export function platesString(target, bar = DEFAULT_BAR_KG, plates = DEFAULT_PLATES) {
  const r = calcPlates(target, bar, plates);
  if (target <= bar) return target === bar ? `bar (${bar} kg)` : `${target} kg`;
  if (!r.perSide.length) return `${target} kg`;
  const counts = {};
  for (const p of r.perSide) counts[p] = (counts[p] || 0) + 1;
  const parts = Object.entries(counts).map(([k, n]) => n > 1 ? `${k}×${n}` : `${k}`).join(' + ');
  return `${parts} per side` + (r.ok ? '' : ` (≈, ${r.remainder.toFixed(2)} kg short)`);
}
