// Theme — dark / light / auto + customizable accent color.
import { S } from '../core/state.js';
import { save } from '../core/persistence.js';
import { haptic } from '../core/state.js';

const ACCENTS = {
  violet: { primary: '#7c6ef7', alt: '#5a4fd4', bg: 'rgba(124,110,247,0.12)', glow: 'rgba(124,110,247,0.25)' },
  teal:   { primary: '#3ecfb0', alt: '#2ba88c', bg: 'rgba(62,207,176,0.12)', glow: 'rgba(62,207,176,0.25)' },
  rose:   { primary: '#f06b6b', alt: '#c94f4f', bg: 'rgba(240,107,107,0.12)', glow: 'rgba(240,107,107,0.25)' },
  gold:   { primary: '#e8b84b', alt: '#c49a33', bg: 'rgba(232,184,75,0.12)', glow: 'rgba(232,184,75,0.25)' },
  green:  { primary: '#5cc87a', alt: '#48a463', bg: 'rgba(92,200,122,0.12)', glow: 'rgba(92,200,122,0.25)' },
  orange: { primary: '#f0904a', alt: '#c4733a', bg: 'rgba(240,144,74,0.12)', glow: 'rgba(240,144,74,0.25)' },
};

function resolveMode(mode) {
  if (mode === 'auto') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme() {
  const s = S.settings || {};
  const mode = s.themeMode || s.theme || 'dark';
  const resolved = resolveMode(mode);
  document.body.classList.toggle('light', resolved === 'light');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = mode === 'auto' ? '🌓 Auto theme' : (resolved === 'dark' ? '🌙 Dark mode' : '☀️ Light mode');
  applyAccent(s.accent || 'violet');
}

function applyAccent(name) {
  const a = ACCENTS[name] || ACCENTS.violet;
  const root = document.documentElement.style;
  root.setProperty('--violet', a.primary);
  root.setProperty('--violet2', a.alt);
  root.setProperty('--violet-bg', a.bg);
  root.setProperty('--violet-glow', a.glow);
}

export function setTheme(dark) {
  if (!S.settings) S.settings = {};
  S.settings.themeMode = dark ? 'dark' : 'light';
  S.settings.theme = dark ? 'dark' : 'light';
  applyTheme();
  save();
}

export function cycleTheme() {
  if (!S.settings) S.settings = {};
  const order = ['dark', 'light', 'auto'];
  const cur = S.settings.themeMode || S.settings.theme || 'dark';
  const next = order[(order.indexOf(cur) + 1) % order.length];
  S.settings.themeMode = next;
  S.settings.theme = next === 'auto' ? 'dark' : next;
  applyTheme();
  save();
}

export function setAccent(name) {
  if (!S.settings) S.settings = {};
  S.settings.accent = name;
  applyTheme(); save();
}

export function initTheme() {
  applyTheme();
  document.getElementById('themeBtn')?.addEventListener('click', () => { haptic('light'); cycleTheme(); });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if ((S.settings?.themeMode || '') === 'auto') applyTheme();
  });
}

window.setTheme = setTheme;
window.cycleTheme = cycleTheme;
window.setAccent = setAccent;
window.ACCENTS = ACCENTS;
