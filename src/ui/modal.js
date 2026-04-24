// Modal helpers — extracted from focusflow_v10.html lines 2429-2446
import { haptic } from '../core/state.js';

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  document.activeElement?.blur();
}

export function initModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) { haptic('light'); m.style.display = 'none'; document.activeElement?.blur(); }
    });
    let _my = 0;
    m.addEventListener('touchstart', e => { _my = e.touches[0].clientY; }, { passive: true });
    m.addEventListener('touchend', e => {
      const dy = e.changedTouches[0].clientY - _my;
      if (dy > 80 && e.target === m) { haptic('light'); m.style.display = 'none'; }
    }, { passive: true });
  });
}

window.closeModal = closeModal;
