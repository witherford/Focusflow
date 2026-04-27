// App-feature visibility toggles. Hidden features have their nav entries
// removed and any attempt to navigate redirects to dashboard.
import { S } from '../../core/state.js';
import { save } from '../../core/persistence.js';

export const FEATURES = [
  { id: 'habits',     label: '✅ Habits',          desc: 'Daily habit tracking' },
  { id: 'chores',     label: '🧹 Chores',          desc: 'Weekly chore checklist' },
  { id: 'projects',   label: '📁 Projects & tasks', desc: 'Project trees and to-dos' },
  { id: 'goals',      label: '🎯 Goals',           desc: 'Long-term goal tracking' },
  { id: 'insights',   label: '📊 Insights',        desc: 'Trends, weekly review, badges' },
  { id: 'deepwork',   label: '🧠 Deep Work',       desc: 'Pomodoro / focus timer' },
  { id: 'meditation', label: '🧘 Meditation',      desc: 'Timer, breathing, guided sessions' },
  { id: 'fitness',    label: '💪 Fitness',         desc: 'Workouts and body measurements' },
  { id: 'weight',     label: '⚖️ Weight',          desc: 'Body weight tracker' },
  { id: 'sleep',      label: '😴 Sleep',           desc: 'Bedtime / quality log' },
  { id: 'shopping',   label: '🛒 Shopping',        desc: 'Shopping list + AI generator' },
  { id: 'journal',    label: '📓 Journal',         desc: 'Reflection entries (and bad-habit log)' },
];

// Pages that can never be hidden.
export const ALWAYS_ON = new Set(['dashboard', 'profile', 'settings']);

const DEFAULTS = Object.fromEntries(FEATURES.map(f => [f.id, true]));

export function getFeatureFlags() {
  if (!S.settings) S.settings = {};
  if (!S.settings.features) S.settings.features = { ...DEFAULTS };
  // Backfill new features as on.
  for (const f of FEATURES) if (S.settings.features[f.id] === undefined) S.settings.features[f.id] = true;
  return S.settings.features;
}

export function isFeatureOn(id) {
  if (ALWAYS_ON.has(id)) return true;
  const f = getFeatureFlags();
  return f[id] !== false;
}

export function setFeature(id, on) {
  if (ALWAYS_ON.has(id)) return;
  const f = getFeatureFlags();
  f[id] = !!on;
  save();
  applyFeatureVisibility();
}

// Map nav entries → feature ids (some pages have no toggle and are always on).
const NAV_TO_FEATURE = {
  dashboard: 'dashboard',
  habits: 'habits',
  chores: 'chores',
  projects: 'projects',
  goals: 'goals',
  insights: 'insights',
  deepwork: 'deepwork',
  meditation: 'meditation',
  fitness: 'fitness',
  weight: 'weight',
  sleep: 'sleep',
  shopping: 'shopping',
  journal: 'journal',
  profile: 'profile',
  settings: 'settings',
};

export function applyFeatureVisibility() {
  // Show/hide sidebar + bottom-nav entries based on flags.
  document.querySelectorAll('[data-page]').forEach(el => {
    const page = el.dataset.page; if (!page) return;
    const featureId = NAV_TO_FEATURE[page] || page;
    const on = isFeatureOn(featureId);
    el.style.display = on ? '' : 'none';
  });
  // If currently-active page has just been turned off, send the user home.
  const cur = document.querySelector('.page.active');
  if (cur) {
    const id = cur.id.replace('page-', '');
    if (!isFeatureOn(id)) window.goPage?.('dashboard');
  }
}

export function renderFeatureToggles() {
  const el = document.getElementById('feature-toggles'); if (!el) return;
  const flags = getFeatureFlags();
  el.innerHTML = FEATURES.map(f => `
    <label class="setting-row" style="cursor:pointer">
      <input type="checkbox" class="setting-check" ${flags[f.id] !== false ? 'checked' : ''} onchange="setFeatureFlag('${f.id}', this.checked)">
      <div><div style="font-size:14px;font-weight:500">${f.label}</div><div style="font-size:12px;color:var(--text3);margin-top:2px">${f.desc}</div></div>
    </label>
  `).join('') + `<div style="font-size:11px;color:var(--text3);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">Always available: 🏠 Dashboard · 👤 Profile &amp; AI · ⚙️ Settings</div>`;
}

window.setFeatureFlag = setFeature;
window.getFeatureFlags = getFeatureFlags;
window.isFeatureOn = isFeatureOn;
window.renderFeatureToggles = renderFeatureToggles;
window.applyFeatureVisibility = applyFeatureVisibility;
