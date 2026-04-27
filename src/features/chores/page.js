// Chores — supports per-chore repeat / timeframe / reset-override.
import { S, uid } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { effectivePeriodKey, resetCaption } from './period.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ANY_KEY = 'AnyTime';
let _dragId = null;

function ensureDefaults(c) {
  if (!c.repeat) c.repeat = 'weekly';
  if (!c.timeframe) c.timeframe = 'specific-day';
  return c;
}

function logFor(chore, today = new Date()) {
  const key = effectivePeriodKey(chore, today);
  if (!S.choreLog[key]) S.choreLog[key] = {};
  return S.choreLog[key];
}

function isDone(chore, today = new Date()) {
  return !!logFor(chore, today)[chore.id];
}

export function collapseChores() { DAYS.forEach(d => S.choreDayOpen[d] = false); S.choreDayOpen[ANY_KEY] = false; save(); renderChores(); }
export function expandChores()   { DAYS.forEach(d => S.choreDayOpen[d] = true);  S.choreDayOpen[ANY_KEY] = true;  save(); renderChores(); }

export function renderChores() {
  S.chores.forEach(ensureDefaults);
  const el = document.getElementById('chores-week'); if (!el) return;
  // Buckets: any-time (collapsed at top), then each weekday.
  const anyTime = S.chores.filter(c => c.timeframe === 'any-time');
  const buckets = [
    { key: ANY_KEY, label: '🌀 Any time this period', list: anyTime, isAny: true },
    ...DAYS.map(d => ({ key: d, label: d, list: S.chores.filter(c => c.timeframe !== 'any-time' && c.day === d), isAny: false })),
  ];

  el.innerHTML = buckets.map(b => {
    const open = S.choreDayOpen?.[b.key] !== false;
    const dc = b.list;
    if (b.isAny && !dc.length) return '';
    const done = dc.filter(c => isDone(c)).length;
    const dropAttrs = b.isAny ? '' : `ondragover="event.preventDefault();this.classList.add('day-over')" ondragleave="this.classList.remove('day-over')" ondrop="dropDay(event,'${b.key}')"`;
    return `<div class="day-card" id="cd-${b.key}" ${dropAttrs}>
      <div class="day-header" onclick="toggleChoreDay('${b.key}')">
        <div style="flex:1"><div class="card-title" style="margin:0;text-transform:none;font-size:14px;font-weight:600;color:var(--text)">${b.label}</div></div>
        <span style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace;margin-right:8px">${done}/${dc.length}</span>
        <span style="color:var(--text3);font-size:12px">${open ? '▾' : '▸'}</span>
      </div>
      ${open ? `<div style="padding:4px 12px 12px">${dc.length ? dc.map(c => renderChoreRow(c, b.key)).join('') : `<div style="color:var(--text3);font-size:12px;padding:4px 0">${b.isAny ? 'Set a chore’s timeframe to "Any time" to put it here' : 'No chores — drag one here or add a new one'}</div>`}</div>` : ''}
    </div>`;
  }).join('');
}

function renderChoreRow(c, dayKey) {
  const checked = isDone(c);
  const reset = resetCaption(c);
  return `<div class="chore-row" draggable="true" ondragstart="startDrag(event,'${c.id}')" ondragover="event.preventDefault();event.stopPropagation();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="dropBefore(event,'${c.id}','${dayKey}')">
    <span style="color:var(--text3);font-size:14px;cursor:grab;padding:0 2px">⠿</span>
    <div class="chore-check ${checked ? 'checked' : ''}" onclick="event.stopPropagation();toggleChore('${c.id}')">✓</div>
    <div style="flex:1;min-width:0" onclick="toggleChore('${c.id}')">
      <div style="font-size:13px;font-weight:500">${c.name}</div>
      <div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace">${reset}${c.repeat && c.repeat !== 'weekly' ? ` · ${c.repeat}` : ''}</div>
    </div>
    <button class="btn-icon" onclick="openEditChore('${c.id}')">✏️</button>
    <button class="btn-icon danger" onclick="delChore('${c.id}')">🗑</button>
  </div>`;
}

export function toggleChoreDay(day) { S.choreDayOpen[day] = !(S.choreDayOpen[day] !== false); save(); renderChores(); }

export function startDrag(e, id) { _dragId = id; setTimeout(() => e.target.closest('.chore-row').classList.add('dragging'), 0); e.dataTransfer.effectAllowed = 'move'; }

export function dropDay(e, day) {
  e.preventDefault(); e.currentTarget.classList.remove('day-over');
  if (!_dragId) return;
  const c = S.chores.find(x => x.id === _dragId); if (c) { c.day = day; c.timeframe = 'specific-day'; }
  _dragId = null; save(); renderChores();
}

