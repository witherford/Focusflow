// Journal — extracted from focusflow_v10.html lines 1620-1669
import { S, uid } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { isJournalEncrypted, isUnlocked, persistEncryptedJournal, unlockJournal, lockJournal } from './encryption.js';

async function persistAfterMutation() {
  if (isJournalEncrypted() && isUnlocked()) {
    try { await persistEncryptedJournal(); } catch (e) { console.error('journal persist failed', e); }
  }
  save();
}

export function openAddJournal() {
  const neg = [...(S.profile.negHabits || []), ...(S.profile.negCustom || '').split('\n').filter(x => x.trim())];
  window.populateSel('j-habit-sel', neg.length ? neg : ['No habits'], neg[0] || '');
  setJType('avoided'); document.getElementById('j-dt').value = new Date().toISOString().slice(0, 16);
  document.getElementById('j-text').value = ''; document.getElementById('j-edit-id').value = '';
  const ph = document.getElementById('j-photo'); if (ph) ph.value = '';
  const pd = document.getElementById('j-photo-data'); if (pd) pd.value = '';
  const pr = document.getElementById('j-photo-preview'); if (pr) pr.innerHTML = '';
  document.getElementById('m-journal').style.display = 'flex';
}
export function openEditJE(id) {
  const e = S.journal.find(j => j.id === id); if (!e) return;
  const neg = [...(S.profile.negHabits || []), ...(S.profile.negCustom || '').split('\n').filter(x => x.trim())];
  window.populateSel('j-habit-sel', neg, e.habitId); setJType(e.type || 'avoided');
  document.getElementById('j-dt').value = e.datetime || ''; document.getElementById('j-text').value = e.text || ''; document.getElementById('j-edit-id').value = id;
  document.getElementById('m-journal').style.display = 'flex';
}
export function setJType(t) {
  document.getElementById('j-type').value = t;
  document.getElementById('j-avoided-btn').className = 'type-btn avoided' + (t === 'avoided' ? ' active' : '');
  document.getElementById('j-indulged-btn').className = 'type-btn indulged' + (t === 'indulged' ? ' active' : '');
}
export function saveJournal() {
  const habitId = document.getElementById('j-habit-sel').value, type = document.getElementById('j-type').value, datetime = document.getElementById('j-dt').value, text = document.getElementById('j-text').value.trim(); if (!habitId || !datetime) return;
  const editId = document.getElementById('j-edit-id').value;
  const photo = document.getElementById('j-photo-data')?.value || '';
  const entry = { id: editId || uid(), habitId, type, datetime, text };
  if (photo) entry.photo = photo;
  if (editId) { const idx = S.journal.findIndex(j => j.id === editId); if (idx > -1) entry.photo = entry.photo || S.journal[idx].photo; if (idx > -1) S.journal[idx] = entry; } else S.journal.push(entry);
  persistAfterMutation(); window.closeModal('m-journal'); renderJournal();
  // Only auto-tick on a fresh entry (not edits).
  if (!editId) window.markHabitDoneFromFlow?.('journal');
}

