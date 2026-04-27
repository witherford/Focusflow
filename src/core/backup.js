// Backup — rolling daily snapshots + unified export/import (plain or
// AES-GCM-256 encrypted with a user passphrase).
import { S, today } from './state.js';
import { save } from './persistence.js';
import { idbGet, idbSet } from './idb.js';
import { APP_VERSION } from './version.js';

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
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: S.profile, habits: S.habits, habitLog: S.habitLog,
    chores: S.chores, choreLog: S.choreLog, choreDayOpen: S.choreDayOpen,
    projects: S.projects, tasks: S.tasks, goals: S.goals,
    deepwork: S.deepwork, meditation: S.meditation, fitness: S.fitness,
    shopping: S.shopping, journal: S.journal, customCats: S.customCats,
    settings: S.settings,
    // Newer state slots — included if present
    checkins: S.checkins || {},
    gamification: S.gamification || null,
    bodyMeasurements: S.bodyMeasurements || [],
    sleepLog: S.sleepLog || [],
    training: S.training || null,
  };
}

function applyPayload(p) {
  if (!p || typeof p !== 'object') return;
  ['profile','habits','habitLog','chores','choreLog','choreDayOpen','projects','tasks','goals','shopping','journal','customCats','settings','checkins','gamification','bodyMeasurements','sleepLog','training'].forEach(k => {
    if (p[k] !== undefined) S[k] = p[k];
  });
  if (p.deepwork) S.deepwork = { ...S.deepwork, ...p.deepwork };
  if (p.meditation) S.meditation = { ...S.meditation, ...p.meditation };
  if (p.fitness) S.fitness = { ...S.fitness, ...p.fitness };
}

// ─── Crypto helpers (AES-GCM-256 with PBKDF2-derived key) ────────────────────
const ENC_HEADER = { format: 'focusflow-backup', version: 1, scheme: 'AES-GCM-256+PBKDF2-SHA-256', iterations: 200_000 };

async function deriveKey(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: ENC_HEADER.iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function bytesToB64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function b64ToBytes(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }

async function encryptPayload(payloadObj, passphrase) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payloadObj)));
  return {
    ...ENC_HEADER,
    encrypted: true,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(ct)),
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
  };
}

async function decryptPayload(env, passphrase) {
  if (env?.format !== ENC_HEADER.format) throw new Error('Not a FocusFlow encrypted backup');
  if (!env.salt || !env.iv || !env.ciphertext) throw new Error('Missing crypto fields');
  const salt = b64ToBytes(env.salt);
  const iv = b64ToBytes(env.iv);
  const ct = b64ToBytes(env.ciphertext);
  const key = await deriveKey(passphrase, salt);
  let pt;
  try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct); }
  catch { throw new Error('Wrong passphrase or corrupted file'); }
  return JSON.parse(new TextDecoder().decode(pt));
}

function isEncryptedEnvelope(obj) {
  return obj && typeof obj === 'object' && obj.format === ENC_HEADER.format && obj.encrypted === true;
}

// ─── Unified export ──────────────────────────────────────────────────────────
// Always writes one JSON file. If a passphrase is supplied, the contents are
// encrypted with AES-GCM-256 (PBKDF2-derived key, 200k iterations). Filename
// hints at encrypted state via the `.enc.json` extension.
export async function exportBackup({ passphrase } = {}) {
  const payload = buildExportPayload();
  let blob, filename;
  if (passphrase) {
    const env = await encryptPayload(payload, passphrase);
    blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
    filename = `focusflow-${today()}.enc.json`;
  } else {
    blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    filename = `focusflow-${today()}.json`;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Legacy alias kept so old callers (settings UI before this commit) keep working.
export function downloadBackup() { return exportBackup(); }

// ─── Unified import ──────────────────────────────────────────────────────────
// Accepts either a plain JSON payload or an encrypted envelope. If encrypted,
// the user is prompted for the passphrase. Either way, applies the result to
// the running state and persists.
export async function importBackup(file, { passphrase } = {}) {
  if (!file) throw new Error('No file provided');
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Not valid JSON'); }
  let payload;
  if (isEncryptedEnvelope(parsed)) {
    let pass = passphrase;
    if (!pass) pass = prompt('This backup is encrypted. Enter the passphrase:');
    if (!pass) throw new Error('Passphrase required');
    payload = await decryptPayload(parsed, pass);
  } else {
    payload = parsed;
  }
  // Snapshot current data before overwriting so the user has an undo path.
  try {
    const pre = buildExportPayload();
    const list = await idbGet(IDB_BACKUPS, []);
    list.push({ date: 'pre-import-' + Date.now(), at: Date.now(), payload: pre });
    while (list.length > MAX_BACKUPS + 1) list.shift();
    await idbSet(IDB_BACKUPS, list);
  } catch {}
  applyPayload(payload);
  save();
  window.renderAll?.();
  return { applied: true, encrypted: isEncryptedEnvelope(parsed) };
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
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.snapshotNow = () => snapshotNow().then(renderBackupList);
window.restoreBackupDate = async d => {
  if (!confirm(`Restore snapshot from ${d}? Current data will be snapshot first.`)) return;
  await restoreBackup(d);
  window.toast?.('Restored ✓');
  renderBackupList();
};
window.renderBackupList = renderBackupList;

// User-facing flows for the Settings UI.
window.exportBackupPrompt = async () => {
  const wantEncrypt = confirm('Encrypt this backup with a passphrase?\n\nOK = Encrypt (recommended)\nCancel = Plain JSON');
  let passphrase = null;
  if (wantEncrypt) {
    passphrase = prompt('Choose a passphrase. You will need this exact phrase to restore the backup. Lose it = lose the data.');
    if (!passphrase) { window.toast?.('Backup cancelled'); return; }
    const confirmed = prompt('Type the passphrase again to confirm:');
    if (confirmed !== passphrase) { window.toast?.('Passphrases didn\'t match'); return; }
  }
  try {
    await exportBackup({ passphrase });
    window.toast?.(passphrase ? '🔒 Encrypted backup downloaded' : 'Backup downloaded');
  } catch (e) {
    window.toast?.('Backup failed: ' + (e?.message || 'unknown'));
  }
};

window.importBackupPrompt = async ev => {
  const file = ev?.target?.files?.[0]; if (!file) return;
  try { ev.target.value = ''; } catch {}
  if (!confirm(`Import "${file.name}"? Your current data will be replaced (a snapshot is saved automatically).`)) return;
  try {
    const res = await importBackup(file);
    window.toast?.(res.encrypted ? '🔓 Decrypted + imported ✓' : 'Imported ✓');
  } catch (e) {
    console.error('[backup] import failed', e);
    window.toast?.('Import failed: ' + (e?.message || 'unknown'));
  }
};
