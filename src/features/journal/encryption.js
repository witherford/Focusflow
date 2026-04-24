// Journal encryption layer — Phase 7
// S.journal is the in-memory array of plaintext entries. Two persisted forms:
//   - Legacy / unprotected: entries live inside the core localStorage blob (as today).
//   - Encrypted:            entries live in IDB under ff:v2:journal as
//                           [{ id, iv, ct, meta: { createdAt, habitId?, type? } }, …]
//
// Meta stays plaintext so lists / bad-habit indicators work without unlock.
import { S } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { idbGet, idbSet } from '../../core/idb.js';
import { IDB_JOURNAL } from '../../core/schema.js';
import {
  createPasscode, verifyPasscode, unlockKey,
  encryptJSON, decryptJSON,
  getSessionKey, setSessionKey, clearSessionKey,
} from '../../core/crypto.js';

export function isJournalEncrypted() {
  return !!(S.settings && S.settings.passcodeSalt && S.settings.passcodeVerifier);
}

export function isUnlocked() { return !!getSessionKey(); }

// Load encrypted journal from IDB, decrypt with session key, populate S.journal.
export async function loadAndDecryptJournal() {
  const key = getSessionKey();
  if (!key) return false;
  const enc = await idbGet(IDB_JOURNAL, []);
  const out = [];
  for (const rec of (enc || [])) {
    try {
      const plain = await decryptJSON({ iv: rec.iv, ct: rec.ct }, key);
      out.push({ ...plain, id: rec.id, ...(rec.meta || {}) });
    } catch (e) {
      // skip corrupted entry
    }
  }
  S.journal = out;
  return true;
}

// Persist S.journal as encrypted records in IDB. Call after any journal mutation.
export async function persistEncryptedJournal() {
  const key = getSessionKey();
  if (!key) throw new Error('Journal is locked');
  const recs = [];
  for (const e of (S.journal || [])) {
    const meta = { createdAt: e.datetime || e.createdAt, habitId: e.habitId || null, type: e.type || null };
    const payload = { ...e };
    const { iv, ct } = await encryptJSON(payload, key);
    recs.push({ id: e.id, iv, ct, meta });
  }
  await idbSet(IDB_JOURNAL, recs);
}

// Set a new passcode for the first time. Optionally migrate any existing
// plaintext journal into encrypted form.
export async function setPasscode(passcode) {
  if (!passcode || passcode.length < 4) throw new Error('Passcode must be at least 4 characters');
  const { salt, verifier } = await createPasscode(passcode);
  const key = await unlockKey(passcode, salt);
  S.settings.passcodeSalt = salt;
  S.settings.passcodeVerifier = verifier;
  setSessionKey(key);
  // migrate existing plaintext journal → encrypted IDB
  await persistEncryptedJournal();
  save();
  return true;
}

export async function unlockJournal(passcode) {
  if (!isJournalEncrypted()) throw new Error('No passcode set');
  const ok = await verifyPasscode(passcode, S.settings.passcodeSalt, S.settings.passcodeVerifier);
  if (!ok) return false;
  const key = await unlockKey(passcode, S.settings.passcodeSalt);
  setSessionKey(key);
  await loadAndDecryptJournal();
  return true;
}

export function lockJournal() {
  clearSessionKey();
  S.journal = [];
  window.renderJournal?.();
}

// Reset passcode: destroys the journal entirely.
export async function resetPasscode() {
  S.settings.passcodeSalt = null;
  S.settings.passcodeVerifier = null;
  clearSessionKey();
  await idbSet(IDB_JOURNAL, []);
  S.journal = [];
  save();
}
