// Reminders — schedule notifications for habits, chores, journal nudges.
// Stores settings on S.settings.reminders, schedules on app load / change.
import { S, today } from './state.js';
import { save } from './persistence.js';
import { schedule, cancel, ensurePermission } from '../platform/notifications.js';
import { metOn } from '../features/habits/counterMode.js';

const DEFAULTS = {
  enabled: false,
  habitReminders: true,
  choreReminders: true,
  journalNudge: true,
  journalTime: '21:30',
  morningTime: '08:00',
  afternoonTime: '13:00',
  eveningTime: '19:00',
};

export function getReminderSettings() {
  if (!S.settings) S.settings = {};
  if (!S.settings.reminders) S.settings.reminders = { ...DEFAULTS };
  else S.settings.reminders = { ...DEFAULTS, ...S.settings.reminders };
  return S.settings.reminders;
}

function nextAt(timeHHMM) {
  const [h, m] = (timeHHMM || '09:00').split(':').map(Number);
  const d = new Date(); d.setHours(h || 0, m || 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

export async function scheduleAll() {
  const r = getReminderSettings();
  if (!r.enabled) return 0;
  const ok = await ensurePermission();
  if (!ok) return 0;
  let n = 0;
  // Habit block reminders — fire once per block if any habit in that block is unfinished
  const blocks = [['morning', r.morningTime], ['afternoon', r.afternoonTime], ['evening', r.eveningTime]];
  if (r.habitReminders) {
    for (const [block, t] of blocks) {
      const habits = S.habits.filter(h => h.block === block);
      if (!habits.length) continue;
      const pending = habits.filter(h => !metOn(h, today())).length;
      if (!pending) continue;
      await schedule({ id: hash('hab-' + block), title: `${block[0].toUpperCase() + block.slice(1)} habits`, body: `${pending} habit${pending === 1 ? '' : 's'} waiting`, at: nextAt(t) });
      n++;
    }
  }
  // Chore reminder — morning
  if (r.choreReminders) {
    const todayDay = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
    const todayChores = (S.chores || []).filter(c => c.day === todayDay).length;
    if (todayChores) {
      await schedule({ id: hash('chores'), title: `Chores today (${todayChores})`, body: 'Block out a few minutes', at: nextAt(r.morningTime) });
      n++;
    }
  }
  if (r.journalNudge) {
    await schedule({ id: hash('journal'), title: 'Journal nudge', body: 'A few lines before bed?', at: nextAt(r.journalTime) });
    n++;
  }
  return n;
}

function hash(s) {
  let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483000;
}

export async function clearAll() {
  ['hab-morning', 'hab-afternoon', 'hab-evening', 'chores', 'journal'].forEach(k => cancel(hash(k)));
}

export function initReminders() {
  getReminderSettings();
  // fire & forget; don't block startup
  scheduleAll().catch(() => {});
  window.addEventListener('focus', () => scheduleAll().catch(() => {}));
}

export async function toggleReminders(on) {
  const r = getReminderSettings();
  r.enabled = !!on;
  if (on) { await ensurePermission(); await scheduleAll(); }
  else await clearAll();
  save();
}

export async function saveReminderSettings(patch) {
  const r = getReminderSettings();
  Object.assign(r, patch);
  save();
  if (r.enabled) { await clearAll(); await scheduleAll(); }
}

window.toggleReminders = toggleReminders;
window.saveReminderSettings = saveReminderSettings;
