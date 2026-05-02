// Medication & Supplements — track meds/supplements, dose reminders, reorder
// alerts, and optional habit integration.
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { schedule, ensurePermission } from '../../platform/notifications.js';
import { attachReorder, reorderArr } from '../../ui/dragReorder.js';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function meds()   { if (!Array.isArray(S.meds)) S.meds = []; return S.meds; }
function groups() { if (!Array.isArray(S.medGroups)) S.medGroups = []; return S.medGroups; }

function blockForTime(hhmm) {
  const [h] = (hhmm || '08:00').split(':').map(Number);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'allday';
}

function dayName() { return new Date().toLocaleDateString('en-GB', { weekday: 'short' }); }

// ── Reminders ───────────────────────────────────────────────────────────────
// ── Reorder-schedule helpers ────────────────────────────────────────────────
function lastDayOfMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function isWeekday(d) { const day = d.getDay(); return day !== 0 && day !== 6; }
function firstWorkingDay(y, m) { const d = new Date(y, m, 1); while (!isWeekday(d)) d.setDate(d.getDate() + 1); return d; }
function lastWorkingDay(y, m)  { const d = new Date(y, m, lastDayOfMonth(y, m)); while (!isWeekday(d)) d.setDate(d.getDate() - 1); return d; }

// Compute the next firing date for a reorderSchedule string.
// Returns a Date in the future (relative to `from`), or null for invalid/empty schedules.
export function nextReorderAt(schedule, from = new Date(), referenceDay = null) {
  if (!schedule) return null;
  const m = schedule.match(/^(same-day|first-day|last-day|first-wd|last-wd)-(\d+)m$/);
  if (!m) return null;
  const kind = m[1]; const months = parseInt(m[2], 10);
  const start = new Date(from); start.setHours(9, 0, 0, 0);
  // Try this month and the next few cycles; pick the first occurrence after `from`.
  for (let i = 0; i < 24; i++) {
    const probe = new Date(start.getFullYear(), start.getMonth() + i, 1);
    let candidate;
    if (kind === 'same-day') {
      const day = referenceDay || start.getDate();
      candidate = new Date(probe.getFullYear(), probe.getMonth(), Math.min(day, lastDayOfMonth(probe.getFullYear(), probe.getMonth())));
    } else if (kind === 'first-day') {
      candidate = new Date(probe.getFullYear(), probe.getMonth(), 1);
    } else if (kind === 'last-day') {
      candidate = new Date(probe.getFullYear(), probe.getMonth(), lastDayOfMonth(probe.getFullYear(), probe.getMonth()));
    } else if (kind === 'first-wd') {
      candidate = firstWorkingDay(probe.getFullYear(), probe.getMonth());
    } else if (kind === 'last-wd') {
      candidate = lastWorkingDay(probe.getFullYear(), probe.getMonth());
    }
    candidate.setHours(9, 0, 0, 0);
    // Only keep if it falls on the right cycle (every N months relative to start month)
    const monthDiff = (candidate.getFullYear() - start.getFullYear()) * 12 + (candidate.getMonth() - start.getMonth());
    if (monthDiff % months !== 0) continue;
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  return null;
}

async function scheduleMedReminders(med) {
  if (!med?.schedule?.times?.length) return;
  await ensurePermission().catch(() => false);
  const days = (med.schedule.activeDays && med.schedule.activeDays.length) ? med.schedule.activeDays : DAYS;
  // Time-based reorder reminder (independent of stock level)
  if (med.reorderSchedule) {
    const at = nextReorderAt(med.reorderSchedule, new Date(), med._reorderRefDay || null);
    if (at) {
      schedule({
        id: hashId('med-reorder-sched-' + med.id),
        title: `Reorder ${med.name}`,
        body: `Scheduled reorder reminder`,
        at,
      }).catch(() => {});
    }
  }
  med.schedule.times.forEach(t => {
    const [h, m] = t.split(':').map(Number);
    // Schedule next occurrence (best-effort) — find the next active-day match.
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(now); d.setDate(now.getDate() + i); d.setHours(h || 0, m || 0, 0, 0);
      const dn = d.toLocaleDateString('en-GB', { weekday: 'short' });
      if (!days.includes(dn)) continue;
      if (d.getTime() <= Date.now()) continue;
      schedule({
        id: hashId('med-' + med.id + '-' + t),
        title: `Take ${med.name}`,
        body: med.dose ? `${med.dose.amount || ''} ${med.dose.unit || ''}`.trim() : '',
        at: d,
      }).catch(() => {});
      break;
    }
  });
  if ((med.qtyOnHand ?? 99) <= (med.reorderThreshold ?? 0) && med.reorderThreshold > 0) {
    schedule({
      id: hashId('med-reorder-' + med.id),
      title: `Reorder ${med.name}`,
      body: `Stock low — ${med.qtyOnHand} left`,
      at: new Date(Date.now() + 60_000),
    }).catch(() => {});
  }
}

