import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../src/core/state.js';
import { computeStreakWithFreeze } from '../src/features/habits/streakFreeze.js';

function dateKey(offset) { return new Date(Date.now() - offset * 864e5).toISOString().split('T')[0]; }

describe('streakFreeze', () => {
  beforeEach(() => {
    S.habits = [];
    S.habitLog = {};
  });

  it('counts a clean streak with no tokens needed', () => {
    const h = { id: 'h1', mode: 'binary', name: 'X' };
    S.habits.push(h);
    for (let i = 0; i < 5; i++) S.habitLog[dateKey(i)] = { h1: true };
    const { streak } = computeStreakWithFreeze(h);
    expect(streak).toBe(5);
  });

  it('earns a token after 14 perfect days', () => {
    const h = { id: 'h2', mode: 'binary', name: 'X' };
    S.habits.push(h);
    for (let i = 0; i < 14; i++) S.habitLog[dateKey(i)] = { h2: true };
    const { streak, tokens } = computeStreakWithFreeze(h);
    expect(streak).toBe(14);
    expect(tokens).toBeGreaterThanOrEqual(1);
  });

  it('auto-consumes a token to bridge a single miss', () => {
    const h = { id: 'h3', mode: 'binary', name: 'X', freezeTokens: 1 };
    S.habits.push(h);
    // today hit, yesterday miss, day before hit
    S.habitLog[dateKey(0)] = { h3: true };
    S.habitLog[dateKey(2)] = { h3: true };
    const { streak, tokens } = computeStreakWithFreeze(h);
    expect(streak).toBeGreaterThanOrEqual(3);
    expect(tokens).toBe(0);
  });
});
