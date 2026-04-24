// Schema migrations — pure functions, unit-tested
import { SCHEMA_VERSION, defaultState } from './schema.js';

// v1 (legacy `ff7` blob) → v2 (sliced schema with meta, fitness, new fields)
export function migrate_1_to_2(v1) {
  const now = new Date().toISOString();
  const base = defaultState();
  const src = v1 || {};

  return {
    meta: { schemaVersion: 2, createdAt: src.meta?.createdAt || now, lastMigrationAt: now },
    profile: { ...base.profile, ...(src.profile || {}) },
    habits: (src.habits || []).map(h => ({ mode: 'binary', journalPrompt: true, ...h })),
    habitLog: src.habitLog && typeof src.habitLog === 'object' ? src.habitLog : {},
    chores: Array.isArray(src.chores) ? src.chores : [],
    choreLog: src.choreLog && typeof src.choreLog === 'object' ? src.choreLog : {},
    choreDayOpen: src.choreDayOpen || {},
    projects: Array.isArray(src.projects) ? src.projects : [],
    tasks: (Array.isArray(src.tasks) ? src.tasks : []).map(t => ({ goalId: null, accruedMinutes: 0, ...t })),
    goals: (Array.isArray(src.goals) ? src.goals : []).map(g => ({ rootTaskId: null, ...g })),
    deepwork: {
      target: src.deepwork?.target ?? 4,
      sessions: Array.isArray(src.deepwork?.sessions) ? src.deepwork.sessions : [],
      presets: Array.isArray(src.deepwork?.presets) && src.deepwork.presets.length ? src.deepwork.presets : base.deepwork.presets,
    },
    meditation: {
      target: src.meditation?.target ?? 10,
      sessions: Array.isArray(src.meditation?.sessions) ? src.meditation.sessions : [],
      savedTimers: Array.isArray(src.meditation?.savedTimers) ? src.meditation.savedTimers : [],
      breathPresets: Array.isArray(src.meditation?.breathPresets) ? src.meditation.breathPresets : [],
    },
    fitness: {
      modalities: Array.isArray(src.fitness?.modalities) ? src.fitness.modalities : [],
      sessions: Array.isArray(src.fitness?.sessions) ? src.fitness.sessions : [],
      prs: Array.isArray(src.fitness?.prs) ? src.fitness.prs : [],
    },
    shopping: Array.isArray(src.shopping) ? src.shopping : [],
    journal: Array.isArray(src.journal) ? src.journal : [],
    customCats: {
      shop: Array.isArray(src.customCats?.shop) ? src.customCats.shop : [],
      proj: Array.isArray(src.customCats?.proj) ? src.customCats.proj : [],
      goal: Array.isArray(src.customCats?.goal) ? src.customCats.goal : [],
    },
    settings: { ...base.settings, ...(src.settings || {}) },
  };
}

// Chain — run every applicable migration in order up to SCHEMA_VERSION
export function migrate(state, fromVersion) {
  let s = state, v = fromVersion;
  if (v < 2) { s = migrate_1_to_2(s); v = 2; }
  // Future: if (v < 3) { s = migrate_2_to_3(s); v = 3; }
  if (v !== SCHEMA_VERSION) console.warn(`Migration stopped at v${v}, target v${SCHEMA_VERSION}`);
  return s;
}

// Detect schema version of an unknown blob
export function detectVersion(blob) {
  if (!blob || typeof blob !== 'object') return 0;
  return blob.meta?.schemaVersion || 1;
}
