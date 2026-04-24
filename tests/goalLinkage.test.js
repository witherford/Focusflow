import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../src/core/state.js';
import { goalProgress, linkedHabits } from '../src/features/goals/progress.js';

function dateKey(offset) { return new Date(Date.now() - offset * 864e5).toISOString().split('T')[0]; }

describe('goal progress with habit linkage', () => {
  beforeEach(() => {
    S.habits = [];
    S.habitLog = {};
    S.goals = [];
    S.tasks = [];
  });

  it('includes linked habit hit rate in goal progress', () => {
    const goal = { id: 'g1', name: 'G', milestones: [] };
    S.goals.push(goal);
    const h = { id: 'h1', name: 'h', mode: 'binary', goalId: 'g1' };
    S.habits.push(h);
    // perfect week
    for (let i = 0; i < 7; i++) S.habitLog[dateKey(i)] = { h1: true };
    expect(linkedHabits('g1')).toHaveLength(1);
    const p = goalProgress(goal);
    expect(p.pct).toBe(100);
  });

  it('zero progress when habit never met', () => {
    const goal = { id: 'g2', name: 'G', milestones: [] };
    S.goals.push(goal);
    S.habits.push({ id: 'h2', name: 'h', mode: 'binary', goalId: 'g2' });
    const p = goalProgress(goal);
    expect(p.pct).toBe(0);
  });
});
