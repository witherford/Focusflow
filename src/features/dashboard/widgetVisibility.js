// Dashboard widget visibility — Settings UI to enable/disable each card.
import { S } from '../../core/state.js';
import { save } from '../../core/persistence.js';

export const WIDGETS = [
  // Default-on dashboard widgets
  { id: 'schedule',  label: 'Schedule strip',      desc: 'Wake / bed / training routines',          group: 'on' },
  { id: 'checkin',   label: 'Check-in',            desc: 'Daily mood + sleep log',                  group: 'on' },
  { id: 'allday',    label: 'All-day habits',      desc: 'Tap-to-increment habit tiles',            group: 'on' },
  { id: 'upnext',    label: 'Up next',             desc: 'Habits/chores due in current block',      group: 'on' },
  { id: 'tasksdue',  label: 'Tasks due today',     desc: 'Upcoming + overdue tasks',                group: 'on' },
  { id: 'badhabits', label: 'Bad-habit tracker',   desc: 'Negative habits with avoid/indulge log',  group: 'on' },
  { id: 'timeblocks',label: 'Time blocks',         desc: 'Morning / afternoon / evening lists',     group: 'on' },
  // Insights moved off the dashboard. Tick the box to put any of them back.
  { id: 'stats',     label: 'Stats grid',          desc: 'Habits %, tasks done, focus hrs, streak — also on Insights', group: 'insights', off: true },
  { id: 'heatstrip', label: 'Heat strip',          desc: 'Last 30 days of habit density — also on Insights',           group: 'insights', off: true },
  { id: 'goals',     label: 'Toward goals',        desc: 'Top 3 goal rings — also on Insights',                        group: 'insights', off: true },
  { id: 'priorities',label: 'Priorities',          desc: 'Overdue + high-priority badges — also on Insights',          group: 'insights', off: true },
];

// Default ON for items not flagged `off:true`.
const DEFAULTS = Object.fromEntries(WIDGETS.map(w => [w.id, !w.off]));
// Hard-deprecated widget ids — quickstart was removed entirely.
const DEPRECATED = new Set(['quickstart']);

// V1.0.8 moved stats/heatstrip/goals/priorities from the dashboard to the
// Insights page. Existing users had those four flagged on, so without this
// migration the cards would still render on their dashboard. Run once,
// stamp a flag, never run again.
const V108_MOVED_TO_INSIGHTS = ['stats', 'heatstrip', 'goals', 'priorities'];

function maybeMigrateV108(dashWidgets) {
  if (!S.settings) S.settings = {};
  if (S.settings.dashMigratedV108) return;
  for (const id of V108_MOVED_TO_INSIGHTS) dashWidgets[id] = false;
  S.settings.dashMigratedV108 = true;
  try { save(); } catch {}
}

export function getWidgetSettings() {
  if (!S.settings) S.settings = {};
  if (!S.settings.dashWidgets) S.settings.dashWidgets = { ...DEFAULTS };
  // Backfill new widgets with their default value (on or off).
  for (const w of WIDGETS) if (S.settings.dashWidgets[w.id] === undefined) S.settings.dashWidgets[w.id] = !w.off;
  maybeMigrateV108(S.settings.dashWidgets);
  return S.settings.dashWidgets;
}

export function isWidgetOn(id) {
  if (DEPRECATED.has(id)) return false;
  const s = getWidgetSettings();
  return s[id] !== false;
}

export function setWidget(id, on) {
  const s = getWidgetSettings();
  s[id] = !!on;
  save();
  window.renderDash?.();
}

function row(w, s) {
  return `<label class="setting-row" style="cursor:pointer">
    <input type="checkbox" class="setting-check" ${s[w.id] !== false ? 'checked' : ''} onchange="setDashWidget('${w.id}', this.checked)">
    <div><div style="font-size:14px;font-weight:500">${w.label}</div><div style="font-size:12px;color:var(--text3);margin-top:2px">${w.desc}</div></div>
  </label>`;
}

export function renderWidgetSettings() {
  const el = document.getElementById('widget-toggles'); if (!el) return;
  const s = getWidgetSettings();
  const onItems = WIDGETS.filter(w => w.group !== 'insights');
  const insightsItems = WIDGETS.filter(w => w.group === 'insights');
  el.innerHTML = `
    ${onItems.map(w => row(w, s)).join('')}
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 4px">📈 Re-add from Insights</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:6px">These now live on the Insights page. Tick to also show them on the Dashboard.</div>
    ${insightsItems.map(w => row(w, s)).join('')}
  `;
}

window.setDashWidget = setWidget;
window.renderWidgetSettings = renderWidgetSettings;
window.getWidgetSettings = getWidgetSettings;
window.isWidgetOn = isWidgetOn;
