// Secure storage — Keychain (iOS) / Keystore (Android) via @capacitor/preferences on native,
// localStorage fallback on web. Used for passcode salt/verifier.
import { isNative, loadPlugin } from './index.js';

const PREFIX = 'ff.sec:';

export async function setSecure(key, value) {
  if (isNative()) {
    const mod = await loadPlugin('@capacitor/preferences');
    if (mod?.Preferences) { try { await mod.Preferences.set({ key: PREFIX + key, value: String(value) }); return; } catch {} }
  }
  try { localStorage.setItem(PREFIX + key, String(value)); } catch {}
}

export async function getSecure(key) {
  if (isNative()) {
    const mod = await loadPlugin('@capacitor/preferences');
    if (mod?.Preferences) {
      try { const { value } = await mod.Preferences.get({ key: PREFIX + key }); return value ?? null; } catch {}
    }
  }
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

export async function removeSecure(key) {
  if (isNative()) {
    const mod = await loadPlugin('@capacitor/preferences');
    if (mod?.Preferences) { try { await mod.Preferences.remove({ key: PREFIX + key }); return; } catch {} }
  }
  try { localStorage.removeItem(PREFIX + key); } catch {}
}
