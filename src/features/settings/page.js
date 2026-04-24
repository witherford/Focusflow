// Settings — passcode + reminders + backups
import { S } from '../../core/state.js';
import { isJournalEncrypted, setPasscode, resetPasscode } from '../journal/encryption.js';
import { getReminderSettings, toggleReminders, saveReminderSettings } from '../../core/reminders.js';
import { renderBackupList } from '../../core/backup.js';

export function renderPasscodeSection() {
  renderReminderSection();
  renderBackupList();
  const set = document.getElementById('passcode-set');
  const manage = document.getElementById('passcode-manage');
  const status = document.getElementById('passcode-status');
  if (!set || !manage || !status) return;
  if (isJournalEncrypted()) {
    status.textContent = '🔒 Journal is encrypted. Entries are unlocked with your passcode on the Journal page.';
    set.style.display = 'none'; manage.style.display = '';
  } else {
    status.textContent = 'Journal is stored in plain text. Enable a passcode to encrypt all entries.';
    set.style.display = ''; manage.style.display = 'none';
  }
}

export function renderReminderSection() {
  const r = getReminderSettings();
  const set = (id, prop, val) => { const el = document.getElementById(id); if (el) el[prop] = val; };
  set('rem-enabled', 'checked', !!r.enabled);
  set('rem-habits', 'checked', !!r.habitReminders);
  set('rem-chores', 'checked', !!r.choreReminders);
  set('rem-journal', 'checked', !!r.journalNudge);
  set('rem-morning', 'value', r.morningTime);
  set('rem-afternoon', 'value', r.afternoonTime);
  set('rem-evening', 'value', r.eveningTime);
  set('rem-journal-time', 'value', r.journalTime);
}

export async function applyReminderSettings() {
  const get = id => document.getElementById(id);
  await saveReminderSettings({
    habitReminders: !!get('rem-habits')?.checked,
    choreReminders: !!get('rem-chores')?.checked,
    journalNudge: !!get('rem-journal')?.checked,
    morningTime: get('rem-morning')?.value || '08:00',
    afternoonTime: get('rem-afternoon')?.value || '13:00',
    eveningTime: get('rem-evening')?.value || '19:00',
    journalTime: get('rem-journal-time')?.value || '21:30',
  });
  window.toast?.('Reminder settings saved ✓');
}

export async function applyToggleReminders() {
  const on = !!document.getElementById('rem-enabled')?.checked;
  await toggleReminders(on);
  window.toast?.(on ? 'Reminders on ✓' : 'Reminders off');
}

export async function applySetPasscode() {
  const a = document.getElementById('pc-new')?.value || '';
  const b = document.getElementById('pc-confirm')?.value || '';
  if (a.length < 4) { window.toast?.('Passcode must be at least 4 chars'); return; }
  if (a !== b) { window.toast?.('Passcodes do not match'); return; }
  try {
    await setPasscode(a);
    document.getElementById('pc-new').value = '';
    document.getElementById('pc-confirm').value = '';
    window.toast?.('Encryption enabled ✓');
    renderPasscodeSection();
  } catch (e) {
    window.toast?.(e.message || 'Failed');
  }
}

export async function applyResetPasscode() {
  if (!confirm('Reset passcode? This will permanently delete ALL journal entries. Continue?')) return;
  await resetPasscode();
  window.toast?.('Passcode reset · journal wiped');
  renderPasscodeSection();
  window.renderJournal?.();
}

if (typeof window !== 'undefined') {
  window.renderPasscodeSection = renderPasscodeSection;
  window.applySetPasscode = applySetPasscode;
  window.applyResetPasscode = applyResetPasscode;
  window.renderReminderSection = renderReminderSection;
  window.applyReminderSettings = applyReminderSettings;
  window.applyToggleReminders = applyToggleReminders;
}
