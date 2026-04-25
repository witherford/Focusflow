// Toast with optional undo action.
let _toastT = null;

export function toast(msg, dur = 2500) {
  const el = document.getElementById('toast'); if (!el) return;
  el.innerHTML = msg; el.classList.add('show');
  clearTimeout(_toastT); _toastT = setTimeout(() => el.classList.remove('show'), dur);
}

export function toastUndo(msg, onUndo, dur = 5000) {
  const el = document.getElementById('toast'); if (!el) return;
  el.innerHTML = `<span>${msg}</span><button class="undo-btn" id="toastUndoBtn">Undo</button>`;
  el.classList.add('show');
  clearTimeout(_toastT);
  const btn = document.getElementById('toastUndoBtn');
  let fired = false;
  if (btn) btn.addEventListener('click', () => {
    if (fired) return; fired = true;
    try { onUndo?.(); } catch (e) { console.warn(e); }
    el.classList.remove('show');
  });
  _toastT = setTimeout(() => el.classList.remove('show'), dur);
}

if (typeof window !== 'undefined') {
  window.toast = toast;
  window.toastUndo = toastUndo;
}
