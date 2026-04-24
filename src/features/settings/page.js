// Settings — Phase 7 passcode UI hooks
import { S } from '../../core/state.js';
import { isJournalEncrypted, setPasscode, resetPasscode } from '../journal/encryption.js';

export function renderPasscodeSection() {
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
}
