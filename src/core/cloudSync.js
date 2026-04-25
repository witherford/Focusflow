// Cloud sync client — AES-GCM encrypt the full state, push/pull to a worker.
// Configure: S.settings.sync = { url, code, passphrase, lastSync, autoSync }
import { S } from './state.js';
import { save } from './persistence.js';
import { buildExportPayload } from './backup.js';

function ensureCfg() {
  if (!S.settings) S.settings = {};
  if (!S.settings.sync) S.settings.sync = { url: '', code: '', lastSync: 0, autoSync: false };
  return S.settings.sync;
}

function randCode(len = 24) {
  const a = new Uint8Array(len); crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(36)[0] || 'a').join('').slice(0, len);
}

// Derive AES-GCM key from passphrase + sync code (salt).
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

async function encryptPayload(payload, passphrase, code) {
  const key = await deriveKey(passphrase, code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
  // Concatenate iv + ciphertext, base64-encode for transit.
  const blob = new Uint8Array(iv.byteLength + ct.byteLength);
  blob.set(iv, 0); blob.set(new Uint8Array(ct), iv.byteLength);
  return btoa(String.fromCharCode(...blob));
}

async function decryptPayload(b64, passphrase, code) {
  const key = await deriveKey(passphrase, code);
  const blob = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = blob.slice(0, 12); const ct = blob.slice(12);
  const dec = new TextDecoder();
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(pt));
}

export function generateSyncCode() {
  const cfg = ensureCfg();
  cfg.code = randCode(24);
  save();
  return cfg.code;
}

export async function pushSync(passphrase) {
  const cfg = ensureCfg();
  if (!cfg.url || !cfg.code) throw new Error('Sync URL and code required');
  if (!passphrase) throw new Error('Passphrase required');
  const payload = buildExportPayload();
  const ciphertext = await encryptPayload(payload, passphrase, cfg.code);
  const res = await fetch(cfg.url.replace(/\/$/, '') + '/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ syncCode: cfg.code, ciphertext, lastUpdated: Date.now() }),
  });
  if (!res.ok) throw new Error('Push failed: HTTP ' + res.status);
  const data = await res.json();
  cfg.lastSync = data.lastUpdated || Date.now();
  save();
  return cfg.lastSync;
}

export async function pullSync(passphrase) {
  const cfg = ensureCfg();
  if (!cfg.url || !cfg.code) throw new Error('Sync URL and code required');
  const res = await fetch(cfg.url.replace(/\/$/, '') + '/sync/pull?code=' + encodeURIComponent(cfg.code));
  if (res.status === 404) throw new Error('No remote backup found');
  if (!res.ok) throw new Error('Pull failed: HTTP ' + res.status);
  const data = await res.json();
  const payload = await decryptPayload(data.ciphertext, passphrase, cfg.code);
  cfg.lastSync = data.lastUpdated || Date.now();
  save();
  return payload;
}

export async function applyPulledPayload(payload) {
  const { applyPayloadIntoState } = await import('./backup.js').catch(() => ({}));
  // We import directly because applyPayload was internal — re-implement here.
  if (!payload || typeof payload !== 'object') return;
  ['profile', 'habits', 'habitLog', 'chores', 'choreLog', 'choreDayOpen', 'projects', 'tasks', 'goals', 'shopping', 'journal', 'customCats', 'settings', 'checkins', 'gamification', 'bodyMeasurements', 'sleepLog'].forEach(k => {
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

window.generateSyncCode = generateSyncCode;
window.pushSync = pushSync;
window.pullSync = pullSync;
window.applyPulledPayload = applyPulledPayload;
window.checkRemoteInfo = checkRemoteInfo;
