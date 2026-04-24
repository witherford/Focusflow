// Deep Work — extracted from focusflow_v10.html lines 1897-1923
import { S, today, uid, f2 } from '../../core/state.js';
import { save } from '../../core/persistence.js';

const fmtSecs = s => f2(Math.floor(s / 60)) + ':' + f2(s % 60);
let dwInt = null, dwRunning = false, dwIsBreak = false, dwSecs = 0, dwFreeRunning = false, dwFreeInt = null, dwFreeSec = 0;
const dwWork = () => parseInt(document.getElementById('dw-work')?.value || 25) * 60;
const dwBreak = () => parseInt(document.getElementById('dw-break')?.value || 5) * 60;

export function renderPresets() {
  const g = document.getElementById('preset-grid'); if (!g) return;
  g.innerHTML = S.deepwork.presets.map(p => `<div class="preset-btn" onclick="applyPreset('${p.id}')"><button class="preset-del" onclick="event.stopPropagation();delPreset('${p.id}')">✕</button><div class="preset-icon">${p.icon || '⏱'}</div><div class="preset-mins">${p.mins}m</div><div class="preset-label-text">${p.label}</div></div>`).join('') + `<div class="preset-add-btn" onclick="openAddPreset()">+</div>`;
}

export function applyPreset(id) {
  const p = S.deepwork.presets.find(x => x.id === id); if (!p) return;
  clearInterval(dwInt); dwRunning = false; dwIsBreak = false; dwSecs = p.mins * 60;
  const e = document.getElementById('dw-work'); if (e) e.value = p.mins;
  updateDwDisplay();
  document.getElementById('dw-start-btn').textContent = '▶';
  document.getElementById('dw-phase').textContent = 'WORK';
  document.getElementById('dw-label').value = p.label;
  window.toast(`${p.icon} ${p.label} (${p.mins}min)`);
}
export function delPreset(id) { S.deepwork.presets = S.deepwork.presets.filter(p => p.id !== id); save(); renderPresets(); }
export function openAddPreset() { document.getElementById('m-preset').style.display = 'flex'; }
export function addPreset() { const label = document.getElementById('preset-label').value.trim(); if (!label) return; S.deepwork.presets.push({ id: uid(), label, mins: parseInt(document.getElementById('preset-mins').value) || 45, icon: document.getElementById('preset-icon').value || '⏱' }); save(); window.closeModal('m-preset'); renderPresets(); document.getElementById('preset-label').value = ''; document.getElementById('preset-icon').value = ''; }

function updateDwDisplay() {
  const el = document.getElementById('dw-timer'); if (el) el.textContent = fmtSecs(dwSecs);
  const ring = document.getElementById('dw-ring'); if (!ring) return;
  const total = dwIsBreak ? dwBreak() : dwWork(), circ = 565.5;
  ring.style.strokeDashoffset = Math.max(0, circ * (dwSecs / total));
}

export function dwToggle() {
  if (dwRunning) { clearInterval(dwInt); dwRunning = false; document.getElementById('dw-start-btn').textContent = '▶'; window.relWL(); }
  else {
    if (dwSecs === 0) dwSecs = dwWork();
    dwRunning = true; document.getElementById('dw-start-btn').textContent = '⏸'; window.reqWL();
    dwInt = setInterval(() => {
      dwSecs--; updateDwDisplay();
      if (dwSecs <= 0) {
        if (!dwIsBreak) { logDwMin(parseInt(document.getElementById('dw-work')?.value || 25)); dwIsBreak = true; dwSecs = dwBreak(); document.getElementById('dw-phase').textContent = 'BREAK'; }
        else { dwIsBreak = false; dwSecs = dwWork(); document.getElementById('dw-phase').textContent = 'WORK'; }
      }
    }, 1000);
  }
}
export function dwReset() { clearInterval(dwInt); dwRunning = false; dwIsBreak = false; dwSecs = 0; window.relWL(); const el = document.getElementById('dw-timer'); if (el) el.textContent = f2(dwWork() / 60) + ':00'; document.getElementById('dw-start-btn').textContent = '▶'; document.getElementById('dw-phase').textContent = 'WORK'; const ring = document.getElementById('dw-ring'); if (ring) ring.style.strokeDashoffset = 565.5; }
export function dwFreeToggle() { if (dwFreeRunning) { clearInterval(dwFreeInt); dwFreeRunning = false; document.getElementById('dw-free-btn').textContent = '▶'; window.relWL(); } else { dwFreeRunning = true; document.getElementById('dw-free-btn').textContent = '⏸'; window.reqWL(); dwFreeInt = setInterval(() => { dwFreeSec++; const el = document.getElementById('dw-free-timer'); if (el) el.textContent = fmtSecs(dwFreeSec); }, 1000); } }
export function dwFreeReset() { if (dwFreeSec > 0) logDwMin(Math.round(dwFreeSec / 60)); clearInterval(dwFreeInt); dwFreeRunning = false; dwFreeSec = 0; window.relWL(); const el = document.getElementById('dw-free-timer'); if (el) el.textContent = '00:00'; document.getElementById('dw-free-btn').textContent = '▶'; }

