import { describe, it, expect } from 'vitest';
import { migrate_1_to_2, migrate, detectVersion } from '../src/core/migrations.js';
import { SCHEMA_VERSION, defaultState } from '../src/core/schema.js';

// Realistic v1 fixture resembling the user's real ff7 blob.
const v1Fixture = {
  profile: {
    name: 'Matt', weight: '82', wake: '06:30', bed: '22:30',
    sleepNow: 7, sleepTarget: 8,
    trainRoutines: [{ id: 'r1', name: 'Morning run', icon: '🏃', start: '07:00', end: '07:30', days: ['Monday','Wednesday','Friday'], notes: '' }],
    posHabits: ['Daily exercise','Journaling'], negHabits: ['Doom scrolling'],
    posCustom: 'Write code\nStretch', negCustom: 'Late snacks',
    goals: 'Run a marathon', diet: 'balanced', allergies: '', meals: 3,
  },
  habits: [
    { id: 'h1', name: 'Read 30 mins', block: 'evening', icon: '📖' },
    { id: 'h2', name: 'Meditate', block: 'morning', icon: '🧘' },
  ],
  habitLog: { '2026-04-19': { h1: true, h2: true }, '2026-04-20': { h1: true } },
  chores: [{ id: 'c1', name: 'Laundry', day: 'Sunday' }],
  choreLog: { '2026-04-14': { c1: true } },
  choreDayOpen: { Monday: true },
  projects: [{ id: 'p1', name: 'FocusFlow v2', category: 'work', color: 'violet' }],
  tasks: [
    { id: 't1', projectId: 'p1', name: 'Phase 1', done: true, priority: 'high' },
    { id: 't2', projectId: 'p1', name: 'Phase 2', done: false, priority: 'high', due: '2026-05-01' },
  ],
  goals: [{ id: 'g1', name: 'Ship v2', category: 'career', targetDate: '2026-12-31', milestones: [{ text: 'Migrations', done: true }, { text: 'Fitness module', done: false }], open: true }],
  deepwork: {
    target: 4,
    sessions: [{ date: '2026-04-20', min: 50, label: 'Phase 2 work', ts: 1713600000000 }],
    presets: [{ id: 'p1', label: 'Pomodoro', mins: 25, icon: '🍅' }],
  },
  meditation: {
    target: 10,
    sessions: [{ date: '2026-04-19', min: 10, sound: 'rain' }],
    savedTimers: [{ id: 's1', name: 'Morning sit', min: 10, sound: 'brown' }],
    breathPresets: [{ id: 'b1', name: 'Box 4', phases: [4,4,4,4] }],
  },
  shopping: [{ id: 'sh1', name: 'Oats', category: 'Grains & Carbs', checked: false, qty: '1kg' }],
  journal: [{ id: 'j1', habitId: 'Doom scrolling', type: 'avoided', datetime: '2026-04-20T21:00', text: 'No phone before bed' }],
  customCats: { shop: ['Cleaning'], proj: [], goal: [] },
  settings: { theme: 'dark', aiEnabled: true },
};

