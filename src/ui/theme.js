// Theme — extracted from focusflow_v10.html lines 2425-2427
import { S } from '../core/state.js';
import { save } from '../core/persistence.js';
import { haptic } from '../core/state.js';

export function setTheme(dark) {
  document.body.classList.toggle('light', !dark);
  S.settings.theme = dark ? 'dark' : 'light';
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = dark ? '🌙 Dark mode' : '☀️ Light mode';
}

export function initTheme() {
  document.getElementById('themeBtn')?.addEventListener('click', () => {
    haptic('light');
    setTheme(S.settings.theme === 'light');
    save();
  });
}

window.setTheme = setTheme;
