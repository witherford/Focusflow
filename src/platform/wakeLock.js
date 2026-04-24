// Wake lock — browser Wake Lock API on web, Capacitor keep-awake on native.
import { isNative, loadPlugin } from './index.js';

let _sentinel = null;
let _pluginAwake = false;

export async function requestWakeLock() {
  if (isNative()) {
    const mod = await loadPlugin('@capacitor-community/keep-awake');
    if (mod?.KeepAwake) { try { await mod.KeepAwake.keepAwake(); _pluginAwake = true; } catch (e) {} }
    return;
  }
  if ('wakeLock' in navigator) {
    try {
      _sentinel = await navigator.wakeLock.request('screen');
      _sentinel.addEventListener?.('release', () => { _sentinel = null; });
    } catch (e) { console.warn('wakeLock', e); }
  }
}

export async function releaseWakeLock() {
  if (isNative() && _pluginAwake) {
    const mod = await loadPlugin('@capacitor-community/keep-awake');
    if (mod?.KeepAwake) { try { await mod.KeepAwake.allowSleep(); } catch (e) {} }
    _pluginAwake = false;
    return;
  }
  if (_sentinel) { try { await _sentinel.release(); } catch (e) {} _sentinel = null; }
}

if (typeof window !== 'undefined') {
  // Replace legacy globals reqWL/relWL if present.
  window.reqWL = requestWakeLock;
  window.relWL = releaseWakeLock;
}