export function dropBefore(e, tid, tDay) {
  e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('drag-over');
  if (!_dragId || _dragId === tid) return;
  const c = S.chores.find(x => x.id === _dragId); if (!c) return;
  c.day = tDay === 'AnyTime' ? c.day : tDay;
  if (tDay === 'AnyTime') c.timeframe = 'any-time'; else c.timeframe = 'specific-day';
  const fi = S.chores.findIndex(x => x.id === _dragId), ti = S.chores.findIndex(x => x.id === tid);
  if (fi > -1 && ti > -1) { const [item] = S.chores.splice(fi, 1); S.chores.splice(ti, 0, item); }
  _dragId = null; save(); renderChores();
}

export function toggleChore(id) {
  const c = S.chores.find(x => x.id === id); if (!c) return;
  ensureDefaults(c);
  const log = logFor(c);
  const cur = !!log[id];
  log[id] = !cur;
  if (!cur) c.lastDoneAt = new Date().toISOString().slice(0, 10);
  save(); renderChores();
}

export function openAddChore() {
  document.getElementById('m-chore-title').textContent = 'Add Chore';
  document.getElementById('chore-edit-id').value = '';
  document.getElementById('chore-name').value = '';
  setVal('chore-day', 'Monday');
  setVal('chore-repeat', 'weekly');
  setVal('chore-timeframe', 'specific-day');
  setVal('chore-custom-days', '');
  setVal('chore-reset-override', '');
  toggleChoreCustomFields();
  toggleChoreTimeframeFields();
  document.getElementById('m-chore').style.display = 'flex';
}

export function openEditChore(id) {
  const c = S.chores.find(x => x.id === id); if (!c) return;
  ensureDefaults(c);
  document.getElementById('m-chore-title').textContent = 'Edit Chore';
  document.getElementById('chore-edit-id').value = id;
  document.getElementById('chore-name').value = c.name;
  setVal('chore-day', c.day || 'Monday');
  setVal('chore-repeat', c.repeat || 'weekly');
  setVal('chore-timeframe', c.timeframe || 'specific-day');
  setVal('chore-custom-days', c.customDays || '');
  setVal('chore-reset-override', c.resetOverride || '');
  toggleChoreCustomFields();
  toggleChoreTimeframeFields();
  document.getElementById('m-chore').style.display = 'flex';
}

function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }

export function toggleChoreCustomFields() {
  const repeat = document.getElementById('chore-repeat')?.value;
  const wrap = document.getElementById('chore-custom-wrap');
  if (wrap) wrap.style.display = repeat === 'custom' ? '' : 'none';
}

export function toggleChoreTimeframeFields() {
  const tf = document.getElementById('chore-timeframe')?.value;
  const dayWrap = document.getElementById('chore-day-wrap');
  if (dayWrap) dayWrap.style.display = tf === 'any-time' ? 'none' : '';
}

export function saveChore() {
  const name = document.getElementById('chore-name').value.trim(); if (!name) return;
  const editId = document.getElementById('chore-edit-id').value;
  const data = {
    name,
    day: document.getElementById('chore-day').value,
    repeat: document.getElementById('chore-repeat')?.value || 'weekly',
    timeframe: document.getElementById('chore-timeframe')?.value || 'specific-day',
    customDays: parseInt(document.getElementById('chore-custom-days')?.value) || undefined,
    resetOverride: document.getElementById('chore-reset-override')?.value || undefined,
  };
  if (editId) { const c = S.chores.find(x => x.id === editId); if (c) Object.assign(c, data); }
  else S.chores.push({ id: uid(), ...data });
  save(); window.closeModal('m-chore'); renderChores();
}

export function delChore(id) {
  const idx = S.chores.findIndex(c => c.id === id); if (idx < 0) return;
  const removed = S.chores[idx];
  S.chores.splice(idx, 1);
  save(); renderChores();
  window.toastUndo?.(`Removed "${removed.name}"`, () => { S.chores.splice(idx, 0, removed); save(); renderChores(); });
}

window.renderChores = renderChores;
window.toggleChoreDay = toggleChoreDay;
window.startDrag = startDrag;
window.dropDay = dropDay;
window.dropBefore = dropBefore;
window.toggleChore = toggleChore;
window.openAddChore = openAddChore;
window.openEditChore = openEditChore;
window.saveChore = saveChore;
window.delChore = delChore;
window.collapseChores = collapseChores;
window.expandChores = expandChores;
window.toggleChoreCustomFields = toggleChoreCustomFields;
window.toggleChoreTimeframeFields = toggleChoreTimeframeFields;
