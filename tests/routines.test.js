import { describe, it, expect } from 'vitest';
import { ROUTINE_LIBRARY, getRoutine, dayLabelForDate, suggestNextWeight } from '../src/features/fitness/routines.js';

describe('training routines', () => {
  it('library contains the major built-ins', () => {
    const ids = ROUTINE_LIBRARY.map(r => r.id);
    expect(ids).toContain('r-sl5x5');
    expect(ids).toContain('r-madcow');
    expect(ids).toContain('r-ppl');
    expect(ids).toContain('r-bro');
    expect(ids).toContain('r-531bbb');
    expect(ids).toContain('r-custom');
  });
  it('each routine has 7 days in the schedule', () => {
    for (const r of ROUTINE_LIBRARY) {
      expect(Array.isArray(r.schedule)).toBe(true);
      expect(r.schedule.length).toBe(7);
    }
  });
  it('getRoutine looks up by id', () => {
    expect(getRoutine('r-sl5x5')?.name).toMatch(/StrongLifts/);
    expect(getRoutine('nope')).toBe(null);
  });
  it('dayLabelForDate maps weekdays correctly', () => {
    const sl = getRoutine('r-sl5x5');
    // Monday of any week
    const mon = new Date('2026-04-20T10:00:00');
    expect(dayLabelForDate(sl, mon)).toBe('A');
  });
  it('suggestNextWeight adds 2.5 kg on a successful linear session', () => {
    const ex = { exercise: 'Squat', sets: 5, reps: 5, start: 60 };
    const last = { exercises: [{ exercise: 'Squat', weight: 60, sets: [{ reps: 5 }, { reps: 5 }, { reps: 5 }, { reps: 5 }, { reps: 5 }] }] };
    expect(suggestNextWeight(ex, 'linear-2.5kg', last)).toBe(62.5);
  });
  it('suggestNextWeight holds weight when reps missed', () => {
    const ex = { exercise: 'Squat', sets: 5, reps: 5, start: 60 };
    const last = { exercises: [{ exercise: 'Squat', weight: 60, sets: [{ reps: 5 }, { reps: 4 }, { reps: 5 }, { reps: 5 }, { reps: 5 }] }] };
    expect(suggestNextWeight(ex, 'linear-2.5kg', last)).toBe(60);
  });
});
