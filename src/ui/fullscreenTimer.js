// Fullscreen timer overlay.
// Shows a big readout that ticks whatever getText() returns every 500ms,
// dims the rest of the app, keeps the screen awake. Optionally renders
// start/pause/reset buttons when the caller supplies the matching callbacks
// (isRunning + onToggle, and onReset).
let _tickId = null, _overlay = null, _touchStartY = 0;
let _api = null;

export function openFullscreenTimer({ getText, getPhase, getPct, isRunning, onToggle, onReset, onExit } = {}) {
  closeFullscreenTimer();
  _api = { getText, getPhase, getPct, isRunning, onToggle, onReset, onExit };
  const el = document.createElement('div');
  el.id = 'fs-timer-overlay';
  const showControls = typeof onToggle === 'function' || typeof onReset === 'function';
  el.innerHTML = `
    <div class="fs-inner">
      <div class="fs-phase" id="fs-phase">${getPhase?.() || ''}</div>
      <div class="fs-time" id="fs-time">${getText?.() || '--:--'}</div>
      <div class="fs-ring"><div class="fs-ring-fill" id="fs-ring-fill" style="width:${getPct?.() || 0}%"></div></div>
      ${showControls ? `<div class="fs-controls">
        ${onReset ? '<button class="fs-btn fs-btn-secondary" id="fs-reset" aria-label="Reset">↺</button>' : ''}
        ${onToggle ? `<button class="fs-btn fs-btn-primary" id="fs-toggle" aria-label="Start or pause">${isRunning?.() ? '⏸' : '▶'}</button>` : ''}
        <button class="fs-btn fs-btn-secondary" id="fs-exit" aria-label="Exit fullscreen">⛶</button>
      </div>` : ''}
      <div class="fs-hint">${showControls ? 'tap a control · swipe down to exit' : 'swipe down or tap to exit'}</div>
    </div>`;
  document.body.appendChild(el);
  _overlay = el;

  const exit = () => { onExit?.(); closeFullscreenTimer(); };

  if (showControls) {
    // Wire the buttons; stop propagation so taps don't fall through to the
    // overlay's exit handler.
    const stop = e => e.stopPropagation();
    const toggleBtn = el.querySelector('#fs-toggle');
    if (toggleBtn) toggleBtn.addEventListener('click', e => { stop(e); try { onToggle?.(); } catch {} updateControls(); });
    const resetBtn = el.querySelector('#fs-reset');
    if (resetBtn) resetBtn.addEventListener('click', e => { stop(e); try { onReset?.(); } catch {} updateControls(); });
    const exitBtn = el.querySelector('#fs-exit');
    if (exitBtn) exitBtn.addEventListener('click', e => { stop(e); exit(); });
    // With controls, only the empty area outside .fs-controls + .fs-time
    // exits on tap — easier on the thumbs than tap-anywhere-to-exit.
    el.addEventListener('click', e => {
      if (e.target.closest('.fs-controls') || e.target.closest('.fs-time') || e.target.closest('.fs-phase')) return;
      exit();
    });
  } else {
    el.addEventListener('click', exit);
  }

  el.addEventListener('touchstart', e => { _touchStartY = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - _touchStartY;
    if (dy > 80) exit();
  }, { passive: true });

  window.reqWL?.();

  _tickId = setInterval(() => {
    if (!_overlay) return;
    const t = document.getElementById('fs-time'); if (t) t.textContent = _api.getText?.() || '--:--';
    const p = document.getElementById('fs-phase'); if (p && _api.getPhase) p.textContent = _api.getPhase();
    const r = document.getElementById('fs-ring-fill'); if (r && _api.getPct) r.style.width = _api.getPct() + '%';
    updateControls();
  }, 500);
}

function updateControls() {
  if (!_overlay || !_api) return;
  const btn = _overlay.querySelector('#fs-toggle');
  if (btn && typeof _api.isRunning === 'function') {
    btn.textContent = _api.isRunning() ? '⏸' : '▶';
  }
}

export function closeFullscreenTimer() {
  if (_tickId) { clearInterval(_tickId); _tickId = null; }
  if (_overlay) { _overlay.remove(); _overlay = null; window.relWL?.(); }
  _api = null;
}

if (typeof window !== 'undefined') {
  window.openFullscreenTimer = openFullscreenTimer;
  window.closeFullscreenTimer = closeFullscreenTimer;
}