describe('migrate_1_to_2', () => {
  it('adds meta with schemaVersion 2', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.meta.schemaVersion).toBe(2);
    expect(v2.meta.createdAt).toBeTruthy();
    expect(v2.meta.lastMigrationAt).toBeTruthy();
  });

  it('preserves profile fields verbatim', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.profile.name).toBe('Matt');
    expect(v2.profile.trainRoutines).toEqual(v1Fixture.profile.trainRoutines);
    expect(v2.profile.posHabits).toEqual(['Daily exercise','Journaling']);
  });

  it('adds mode="binary" to all habits, keeping original fields', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.habits).toHaveLength(2);
    expect(v2.habits[0].mode).toBe('binary');
    expect(v2.habits[0].name).toBe('Read 30 mins');
    expect(v2.habits[1].icon).toBe('🧘');
  });

  it('preserves habitLog and choreLog structure losslessly', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.habitLog).toEqual(v1Fixture.habitLog);
    expect(v2.choreLog).toEqual(v1Fixture.choreLog);
  });

  it('tasks gain goalId=null and accruedMinutes=0 by default', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.tasks[0].goalId).toBeNull();
    expect(v2.tasks[0].accruedMinutes).toBe(0);
    expect(v2.tasks[1].priority).toBe('high');
    expect(v2.tasks[1].due).toBe('2026-05-01');
  });

  it('goals gain rootTaskId=null, preserve milestones', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.goals[0].rootTaskId).toBeNull();
    expect(v2.goals[0].milestones).toHaveLength(2);
    expect(v2.goals[0].milestones[0].done).toBe(true);
  });

  it('adds empty fitness slice', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.fitness).toEqual({ modalities: [], sessions: [], prs: [] });
  });

  it('preserves existing fitness data when present', () => {
    const input = { ...v1Fixture, fitness: { modalities: [{ id: 'm1', name: 'Running' }], sessions: [{ date: '2026-04-20', modality: 'm1', distance: 5 }], prs: [] } };
    const v2 = migrate_1_to_2(input);
    expect(v2.fitness.modalities).toHaveLength(1);
    expect(v2.fitness.sessions[0].distance).toBe(5);
  });

  it('settings gains incrementalHabits, passcodeHash, passcodeSalt', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.settings.incrementalHabits).toBe(false);
    expect(v2.settings.passcodeHash).toBeNull();
    expect(v2.settings.passcodeSalt).toBeNull();
    expect(v2.settings.aiEnabled).toBe(true);   // preserved
    expect(v2.settings.theme).toBe('dark');     // preserved
  });

  it('preserves deepwork sessions and presets', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.deepwork.sessions[0].label).toBe('Phase 2 work');
    expect(v2.deepwork.presets[0].id).toBe('p1');
  });

  it('restores default presets if input has none', () => {
    const input = { ...v1Fixture, deepwork: { target: 4, sessions: [], presets: [] } };
    const v2 = migrate_1_to_2(input);
    expect(v2.deepwork.presets.length).toBeGreaterThan(0);
  });

  it('preserves meditation savedTimers and breathPresets', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.meditation.savedTimers[0].name).toBe('Morning sit');
    expect(v2.meditation.breathPresets[0].phases).toEqual([4,4,4,4]);
  });

  it('preserves journal entries verbatim', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.journal).toHaveLength(1);
    expect(v2.journal[0].type).toBe('avoided');
    expect(v2.journal[0].text).toBe('No phone before bed');
  });

  it('preserves customCats', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.customCats.shop).toEqual(['Cleaning']);
  });

  it('is idempotent via round-trip through migrate()', () => {
    const once = migrate(v1Fixture, 1);
    const twice = migrate(once, 2);
    expect(twice).toEqual(once);
  });

  it('handles empty/missing input without throwing', () => {
    expect(() => migrate_1_to_2(null)).not.toThrow();
    expect(() => migrate_1_to_2({})).not.toThrow();
    const v2 = migrate_1_to_2({});
    expect(v2.habits).toEqual([]);
    expect(v2.fitness).toEqual({ modalities: [], sessions: [], prs: [] });
  });

  it('coerces wrong types back to arrays', () => {
    const broken = { habits: null, tasks: 'oops', goals: undefined, shopping: 42 };
    const v2 = migrate_1_to_2(broken);
    expect(Array.isArray(v2.habits)).toBe(true);
    expect(Array.isArray(v2.tasks)).toBe(true);
    expect(Array.isArray(v2.goals)).toBe(true);
    expect(Array.isArray(v2.shopping)).toBe(true);
  });
});

describe('detectVersion', () => {
  it('returns 1 for legacy ff7 blob without meta', () => {
    expect(detectVersion(v1Fixture)).toBe(1);
  });
  it('returns schemaVersion when present', () => {
    expect(detectVersion({ meta: { schemaVersion: 2 } })).toBe(2);
  });
  it('returns 0 for non-object input', () => {
    expect(detectVersion(null)).toBe(0);
    expect(detectVersion('x')).toBe(0);
  });
});

describe('migrate() chain', () => {
  it('runs v1→v2 when fromVersion=1', () => {
    const out = migrate(v1Fixture, 1);
    expect(out.meta.schemaVersion).toBe(2);
  });
  it('no-op for already-current schema', () => {
    const v2 = migrate(v1Fixture, 1);
    const v2again = migrate(v2, 2);
    expect(v2again).toEqual(v2);
  });
});

describe('load→mutate→reload round-trip (schema shape)', () => {
  it('migrated v2 matches defaultState shape', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    const def = defaultState();
    // All top-level keys from defaultState exist in v2
    for (const k of Object.keys(def)) expect(v2).toHaveProperty(k);
  });

  it('SCHEMA_VERSION matches meta after migration', () => {
    const v2 = migrate_1_to_2(v1Fixture);
    expect(v2.meta.schemaVersion).toBe(SCHEMA_VERSION);
  });
});
