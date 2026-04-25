import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../src/core/state.js';
import { nextDueDate, spawnNextOccurrence, snooze } from '../src/features/projects/recurring.js';

describe('recurring tasks', () => {
  beforeEach(() => { S.tasks = []; });

  it('computes next due date for daily', () => {
    expect(nextDueDate('2026-04-25', 'daily')).toBe('2026-04-26');
  });
  it('computes next due date for weekly', () => {
    expect(nextDueDate('2026-04-25', 'weekly')).toBe('2026-05-02');
  });
  it('computes next due date for monthly across month boundary', () => {
    expect(nextDueDate('2026-01-31', 'monthly')).toMatch(/^2026-(02|03)-/);
  });
  it('spawns next occurrence with same name and project', () => {
    const t = { id: 't1', name: 'Pay rent', repeat: 'monthly', due: '2026-04-01', projectId: 'p1', priority: 'high' };
    S.tasks.push(t);
    const next = spawnNextOccurrence(t);
    expect(next).toBeTruthy();
    expect(next.name).toBe('Pay rent');
    expect(next.due).toMatch(/^2026-05-/);
    expect(next.projectId).toBe('p1');
    expect(next.done).toBe(false);
    expect(next.seriesId).toBe('t1');
  });
  it('snooze +1d pushes due forward', () => {
    const today = new Date().toISOString().slice(0, 10);
    const t = { id: 't', due: today };
    snooze(t, '+1d');
    expect(t.due).not.toBe(today);
    expect(t.due > today).toBe(true);
  });
});
