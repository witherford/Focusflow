// Thin idb-keyval wrapper with graceful fallback
import { get, set, del, clear } from 'idb-keyval';

export async function idbGet(key, fallback) {
  try { const v = await get(key); return v === undefined ? fallback : v; }
  catch (e) { console.warn('idb get failed', key, e); return fallback; }
}

export async function idbSet(key, value) {
  try { await set(key, value); }
  catch (e) { console.warn('idb set failed', key, e); }
}

export async function idbDel(key) {
  try { await del(key); } catch (e) { console.warn('idb del failed', key, e); }
}

export async function idbClearAll() {
  try { await clear(); } catch (e) { console.warn('idb clear failed', e); }
}