export function dwFullscreen() {
  const getText = () => document.getElementById('dw-timer')?.textContent || '--:--';
  const getPhase = () => document.getElementById('dw-phase')?.textContent || '';
  const work = parseInt(document.getElementById('dw-work')?.value || 25) * 60;
  const brk  = parseInt(document.getElementById('dw-break')?.value || 5) * 60;
  const getPct = () => {
    const t = getText();
    const [m, s] = t.split(':').map(Number);
    const secs = (m || 0) * 60 + (s || 0);
    const phase = getPhase();
    const total = phase === 'BREAK' ? brk : work;
    return total ? Math.round((1 - secs / total) * 100) : 0;
  };
  window.openFullscreenTimer({ getText, getPhase, getPct });
}

export function logDwMin(min) {
  const label = document.getElementById('dw-label')?.value || 'Focus session';
  const taskId = document.getElementById('dw-task-link')?.value || null;
  const session = { date: today(), min, label, ts: Date.now() };
  if (taskId) {
    const t = S.tasks.find(x => x.id === taskId);
    if (t) {
      t.accruedMinutes = (t.accruedMinutes || 0) + min;
      session.taskId = taskId;
      if (t.goalId) session.goalId = t.goalId;
    }
  }
  S.deepwork.sessions.push(session);
  save(); renderDwLog(); updateDwProg(); window.renderHeatmaps?.(); window.renderGoals?.(); window.renderDash?.();
}
export function populateDwTaskLink() {
  const s = document.getElementById('dw-task-link'); if (!s) return;
  const cur = s.value;
  const linked = (S.tasks || []).filter(t => !t.done).map(t => {
    const g = t.goalId ? S.goals.find(x => x.id === t.goalId) : null;
    return `<option value="${t.id}">${t.name}${g ? ' → ' + g.name : ''}</option>`;
  }).join('');
  s.innerHTML = '<option value="">— none —</option>' + linked;
  if (cur) s.value = cur;
}
export function saveDwTarget() { S.deepwork.target = parseInt(document.getElementById('dw-target')?.value || 4); save(); updateDwProg(); }
export function getTodayDwMin() { return S.deepwork.sessions.filter(s => s.date === today()).reduce((a, s) => a + s.min, 0); }
function updateDwProg() { const min = getTodayDwMin(), target = (S.deepwork.target || 4) * 60, pct = Math.min(100, Math.round(min / target * 100)); const f = document.getElementById('dw-prog-fill'); if (f) f.style.width = pct + '%'; const l = document.getElementById('dw-prog-label'); if (l) l.textContent = Math.round(min) + 'min/' + (S.deepwork.target || 4) + 'h'; }
export function renderDwLog() { populateDwTaskLink(); const el = document.getElementById('dw-log'); if (!el) return; const sessions = [...S.deepwork.sessions].reverse().slice(0, 20); el.innerHTML = sessions.length ? sessions.map(s => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="font-weight:500">${s.label}</span><span style="color:var(--text3);font-family:'DM Mono',monospace">${s.date} · ${s.min}min</span></div>`).join('') : '<div style="color:var(--text3);font-size:12px">No sessions yet</div>'; updateDwProg(); }

window.renderPresets = renderPresets;
window.applyPreset = applyPreset;
window.delPreset = delPreset;
window.openAddPreset = openAddPreset;
window.addPreset = addPreset;
window.dwToggle = dwToggle;
window.dwReset = dwReset;
window.dwFreeToggle = dwFreeToggle;
window.dwFreeReset = dwFreeReset;
window.logDwMin = logDwMin;
window.saveDwTarget = saveDwTarget;
window.getTodayDwMin = getTodayDwMin;
window.renderDwLog = renderDwLog;
window.populateDwTaskLink = populateDwTaskLink;
window.dwFullscreen = dwFullscreen;