export function onJournalPhoto(ev) {
  const file = ev?.target?.files?.[0]; if (!file) return;
  if (file.size > 4 * 1024 * 1024) { window.toast?.('Photo too large (>4MB) — pick a smaller one'); ev.target.value = ''; return; }
  const r = new FileReader();
  r.onload = e => {
    // Compress via canvas to ~1024px wide JPEG to keep IDB happy.
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      const maxW = 1024; const scale = Math.min(1, maxW / img.width);
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const data = cv.toDataURL('image/jpeg', 0.78);
      const pd = document.getElementById('j-photo-data'); if (pd) pd.value = data;
      const pr = document.getElementById('j-photo-preview'); if (pr) pr.innerHTML = `<img src="${data}" style="max-width:100%;max-height:160px;border-radius:8px;border:1px solid var(--border)">`;
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}
export function renderJournal() {
  const el = document.getElementById('journal-list'); if (!el) return;
  // Locked: show unlock prompt instead.
  if (isJournalEncrypted() && !isUnlocked()) {
    el.innerHTML = `<div class="card" style="max-width:360px;margin:40px auto;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">🔒</div>
      <div class="card-title" style="margin-bottom:14px">Journal locked</div>
      <input type="password" id="jlock-pass" placeholder="Enter passcode" style="width:100%;margin-bottom:8px" onkeydown="if(event.key==='Enter')tryUnlockJournal()">
      <div id="jlock-msg" style="font-size:11px;color:var(--rose);margin-bottom:8px;min-height:14px"></div>
      <button class="btn btn-primary" style="width:100%" onclick="tryUnlockJournal()">Unlock</button>
    </div>`;
    setTimeout(() => document.getElementById('jlock-pass')?.focus(), 50);
    return;
  }
  const neg = [...(S.profile.negHabits || []), ...(S.profile.negCustom || '').split('\n').filter(x => x.trim())];
  const jHF = document.getElementById('j-habit-filter'); if (jHF) { const cur = jHF.value; jHF.innerHTML = `<option value="">All</option>${neg.map(h => `<option value="${h}"${h === cur ? ' selected' : ''}>${h}</option>`).join('')}`; }
  const sortBy = document.getElementById('j-sort')?.value || 'desc';
  const hF = document.getElementById('j-habit-filter')?.value || '';
  const tF = document.getElementById('j-type-filter')?.value || '';
  let entries = [...S.journal];
  if (hF) entries = entries.filter(e => e.habitId === hF);
  if (tF) entries = entries.filter(e => e.type === tF);
  entries.sort((a, b) => sortBy === 'desc' ? (b.datetime || '').localeCompare(a.datetime || '') : (a.datetime || '').localeCompare(b.datetime || ''));
  if (!entries.length) { el.innerHTML = '<div style="color:var(--text3);text-align:center;padding:40px;font-size:14px">No journal entries yet.<br><span style="font-size:12px">Log bad habit events from the Dashboard.</span></div>'; return; }
  const av = entries.filter(e => e.type === 'avoided').length, ind = entries.filter(e => e.type === 'indulged').length;
  el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
    <div class="stat-card" style="--accent:var(--green)"><div class="stat-num">${av}</div><div class="stat-label">Avoided</div></div>
    <div class="stat-card" style="--accent:var(--rose)"><div class="stat-num">${ind}</div><div class="stat-label">Indulged</div></div>
    <div class="stat-card"><div class="stat-num">${entries.length}</div><div class="stat-label">Total</div></div>
  </div>` + entries.map(e => {
    const dt = e.datetime ? new Date(e.datetime) : null;
    const dtStr = dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    const typeIcon = e.type === 'review' ? '📝' : e.type === 'avoided' ? '✅' : e.type === 'note' ? '🗒' : '❌';
    return `<div class="journal-entry ${e.type || ''}"><div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:${e.text || e.photo ? '8' : '0'}px"><div style="flex:1"><div style="font-weight:600;font-size:13px">${typeIcon} ${e.habitId || (e.type === 'review' ? 'Weekly review' : 'Note')}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${dtStr}</div></div><button class="btn-icon" onclick="openEditJE('${e.id}')">✏️</button><button class="btn-icon danger" onclick="delJournal('${e.id}')">🗑</button></div>${e.text ? `<div style="font-size:13px;line-height:1.6;white-space:pre-wrap;color:var(--text2)">${e.text}</div>` : ''}${e.photo ? `<img src="${e.photo}" style="max-width:100%;max-height:240px;border-radius:8px;margin-top:8px">` : ''}</div>`;
  }).join('');
}
export function delJournal(id) { S.journal = S.journal.filter(j => j.id !== id); persistAfterMutation(); renderJournal(); }

export async function tryUnlockJournal() {
  const pc = document.getElementById('jlock-pass')?.value || '';
  const msg = document.getElementById('jlock-msg');
  if (!pc) { if (msg) msg.textContent = 'Enter passcode'; return; }
  try {
    const ok = await unlockJournal(pc);
    if (!ok) { if (msg) msg.textContent = 'Wrong passcode'; return; }
    document.getElementById('jlock-pass').value = '';
    if (msg) msg.textContent = '';
    renderJournal();
  } catch (e) {
    if (msg) msg.textContent = e.message || 'Unlock failed';
  }
}

export function lockJournalAction() { lockJournal(); renderJournal(); }

window.renderJournal = renderJournal;
window.openAddJournal = openAddJournal;
window.openEditJE = openEditJE;
window.setJType = setJType;
window.saveJournal = saveJournal;
window.delJournal = delJournal;
window.tryUnlockJournal = tryUnlockJournal;
window.lockJournalAction = lockJournalAction;
window.onJournalPhoto = onJournalPhoto;
