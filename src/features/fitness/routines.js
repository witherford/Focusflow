// Built-in workout routines.
// Schedule is a 7-day array starting at Monday: each entry is a day-label or
// 'rest'. Days hold ordered exercises with default sets/reps/weight schemes.
// Progression schemes:
//   - linear-2.5kg : add 2.5 kg every successful workout (StrongLifts/Madcow)
//   - doublePr     : add reps until top of range, then add weight, reset reps
//   - manual       : user controls

export const ROUTINE_LIBRARY = [
  {
    id: 'r-sl5x5', name: 'StrongLifts 5×5', desc: '3-day full body, alternating A / B. Linear progression.',
    schedule: ['A', 'rest', 'B', 'rest', 'A', 'rest', 'rest'],
    progression: 'linear-2.5kg',
    days: {
      A: [
        { exercise: 'Squat',     sets: 5, reps: 5,  start: 40 },
        { exercise: 'Bench Press', sets: 5, reps: 5, start: 30 },
        { exercise: 'Barbell Row', sets: 5, reps: 5, start: 30 },
      ],
      B: [
        { exercise: 'Squat',           sets: 5, reps: 5, start: 40 },
        { exercise: 'Overhead Press',  sets: 5, reps: 5, start: 25 },
        { exercise: 'Deadlift',        sets: 1, reps: 5, start: 60 },
      ],
    },
  },
  {
    id: 'r-madcow', name: 'Madcow 5×5', desc: 'Intermediate progression — Heavy / Light / Medium.',
    schedule: ['Heavy', 'rest', 'Light', 'rest', 'Medium', 'rest', 'rest'],
    progression: 'manual',
    days: {
      Heavy:  [{ exercise: 'Squat', sets: 5, reps: 5, start: 60 }, { exercise: 'Bench Press', sets: 5, reps: 5, start: 50 }, { exercise: 'Barbell Row', sets: 5, reps: 5, start: 50 }],
      Light:  [{ exercise: 'Squat', sets: 4, reps: 5, start: 45 }, { exercise: 'Overhead Press', sets: 4, reps: 5, start: 30 }, { exercise: 'Deadlift', sets: 4, reps: 5, start: 80 }],
      Medium: [{ exercise: 'Squat', sets: 4, reps: 5, start: 55 }, { exercise: 'Bench Press', sets: 4, reps: 5, start: 45 }, { exercise: 'Barbell Row', sets: 4, reps: 5, start: 45 }],
    },
  },
  {
    id: 'r-ppl', name: 'Push / Pull / Legs (PPL)', desc: '3 or 6 days/week. Big-3 + accessories.',
    schedule: ['Push', 'Pull', 'Legs', 'rest', 'Push', 'Pull', 'Legs'],
    progression: 'doublePr',
    days: {
      Push: [
        { exercise: 'Bench Press',     sets: 4, reps: 8,  start: 50 },
        { exercise: 'Overhead Press',  sets: 4, reps: 8,  start: 30 },
        { exercise: 'Incline DB Press',sets: 3, reps: 10, start: 16 },
        { exercise: 'Triceps Pushdown',sets: 3, reps: 12, start: 20 },
      ],
      Pull: [
        { exercise: 'Deadlift',     sets: 3, reps: 5,  start: 80 },
        { exercise: 'Pull-ups',     sets: 4, reps: 8,  start: 0 },
        { exercise: 'Barbell Row',  sets: 4, reps: 8,  start: 50 },
        { exercise: 'Barbell Curl', sets: 3, reps: 10, start: 25 },
      ],
      Legs: [
        { exercise: 'Squat',         sets: 4, reps: 8,  start: 60 },
        { exercise: 'Romanian DL',   sets: 3, reps: 10, start: 60 },
        { exercise: 'Leg Press',     sets: 3, reps: 12, start: 100 },
        { exercise: 'Calf Raises',   sets: 4, reps: 15, start: 40 },
      ],
    },
  },
  {
    id: 'r-bro', name: 'Bro Split', desc: '5 days, body-part focus per session.',
    schedule: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'rest', 'rest'],
    progression: 'doublePr',
    days: {
      Chest:     [{ exercise: 'Bench Press', sets: 4, reps: 8, start: 50 }, { exercise: 'Incline DB Press', sets: 4, reps: 10, start: 18 }, { exercise: 'Cable Fly', sets: 3, reps: 12, start: 12 }, { exercise: 'Dips', sets: 3, reps: 10, start: 0 }],
      Back:      [{ exercise: 'Deadlift', sets: 3, reps: 5, start: 80 }, { exercise: 'Pull-ups', sets: 4, reps: 8, start: 0 }, { exercise: 'Barbell Row', sets: 4, reps: 8, start: 50 }, { exercise: 'Lat Pulldown', sets: 3, reps: 12, start: 35 }],
      Shoulders: [{ exercise: 'Overhead Press', sets: 4, reps: 8, start: 30 }, { exercise: 'Lateral Raise', sets: 4, reps: 12, start: 8 }, { exercise: 'Rear-Delt Fly', sets: 3, reps: 12, start: 8 }, { exercise: 'Face Pulls', sets: 3, reps: 15, start: 15 }],
      Arms:      [{ exercise: 'Barbell Curl', sets: 4, reps: 10, start: 25 }, { exercise: 'Skull Crushers', sets: 4, reps: 10, start: 20 }, { exercise: 'Hammer Curl', sets: 3, reps: 12, start: 10 }, { exercise: 'Triceps Pushdown', sets: 3, reps: 12, start: 25 }],
      Legs:      [{ exercise: 'Squat', sets: 4, reps: 8, start: 60 }, { exercise: 'Romanian DL', sets: 3, reps: 10, start: 60 }, { exercise: 'Leg Press', sets: 3, reps: 12, start: 100 }, { exercise: 'Leg Curl', sets: 3, reps: 12, start: 30 }],
    },
  },
  {
    id: 'r-531bbb', name: '5/3/1 BBB', desc: '4-day strength + Boring But Big assistance.',
    schedule: ['OHP', 'Deadlift', 'rest', 'Bench', 'Squat', 'rest', 'rest'],
    progression: 'manual',
    days: {
      OHP:      [{ exercise: 'Overhead Press', sets: 5, reps: 5, start: 30 }, { exercise: 'OHP (5×10 BBB)', sets: 5, reps: 10, start: 20 }, { exercise: 'Chin-ups', sets: 5, reps: 10, start: 0 }],
      Deadlift: [{ exercise: 'Deadlift', sets: 5, reps: 5, start: 80 }, { exercise: 'Deadlift (5×10 BBB)', sets: 5, reps: 10, start: 60 }, { exercise: 'Hanging Leg Raise', sets: 5, reps: 10, start: 0 }],
      Bench:    [{ exercise: 'Bench Press', sets: 5, reps: 5, start: 50 }, { exercise: 'Bench (5×10 BBB)', sets: 5, reps: 10, start: 35 }, { exercise: 'Barbell Row', sets: 5, reps: 10, start: 40 }],
      Squat:    [{ exercise: 'Squat', sets: 5, reps: 5, start: 60 }, { exercise: 'Squat (5×10 BBB)', sets: 5, reps: 10, start: 45 }, { exercise: 'Leg Curl', sets: 5, reps: 10, start: 25 }],
    },
  },
  {
    id: 'r-custom', name: 'Custom routine', desc: 'Build your own from scratch.',
    schedule: ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'],
    progression: 'manual',
    days: {},
  },
];

