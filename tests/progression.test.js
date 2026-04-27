import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../src/core/state.js';
import {
  estimate1RM, calcPlates, platesString, perLiftRate,
  setStartingWeight, getStartingWeight,
  recordSessionOutcome, getConsecutiveFails,
  suggestNext,
} from '../src/features/fitness/progression.js';

describe('progression helpers', () => {
  beforeEach(() => {
    S.training = { startingWeights: {}, consecutiveFails: {} };
  });

  it('estimate1RM uses Epley', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(80, 5)).toBeCloseTo(93.3, 0);
    expect(estimate1RM(0, 5)).toBe(0);
    expect(estimate1RM(50, 0)).toBe(0);
  });

  it('plate calc breaks 100kg into per-side plates with 20kg bar', () => {
    const r = calcPlates(100, 20);
    expect(r.ok).toBe(true);
    expect(r.perSide.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it('plate calc handles odd weights with remainder', () => {
    const r = calcPlates(99, 20);
    expect(r.perSide.length).toBeGreaterThan(0);
  });

  it('platesString includes "per side" or describes the bar', () => {
    expect(platesString(20, 20)).toMatch(/bar/);
    expect(platesString(100, 20)).toMatch(/per side/);
  });

  it('perLiftRate uses StrongLifts-style defaults', () => {
    expect(perLiftRate('Squat')).toBe(5);
    expect(perLiftRate('Deadlift')).toBe(5);
    expect(perLiftRate('Bench Press')).toBe(2.5);
    expect(perLiftRate('Overhead Press')).toBe(1);
    // Unknown lift falls back
    expect(perLiftRate('Side Lunge')).toBe(2.5);
  });

  it('starting weights store + retrieve', () => {
    setStartingWeight('Squat', 60);
    expect(getStartingWeight('Squat')).toBe(60);
    expect(getStartingWeight('Mystery', 99)).toBe(99);
  });

  it('consecutive-fail tracking resets on success', () => {
    recordSessionOutcome('r-x', 'Bench', false);
    recordSessionOutcome('r-x', 'Bench', false);
    expect(getConsecutiveFails('r-x', 'Bench')).toBe(2);
    recordSessionOutcome('r-x', 'Bench', true);
    expect(getConsecutiveFails('r-x', 'Bench')).toBe(0);
  });

  it('suggestNext bumps weight on success and holds on miss', () => {
    const ex = { exercise: 'Squat', sets: 5, reps: 5, start: 60 };
    const routine = { id: 'r1', progression: 'linear-2.5kg' };
    const success = { exercises: [{ exercise: 'Squat', weight: 60, sets: [{ reps: 5 },{ reps: 5 },{ reps: 5 },{ reps: 5 },{ reps: 5 }] }] };
    expect(suggestNext(ex, routine, success).weight).toBe(65);
    const miss = { exercises: [{ exercise: 'Squat', weight: 65, sets: [{ reps: 5 },{ reps: 4 },{ reps: 3 },{ reps: 5 },{ reps: 5 }] }] };
    expect(suggestNext(ex, routine, miss).weight).toBe(65);
  });

  it('suggestNext deloads after 3 consecutive fails', () => {
    const ex = { exercise: 'Bench Press', sets: 5, reps: 5, start: 50 };
    const routine = { id: 'r-deload' };
    const miss = { exercises: [{ exercise: 'Bench Press', weight: 60, sets: [{ reps: 4 },{ reps: 3 },{ reps: 2 },{ reps: 4 },{ reps: 5 }] }] };
    suggestNext(ex, routine, miss);  // fail 1
    suggestNext(ex, routine, miss);  // fail 2
    const out = suggestNext(ex, routine, miss);  // fail 3 → deload
    expect(out.deloaded).toBe(true);
    expect(out.weight).toBeLessThan(60);
  });
});
