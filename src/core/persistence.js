// Persistence — Phase 2: sliced schema v2, localStorage (core) + IDB (large buckets)
import { S } from './state.js';
import { toast } from '../ui/toast.js';
import {
  SCHEMA_VERSION, KEY_LEGACY, KEY_BACKUP, KEY_CORE,
  IDB_HABIT_LOG, IDB_CHORE_LOG, IDB_DW_SESSIONS, IDB_MED_SESSIONS, IDB_FIT_SESSIONS, IDB_JOURNAL,
  defaultState,
} from './schema.js';
import { idbGet, idbSet, idbClearAll } from './idb.js';
import { migrate, detectVersion } from './migrations.js';

let _saveT = null, _dotHideT = null;

// ── Autosave dot ─────────────────────────────────────────────────────────────
export function showAutosaveDot(state) {
  const wrap = document.getElementById('autosaveDot');
  const dot = document.getElementById('autosaveDotInner');
  const lbl = document.getElementById('autosaveLabel');
  if (!wrap) return;
  clearTimeout(_dotHideT);
  wrap.classList.add('visible');
  if (state === 'saving') { dot.className = 'autosave-dot saving'; lbl.textContent = 'Saving…'; }
  else { dot.className = 'autosave-dot saved'; lbl.textContent = 'Saved'; _dotHideT = setTimeout(() => wrap.classList.remove('visible'), 3000); }
}
export function showSave() { showAutosaveDot('saved'); }

// ── Core/bucket split ────────────────────────────────────────────────────────
// Core (localStorage): everything except high-volume append-only arrays.
// Buckets (IDB): habitLog, choreLog, dw/med/fit sessions, journal.
function extractCore(state) {
  return {
    meta: state.meta,
    profile: state.profile,
    habits: state.habits,
    chores: state.chores,
    choreDayOpen: state.choreDayOpen,
    projects: state.projects,
    tasks: state.tasks,
    goals: state.goals,
    deepwork: { target: state.deepwork?.target ?? 4, presets: state.deepwork?.presets || [] },
    meditation: {
      target: state.meditation?.target ?? 10,
      savedTimers: state.meditation?.savedTimers || [],
      breathPresets: state.meditation?.breathPresets || [],
    },
    fitness: { modalities: state.fitness?.modalities || [], prs: state.fitness?.prs || [] },
    shopping: state.shopping,
    customCats: state.customCats,
    settings: state.settings,
    checkins: state.checkins || {},
    gamification: state.gamification || null,
    bodyMeasurements: state.bodyMeasurements || [],
    sleepLog: state.sleepLog || [],
    training: state.training || null,
    badHabitLog: state.badHabitLog || {},
    sleepHabitLog: state.sleepHabitLog || {},
    meds: state.meds || [],
    medGroups: state.medGroups || [],
    medLog: state.medLog || {},
    diet: state.diet || { goal: 'maintain', calorieAdjust: 0, manualTDEEOverride: null, log: {} },
    dietGroups: state.dietGroups || [],
    meals: state.meals || [],
  };
}

function mergeCore(core) {
  Object.assign(S, {
    meta: core.meta,
    profile: core.profile,
    habits: core.habits,
    badHabitLog: core.badHabitLog || {},
    sleepHabitLog: core.sleepHabitLog || {},
    chores: core.chores,
    choreDayOpen: core.choreDayOpen,
    projects: core.projects,
    tasks: core.tasks,
    goals: core.goals,
    shopping: core.shopping,
    customCats: core.customCats,
    settings: core.settings,
    checkins: core.checkins || {},
    gamification: core.gamification || null,
    bodyMeasurements: core.bodyMeasurements || [],
    sleepLog: core.sleepLog || [],
    training: core.training || null,
    meds: core.meds || [],
    medGroups: core.medGroups || [],
    medLog: core.medLog || {},
    diet: core.diet || { goal: 'maintain', calorieAdjust: 0, manualTDEEOverride: null, log: {} },
    dietGroups: core.dietGroups || [],
    meals: core.meals || [],
  });
  // Merge into existing nested objects so we don't clobber sessions arrays
  S.deepwork = { ...S.deepwork, target: core.deepwork.target, presets: core.deepwork.presets };
  S.meditation = { ...S.meditation, target: core.meditation.target, savedTimers: core.meditation.savedTimers, breathPresets: core.meditation.breathPresets };
  S.fitness = { ...(S.fitness || { sessions: [] }), modalities: core.fitness.modalities, prs: core.fitness.prs };
}

