import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../src/core/state.js';
import { habitCompletionByWeek, dwMinutesByDay, weekSummary } from '../src/features/insights/trends.js';

function dateKey(offset) { return new Date(Date.now() - offset * 864e5).toISOString().split('T')[0]; }

describe('insights trends', () => {
  beforeEach(() => {
    S.habits = [{ id: 'a', mode: 'binary', name: 'A' }];
    S.habitLog = {};
    S.deepwork = { target: 4, sessions: [], presets: [] };
    S.meditation = { target: 10, sessions: [], savedTimers: [], breathPresets: [] };
    S.tasks = [];
    S.journal = [];
  });

  it('computes habit completion by week', () => {
    for (let i = 0; i < 7; i++) S.habitLog[dateKey(i)] = { a: true };
    const data = habitCompletionByWeek(1);
    expect(data).toHaveLength(1);
    expect(data[0].pct).toBe(100);
  });

  it('aggregates deepwork minutes by day', () => {
    S.deepwork.sessions.push({ date: dateKey(0), min: 45 });
    const data = dwMinutesByDay(3);
    expect(data[data.length - 1].min).toBe(45);
  });

  it('builds a week summary', () => {
    for (let i = 0; i < 7; i++) S.habitLog[dateKey(i)] = { a: true };
    S.deepwork.sessions.push({ date: dateKey(0), min: 60 });
    S.meditation.sessions.push({ date: dateKey(0), min: 10 });
    S.tasks.push({ id: 't', name: 't', done: true, doneAt: dateKey(0) });
    const s = weekSummary();
    expect(s.habits.pct).toBe(100);
    expect(s.dwMin).toBe(60);
    expect(s.medMin).toBe(10);
    expect(s.tasks).toBe(1);
  });
});
