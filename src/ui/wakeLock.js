// Wake lock — extracted from focusflow_v10.html lines 1455-1459
let _wl = null;
export async function reqWL() {
  if ('wakeLock' in navigator) { try { _wl = await navigator.wakeLock.request('screen'); } catch (e) {} }
}
export function relWL() { if (_wl) { _wl.release(); _wl = null; } }
document.addEventListener('visibilitychange', () => { if (_wl && document.visibilityState === 'visible') reqWL(); });

window.reqWL = reqWL;
window.relWL = relWL;
