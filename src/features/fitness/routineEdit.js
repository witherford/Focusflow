// Routine editor — opens a modal to edit any routine. Built-in (library)
// routines are cloned into S.training.customRoutines on first edit so the
// originals stay pristine.
import { S, uid } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { ROUTINE_LIBRARY, getRoutine, dayToSections } from './routines.js';

let _editId = null;
let _draft = null; // local working copy

function ensureCustom() {
  if (!S.training) S.training = { activeRoutineId: null, customRoutines: [], history: [], autoHabit: false };
  if (!Array.isArray(S.training.customRoutines)) S.training.customRoutines = [];
  return S.training.customRoutines;
}

// Ensure a deep, normalised copy of a routine in the new section-aware shape.
function normalise(routine) {
  const days = {};
  for (const [label, day] of Object.entries(routine.days || {})) {
    const sections = dayToSections(day).map(s => ({
      id: s.id || uid(),
      name: s.name || 'Section',
      type: s.type || 'lift',
      cardioType: s.cardioType,
      intervals: s.intervals,
      exercises: (s.exercises || []).map(ex => ({
        exercise: ex.exercise || ex.name || 'Exercise',
        sets: ex.sets || 3, reps: ex.reps || 8,
        start: ex.start || 0,
        // Cardio exercise spec is just descriptive
        ...(ex.duration ? { duration: ex.duration } : {}),
      })),
    }));
    days[label] = { sections };
  }
  return JSON.parse(JSON.stringify({
    id: routine.id, name: routine.name, desc: routine.desc || '',
    schedule: [...(routine.schedule || ['rest','rest','rest','rest','rest','rest','rest'])],
    progression: routine.progression || 'manual',
    rates: routine.rates ? { ...routine.rates } : undefined,
    days,
  }));
}

export function openRoutineEditor(routineId) {
  const t = S.training || {};
  // If the target is a library routine, clone into customRoutines first.
  let target = (t.customRoutines || []).find(r => r.id === routineId);
  if (!target) {
    const lib = ROUTINE_LIBRARY.find(r => r.id === routineId);
    if (!lib) return;
    target = normalise(lib);
    target.id = 'cr-' + uid();
    target.name = lib.name + ' (mine)';
    ensureCustom().push(target);
    // If the library routine was active, rebind activation to the clone.
    if (t.activeRoutineId === lib.id) t.activeRoutineId = target.id;
    save();
    window.toast?.('Cloned into your custom routines');
  }
  _editId = target.id;
  _draft = normalise(target);
  ensureModal();
  renderEditor();
  document.getElementById('m-routine-edit').style.display = 'flex';
}

export function createNewRoutine() {
  const name = prompt('Name your new routine:', 'My routine');
  if (!name || !name.trim()) return;
  const r = normalise({ id: 'cr-' + uid(), name: name.trim(), desc: '', progression: 'manual', schedule: ['rest','rest','rest','rest','rest','rest','rest'], days: {} });
  ensureCustom().push(r);
  save();
  openRoutineEditor(r.id);
}

export function deleteRoutine(routineId) {
  const list = ensureCustom();
  const idx = list.findIndex(r => r.id === routineId); if (idx < 0) return;
  const removed = list[idx];
  if (!confirm(`Delete custom routine "${removed.name}"? This cannot be undone.`)) return;
  list.splice(idx, 1);
  if (S.training.activeRoutineId === routineId) S.training.activeRoutineId = null;
  save();
  window.renderTraining?.();
  window.toast?.('Routine deleted');
}

// ── Editor UI ───────────────────────────────────────────────────────────────
function ensureModal() {
  if (document.getElementById('m-routine-edit')) return;
  const html = `<div class="modal-overlay" id="m-routine-edit" style="display:none"><div class="modal" style="max-width:680px;max-height:92vh;overflow-y:auto">
    <div class="modal-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="modal-title" style="margin:0">Edit routine</div>
      <button class="btn-icon" onclick="closeModal('m-routine-edit')">✕</button>
    </div>
    <div id="re-content"></div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="saveRoutineEdit()">💾 Save</button>
      <button class="btn" onclick="closeModal('m-routine-edit')">Cancel</button>
    </div>
  </div></div>`;
  const wrap = document.createElement('div'); wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
}