// ── Load ─────────────────────────────────────────────────────────────────────
export async function load() {
  try {
    const rawV2 = localStorage.getItem(KEY_CORE);
    if (rawV2) {
      const core = JSON.parse(rawV2);
      mergeCore(core);
      await loadBuckets();
      return { migrated: false, fresh: false };
    }
    // No v2 — look for v1 legacy blob
    const rawV1 = localStorage.getItem(KEY_LEGACY);
    if (rawV1) {
      localStorage.setItem(KEY_BACKUP, rawV1);        // never delete ff7, but keep explicit .bak
      const v1 = JSON.parse(rawV1);
      const v2 = migrate(v1, detectVersion(v1));
      await writeAll(v2);
      mergeCore(extractCore(v2));
      S.habitLog = v2.habitLog || {};
      S.choreLog = v2.choreLog || {};
      S.deepwork.sessions = v2.deepwork.sessions || [];
      S.meditation.sessions = v2.meditation.sessions || [];
      S.fitness.sessions = v2.fitness.sessions || [];
      S.journal = v2.journal || [];
      console.log('%cFocusFlow migrated ff7 → v2', 'color:#ffa040;font-weight:bold');
      return { migrated: true, fresh: false };
    }
    // Fresh install — S already holds defaults (from state.js)
    const d = defaultState();
    Object.assign(S, d);
    return { migrated: false, fresh: true };
  } catch (e) {
    console.error('load failed', e);
    toast('Load error — using defaults');
    Object.assign(S, defaultState());
    return { migrated: false, fresh: true, error: e };
  }
}

async function loadBuckets() {
  const [habitLog, choreLog, dwSessions, medSessions, fitSessions, journal] = await Promise.all([
    idbGet(IDB_HABIT_LOG, {}),
    idbGet(IDB_CHORE_LOG, {}),
    idbGet(IDB_DW_SESSIONS, []),
    idbGet(IDB_MED_SESSIONS, []),
    idbGet(IDB_FIT_SESSIONS, []),
    idbGet(IDB_JOURNAL, []),
  ]);
  S.habitLog = habitLog;
  S.choreLog = choreLog;
  S.deepwork.sessions = dwSessions;
  S.meditation.sessions = medSessions;
  if (!S.fitness) S.fitness = { modalities:[], sessions:[], prs:[] };
  S.fitness.sessions = fitSessions;
  // If journal is encrypted, leave S.journal empty until user unlocks.
  const encrypted = !!(S.settings && S.settings.passcodeSalt && S.settings.passcodeVerifier);
  S.journal = encrypted ? [] : journal;
}

// ── Save ─────────────────────────────────────────────────────────────────────
// Debounced: multiple rapid save() calls coalesce into one flush.
export function save() {
  showAutosaveDot('saving');
  clearTimeout(_saveT);
  _saveT = setTimeout(flushNow, 400);
}

async function flushNow() {
  try {
    await writeAll(S);
    showAutosaveDot('saved');
  } catch (e) {
    console.error('save failed', e);
    toast('Save error');
  }
}

async function writeAll(state) {
  const core = extractCore(state);
  // Ensure meta present
  if (!core.meta) core.meta = { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), lastMigrationAt: null };
  localStorage.setItem(KEY_CORE, JSON.stringify(core));
  const encrypted = !!(state.settings && state.settings.passcodeSalt && state.settings.passcodeVerifier);
  const writes = [
    idbSet(IDB_HABIT_LOG,    state.habitLog || {}),
    idbSet(IDB_CHORE_LOG,    state.choreLog || {}),
    idbSet(IDB_DW_SESSIONS,  state.deepwork?.sessions || []),
    idbSet(IDB_MED_SESSIONS, state.meditation?.sessions || []),
    idbSet(IDB_FIT_SESSIONS, state.fitness?.sessions || []),
  ];
  // When encrypted, journal bucket is managed by features/journal/encryption.js
  if (!encrypted) writes.push(idbSet(IDB_JOURNAL, state.journal || []));
  await Promise.all(writes);
}

// ── Back-out: restore from ff7.bak ───────────────────────────────────────────
export async function resetFromBackup() {
  const bak = localStorage.getItem(KEY_BACKUP);
  if (!bak) { toast('No backup found'); return false; }
  if (!confirm('Restore pre-migration backup? Current v2 data will be discarded.')) return false;
  localStorage.removeItem(KEY_CORE);
  await idbClearAll();
  localStorage.setItem(KEY_LEGACY, bak);
  toast('Backup restored — reloading…');
  setTimeout(() => location.reload(), 400);
  return true;
}

// ── Export / Import ──────────────────────────────────────────────────────────
export function exportData() {
  const payload = { ...extractCore(S), habitLog: S.habitLog, choreLog: S.choreLog, journal: S.journal, deepwork: { ...extractCore(S).deepwork, sessions: S.deepwork.sessions }, meditation: { ...extractCore(S).meditation, sessions: S.meditation.sessions }, fitness: { ...extractCore(S).fitness, sessions: S.fitness.sessions } };
  const b = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b);
  a.download = 'focusflow-backup.json'; a.click();
}

