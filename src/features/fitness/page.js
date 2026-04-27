// Training (formerly Fitness) — orchestrator that ties together:
//   • Active routine + library picker
//   • Workout logger (workout.js)
//   • Schedule calendar (calendar.js)
//   • Body measurements (kept from old Fitness)
//   • Per-exercise progression chart (kept)
//   • Modality + manual session log (kept for non-routine cardio / martial)
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { ROUTINE_LIBRARY, getRoutine, dayLabelForDate } from './routines.js';
import { activeRoutine, activateRoutine, openWorkoutLogger } from './workout.js';
import { renderTrainingSchedule } from './calendar.js';
import { estimate1RM } from './progression.js';

const MOD_TYPE_META = {
  weightlifting: { icon: '🏋️', label: 'Weightlifting', fields: ['sets', 'reps', 'weight'] },
  cardio:        { icon: '🏃', label: 'Cardio',        fields: ['distance', 'duration'] },
  martial:       { icon: '🥋', label: 'Martial arts',  fields: ['rounds', 'duration'] },
  custom:        { icon: '✨', label: 'Custom',        fields: ['duration'] },
};

function ensureFit() {
  if (!S.fitness) S.fitness = { modalities: [], sessions: [], prs: [] };
  if (!Array.isArray(S.fitness.modalities)) S.fitness.modalities = [];
  if (!Array.isArray(S.fitness.sessions))   S.fitness.sessions = [];
  if (!Array.isArray(S.fitness.prs))        S.fitness.prs = [];
  if (!S.training) S.training = { activeRoutineId: null, customRoutines: [], history: [], autoHabit: true };
}

export function renderTraining() {
  ensureFit();
  renderActiveRoutineCard();
  renderRoutinePicker();
  renderScheduledEvents();
  renderTrainingSchedule();
  renderBodyMeasurements();
  renderWeightProgression();
  renderModalitiesList();
  renderFitLog();
}

function renderActiveRoutineCard() {
  const el = document.getElementById('train-active'); if (!el) return;
  const r = activeRoutine();
  if (!r) {
    el.innerHTML = '<div class="empty-state" style="padding:20px"><div class="es-icon">🏋️</div><div class="es-title">No routine yet</div><div class="es-sub">Pick one in the Routines tab or build your own</div></div>';
    return;
  }
  const planned = dayLabelForDate(r, new Date());
  const lastDone = (S.training?.history || []).slice().reverse().find(h => h.routineId === r.id);
  el.innerHTML = `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:16px">${r.name}</div>
      <div style="font-size:12px;color:var(--text3)">${r.desc}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px">
        Today: <strong style="color:${planned === 'rest' ? 'var(--text3)' : 'var(--teal)'}">${planned}</strong>
        ${lastDone ? ` · last: ${lastDone.date} (${lastDone.dayLabel})` : ''}
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="openWorkoutLogger()">▶ Start workout</button>
      <button class="btn btn-sm" onclick="openRoutineEditor('${r.id}')">✏️ Edit</button>
      <button class="btn btn-sm" onclick="deactivateRoutinePrompt()">⏹ Deactivate</button>
    </div>
  </div>`;
}