function hashId(s) {
  let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483000;
}

// ── Habit integration ───────────────────────────────────────────────────────
function clearMedHabits(medId) {
  const tag = 'med:' + medId;
  S.habits = (S.habits || []).filter(h => h.managedBy !== tag);
}

const KIND_ICON = { medication: '💊', supplement: '🌿', peptide: '🧪' };
const KIND_LABEL = { medication: 'Medication', supplement: 'Supplement', peptide: 'Peptide' };

function syncMedHabits(med) {
  clearMedHabits(med.id);
  if (!med.asHabit) return;
  const times = med.schedule?.times || [];
  if (!times.length) return;
  const tag = 'med:' + med.id;
  times.forEach(t => {
    S.habits.push({
      id: 'medh-' + med.id + '-' + t.replace(':', ''),
      name: `${med.name} @ ${t}`,
      kind: 'good',
      block: blockForTime(t),
      icon: KIND_ICON[med.kind] || '💊',
      mode: 'binary',
      activeDays: (med.schedule.activeDays && med.schedule.activeDays.length) ? med.schedule.activeDays.slice() : null,
      linkedType: 'medication',
      linkedRefId: med.id,
      managedBy: tag,
      medCategory: med.kind,
      expiryDate: med.expiryDate || null,
      noExpiry: !!med.noExpiry,
      journalPrompt: false,
    });
  });
}

// ── Modal: medication ───────────────────────────────────────────────────────
function setWeekdayPicker(containerId, days) {
  const set = new Set(days || DAYS);
  document.querySelectorAll(`#${containerId} input[type=checkbox]`).forEach(cb => {
    cb.checked = !days || days.length === 0 ? true : set.has(cb.dataset.day);
  });
}
function readWeekdayPicker(containerId) {
  const all = [...document.querySelectorAll(`#${containerId} input[type=checkbox]`)];
  const on = all.filter(cb => cb.checked).map(cb => cb.dataset.day);
  return on.length === 7 ? null : on;
}

function renderTimeRow(time = '08:00') {
  const wrap = document.getElementById('med-times-list'); if (!wrap) return;
  const row = document.createElement('div');
  row.className = 'med-time-row';
  row.style.cssText = 'display:flex;gap:6px;margin-bottom:4px;align-items:center';
  row.innerHTML = `<span style="font-size:11px;color:var(--text3);width:34px">Time</span><input type="time" value="${time}" style="flex:1"><button type="button" class="btn btn-xs" title="Remove time">Remove</button>`;
  row.querySelector('button').onclick = () => row.remove();
  wrap.appendChild(row);
}

export function addMedTime() { renderTimeRow('08:00'); }

export function onDoseUnitChange() {
  const sel = document.getElementById('med-dose-unit-sel');
  const row = document.getElementById('med-dose-unit-custom-row');
  if (!sel || !row) return;
  row.style.display = sel.value === 'custom' ? '' : 'none';
}

export function onNoExpiryChange() {
  const cb = document.getElementById('med-no-expiry');
  const inp = document.getElementById('med-expiry');
  if (!cb || !inp) return;
  inp.disabled = cb.checked;
  if (cb.checked) inp.value = '';
}

function readTimes() {
  return [...document.querySelectorAll('#med-times-list input[type=time]')]
    .map(inp => inp.value).filter(Boolean);
}

