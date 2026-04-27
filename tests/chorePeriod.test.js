import { describe, it, expect } from 'vitest';
import { chorePeriodKey, resetCaption } from '../src/features/chores/period.js';

describe('chore periods', () => {
  it('daily key is the date itself', () => {
    expect(chorePeriodKey({ repeat: 'daily' }, new Date('2026-04-25T10:00:00'))).toBe('2026-04-25');
  });
  it('weekly key is the Monday of the week', () => {
    // Saturday 2026-04-25 → Monday 2026-04-20
    expect(chorePeriodKey({ repeat: 'weekly' }, new Date('2026-04-25T10:00:00'))).toBe('2026-04-20');
  });
  it('monthly key is YYYY-MM', () => {
    expect(chorePeriodKey({ repeat: 'monthly' }, new Date('2026-04-25T10:00:00'))).toBe('2026-04');
  });
  it('custom every-3-days produces stable keys for consecutive days within a block', () => {
    const k1 = chorePeriodKey({ repeat: 'custom', customDays: 3 }, new Date('2026-04-25T01:00:00'));
    const k2 = chorePeriodKey({ repeat: 'custom', customDays: 3 }, new Date('2026-04-25T23:00:00'));
    expect(k1).toBe(k2);
  });
  it('reset caption mentions monthly', () => {
    expect(resetCaption({ repeat: 'monthly' })).toMatch(/monthly|month/i);
  });
  it('reset override surfaces in caption', () => {
    expect(resetCaption({ resetOverride: '2026-12-01' })).toContain('2026-12-01');
  });
});
