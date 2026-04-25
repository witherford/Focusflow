// Fitness module — Phase 6
// Modalities: weightlifting, cardio, martial arts, custom. Logs sessions with
// flexible fields based on modality.type. Auto-detects PRs for weightlifting.
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';

const MOD_TYPE_META = {
  weightlifting: { icon: '🏋️', label: 'Weightlifting', fields: ['sets', 'reps', 'weight'] },
  cardio:        { icon: '🏃', label: 'Cardio',        fields: ['distance', 'duration', 'pace'] },
  martial:       { icon: '🥋', label: 'Martial arts',  fields: ['rounds', 'duration', 'notes'] },
  custom:        { icon: '✨', label: 'Custom',        fields: ['duration', 'notes'] },
};

function ensureFit() {
  if (!S.fitness) S.fitness = { modalities: [], sessions: [], prs: [] };
  if (!Array.isArray(S.fitness.modalities)) S.fitness.modalities = [];
  if (!Array.isArray(S.fitness.sessions))   S.fitness.sessions = [];
  if (!Array.isArray(S.fitness.prs))        S.fitness.prs = [];
}

export function renderFitness() {
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
          <button class="btn-icon danger" onclick="event.stopPropagation();delModality('${m.id}')">✕</button>
        </div>`;
      }).join('')
    : '<div style="color:var(--text3);text-align:center;padding:40px">No fitness modalities yet — tap + to add one</div>';
  renderFitLog();
}

function summarizeSession(s) {
  if (s.type === 'weightlifting') return `${s.sets || 0}×${s.reps || 0} @ ${s.weight || 0}`;
  if (s.type === 'cardio')        return `${s.distance || 0}${s.unit || 'km'} · ${s.duration || 0}min`;
  if (s.type === 'martial')       return `${s.rounds || 0} rounds · ${s.duration || 0}min`;
  return `${s.duration || 0}min`;
}

export function renderFitLog() {
  const el = document.getElementById('fit-log'); if (!el) return;
  ensureFit();
  const sessions = [...S.fitness.sessions].sort((a, b) => b.ts - a.ts).slice(0, 20);
  el.innerHTML = sessions.length
    ? sessions.map(s => {
        const m = S.fitness.modalities.find(x => x.id === s.modId);
        return `<div class="fit-session-card">
          <div class="fsc-hd"><span class="fsc-name">${m?.icon || '●'} ${m?.name || '?'}${s.isPR ? ' 🏆 PR' : ''}</span><span class="fsc-date">${s.date}</span></div>
          <div style="color:var(--text3)">${summarizeSession(s)}${s.notes ? ' · ' + s.notes : ''}</div>
        </div>`;
      }).join('')
    : '<div style="color:var(--text3);font-size:12px">No sessions logged yet</div>';
}

// --- modality CRUD ---
export function openAddModality() {
  document.getElementById('fm-title').textContent = 'Add Modality';
  document.getElementById('fm-edit-id').value = '';
  document.getElementById('fm-name').value = '';
  document.getElementById('fm-icon').value = '';
  document.getElementById('fm-type').value = 'weightlifting';
  document.getElementById('m-fit-modality').style.display = 'flex';
}
export function openEditModality(id) {
  ensureFit();
  const m = S.fitness.modalities.find(x => x.id === id); if (!m) return;
  document.getElementById('fm-title').textContent = 'Edit Modality';
  document.getElementById('fm-edit-id').value = id;
  document.getElementById('fm-name').value = m.name;
  document.getElementById('fm-icon').value = m.icon || '';
  document.getElementById('fm-type').value = m.type || 'weightlifting';
  document.getElementById('m-fit-modality').style.display = 'flex';
}
export function saveModality() {
  ensureFit();
  const name = document.getElementById('fm-name').value.trim(); if (!name) return;
  const editId = document.getElementById('fm-edit-id').value;
  const type = document.getElementById('fm-type').value;
  const icon = document.getElementById('fm-icon').value || MOD_TYPE_META[type]?.icon || '●';
  const data = { name, icon, type };
  if (editId) {
    const m = S.fitness.modalities.find(x => x.id === editId);
    if (m) Object.assign(m, data);
  } else {
    S.fitness.modalities.push({ id: uid(), ...data });
  }
  save(); window.closeModal('m-fit-modality'); renderFitness();
}
export function delModality(id) {
  if (!confirm('Delete modality? Sessions will remain in history.')) return;
  ensureFit();
  S.fitness.modalities = S.fitness.modalities.filter(m => m.id !== id);
  save(); renderFitness();
}

// --- session log ---
export function openLogFit(modId) {
  ensureFit();
  const m = S.fitness.modalities.find(x => x.id === modId); if (!m) return;
  document.getElementById('fit-log-modid').value = modId;
  document.getElementById('fit-log-title').textContent = 'Log: ' + m.name;
  document.getElementById('fit-log-type').value = m.type;
  ['fit-sets','fit-reps','fit-weight','fit-distance','fit-duration','fit-rounds','fit-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  // Show only relevant fields
  const type = m.type;
  document.getElementById('fit-fields-weight').style.display   = type === 'weightlifting' ? '' : 'none';
  document.getElementById('fit-fields-cardio').style.display   = type === 'cardio'        ? '' : 'none';
  document.getElementById('fit-fields-martial').style.display  = type === 'martial'       ? '' : 'none';
  // Duration row visible for all non-weightlifting types
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
  if (m.type === 'weightlifting') { s.sets = n('fit-sets'); s.reps = n('fit-reps'); s.weight = n('fit-weight'); }
  else if (m.type === 'cardio')   { s.distance = n('fit-distance'); s.duration = n('fit-duration'); s.unit = 'km'; s.pace = s.duration && s.distance ? (s.duration / s.distance).toFixed(2) + ' min/km' : ''; }
  else if (m.type === 'martial')  { s.rounds = n('fit-rounds'); s.duration = n('fit-duration'); }
  else                            { s.duration = n('fit-duration'); }
  // Auto-detect PR for weightlifting (heaviest weight for a given rep scheme)
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
  save(); window.awardXP?.('fitSession'); window.closeModal('m-fit-log'); renderFitness();
}

// --- Body measurements ---
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
  return all.map(m => `<div class="weight-row"><span class="w-date">${m.date}</span><span class="w-val">${m.kind}: ${m.value} cm</span><button class="btn-icon btn-xs danger" onclick="deleteMeasurement('${m.id}')">✕</button></div>`).join('');
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

// --- Per-exercise progression chart ---
export function renderWeightProgression() {
  const el = document.getElementById('fit-progression'); if (!el) return;
  const lifting = S.fitness.modalities.filter(m => m.type === 'weightlifting');
  if (!lifting.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card-header"><div class="card-title">📈 Weightlifting progression</div></div>
    ${lifting.map(m => {
      const sessions = S.fitness.sessions.filter(s => s.modId === m.id && s.weight > 0).sort((a, b) => a.ts - b.ts);
      if (!sessions.length) return `<div style="font-size:12px;color:var(--text3);margin-bottom:10px">${m.name}: no sessions</div>`;
      const w = 300, h = 60;
      const max = Math.max(...sessions.map(s => s.weight));
      const min = Math.min(...sessions.map(s => s.weight));
      const range = Math.max(1, max - min);
      const pts = sessions.map((s, i) => {
        const x = (i / Math.max(1, sessions.length - 1)) * w;
        const y = h - ((s.weight - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="font-weight:500">${m.icon || '🏋️'} ${m.name}</span><span style="color:var(--text3)">${min}→${max} · ${sessions.length} sessions</span></div>
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px"><polyline points="${pts}" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linejoin="round"/></svg>
      </div>`;
    }).join('')}
  `;
}

// Expose
window.renderFitness = () => { renderFitness(); renderBodyMeasurements(); renderWeightProgression(); };
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
