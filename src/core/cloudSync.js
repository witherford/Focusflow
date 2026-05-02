// Cloud sync client — AES-GCM encrypt the full state, push/pull to a worker.
// Configure: S.settings.sync = { url, code, lastSync, autoSync, dirtySince }
// Optional: AES key cached in IndexedDB as a non-extractable CryptoKey so the
// passphrase is never re-prompted on this device. Passphrase itself is never stored.
import { S } from './state.js';
import { save } from './persistence.js';
import { idbGet, idbSet, idbDel } from './idb.js';
import { buildExportPayload } from './backup.js';

const KEY_CACHE = 'cloud-sync-cached-key';
let _autoSyncT = null;
let _pushing = false;

function ensureCfg() {
  if (!S.settings) S.settings = {};
  if (!S.settings.sync) S.settings.sync = { url: '', code: '', lastSync: 0, autoSync: false, dirtySince: 0 };
  return S.settings.sync;
}

function randCode(len = 24) {
  const a = new Uint8Array(len); crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(36)[0] || 'a').join('').slice(0, len);
}

// Derive AES-GCM key from passphrase + sync code (salt). Non-extractable.
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptWithKey(payload, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
  const blob = new Uint8Array(iv.byteLength + ct.byteLength);
  blob.set(iv, 0); blob.set(new Uint8Array(ct), iv.byteLength);
  return btoa(String.fromCharCode(...blob));
}

async function decryptWithKey(b64, key) {
  const blob = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = blob.slice(0, 12); const ct = blob.slice(12);
  const dec = new TextDecoder();
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(pt));
}

// CryptoKey objects are structured-cloneable, so IDB can store them directly.
export async function rememberKey(passphrase) {
  const cfg = ensureCfg();
  if (!cfg.code) throw new Error('Generate a sync code first');
  const key = await deriveKey(passphrase, cfg.code);
  await idbSet(KEY_CACHE, key);
  return true;
}

export async function getCachedKey() {
  const k = await idbGet(KEY_CACHE, null);
  return k && typeof k.algorithm === 'object' ? k : null;
}

export async function forgetKey() {
  await idbDel(KEY_CACHE);
  if (_autoSyncT) { clearTimeout(_autoSyncT); _autoSyncT = null; }
}

export async function hasCachedKey() {
  return !!(await getCachedKey());
}

export function generateSyncCode() {
  const cfg = ensureCfg();
  cfg.code = randCode(24);
  save();
  return cfg.code;
}

async function resolveKey(passphrase) {
  if (passphrase) {
    const cfg = ensureCfg();
    return deriveKey(passphrase, cfg.code);
  }
  const cached = await getCachedKey();
  if (!cached) throw new Error('Passphrase required (no remembered key on this device)');
  return cached;
}

async function pushWithKey(key) {
  const cfg = ensureCfg();
  if (!cfg.url || !cfg.code) throw new Error('Sync URL and code required');
  const payload = buildExportPayload();
  const ciphertext = await encryptWithKey(payload, key);
  const res = await fetch(cfg.url.replace(/\/$/, '') + '/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ syncCode: cfg.code, ciphertext, lastUpdated: Date.now() }),
  });
  if (!res.ok) throw new Error('Push failed: HTTP ' + res.status);
  const data = await res.json();
  cfg.lastSync = data.lastUpdated || Date.now();
  cfg.dirtySince = 0;
  _pushing = true;
  try { save(); } finally { _pushing = false; }
  return cfg.lastSync;
}

export async function pushSync(passphrase) {
  const key = await resolveKey(passphrase);
  return pushWithKey(key);
}

export async function pullSync(passphrase) {
  const cfg = ensureCfg();
  if (!cfg.url || !cfg.code) throw new Error('Sync URL and code required');
  const key = await resolveKey(passphrase);
  const res = await fetch(cfg.url.replace(/\/$/, '') + '/sync/pull?code=' + encodeURIComponent(cfg.code));
  if (res.status === 404) throw new Error('No remote backup found');
  if (!res.ok) throw new Error('Pull failed: HTTP ' + res.status);
  const data = await res.json();
  const payload = await decryptWithKey(data.ciphertext, key);
  cfg.lastSync = data.lastUpdated || Date.now();
  cfg.dirtySince = 0;
  _pushing = true;
  try { save(); } finally { _pushing = false; }
  return payload;
}

export async function applyPulledPayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  ['profile', 'habits', 'habitLog', 'chores', 'choreLog', 'choreDayOpen', 'projects', 'tasks', 'goals', 'shopping', 'journal', 'customCats', 'settings', 'checkins', 'gamification', 'bodyMeasurements', 'sleepLog', 'meds', 'medGroups', 'medLog', 'diet', 'dietGroups', 'meals', 'badHabitLog', 'sleepHabitLog', 'training'].forEach(k => {
    if (payload[k] !== undefined) S[k] = payload[k];
  });
  if (payload.deepwork) S.deepwork = { ...S.deepwork, ...payload.deepwork };
  if (payload.meditation) S.meditation = { ...S.meditation, ...payload.meditation };
  if (payload.fitness) S.fitness = { ...S.fitness, ...payload.fitness };
  save();
  window.renderAll?.();
}

export async function checkRemoteInfo() {
  const cfg = ensureCfg();
  if (!cfg.url || !cfg.code) return null;
  const res = await fetch(cfg.url.replace(/\/$/, '') + '/sync/info?code=' + encodeURIComponent(cfg.code));
  if (!res.ok) return null;
  return res.json();
}

// Called from persistence.js save() — schedules a debounced auto-push.
export function notifyChange() {
  if (_pushing) return;
  const cfg = ensureCfg();
  if (!cfg.autoSync) return;
  cfg.dirtySince = Date.now();
  clearTimeout(_autoSyncT);
  _autoSyncT = setTimeout(runAutoSync, 30_000);
}

async function runAutoSync() {
  const cfg = ensureCfg();
  if (!(cfg.dirtySince > (cfg.lastSync || 0))) return;
  if (!cfg.url || !cfg.code) return;
  const key = await getCachedKey();
  if (!key) return;
  try {
    await pushWithKey(key);
    const el = document.getElementById('cs-status');
    if (el) {
      el.innerHTML = '🔄 Auto-synced ✓ at ' + new Date().toLocaleTimeString();
      el.style.color = 'var(--text3)';
    }
  } catch (e) {
    console.warn('Auto-sync failed:', e.message);
    const el = document.getElementById('cs-status');
    if (el) {
      el.innerHTML = '⚠ Auto-sync failed: ' + e.message;
      el.style.color = 'var(--rose)';
    }
  }
}

// On load, if auto-sync is on and we're dirty (e.g. unsaved changes from last
// session before close), push once after a short delay so any pending edits
// from the prior tab get up.
export function initAutoSync() {
  setTimeout(() => {
    const cfg = ensureCfg();
    if (cfg.autoSync && (cfg.dirtySince || 0) > (cfg.lastSync || 0)) runAutoSync();
  }, 5_000);
}

window.generateSyncCode = generateSyncCode;
window.pushSync = pushSync;
window.pullSync = pullSync;
window.applyPulledPayload = applyPulledPayload;
window.checkRemoteInfo = checkRemoteInfo;
window.cloudSyncNotifyChange = notifyChange;
window.cloudSyncRememberKey = rememberKey;
window.cloudSyncForgetKey = forgetKey;
window.cloudSyncHasCachedKey = hasCachedKey;
window.cloudSyncInit = initAutoSync;
