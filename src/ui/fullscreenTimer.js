// Fullscreen timer overlay — Phase 6
// Mountable anywhere: call openFullscreenTimer(getText, onExit). It shows
// a big readout that ticks whatever getText() returns every 500ms, dims
// the rest of the app, keeps the screen awake, and exits on tap-to-close
// or swipe-down.
let _tickId = null, _overlay = null, _touchStartY = 0;

export function openFullscreenTimer({ getText, getPhase, getPct, onExit } = {}) {
  closeFullscreenTimer();
  const el = document.createElement('div');
  el.id = 'fs-timer-overlay';
  el.innerHTML = `
    <div class="fs-inner">
      <div class="fs-phase" id="fs-phase">${getPhase?.() || ''}</div>
      <div class="fs-time" id="fs-time">${getText?.() || '--:--'}</div>
      <div class="fs-ring"><div class="fs-ring-fill" id="fs-ring-fill" style="width:${getPct?.() || 0}%"></div></div>
      <div class="fs-hint">swipe down or tap to exit</div>
    </div>`;
  document.body.appendChild(el);
  _overlay = el;

  const exit = () => { onExit?.(); closeFullscreenTimer(); };
  el.addEventListener('click', exit);
  el.addEventListener('touchstart', e => { _touchStartY = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - _touchStartY;
    if (dy > 80) exit();
  }, { passive: true });

  window.reqWL?.();

  _tickId = setInterval(() => {
    if (!_overlay) return;
    const t = document.getElementById('fs-time'); if (t) t.textContent = getText?.() || '--:--';
    const p = document.getElementById('fs-phase'); if (p && getPhase) p.textContent = getPhase();
    const r = document.getElementById('fs-ring-fill'); if (r && getPct) r.style.width = getPct() + '%';
  }, 500);
}

export function closeFullscreenTimer() {
  if (_tickId) { clearInterval(_tickId); _tickId = null; }
  if (_overlay) { _overlay.remove(); _overlay = null; window.relWL?.(); }
}

// Expose so non-module callers (inline onclicks) work.
if (typeof window !== 'undefined') {
  window.openFullscreenTimer = openFullscreenTimer;
  window.closeFullscreenTimer = closeFullscreenTimer;
}