export function importData(e) {
  const f = e.target.files?.[0];
  if (!f) { toast('No file selected'); return; }
  // Reset the input so the same file can be re-picked after an error
  try { e.target.value = ''; } catch {}
  if (f.size === 0) { toast('File is empty'); return; }
  if (f.size > 20 * 1024 * 1024) { toast('File too large (>20MB)'); return; }
  toast(`Reading ${f.name}…`);
  const r = new FileReader();
  r.onerror = () => { console.error('FileReader error', r.error); toast('Could not read file — try saving it to Files first'); };
  r.onload = async ev => {
    const text = ev.target.result;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error('JSON parse failed', parseErr, 'first 200 chars:', String(text).slice(0, 200));
      toast('Not valid JSON — check the file');
      return;
    }
    try {
      const v2 = migrate(parsed, detectVersion(parsed));
      await writeAll(v2);
      mergeCore(extractCore(v2));
      S.habitLog = v2.habitLog || {}; S.choreLog = v2.choreLog || {};
      S.deepwork.sessions = v2.deepwork.sessions || [];
      S.meditation.sessions = v2.meditation.sessions || [];
      S.fitness.sessions = v2.fitness.sessions || [];
      S.journal = v2.journal || [];
      window.renderAll?.();
      toast('Imported ✓');
    } catch (ex) {
      console.error('Migration/apply failed', ex);
      toast('Import failed: ' + (ex?.message || 'unknown error'));
    }
  };
  r.readAsText(f);
}

// ── Global autosave on inputs (feature forms) ────────────────────────────────
if (typeof document !== 'undefined') {
  document.addEventListener('input', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
      showAutosaveDot('saving');
      clearTimeout(_saveT);
      _saveT = setTimeout(() => { window.saveProfile?.(true); }, 700);
    }
  });
  document.addEventListener('change', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
      showAutosaveDot('saving');
      clearTimeout(_saveT);
      _saveT = setTimeout(() => { window.saveProfile?.(true); }, 700);
    }
  });
}

// ── Categories ───────────────────────────────────────────────────────────────
export const BASE_SHOP = ['Protein','Vegetables','Fruit','Grains & Carbs','Dairy & Eggs','Healthy Fats','Snacks','Drinks','Supplements','Other'];
export const BASE_PROJ = ['work','personal','health','learning','finance','other'];
export const BASE_GOAL = ['career','health','training','learning','personal','finance'];
export const CAT_ICONS = { 'Protein':'🥩','Vegetables':'🥦','Fruit':'🍎','Grains & Carbs':'🌾','Dairy & Eggs':'🥛','Healthy Fats':'🥑','Snacks':'🍿','Drinks':'💧','Supplements':'💊','Other':'📦' };

export const shopCats = () => [...BASE_SHOP, ...(S.customCats.shop || [])];
export const projCats = () => [...BASE_PROJ, ...(S.customCats.proj || [])];
export const goalCats = () => [...BASE_GOAL, ...(S.customCats.goal || [])];

export function addCustomCat(t) {
  const inp = document.getElementById('new-' + t + '-cat');
  const v = inp.value.trim(); if (!v) return;
  S.customCats[t].push(v); inp.value = ''; save(); renderCustomCats();
}
export function delCustomCat(t, i) { S.customCats[t].splice(i, 1); save(); renderCustomCats(); }
export function renderCustomCats() {
  ['shop','proj','goal'].forEach(t => {
    const el = document.getElementById('custom-' + t + '-cats'); if (!el) return;
    const arr = S.customCats[t] || [];
    el.innerHTML = arr.length
      ? arr.map((c, i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="flex:1;font-size:13px">${c}</span><button class="btn-icon btn-xs" onclick="delCustomCat('${t}',${i})">✕</button></div>`).join('')
      : '<div class="caption" style="margin-bottom:4px">None added</div>';
  });
}
export function populateSel(id, options, cur) {
  const s = document.getElementById(id); if (!s) return;
  s.innerHTML = options.map(o => `<option value="${o}"${o === cur ? ' selected' : ''}>${o}</option>`).join('');
}

// Expose to window
if (typeof window !== 'undefined') {
  window.save = save;
  window.load = load;
  window.exportData = exportData;
  window.importData = importData;
  window.resetFromBackup = resetFromBackup;
  window.showSave = showSave;
  window.showAutosaveDot = showAutosaveDot;
  window.shopCats = shopCats;
  window.projCats = projCats;
  window.goalCats = goalCats;
  window.addCustomCat = addCustomCat;
  window.delCustomCat = delCustomCat;
  window.renderCustomCats = renderCustomCats;
  window.populateSel = populateSel;
}
