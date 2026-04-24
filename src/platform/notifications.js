// Notifications — Web Notification API on web, Capacitor LocalNotifications on native.
import { isNative, loadPlugin } from './index.js';

export async function ensurePermission() {
  if (isNative()) {
    const mod = await loadPlugin('@capacitor/local-notifications');
    if (!mod?.LocalNotifications) return false;
    try {
      const res = await mod.LocalNotifications.requestPermissions();
      return res.display === 'granted';
    } catch { return false; }
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch { return false; }
}

// Schedule a one-shot notification at a future time (Date or timestamp ms).
export async function schedule({ id, title, body, at }) {
  const when = at instanceof Date ? at : new Date(at);
  if (isNative()) {
    const mod = await loadPlugin('@capacitor/local-notifications');
    if (!mod?.LocalNotifications) return;
    try {
      await mod.LocalNotifications.schedule({
        notifications: [{ id: id || Date.now() % 2147483647, title, body, schedule: { at: when } }]
      });
    } catch (e) { console.warn('notif schedule', e); }
    return;
  }
  // Web fallback: setTimeout + Notification (best-effort, only while tab is alive)
  const delay = when.getTime() - Date.now();
  if (delay <= 0) { notifyNow(title, body); return; }
  setTimeout(() => notifyNow(title, body), Math.min(delay, 2_147_483_000));
}

export async function cancel(id) {
  if (isNative()) {
    const mod = await loadPlugin('@capacitor/local-notifications');
    if (!mod?.LocalNotifications) return;
    try { await mod.LocalNotifications.cancel({ notifications: [{ id }] }); } catch {}
  }
}

function notifyNow(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch {}
}

export async function notify(title, body) {
  const ok = await ensurePermission();
  if (!ok) return;
  notifyNow(title, body);
}

if (typeof window !== 'undefined') {
  window.ffNotify = notify;
  window.ffScheduleNotif = schedule;
}
