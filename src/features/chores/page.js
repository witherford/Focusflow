// Chores — extracted from focusflow_v10.html lines 1727-1762
import { S, uid, weekKey } from '../../core/state.js';
import { save } from '../../core/persistence.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let _dragId = null;

export function collapseChores() { DAYS.forEach(d => S.choreDayOpen[d] = false); save(); renderChores(); }
export function expandChores() { DAYS.forEach(d => S.choreDayOpen[d] = true); save(); renderChores(); }

export function renderChores() {
  const el = document.getElementById('chores-week'); if (!el) return;
  const log = S.choreLog[weekKey()] || {};
  el.innerHTML = DAYS.map(day => {
    const dc = S.chores.filter(c => c.day === day), open = S.choreDayOpen[day] !== false;
    const done = dc.filter(c => log[c.id]).length;
    return `<div class="day-card" id="cd-${day}" ondragover="event.preventDefault();this.classList.add('day-over')" ondragleave="this.classList.remove('day-over')" ondrop="dropDay(event,'${day}')">
      <div class="day-header" onclick="toggleChoreDay('${day}')">
        <div style="flex:1"><div class="card-title" style="margin:0;text-transform:none;font-size:14px;font-weight:600;color:var(--text)">${day}</div></div>
        <span style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace;margin-right:8px">${done}/${dc.length}</span>
        <span style="color:var(--text3);font-size:12px">${open ? '▾' : '▸'}</span>
      </div>
      ${open ? `<div style="padding:4px 12px 12px">${dc.length ? dc.map(c => `<div class="chore-row" draggable="true" ondragstart="startDrag(event,'${c.id}')" ondragover="event.preventDefault();event.stopPropagation();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="dropBefore(event,'${c.id}','${day}')">
        <span style="color:var(--text3);font-size:14px;cursor:grab;padding:0 2px">⠿</span>
        <div class="chore-check ${log[c.id] ? 'checked' : ''}" onclick="event.stopPropagation();toggleChore('${c.id}')">✓</div>
        <span style="flex:1;font-size:13px;font-weight:500" onclick="toggleChore('${c.id}')">${c.name}</span>
        <button class="btn-icon" onclick="openEditChore('${c.id}')">✏️</button>
        <button class="btn-icon danger" onclick="delChore('${c.id}')">✕</button>
      </div>`).join('') : '<div style="color:var(--text3);font-size:12px;padding:4px 0">No chores — drag one here or add a new one</div>'}</div>` : ''}
    </div>`;
  }).join('');
}

export function toggleChoreDay(day) { S.choreDayOpen[day] = !(S.choreDayOpen[day] !== false); save(); renderChores(); }
export function startDrag(e, id) { _dragId = id; setTimeout(() => e.target.closest('.chore-row').classList.add('dragging'), 0); e.dataTransfer.effectAllowed = 'move'; }
export function dropDay(e, day) { e.preventDefault(); e.currentTarget.classList.remove('day-over'); if (!_dragId) return; const c = S.chores.find(x => x.id === _dragId); if (c) c.day = day; _dragId = null; save(); renderChores(); }
export function dropBefore(e, tid, tDay) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('drag-over'); if (!_dragId || _dragId === tid) return; const c = S.chores.find(x => x.id === _dragId); if (!c) return; c.day = tDay; const fi = S.chores.findIndex(x => x.id === _dragId), ti = S.chores.findIndex(x => x.id === tid); if (fi > -1 && ti > -1) { const [item] = S.chores.splice(fi, 1); S.chores.splice(ti, 0, item); } _dragId = null; save(); renderChores(); }
export function toggleChore(id) { if (!S.choreLog[weekKey()]) S.choreLog[weekKey()] = {}; S.choreLog[weekKey()][id] = !S.choreLog[weekKey()][id]; save(); renderChores(); }
export function openAddChore() { document.getElementById('m-chore-title').textContent = 'Add Chore'; document.getElementById('chore-edit-id').value = ''; document.getElementById('chore-name').value = ''; document.getElementById('m-chore').style.display = 'flex'; }
export function openEditChore(id) { const c = S.chores.find(x => x.id === id); if (!c) return; document.getElementById('m-chore-title').textContent = 'Edit Chore'; document.getElementById('chore-edit-id').value = id; document.getElementById('chore-name').value = c.name; document.getElementById('chore-day').value = c.day || 'Monday'; document.getElementById('m-chore').style.display = 'flex'; }
export function saveChore() { const name = document.getElementById('chore-name').value.trim(); if (!name) return; const editId = document.getElementById('chore-edit-id').value, data = { name, day: document.getElementById('chore-day').value }; if (editId) { const c = S.chores.find(x => x.id === editId); if (c) Object.assign(c, data); } else S.chores.push({ id: uid(), ...data }); save(); window.closeModal('m-chore'); renderChores(); }
export function delChore(id) { S.chores = S.chores.filter(c => c.id !== id); save(); renderChores(); }

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