export const DAY_LABELS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function getRoutine(id, customRoutines = []) {
  return ROUTINE_LIBRARY.find(r => r.id === id) || customRoutines.find(r => r.id === id) || null;
}

// Returns the day-label scheduled for a given Date, or 'rest'.
export function dayLabelForDate(routine, date) {
  if (!routine || !routine.schedule) return 'rest';
  const d = date || new Date();
  // JS Date.getDay() — 0 = Sunday. Convert to Mon-first index.
  const idx = (d.getDay() + 6) % 7;
  return routine.schedule[idx] || 'rest';
}

export function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Last logged session of a routine, optionally for a specific dayLabel.
export function lastSessionOf(routineId, dayLabel, history = []) {
  let found = null;
  for (const h of history) {
    if (h.routineId !== routineId) continue;
    if (dayLabel && h.dayLabel !== dayLabel) continue;
    if (!found || h.ts > found.ts) found = h;
  }
  return found;
}

// Suggest next weight for an exercise given its progression scheme + the
// last session's outcome. Returns weight in kg.
export function suggestNextWeight(exercise, scheme, lastSession) {
  const baseStart = exercise.start || 0;
  if (!lastSession) return baseStart;
  const prev = (lastSession.exercises || []).find(e => e.exercise === exercise.exercise);
  if (!prev) return baseStart;
  const lastWeight = prev.weight || 0;
  const allHit = Array.isArray(prev.sets) && prev.sets.every(s => (s.reps || 0) >= (exercise.reps || 0));
  if (scheme === 'linear-2.5kg' && allHit) return lastWeight + 2.5;
  if (scheme === 'doublePr' && allHit) {
    // simple rep increment until +2 reps over target, then weight bump
    const repsHit = (prev.sets || []).reduce((a, s) => a + (s.reps || 0), 0);
    const target = (exercise.sets || 0) * (exercise.reps || 0);
    if (repsHit >= target + (exercise.sets || 1) * 2) return lastWeight + 2.5;
  }
  return lastWeight; // hold
}
