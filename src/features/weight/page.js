// Weight tracker — daily log + trend chart + goal weight.
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';

function log() {
  if (!Array.isArray(S.profile.weightLog)) S.profile.weightLog = [];
  return S.profile.weightLog;
}

export function logWeight(v, dateKey) {
  v = parseFloat(v); if (!v || v <= 0) return;
  const k = dateKey || today();
  const arr = log();
  const idx = arr.findIndex(e => e.date === k);
  const entry = { id: uid(), date: k, kg: v, ts: Date.now() };
  if (idx >= 0) arr[idx] = entry; else arr.push(entry);
  arr.sort((a, b) => a.date.localeCompare(b.date));
  S.profile.weight = v; // mirror current weight
  haptic('medium'); save();
  renderWeight();
}

export function deleteWeightEntry(id) {
  const arr = log();
  const i = arr.findIndex(e => e.id === id); if (i < 0) return;
  const removed = arr.splice(i, 1)[0];
  save(); renderWeight();
  window.toastUndo?.(`Removed ${removed.kg}kg on ${removed.date}`, () => {
    arr.splice(i, 0, removed); arr.sort((a, b) => a.date.localeCompare(b.date));
    save(); renderWeight();
  });
}

export function setGoalWeight(v) {
  v = parseFloat(v) || 0;
  S.profile.goalWeight = v; save(); renderWeight();
}

function movingAverage(points, window) {
  const out = []; if (!points.length) return out;
  for (let i = 0; i < points.length; i++) {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((a, p) => a + p.kg, 0) / slice.length;
    out.push({ ...points[i], avg });
  }
  return out;
}

function renderChart(points) {
  if (!points.length) return '<div class="empty-state"><div class="es-icon">⚖️</div><div class="es-sub">No weight logged yet</div></div>';
  const smoothed = movingAverage(points, 5);
  const min = Math.min(...smoothed.map(p => p.kg));
  const max = Math.max(...smoothed.map(p => p.kg));
  const range = Math.max(1, max - min);
  const w = 600, h = 140, pad = 16;
  const yScale = v => pad + (1 - (v - min) / range) * (h - 2 * pad);
  const xScale = i => pad + (i / Math.max(1, smoothed.length - 1)) * (w - 2 * pad);
  const linePts = smoothed.map((p, i) => `${xScale(i).toFixed(1)},${yScale(p.kg).toFixed(1)}`).join(' ');
  const avgPts = smoothed.map((p, i) => `${xScale(i).toFixed(1)},${yScale(p.avg).toFixed(1)}`).join(' ');
  const goal = S.profile.goalWeight;
  const goalLine = goal ? `<line x1="${pad}" x2="${w - pad}" y1="${yScale(goal).toFixed(1)}" y2="${yScale(goal).toFixed(1)}" stroke="var(--gold)" stroke-dasharray="4 4" stroke-width="1.5"/>` : '';
  return `<svg class="weight-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    ${goalLine}
    <polyline points="${linePts}" fill="none" stroke="rgba(124,110,247,0.4)" stroke-width="1.5"/>
    <polyline points="${avgPts}" fill="none" stroke="var(--teal)" stroke-width="2.5" stroke-linejoin="round"/>
    ${smoothed.map((p, i) => `<circle cx="${xScale(i).toFixed(1)}" cy="${yScale(p.kg).toFixed(1)}" r="2.5" fill="var(--violet)"/>`).join('')}
  </svg>`;
}

export function renderWeight() {
  const el = document.getElementById('weight-content'); if (!el) return;
  const arr = log();
  const last = arr[arr.length - 1];
  const first = arr[0];
  const delta = (last && first) ? (last.kg - first.kg).toFixed(1) : '0.0';
  const deltaColor = (parseFloat(delta) < 0) ? 'var(--green)' : (parseFloat(delta) > 0) ? 'var(--rose)' : 'var(--text3)';
  const goal = S.profile.goalWeight || '';
  const toGoal = (last && goal) ? (last.kg - goal).toFixed(1) : '';
  el.innerHTML = `
    <div class="stat-grid" style="margin-bottom:14px">
      <div class="stat-card" style="--accent:var(--violet)"><div class="stat-num">${last ? last.kg : '—'}</div><div class="stat-label">Current (kg)</div></div>
      <div class="stat-card" style="--accent:var(--teal)"><div class="stat-num">${arr.length}</div><div class="stat-label">Entries</div></div>
      <div class="stat-card" style="--accent:var(--gold)"><div class="stat-num" style="color:${deltaColor}">${delta}</div><div class="stat-label">Change (kg)</div></div>
      <div class="stat-card" style="--accent:var(--green)"><div class="stat-num">${goal || '—'}</div><div class="stat-label">Goal (kg)</div></div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-header"><div class="card-title">Log weight</div></div>
      <div class="form-grid">
        <div class="form-row"><label>Date</label><input type="date" id="w-date" value="${today()}"></div>
        <div class="form-row"><label>Weight (kg)</label><input type="number" id="w-kg" step="0.1" inputmode="decimal" placeholder="${last ? last.kg : '80'}"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="saveWeight()">+ Log</button>
        <input type="number" id="w-goal" step="0.1" inputmode="decimal" placeholder="Goal weight" value="${goal}" style="flex:1;max-width:140px">
        <button class="btn btn-sm" onclick="saveGoalWeight()">Set goal</button>
        ${toGoal !== '' ? `<span style="align-self:center;font-size:12px;color:var(--text3)">${Math.abs(toGoal)}kg ${parseFloat(toGoal) > 0 ? 'to lose' : 'to gain'}</span>` : ''}
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-header"><div class="card-title">Trend</div><div style="font-size:11px;color:var(--text3)">5-day moving average</div></div>
      ${renderChart(arr)}
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Log</div></div>
      ${arr.length ? arr.slice().reverse().map(e => `<div class="weight-row"><span class="w-date">${e.date}</span><span class="w-val">${e.kg} kg</span><button class="btn-icon btn-xs danger" onclick="deleteWeightEntry('${e.id}')">✕</button></div>`).join('') : '<div class="caption">No entries yet</div>'}
    </div>
  `;
}

export function saveWeight() {
  const d = document.getElementById('w-date')?.value || today();
  const k = document.getElementById('w-kg')?.value;
  if (!k) { window.toast?.('Enter a weight'); return; }
  logWeight(k, d);
  const kInput = document.getElementById('w-kg'); if (kInput) kInput.value = '';
  window.toast?.('Weight logged ✓');
}

export function saveGoalWeight() {
  const v = document.getElementById('w-goal')?.value || 0;
  setGoalWeight(v);
  window.toast?.('Goal set ✓');
}

window.renderWeight = renderWeight;
window.saveWeight = saveWeight;
window.saveGoalWeight = saveGoalWeight;
window.deleteWeightEntry = deleteWeightEntry;
window.logWeight = logWeight;
