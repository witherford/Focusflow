// Toast — extracted from focusflow_v10.html
let _toastT = null;
export function toast(msg, dur = 2500) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastT); _toastT = setTimeout(() => el.classList.remove('show'), dur);
}
window.toast = toast;
