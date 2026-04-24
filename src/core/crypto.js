// Web Crypto AES-GCM + PBKDF2 — Phase 7
// Zero external deps. Uses SubtleCrypto on all supported platforms (including
// iOS WKWebView and Android WebView).
//
// Passcode flow:
//   - Derive AES-GCM key via PBKDF2-SHA256 (250k iterations) from passcode + salt.
//   - Store salt + a hash-of-key verifier (hash is itself a PBKDF2 derivation on the key).
//   - Never persist the passcode or raw key; key is cached in memory with an idle timeout.
//
// Entry shape on disk: { id, iv (base64), ct (base64), meta: { createdAt, habitId?, ... } }
// meta stays plaintext so listing/filtering works without unlock.

const PBKDF2_ITER = 250_000;
const KEY_LEN_BITS = 256;
const IV_LEN = 12;
const SALT_LEN = 16;

const te = new TextEncoder();
const td = new TextDecoder();

// Base64 helpers (Uint8Array ↔ base64 string)
export function b64enc(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function b64dec(str) {
  const s = atob(str);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

// Derive an AES-GCM CryptoKey from passcode + salt (raw Uint8Array).
async function deriveKey(passcode, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw', te.encode(passcode), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

// Create salt + verifier from a fresh passcode. Verifier = SHA-256 of the raw
// key bytes — cheap to compare without exposing the key itself. We actually
// don't have raw key access (non-extractable), so we derive a second PBKDF2
// (1 iter) over a fixed marker and hash its output. Simpler: verifier is
// PBKDF2(passcode || 'verifier', salt, 10k iter) as base64.
async function deriveVerifier(passcode, salt) {
  const marker = te.encode('ff:verifier:v1');
  const combined = new Uint8Array(te.encode(passcode).length + marker.length);
  combined.set(te.encode(passcode), 0);
  combined.set(marker, te.encode(passcode).length);
  const baseKey = await crypto.subtle.importKey('raw', combined, { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 10_000, hash: 'SHA-256' },
    baseKey, 256
  );
  return b64enc(new Uint8Array(bits));
}

export async function createPasscode(passcode) {
  const salt = randomBytes(SALT_LEN);
  const verifier = await deriveVerifier(passcode, salt);
  return { salt: b64enc(salt), verifier };
}

export async function verifyPasscode(passcode, saltB64, verifier) {
  const salt = b64dec(saltB64);
  const v = await deriveVerifier(passcode, salt);
  return v === verifier;
}

export async function unlockKey(passcode, saltB64) {
  return deriveKey(passcode, b64dec(saltB64));
}

export async function encryptJSON(obj, key) {
  const iv = randomBytes(IV_LEN);
  const data = te.encode(JSON.stringify(obj));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: b64enc(iv), ct: b64enc(new Uint8Array(ctBuf)) };
}

export async function decryptJSON({ iv, ct }, key) {
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64dec(iv) }, key, b64dec(ct)
  );
  return JSON.parse(td.decode(ptBuf));
}

// Session-lock management: the derived key lives only in-memory.
let _sessionKey = null;
let _sessionTimer = null;
const DEFAULT_IDLE_MS = 5 * 60 * 1000;

export function setSessionKey(key, idleMs = DEFAULT_IDLE_MS) {
  _sessionKey = key;
  clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(() => { _sessionKey = null; }, idleMs);
}

export function getSessionKey() { return _sessionKey; }

export function clearSessionKey() {
  _sessionKey = null;
  clearTimeout(_sessionTimer);
  _sessionTimer = null;
}

// Refresh idle timer on activity
export function touchSession(idleMs = DEFAULT_IDLE_MS) {
  if (!_sessionKey) return;
  clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(() => { _sessionKey = null; }, idleMs);
}
