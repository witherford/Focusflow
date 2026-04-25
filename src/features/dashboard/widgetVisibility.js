// Dashboard widget visibility — Settings UI to enable/disable each card.
import { S } from '../../core/state.js';
import { save } from '../../core/persistence.js';

export const WIDGETS = [
  { id: 'stats',     label: 'Stats grid',          desc: 'Habits %, tasks done, focus hrs, streak' },
  { id: 'schedule',  label: 'Schedule strip',      desc: 'Wake / bed / training routines' },
  { id: 'checkin',   label: 'Check-in',            desc: 'Daily mood + sleep log' },
  { id: 'allday',    label: 'All-day habits',      desc: 'Tap-to-increment habit tiles' },
  { id: 'upnext',    label: 'Up next',             desc: 'Habits/chores due in current block' },
  { id: 'quickstart',label: 'Quick-start timers',  desc: 'Recent focus presets' },
  { id: 'tasksdue',  label: 'Tasks due today',     desc: 'Upcoming + overdue tasks' },
  { id: 'heatstrip', label: 'Heat strip',          desc: 'Last 30 days of habit density' },
  { id: 'goals',     label: 'Toward goals',        desc: 'Top 3 goal rings' },
  { id: 'priorities',label: 'Priorities',          desc: 'Overdue + high-priority badges' },
  { id: 'badhabits', label: 'Bad-habit tracker',   desc: 'Negative habits with avoid/indulge log' },
  { id: 'timeblocks',label: 'Time blocks',         desc: 'Morning / afternoon / evening lists' },
];

const DEFAULTS = Object.fromEntries(WIDGETS.map(w => [w.id, true]));

export function getWidgetSettings() {
  if (!S.settings) S.settings = {};
  if (!S.settings.dashWidgets) S.settings.dashWidgets = { ...DEFAULTS };
  // Backfill any new widgets with default-on.
  for (const w of WIDGETS) if (S.settings.dashWidgets[w.id] === undefined) S.settings.dashWidgets[w.id] = true;
  return S.settings.dashWidgets;
}

export function isWidgetOn(id) {
  const s = getWidgetSettings();
  return s[id] !== false;
}

export function setWidget(id, on) {
  const s = getWidgetSettings();
  s[id] = !!on;
  save();
  window.renderDash?.();
}

export function renderWidgetSettings() {
  const el = document.getElementById('widget-toggles'); if (!el) return;
  const s = getWidgetSettings();
  el.innerHTML = WIDGETS.map(w => `
    <label class="setting-row" style="cursor:pointer">
      <input type="checkbox" class="setting-check" ${s[w.id] !== false ? 'checked' : ''} onchange="setDashWidget('${w.id}', this.checked)">
      <div><div style="font-size:14px;font-weight:500">${w.label}</div><div style="font-size:12px;color:var(--text3);margin-top:2px">${w.desc}</div></div>
    </label>
  `).join('');
}

window.setDashWidget = setWidget;
window.renderWidgetSettings = renderWidgetSettings;
window.getWidgetSettings = getWidgetSettings;
window.isWidgetOn = isWidgetOn;
