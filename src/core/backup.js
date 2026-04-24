// Backup — rolling daily snapshots + manual export/import with safety copy.
import { S, today } from './state.js';
import { save } from './persistence.js';
import { idbGet, idbSet } from './idb.js';

const IDB_BACKUPS = 'ff:v2:backups';
const MAX_BACKUPS = 7;

export async function snapshotNow() {
  const payload = buildExportPayload();
  const existing = await idbGet(IDB_BACKUPS, []);
  const td = today();
  const filtered = existing.filter(b => b.date !== td);
  filtered.push({ date: td, at: Date.now(), payload });
  while (filtered.length > MAX_BACKUPS) filtered.shift();
  await idbSet(IDB_BACKUPS, filtered);
  return filtered;
}

export async function listBackups() {
  return (await idbGet(IDB_BACKUPS, []));
}

export async function restoreBackup(date) {
  const list = await idbGet(IDB_BACKUPS, []);
  const b = list.find(x => x.date === date);
  if (!b) return false;
  const pre = buildExportPayload();
  const preList = await idbGet(IDB_BACKUPS, []);
  preList.push({ date: 'pre-restore-' + Date.now(), at: Date.now(), payload: pre });
  while (preList.length > MAX_BACKUPS + 1) preList.shift();
  await idbSet(IDB_BACKUPS, preList);
  applyPayload(b.payload);
  save();
  window.renderAll?.();
  return true;
}

export function buildExportPayload() {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    profile: S.profile, habits: S.habits, habitLog: S.habitLog,
    chores: S.chores, choreLog: S.choreLog, choreDayOpen: S.choreDayOpen,
    projects: S.projects, tasks: S.tasks, goals: S.goals,
    deepwork: S.deepwork, meditation: S.meditation, fitness: S.fitness,
    shopping: S.shopping, journal: S.journal, customCats: S.customCats,
    settings: S.settings,
  };
}

function applyPayload(p) {
  if (!p || typeof p !== 'object') return;
  ['profile','habits','habitLog','chores','choreLog','choreDayOpen','projects','tasks','goals','shopping','journal','customCats','settings'].forEach(k => {
    if (p[k] !== undefined) S[k] = p[k];
  });
  if (p.deepwork) S.deepwork = { ...S.deepwork, ...p.deepwork };
  if (p.meditation) S.meditation = { ...S.meditation, ...p.meditation };
  if (p.fitness) S.fitness = { ...S.fitness, ...p.fitness };
}

export function downloadBackup() {
  const payload = buildExportPayload();
  const b = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `focusflow-${today()}.json`;
  a.click();
}

export function initBackup() {
  // Snapshot once per day on startup (cheap).
  idbGet(IDB_BACKUPS, []).then(list => {
    if (!list.some(b => b.date === today())) snapshotNow().catch(() => {});
  }).catch(() => {});
}

export async function renderBackupList() {
  const el = document.getElementById('backup-list'); if (!el) return;
  const list = await listBackups();
  if (!list.length) { el.innerHTML = '<div class="caption">No snapshots yet</div>'; return; }
  el.innerHTML = list.slice().reverse().map(b => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="flex:1;font-family:'DM Mono',monospace">${b.date}</span><button class="btn btn-xs" onclick="restoreBackupDate('${b.date}')">Restore</button></div>`).join('');
}

window.downloadBackup = downloadBackup;
window.snapshotNow = () => snapshotNow().then(renderBackupList);
window.restoreBackupDate = async d => {
  if (!confirm(`Restore snapshot from ${d}? Current data will be snapshot first.`)) return;
  await restoreBackup(d);
  window.toast?.('Restored ✓');
  renderBackupList();
};
window.renderBackupList = renderBackupList;