function populateGroupSelect(selId, current = '') {
  const sel = document.getElementById(selId); if (!sel) return;
  const gs = groups();
  sel.innerHTML = '<option value="">— Ungrouped —</option>' + gs.map(g => `<option value="${g.id}"${current === g.id ? ' selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
}

export function openMedModal(id) {
  const editing = id ? meds().find(m => m.id === id) : null;
  document.getElementById('m-medication-title').textContent = editing ? 'Edit medication' : 'Add medication';
  document.getElementById('med-edit-id').value = editing?.id || '';
  document.getElementById('med-name').value = editing?.name || '';
  document.getElementById('med-kind').value = editing?.kind || 'medication';
  document.getElementById('med-prescribed').value = editing?.prescribed ? 'true' : 'false';
  document.getElementById('med-prescriber-type').value = editing?.prescriber?.type || '';
  document.getElementById('med-prescriber-name').value = editing?.prescriber?.name || '';
  document.getElementById('med-delivery').value = editing?.delivery || 'pill';
  document.getElementById('med-dose-amt').value = editing?.dose?.amount ?? '';
  // Dose unit — match against preset list, else fall back to custom.
  const unitSel = document.getElementById('med-dose-unit-sel');
  const unitCustom = document.getElementById('med-dose-unit-custom');
  const presetUnits = ['tablet','capsule','ml','L','mg','mcg','g','units','IU','drops','puff','spray','patch','scoop'];
  const u = editing?.dose?.unit || 'tablet';
  if (presetUnits.includes(u)) { unitSel.value = u; unitCustom.value = ''; }
  else { unitSel.value = 'custom'; unitCustom.value = u; }
  onDoseUnitChange();
  document.getElementById('med-qty').value = editing?.qtyOnHand ?? '';
  document.getElementById('med-reorder').value = editing?.reorderThreshold ?? '';
  document.getElementById('med-reorder-schedule').value = editing?.reorderSchedule || '';
  document.getElementById('med-expiry').value = editing?.expiryDate || '';
  document.getElementById('med-no-expiry').checked = !!editing?.noExpiry;
  onNoExpiryChange();
  document.getElementById('med-as-habit').checked = !!editing?.asHabit;
  document.getElementById('med-notes').value = editing?.notes || '';
  setWeekdayPicker('med-weekday-picker', editing?.schedule?.activeDays || null);
  const list = document.getElementById('med-times-list'); if (list) list.innerHTML = '';
  const times = editing?.schedule?.times || ['08:00'];
  times.forEach(t => renderTimeRow(t));
  populateGroupSelect('med-group', editing?.groupId || '');
  document.getElementById('m-medication').style.display = 'flex';
}

export function saveMedication() {
  const name = document.getElementById('med-name').value.trim();
  if (!name) { window.toast?.('Name required'); return; }
  const id = document.getElementById('med-edit-id').value || uid();
  const existing = meds().find(m => m.id === id);
  const med = existing || { id };
  med.name = name;
  med.kind = document.getElementById('med-kind').value;
  med.prescribed = document.getElementById('med-prescribed').value === 'true';
  med.prescriber = {
    type: document.getElementById('med-prescriber-type').value,
    name: document.getElementById('med-prescriber-name').value.trim(),
  };
  med.delivery = document.getElementById('med-delivery').value;
  const unitSel = document.getElementById('med-dose-unit-sel').value;
  const unitCustom = document.getElementById('med-dose-unit-custom').value.trim();
  med.dose = {
    amount: parseFloat(document.getElementById('med-dose-amt').value) || 0,
    unit: unitSel === 'custom' ? (unitCustom || 'unit') : unitSel,
  };
  med.qtyOnHand = parseInt(document.getElementById('med-qty').value, 10) || 0;
  med.reorderThreshold = parseInt(document.getElementById('med-reorder').value, 10) || 0;
  med.reorderSchedule = document.getElementById('med-reorder-schedule').value || null;
  med.expiryDate = document.getElementById('med-expiry').value || null;
  med.noExpiry = !!document.getElementById('med-no-expiry').checked;
  med.schedule = {
    activeDays: readWeekdayPicker('med-weekday-picker'),
    times: readTimes(),
  };
  med.asHabit = !!document.getElementById('med-as-habit').checked;
  med.groupId = document.getElementById('med-group').value || null;
  med.notes = document.getElementById('med-notes').value;
  if (!existing) meds().push(med);

  syncMedHabits(med);
  scheduleMedReminders(med);
  haptic('medium'); save();
  window.closeModal?.('m-medication');
  renderMedication();
  window.renderHabitsToday?.(); window.renderHabitsAll?.(); window.renderDash?.();
}

export function deleteMedication(id) {
  if (!confirm('Delete this medication?')) return;
  S.meds = meds().filter(m => m.id !== id);
  clearMedHabits(id);
  save(); renderMedication();
  window.renderHabitsToday?.(); window.renderHabitsAll?.(); window.renderDash?.();
}

// Mark a dose taken — decrements stock and ticks linked habits for today.
export function markDoseTaken(medId, time) {
  const m = meds().find(x => x.id === medId); if (!m) return;
  if (m.qtyOnHand > 0) m.qtyOnHand -= (m.dose?.amount || 1);
  if (m.qtyOnHand < 0) m.qtyOnHand = 0;
  if (!S.medLog) S.medLog = {};
  const k = today();
  if (!S.medLog[k]) S.medLog[k] = {};
  if (!S.medLog[k][medId]) S.medLog[k][medId] = [];
  if (!S.medLog[k][medId].includes(time)) S.medLog[k][medId].push(time);
  // Tick associated habit if exists for this time
  const hid = 'medh-' + medId + '-' + time.replace(':', '');
  if (!S.habitLog[k]) S.habitLog[k] = {};
  S.habitLog[k][hid] = true;
  haptic('light'); save();
  renderMedication();
  window.renderHabitsToday?.(); window.renderHabitsAll?.(); window.renderDash?.();
}

// ── Group modals ────────────────────────────────────────────────────────────
export function openMedGroupModal(id) {
  const editing = id ? groups().find(g => g.id === id) : null;
  document.getElementById('m-medication-group-title').textContent = editing ? 'Edit group' : 'New group';
  document.getElementById('med-group-edit-id').value = editing?.id || '';
  document.getElementById('med-group-name').value = editing?.name || '';
  document.getElementById('m-medication-group').style.display = 'flex';
}

export function saveMedGroup() {
  const name = document.getElementById('med-group-name').value.trim();
  if (!name) return;
  const id = document.getElementById('med-group-edit-id').value || uid();
  const existing = groups().find(g => g.id === id);
  if (existing) existing.name = name;
  else groups().push({ id, name, order: groups().length });
  save(); window.closeModal?.('m-medication-group'); renderMedication();
}

export function deleteMedGroup(id) {
  if (!confirm('Delete group? Members move to Ungrouped.')) return;
  S.medGroups = groups().filter(g => g.id !== id);
  meds().forEach(m => { if (m.groupId === id) m.groupId = null; });
  save(); renderMedication();
}

export function moveMedToGroup(medId, groupId) {
  const m = meds().find(x => x.id === medId); if (!m) return;
  m.groupId = groupId || null;
  save(); renderMedication();
}

// ── Render ──────────────────────────────────────────────────────────────────
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function lowStockBanner() {
  const low = meds().filter(m => m.reorderThreshold > 0 && (m.qtyOnHand ?? 0) <= m.reorderThreshold);
  const el = document.getElementById('med-reorder-banner'); if (!el) return;
  if (!low.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card" style="border-color:var(--gold);background:var(--surface)">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:18px">⚠️</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px;margin-bottom:2px">Time to reorder</div>
        <div style="font-size:12px;color:var(--text3)">${low.map(m => `${escapeHtml(m.name)} (${m.qtyOnHand} left)`).join(' · ')}</div>
      </div>
    </div>
  </div>`;
}

const reorderDetach = {};

function renderMemberRow(m) {
  const next = (m.schedule?.times || [])[0] || '';
  const groupOpts = '<option value="">— Ungrouped —</option>' + groups().map(g => `<option value="${g.id}"${m.groupId === g.id ? ' selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
  const lowCls = (m.reorderThreshold > 0 && (m.qtyOnHand ?? 0) <= m.reorderThreshold) ? 'color:var(--rose)' : '';
  const taken = (S.medLog?.[today()]?.[m.id] || []);
  const timesHtml = (m.schedule?.times || []).map(t => {
    const done = taken.includes(t);
    return `<button type="button" class="btn btn-xs" style="${done ? 'opacity:.5;text-decoration:line-through' : ''}" onclick="markDoseTaken('${m.id}','${t}')" title="Mark dose taken">${done ? '✓ ' : ''}${t}</button>`;
  }).join(' ');
  return `<div class="med-row" data-med-id="${m.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:6px;background:var(--surface)">
    <span class="med-drag-handle" style="cursor:grab;color:var(--text3);user-select:none;touch-action:none;font-size:14px" title="Drag to reorder">≡</span>
    <span style="font-size:18px">${KIND_ICON[m.kind] || '💊'}</span>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:14px">${escapeHtml(m.name)} <span class="badge" style="font-size:10px">${KIND_LABEL[m.kind] || 'Medication'}</span>${m.prescribed ? ' <span class="badge badge-violet" style="font-size:10px">Rx</span>' : ''}${m.expiryDate && !m.noExpiry ? ` <span class="badge ${m.expiryDate < today() ? 'badge-rose' : ''}" style="font-size:10px" title="Expires ${m.expiryDate}">exp ${m.expiryDate}</span>` : ''}</div>
      <div style="font-size:11px;color:var(--text3)">${m.dose?.amount || ''} ${escapeHtml(m.dose?.unit || '')} · ${escapeHtml(m.delivery || 'pill')} · next ${next || '—'}</div>
      <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${timesHtml}</div>
    </div>
    <div style="text-align:right;font-size:11px">
      <div style="${lowCls}"><strong>${m.qtyOnHand ?? 0}</strong> left</div>
      <select class="med-move-grp" onchange="moveMedToGroup('${m.id}', this.value)" style="font-size:11px;padding:2px 4px;margin-top:2px">${groupOpts}</select>
    </div>
    <button class="btn btn-xs" onclick="openMedModal('${m.id}')" title="Edit">✎</button>
    <button class="btn btn-xs" onclick="deleteMedication('${m.id}')" title="Delete">×</button>
  </div>`;
}

export function renderMedication() {
  lowStockBanner();
  const root = document.getElementById('med-content'); if (!root) return;
  const all = meds();
  if (!all.length && !groups().length) {
    root.innerHTML = '<div class="empty-state"><div class="es-icon">💊</div><div class="es-sub">No medication or supplements yet — tap + Add to start tracking.</div></div>';
    return;
  }
  // Cleanup prior reorder handlers
  Object.values(reorderDetach).forEach(fn => { try { fn?.(); } catch {} });
  Object.keys(reorderDetach).forEach(k => delete reorderDetach[k]);

  const sections = [];
  groups().forEach(g => {
    const members = all.filter(m => m.groupId === g.id);
    sections.push(`<div class="card" style="margin-bottom:14px" data-med-group="${g.id}">
      <div class="card-header"><div class="card-title">${escapeHtml(g.name)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-xs" onclick="openMedGroupModal('${g.id}')">Edit</button>
          <button class="btn btn-xs" onclick="deleteMedGroup('${g.id}')">×</button>
        </div>
      </div>
      <div class="med-group-list" data-group-id="${g.id}">${members.map(renderMemberRow).join('') || '<div class="caption">Empty group — assign meds via the dropdown on each row.</div>'}</div>
    </div>`);
  });
  const ungrouped = all.filter(m => !m.groupId || !groups().find(g => g.id === m.groupId));
  if (ungrouped.length || groups().length === 0) {
    sections.push(`<div class="card" style="margin-bottom:14px"><div class="card-header"><div class="card-title">Ungrouped</div></div><div class="med-group-list" data-group-id="">${ungrouped.map(renderMemberRow).join('') || '<div class="caption">No items.</div>'}</div></div>`);
  }
  root.innerHTML = sections.join('');

  // Attach drag-reorder per group container
  document.querySelectorAll('.med-group-list').forEach(list => {
    const gid = list.dataset.groupId || '';
    const detach = attachReorder(list, {
      itemSelector: '.med-row',
      handleSelector: '.med-drag-handle',
      onReorder: (from, to) => {
        const inGroup = meds().filter(m => (m.groupId || '') === gid);
        const moved = inGroup[from]; const target = inGroup[to];
        if (!moved || !target) return;
        const fromIdx = meds().indexOf(moved);
        const toIdx = meds().indexOf(target);
        reorderArr(meds(), fromIdx, toIdx);
        save(); renderMedication();
      },
    });
    reorderDetach[gid || '_un'] = detach;
  });
}

// Hooks for linked-habit picker (lists meds for choosing in habit modal)
export function listMedsForPicker() {
  return meds().map(m => ({ id: m.id, name: m.name, kind: m.kind }));
}

window.onDoseUnitChange = onDoseUnitChange;
window.onNoExpiryChange = onNoExpiryChange;
window.openMedModal = openMedModal;
window.saveMedication = saveMedication;
window.deleteMedication = deleteMedication;
window.openMedGroupModal = openMedGroupModal;
window.saveMedGroup = saveMedGroup;
window.deleteMedGroup = deleteMedGroup;
window.moveMedToGroup = moveMedToGroup;
window.markDoseTaken = markDoseTaken;
window.addMedTime = addMedTime;
window.renderMedication = renderMedication;
window.listMedsForPicker = listMedsForPicker;
