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
  save(); window.closeModal('m-fit-log'); renderFitness();
}

// Expose
window.renderFitness = renderFitness;
window.renderFitLog = renderFitLog;
window.openAddModality = openAddModality;
window.openEditModality = openEditModality;
window.saveModality = saveModality;
window.delModality = delModality;
window.openLogFit = openLogFit;
window.saveFitLog = saveFitLog;