function renderRoutinePicker() {
  const el = document.getElementById('train-routines'); if (!el) return;
  const t = S.training || {};
  const builtIn = ROUTINE_LIBRARY;
  const custom = t.customRoutines || [];
  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="btn btn-sm btn-primary" onclick="createNewRoutine()">+ New routine</button>
    </div>
    ${custom.length ? `<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 4px">Your routines</div>` : ''}
    ${custom.map(r => routineCardHTML(r, t.activeRoutineId, true)).join('')}
    <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 4px">Built-in routines</div>
    ${builtIn.map(r => routineCardHTML(r, t.activeRoutineId, false)).join('')}
  `;
}

function routineCardHTML(r, activeId, isCustom) {
  const active = r.id === activeId;
  const dayCount = (r.schedule || []).filter(d => d && d !== 'rest').length;
  return `<div class="routine-card${active ? ' active' : ''}">
    <div class="rc-info" onclick="activateRoutine('${r.id}')" style="cursor:pointer">
      <div class="rc-name">${r.name}${active ? ' <span style="color:var(--teal);font-size:11px">· active</span>' : ''}</div>
      <div class="rc-desc">${r.desc || ''}</div>
      <div class="rc-meta">${dayCount} days/week · ${r.progression || 'manual'}</div>
    </div>
    <div style="display:flex;gap:4px;flex-direction:column">
      <button class="btn-icon" title="Edit" onclick="event.stopPropagation();openRoutineEditor('${r.id}')">✏️</button>
      ${isCustom ? `<button class="btn-icon danger" title="Delete" onclick="event.stopPropagation();deleteRoutine('${r.id}')">🗑</button>` : ''}
    </div>
  </div>`;
}

export function deactivateRoutinePrompt() {
  if (!S.training?.activeRoutineId) return;
  if (!confirm('Are you sure you want to deactivate the active routine? Past sessions are kept; just no plan will show on the schedule until you reactivate.')) return;
  S.training.activeRoutineId = null;
  save();
  renderTraining();
  window.toast?.('Routine deactivated');
}

// ── Scheduled training events (formerly Profile → Training Routines) ────────
function renderScheduledEvents() {
  const el = document.getElementById('train-scheduled'); if (!el) return;
  const routines = S.profile?.trainRoutines || [];
  const todayShort = new Date().toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3);
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px">Scheduled training events</div>
      <button class="btn btn-sm btn-primary" onclick="openAddRoutine()">+ Add</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Time-bound entries (e.g. "Yoga 7-8am Mon/Wed/Fri") — show on the dashboard schedule strip too.</div>
    ${routines.length ? routines.map(r => {
      const todayMatch = (r.days || []).includes(todayShort);
      return `<div class="routine-card${todayMatch ? ' active' : ''}" style="margin-bottom:6px">
        <div class="rc-info">
          <div class="rc-name">${r.icon || '🏋️'} ${r.name}${todayMatch ? ' <span style="color:var(--teal);font-size:11px">· today</span>' : ''}</div>
          <div class="rc-meta">${(r.start || '?')}–${(r.end || '?')} · ${(r.days || []).join(', ') || 'no days'}</div>
          ${r.notes ? `<div class="rc-desc">${r.notes}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-direction:column">
          <button class="btn-icon" onclick="openEditRoutine('${r.id}')">✏️</button>
          <button class="btn-icon danger" onclick="delRoutine('${r.id}')">🗑</button>
        </div>
      </div>`;
    }).join('') : '<div class="caption" style="padding:6px 0">No scheduled events</div>'}
  `;
}

// ── Modality CRUD (manual sessions for non-routine activities) ──────────────
export function renderModalitiesList() {
  ensureFit();
  const el = document.getElementById('fit-list'); if (!el) return;
  const mods = S.fitness.modalities;
  el.innerHTML = mods.length
    ? mods.map(m => {
        const meta = MOD_TYPE_META[m.type] || MOD_TYPE_META.custom;
        const last = [...S.fitness.sessions].filter(s => s.modId === m.id).sort((a, b) => b.ts - a.ts)[0];
        const lastLine = last ? `${last.date} · ${summarizeSession(last)}` : 'No sessions yet';
        return `<div class="fit-modality" onclick="openLogFit('${m.id}')">
          <span class="fm-icon">${m.icon || meta.icon}</span>
          <div class="fm-info"><div class="fm-name">${m.name}</div><div class="fm-meta">${lastLine}</div></div>
          <button class="btn-icon" onclick="event.stopPropagation();openEditModality('${m.id}')">✏️</button>
          <button class="btn-icon danger" onclick="event.stopPropagation();delModality('${m.id}')">🗑</button>
        </div>`;
      }).join('')
    : '<div class="caption" style="text-align:center;padding:14px">No manual modalities yet — add one for cardio / martial arts / etc.</div>';
}

function summarizeSession(s) {
  if (s.type === 'weightlifting') return `${s.sets || 0}×${s.reps || 0} @ ${s.weight || 0}kg${s.volume ? ` · ${Math.round(s.volume)} vol` : ''}`;
  if (s.type === 'cardio')        return `${s.distance || 0}${s.unit || 'km'} · ${s.duration || 0}min`;
  if (s.type === 'martial')       return `${s.rounds || 0} rounds · ${s.duration || 0}min`;
  return `${s.duration || 0}min`;
}

export function renderFitLog() {
  const el = document.getElementById('fit-log'); if (!el) return;
  ensureFit();
  const sessions = [...S.fitness.sessions].sort((a, b) => b.ts - a.ts).slice(0, 30);
  el.innerHTML = sessions.length
    ? sessions.map(s => {
        const m = S.fitness.modalities.find(x => x.id === s.modId);
        const isRoutine = s.modId?.startsWith('_training_');
        const icon = isRoutine ? '🏋️' : (m?.icon || '●');
        const name = isRoutine ? (s.notes?.split(' · ')[0] || 'Workout') : (m?.name || '?');
        return `<div class="fit-session-card">
          <div class="fsc-hd"><span class="fsc-name">${icon} ${name}${s.isPR ? ' 🏆 PR' : ''}</span><span class="fsc-date">${s.date}</span></div>
          <div style="color:var(--text2);font-size:12px">${summarizeSession(s)}${s.notes ? ' · ' + s.notes : ''}</div>
        </div>`;
      }).join('')
    : '<div class="caption" style="text-align:center;padding:8px">No sessions yet</div>';
}

// ── modality CRUD (kept) ────────────────────────────────────────────────────
export function openAddModality() {
  document.getElementById('fm-title').textContent = 'Add modality';
  document.getElementById('fm-edit-id').value = '';
  document.getElementById('fm-name').value = '';
  document.getElementById('fm-icon').value = '';
  document.getElementById('fm-type').value = 'cardio';
  document.getElementById('m-fit-modality').style.display = 'flex';
}
export function openEditModality(id) {
  ensureFit();
  const m = S.fitness.modalities.find(x => x.id === id); if (!m) return;
  document.getElementById('fm-title').textContent = 'Edit modality';
  document.getElementById('fm-edit-id').value = id;
  document.getElementById('fm-name').value = m.name;
  document.getElementById('fm-icon').value = m.icon || '';
  document.getElementById('fm-type').value = m.type || 'cardio';
  document.getElementById('m-fit-modality').style.display = 'flex';
}
export function saveModality() {
  ensureFit();
  const name = document.getElementById('fm-name').value.trim(); if (!name) return;
  const editId = document.getElementById('fm-edit-id').value;
  const type = document.getElementById('fm-type').value;
  const icon = document.getElementById('fm-icon').value || MOD_TYPE_META[type]?.icon || '●';
  const data = { name, icon, type };
  if (editId) { const m = S.fitness.modalities.find(x => x.id === editId); if (m) Object.assign(m, data); }
  else S.fitness.modalities.push({ id: uid(), ...data });
  save(); window.closeModal('m-fit-modality'); renderTraining();
}
export function delModality(id) {
  ensureFit();
  const idx = S.fitness.modalities.findIndex(m => m.id === id); if (idx < 0) return;
  const removed = S.fitness.modalities[idx];
  S.fitness.modalities.splice(idx, 1);
  save(); renderTraining();
  window.toastUndo?.(`Removed "${removed.name}"`, () => { S.fitness.modalities.splice(idx, 0, removed); save(); renderTraining(); });
}

export function openLogFit(modId) {
  ensureFit();
  const m = S.fitness.modalities.find(x => x.id === modId); if (!m) return;
  document.getElementById('fit-log-modid').value = modId;
  document.getElementById('fit-log-title').textContent = 'Log: ' + m.name;
  document.getElementById('fit-log-type').value = m.type;
  ['fit-sets','fit-reps','fit-weight','fit-distance','fit-duration','fit-rounds','fit-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const type = m.type;
  document.getElementById('fit-fields-weight').style.display   = type === 'weightlifting' ? '' : 'none';
  document.getElementById('fit-fields-cardio').style.display   = type === 'cardio'        ? '' : 'none';
  document.getElementById('fit-fields-martial').style.display  = type === 'martial'       ? '' : 'none';
  document.getElementById('fit-fields-generic').style.display  = type === 'weightlifting' ? 'none' : '';
  document.getElementById('m-fit-log').style.display = 'flex';
}

export function saveFitLog() {
  ensureFit();
  const modId = document.getElementById('fit-log-modid').value;
  const m = S.fitness.modalities.find(x => x.id === modId); if (!m) return;
  const v = id => document.getElementById(id)?.value;
  const n = id => parseFloat(v(id)) || 0;
  const s = { id: uid(), modId, type: m.type, date: today(), ts: Date.now(), notes: v('fit-notes') || '' };
  if (m.type === 'weightlifting') { s.sets = n('fit-sets'); s.reps = n('fit-reps'); s.weight = n('fit-weight'); s.volume = s.sets * s.reps * s.weight; }
  else if (m.type === 'cardio')   { s.distance = n('fit-distance'); s.duration = n('fit-duration'); s.unit = 'km'; }
  else if (m.type === 'martial')  { s.rounds = n('fit-rounds'); s.duration = n('fit-duration'); }
  else                            { s.duration = n('fit-duration'); }
  if (m.type === 'weightlifting' && s.weight > 0) {
    const prior = S.fitness.sessions.filter(x => x.modId === modId && x.reps === s.reps);
    const maxPrior = prior.reduce((mx, x) => Math.max(mx, x.weight || 0), 0);
    if (s.weight > maxPrior) {
      s.isPR = true;
      S.fitness.prs.push({ modId, reps: s.reps, weight: s.weight, date: s.date });
      haptic('heavy');
    }
  }
  S.fitness.sessions.push(s);
  save(); window.awardXP?.('fitSession'); window.closeModal('m-fit-log'); renderTraining();
}

// ── Body measurements (kept) ────────────────────────────────────────────────
export function logMeasurement(kind, value) {
  value = parseFloat(value); if (!value) return;
  if (!Array.isArray(S.bodyMeasurements)) S.bodyMeasurements = [];
  S.bodyMeasurements.push({ id: uid(), date: today(), kind, value, ts: Date.now() });
  save(); renderBodyMeasurements();
}

export function deleteMeasurement(id) {
  const idx = (S.bodyMeasurements || []).findIndex(m => m.id === id);
  if (idx < 0) return;
  const removed = S.bodyMeasurements.splice(idx, 1)[0];
  save(); renderBodyMeasurements();
  window.toastUndo?.(`Removed ${removed.kind} ${removed.value}cm`, () => {
    S.bodyMeasurements.splice(idx, 0, removed); save(); renderBodyMeasurements();
  });
}

export function renderBodyMeasurements() {
  const el = document.getElementById('body-measurements'); if (!el) return;
  const all = S.bodyMeasurements || [];
  const kinds = ['chest', 'waist', 'hips', 'arm', 'thigh'];
  const latest = {}; const prior = {};
  for (const kind of kinds) {
    const items = all.filter(m => m.kind === kind).sort((a, b) => a.ts - b.ts);
    if (items.length) {
      latest[kind] = items[items.length - 1];
      if (items.length > 1) prior[kind] = items[items.length - 2];
    }
  }
  el.innerHTML = `<div class="card-header"><div class="card-title">📏 Body measurements (cm)</div></div>
    <div class="form-grid" style="margin-bottom:10px">
      ${kinds.map(k => `<div class="form-row"><label>${k[0].toUpperCase() + k.slice(1)}${latest[k] ? ` · now ${latest[k].value}${prior[k] ? ' <span style="color:var(--text3);font-size:10px">(was ' + prior[k].value + ')</span>' : ''}` : ''}</label><input type="number" step="0.1" inputmode="decimal" id="bm-${k}" placeholder="${latest[k] ? latest[k].value : ''}"></div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="saveAllMeasurements()">+ Log today</button>
      <span style="align-self:center;font-size:11px;color:var(--text3)">${all.length} total entries</span>
    </div>
    ${all.length ? `<div style="margin-top:10px">${renderMeasurementLog()}</div>` : ''}
  `;
}

function renderMeasurementLog() {
  const all = (S.bodyMeasurements || []).slice().sort((a, b) => b.ts - a.ts).slice(0, 10);
  return all.map(m => `<div class="weight-row"><span class="w-date">${m.date}</span><span class="w-val">${m.kind}: ${m.value} cm</span><button class="btn-icon btn-xs danger" onclick="deleteMeasurement('${m.id}')">🗑</button></div>`).join('');
}

export function saveAllMeasurements() {
  const kinds = ['chest', 'waist', 'hips', 'arm', 'thigh'];
  let n = 0;
  for (const k of kinds) {
    const el = document.getElementById('bm-' + k);
    if (el && el.value) { logMeasurement(k, el.value); el.value = ''; n++; }
  }
  if (n) window.toast?.(`Logged ${n} measurement${n === 1 ? '' : 's'} ✓`);
  else window.toast?.('Enter at least one value');
}

// ── Per-exercise progression chart ──────────────────────────────────────────
export function renderWeightProgression() {
  const el = document.getElementById('fit-progression'); if (!el) return;
  const sessions = (S.fitness.sessions || []);
  // Pull weightlifting per-exercise from training history (more granular).
  const byExercise = {};
  for (const h of (S.training?.history || [])) {
    for (const e of (h.exercises || [])) {
      const top = (e.sets || []).reduce((mx, s) => ((s.weight || 0) > (mx?.weight || 0) ? s : mx), null);
      if (!top) continue;
      const e1rm = estimate1RM(top.weight, top.reps);
      (byExercise[e.exercise] ||= []).push({ ts: h.ts, date: h.date, weight: top.weight, reps: top.reps, e1rm });
    }
  }
  // Also fold in legacy modality sessions
  for (const s of sessions) {
    if (s.type !== 'weightlifting' || !s.modId || s.modId.startsWith('_training_')) continue;
    const m = S.fitness.modalities.find(x => x.id === s.modId);
    if (!m) continue;
    (byExercise[m.name] ||= []).push({ ts: s.ts, date: s.date, weight: s.weight });
  }
  const exNames = Object.keys(byExercise);
  if (!exNames.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card-header"><div class="card-title">📈 Lift progression</div><div style="font-size:11px;color:var(--text3)">top set + estimated 1RM</div></div>
    ${exNames.map(name => {
      const list = byExercise[name].sort((a, b) => a.ts - b.ts);
      const w = 300, h = 60;
      const maxW = Math.max(...list.map(s => s.weight));
      const minW = Math.min(...list.map(s => s.weight));
      const max1 = Math.max(...list.map(s => s.e1rm || 0));
      const max = Math.max(maxW, max1);
      const min = Math.min(minW, ...list.map(s => s.e1rm || s.weight));
      const range = Math.max(1, max - min);
      const ptsW = list.map((s, i) => {
        const x = (i / Math.max(1, list.length - 1)) * w;
        const y = h - ((s.weight - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      const pts1 = list.map((s, i) => {
        const x = (i / Math.max(1, list.length - 1)) * w;
        const y = h - (((s.e1rm || s.weight) - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      const last = list[list.length - 1];
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
          <span style="font-weight:500">${name}</span>
          <span style="color:var(--text3);font-family:'DM Mono',monospace">${minW}→${maxW}kg · e1RM ${last?.e1rm || 0}</span>
        </div>
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
          <polyline points="${pts1}" fill="none" stroke="var(--teal)" stroke-width="1.4" stroke-dasharray="3 3" stroke-linejoin="round"/>
          <polyline points="${ptsW}" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>`;
    }).join('')}
  `;
}

// Expose
if (typeof window !== 'undefined') {
  window.renderTraining = renderTraining;
  window.renderFitness = renderTraining;        // legacy alias
  window.renderFitLog = renderFitLog;
  window.openAddModality = openAddModality;
  window.openEditModality = openEditModality;
  window.saveModality = saveModality;
  window.delModality = delModality;
  window.openLogFit = openLogFit;
  window.saveFitLog = saveFitLog;
  window.logMeasurement = logMeasurement;
  window.deleteMeasurement = deleteMeasurement;
  window.saveAllMeasurements = saveAllMeasurements;
  window.renderBodyMeasurements = renderBodyMeasurements;
  window.renderWeightProgression = renderWeightProgression;
  window.deactivateRoutinePrompt = deactivateRoutinePrompt;
}