const SCHEDULE_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function renderEditor() {
  const el = document.getElementById('re-content'); if (!el || !_draft) return;
  // Build set of day-label tokens from the schedule (excluding 'rest').
  const labels = Array.from(new Set(_draft.schedule.filter(d => d && d !== 'rest')));
  el.innerHTML = `
    <div class="form-row"><label>Name</label><input type="text" id="re-name" value="${escAttr(_draft.name)}"></div>
    <div class="form-row"><label>Description</label><input type="text" id="re-desc" value="${escAttr(_draft.desc || '')}"></div>
    <div class="form-row"><label>Progression scheme</label><select id="re-prog">
      <option value="manual"${_draft.progression === 'manual' ? ' selected' : ''}>Manual (no auto-progression)</option>
      <option value="linear-2.5kg"${_draft.progression === 'linear-2.5kg' ? ' selected' : ''}>Linear (per-lift defaults)</option>
      <option value="doublePr"${_draft.progression === 'doublePr' ? ' selected' : ''}>Double progression (reps then weight)</option>
    </select></div>

    <div class="card-header" style="margin-top:14px"><div class="card-title">Weekly schedule</div></div>
    <div class="form-grid" style="grid-template-columns:repeat(7,1fr);gap:6px">
      ${SCHEDULE_LABELS.map((d, i) => `<div class="form-row" style="margin:0">
        <label style="font-size:10px">${d}</label>
        <input type="text" id="re-sch-${i}" value="${escAttr(_draft.schedule[i] || 'rest')}" placeholder="rest" style="font-size:12px">
      </div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:4px">Type a day label (e.g. "Push", "A") for training days, or "rest" to skip.</div>

    <div class="card-header" style="margin-top:14px"><div class="card-title">Workout days</div></div>
    ${labels.length ? labels.map(label => renderDayEditor(label)).join('') : '<div class="caption">Add a non-rest day above to start configuring workouts.</div>'}
  `;
  // Wire schedule inputs to live-update labels list when user changes them.
  for (let i = 0; i < 7; i++) {
    const inp = document.getElementById('re-sch-' + i);
    if (inp) inp.addEventListener('change', () => {
      _draft.schedule[i] = inp.value.trim() || 'rest';
      renderEditor();
    });
  }
}

function renderDayEditor(label) {
  const day = _draft.days[label] || { sections: [] };
  if (!_draft.days[label]) _draft.days[label] = day;
  return `<div class="day-editor">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div style="font-weight:700">${label}</div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-xs" onclick="reAddSection('${label}','lift')">+ Lift section</button>
        <button class="btn btn-xs" onclick="reAddSection('${label}','cardio')">+ Cardio section</button>
      </div>
    </div>
    ${day.sections.length ? day.sections.map((s, sIdx) => renderSectionEditor(label, sIdx, s)).join('') : '<div class="caption" style="padding:6px 0">No sections yet — add one above</div>'}
  </div>`;
}

function renderSectionEditor(label, sIdx, s) {
  const isCardio = s.type === 'cardio';
  return `<div class="sec-editor ${isCardio ? 'sec-cardio' : 'sec-lift'}">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <input type="text" value="${escAttr(s.name)}" oninput="reSecName('${label}',${sIdx},this.value)" style="flex:1;font-size:13px;font-weight:600">
      <span style="font-size:10px;color:var(--text3)">${isCardio ? '🏃 cardio' : '🏋️ lift'}</span>
      ${isCardio ? `<select onchange="reSecCardioType('${label}',${sIdx},this.value)" style="font-size:11px">
        <option value="stopwatch"${s.cardioType === 'stopwatch' ? ' selected' : ''}>Stopwatch</option>
        <option value="interval"${s.cardioType === 'interval' ? ' selected' : ''}>Interval</option>
        <option value="distance"${s.cardioType === 'distance' ? ' selected' : ''}>Distance / time</option>
      </select>` : ''}
      <button class="btn-icon btn-xs danger" onclick="reDelSection('${label}',${sIdx})">🗑</button>
    </div>
    <div class="ex-list">
      ${s.exercises.map((ex, eIdx) => `<div class="ex-row">
        <input type="text" value="${escAttr(ex.exercise || '')}" oninput="reExName('${label}',${sIdx},${eIdx},this.value)" placeholder="Exercise" style="flex:1;font-size:12px">
        ${isCardio ? `<input type="number" value="${ex.duration || ''}" oninput="reExDur('${label}',${sIdx},${eIdx},this.value)" placeholder="min" style="width:60px;font-size:12px">` : `
          <input type="number" value="${ex.sets || 3}" oninput="reExSets('${label}',${sIdx},${eIdx},this.value)" min="1" style="width:46px;font-size:12px;text-align:center" title="Sets">
          <span style="color:var(--text3);font-family:'DM Mono',monospace">×</span>
          <input type="number" value="${ex.reps || 8}" oninput="reExReps('${label}',${sIdx},${eIdx},this.value)" min="1" style="width:46px;font-size:12px;text-align:center" title="Reps">
          <input type="number" value="${ex.start || 0}" oninput="reExStart('${label}',${sIdx},${eIdx},this.value)" min="0" step="0.5" style="width:60px;font-size:12px;text-align:center" title="Starting weight">
          <span style="font-size:10px;color:var(--text3)">kg</span>
        `}
        <button class="btn-icon btn-xs danger" onclick="reDelExercise('${label}',${sIdx},${eIdx})">🗑</button>
      </div>`).join('')}
    </div>
    <button class="btn btn-xs" onclick="reAddExercise('${label}',${sIdx})">+ Exercise</button>
  </div>`;
}

function escAttr(s) { return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

// ── Editor mutations ────────────────────────────────────────────────────────
function findSection(label, sIdx) { return _draft?.days?.[label]?.sections?.[sIdx]; }
function findExercise(label, sIdx, eIdx) { return findSection(label, sIdx)?.exercises?.[eIdx]; }

window.reAddSection = (label, type) => {
  const day = _draft.days[label] ||= { sections: [] };
  day.sections.push({ id: uid(), name: type === 'cardio' ? 'Cardio' : 'New section', type, exercises: type === 'cardio' ? [{ exercise: 'Run', duration: 20 }] : [{ exercise: 'New exercise', sets: 3, reps: 10, start: 0 }] });
  if (type === 'cardio') day.sections[day.sections.length - 1].cardioType = 'stopwatch';
  renderEditor();
};
window.reDelSection = (label, sIdx) => {
  const day = _draft.days[label]; if (!day) return;
  day.sections.splice(sIdx, 1); renderEditor();
};
window.reSecName = (label, sIdx, v) => { const s = findSection(label, sIdx); if (s) s.name = v; };
window.reSecCardioType = (label, sIdx, v) => { const s = findSection(label, sIdx); if (s) s.cardioType = v; };

window.reAddExercise = (label, sIdx) => {
  const s = findSection(label, sIdx); if (!s) return;
  s.exercises = s.exercises || [];
  if (s.type === 'cardio') s.exercises.push({ exercise: 'New', duration: 20 });
  else s.exercises.push({ exercise: 'New exercise', sets: 3, reps: 10, start: 0 });
  renderEditor();
};
window.reDelExercise = (label, sIdx, eIdx) => {
  const s = findSection(label, sIdx); if (!s) return;
  s.exercises.splice(eIdx, 1); renderEditor();
};
window.reExName  = (label, sIdx, eIdx, v) => { const ex = findExercise(label, sIdx, eIdx); if (ex) ex.exercise = v; };
window.reExSets  = (label, sIdx, eIdx, v) => { const ex = findExercise(label, sIdx, eIdx); if (ex) ex.sets  = parseInt(v) || 0; };
window.reExReps  = (label, sIdx, eIdx, v) => { const ex = findExercise(label, sIdx, eIdx); if (ex) ex.reps  = parseInt(v) || 0; };
window.reExStart = (label, sIdx, eIdx, v) => { const ex = findExercise(label, sIdx, eIdx); if (ex) ex.start = parseFloat(v) || 0; };
window.reExDur   = (label, sIdx, eIdx, v) => { const ex = findExercise(label, sIdx, eIdx); if (ex) ex.duration = parseFloat(v) || 0; };

window.saveRoutineEdit = () => {
  const list = ensureCustom();
  const idx = list.findIndex(r => r.id === _editId); if (idx < 0) return;
  // Pull name + desc + progression
  _draft.name = (document.getElementById('re-name')?.value || '').trim() || 'Routine';
  _draft.desc = (document.getElementById('re-desc')?.value || '').trim();
  _draft.progression = document.getElementById('re-prog')?.value || 'manual';
  // Prune days that are no longer in the schedule
  const used = new Set(_draft.schedule.filter(d => d && d !== 'rest'));
  for (const k of Object.keys(_draft.days || {})) {
    if (!used.has(k)) delete _draft.days[k];
  }
  list[idx] = _draft;
  save();
  window.closeModal?.('m-routine-edit');
  window.toast?.('Routine saved ✓');
  window.renderTraining?.();
};

window.openRoutineEditor = openRoutineEditor;
window.createNewRoutine = createNewRoutine;
window.deleteRoutine = deleteRoutine;
