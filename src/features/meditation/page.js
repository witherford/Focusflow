// Meditation — extracted from focusflow_v10.html lines 1925-2321
import { S, today, uid, f2, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { playChime } from '../../core/audio.js';

const medSoundsOn = () => (S.meditation.cfg ||= { sounds: true }).sounds;

const fmtSecs = s => f2(Math.floor(s / 60)) + ':' + f2(s % 60);
let medInt = null, medRunning = false, medSecs = 0;
const medDur = () => parseInt(document.getElementById('med-dur')?.value || 10) * 60;

export function setMedSound(btn, sound) {
  document.querySelectorAll('.med-sound-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window.playAmbient(sound);
}
export function setMedDur(min) { const inp = document.getElementById('med-dur'); if (inp) { inp.value = min; medReset(); } }

export function medToggle() {
  if (medRunning) { clearInterval(medInt); medRunning = false; document.getElementById('med-btn').textContent = '▶'; document.getElementById('med-phase').textContent = 'PAUSED'; window.relWL(); }
  else {
    if (medSecs === 0) medSecs = medDur();
    medRunning = true; document.getElementById('med-btn').textContent = '⏸'; document.getElementById('med-phase').textContent = 'MEDITATING'; window.reqWL();
    if (medSoundsOn()) playChime('start');
    medInt = setInterval(() => {
      medSecs--;
      const el = document.getElementById('med-timer'); if (el) el.textContent = fmtSecs(medSecs);
      const ring = document.querySelector('.med-ring-progress');
      if (ring) { const total = medDur(), circ = 678.6; ring.style.strokeDashoffset = Math.max(0, circ * (medSecs / total)); }
      updateMedProg();
      if (medSecs <= 0) { clearInterval(medInt); medRunning = false; window.relWL(); document.getElementById('med-btn').textContent = '▶'; document.getElementById('med-phase').textContent = 'COMPLETE ✓'; haptic('success'); if (medSoundsOn()) playChime('end'); logMed(parseInt(document.getElementById('med-dur')?.value || 10)); medSecs = 0; }
    }, 1000);
  }
}
export function saveMedCfg() { (S.meditation.cfg ||= { sounds: true }).sounds = !!document.getElementById('med-cfg-sounds')?.checked; save(); }
export function syncMedCfgInputs() { const el = document.getElementById('med-cfg-sounds'); if (el) el.checked = medSoundsOn(); }
export function medReset() { clearInterval(medInt); medRunning = false; medSecs = 0; window.relWL(); const el = document.getElementById('med-timer'); if (el) el.textContent = f2(medDur() / 60) + ':00'; const ph = document.getElementById('med-phase'); if (ph) ph.textContent = 'READY'; const btn = document.getElementById('med-btn'); if (btn) btn.textContent = '▶'; const ring = document.querySelector('.med-ring-progress'); if (ring) ring.style.strokeDashoffset = '678.6'; }
export function medSkip() { if (!medRunning && medSecs === 0) return; clearInterval(medInt); medRunning = false; window.relWL(); const elapsed = Math.max(1, Math.round((medDur() - medSecs) / 60)); document.getElementById('med-btn').textContent = '▶'; document.getElementById('med-phase').textContent = 'LOGGED ✓'; logMed(elapsed); medSecs = 0; const ring = document.querySelector('.med-ring-progress'); if (ring) ring.style.strokeDashoffset = '678.6'; window.toast('Session logged: ' + elapsed + ' min ✓'); }
export function logMed(min) { if (!S.meditation.sessions) S.meditation.sessions = []; S.meditation.sessions.push({ date: today(), min: min || parseInt(document.getElementById('med-dur')?.value || 10), ts: Date.now() }); save(); renderMedStats(); window.renderHeatmaps(); updateMedProg(); }
function updateMedProg() { const target = S.meditation.target || parseInt(document.getElementById('med-target')?.value || 10); const done = S.meditation.sessions.filter(s => s.date === today()).reduce((a, s) => a + s.min, 0); const pct = Math.min(100, Math.round(done / target * 100)); const fill = document.getElementById('med-prog-fill'); if (fill) fill.style.width = pct + '%'; const lbl = document.getElementById('med-prog-label'); if (lbl) lbl.textContent = done + ' / ' + target + ' min'; }
export function saveMedTarget() { S.meditation.target = parseInt(document.getElementById('med-target')?.value || 10); save(); updateMedProg(); }

export function renderMedStats() {
  syncMedCfgInputs();
  const el = document.getElementById('med-log');
  if (el) {
    const sessions = [...S.meditation.sessions].reverse().slice(0, 30);
    el.innerHTML = sessions.length ? sessions.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">🧘</span>
          <div><div style="font-size:13px;font-weight:500">${s.label || 'Meditation'}</div><div style="font-size:11px;color:var(--text3)">${s.date}</div></div></div>
        <div style="font-family:'DM Mono',monospace;font-size:13px;color:var(--teal)">${s.min} min</div>
      </div>`).join('') : '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">No sessions yet — start meditating!</div>';
  }
  let streak = 0;
  for (let i = 0; i < 365; i++) { const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0]; if (S.meditation.sessions.some(s => s.date === k)) streak++; else break; }
  const sEl = document.getElementById('med-streak'); if (sEl) sEl.textContent = streak;
  const tMin = S.meditation.sessions.filter(s => s.date === today()).reduce((a, s) => a + s.min, 0);
  const mEl = document.getElementById('med-today'); if (mEl) mEl.textContent = tMin;
  const tsEl = document.getElementById('med-total-sessions'); if (tsEl) tsEl.textContent = S.meditation.sessions.length;
  updateMedProg();
}

// Saved Timers
export function openAddMedTimer() { document.getElementById('m-med-timer-title').textContent = 'New Meditation Timer'; document.getElementById('med-timer-edit-id').value = ''; document.getElementById('mt-name').value = ''; document.getElementById('mt-icon').value = '🧘'; document.getElementById('mt-dur').value = '10'; document.getElementById('mt-target').value = '10'; document.getElementById('mt-sound').value = ''; document.getElementById('mt-notes').value = ''; document.getElementById('m-med-timer').style.display = 'flex'; }
export function openEditMedTimer(id) { const t = (S.meditation.savedTimers || []).find(x => x.id === id); if (!t) return; document.getElementById('m-med-timer-title').textContent = 'Edit Timer'; document.getElementById('med-timer-edit-id').value = id; document.getElementById('mt-name').value = t.name || ''; document.getElementById('mt-icon').value = t.icon || '🧘'; document.getElementById('mt-dur').value = t.dur || 10; document.getElementById('mt-target').value = t.target || 10; document.getElementById('mt-sound').value = t.sound || ''; document.getElementById('mt-notes').value = t.notes || ''; document.getElementById('m-med-timer').style.display = 'flex'; }
export function saveMedTimerPreset() { const name = document.getElementById('mt-name').value.trim(); if (!name) { window.toast('Enter a name', 'error'); return; } if (!S.meditation.savedTimers) S.meditation.savedTimers = []; const editId = document.getElementById('med-timer-edit-id').value; const data = { name, icon: document.getElementById('mt-icon').value || '🧘', dur: parseInt(document.getElementById('mt-dur').value) || 10, target: parseInt(document.getElementById('mt-target').value) || 10, sound: document.getElementById('mt-sound').value || '', notes: document.getElementById('mt-notes').value || '' }; if (editId) { const t = S.meditation.savedTimers.find(x => x.id === editId); if (t) Object.assign(t, data); } else S.meditation.savedTimers.push({ id: uid(), ...data }); save(); window.closeModal('m-med-timer'); renderSavedTimers(); window.toast('Timer saved ✓'); }
export function deleteMedTimer(id) { S.meditation.savedTimers = (S.meditation.savedTimers || []).filter(t => t.id !== id); save(); renderSavedTimers(); }
export function loadSavedTimer(t) { const inp = document.getElementById('med-dur'); if (inp) { inp.value = t.dur || 10; medReset(); } const tgt = document.getElementById('med-target'); if (tgt) { tgt.value = t.target || 10; saveMedTarget(); } document.querySelectorAll('#page-meditation .tab').forEach(x => x.classList.remove('active')); const timerTab = document.querySelector('[data-tab="med-tab-timer"]'); if (timerTab) timerTab.classList.add('active'); document.querySelectorAll('#page-meditation .tab-content').forEach(x => x.style.display = 'none'); const tc = document.getElementById('med-tab-timer'); if (tc) tc.style.display = 'block'; if (t.sound !== undefined) { document.querySelectorAll('.med-sound-btn').forEach(b => { b.classList.toggle('active', b.dataset.sound === t.sound); }); window.playAmbient(t.sound); } haptic('medium'); window.toast('Loaded: ' + t.name); }
export function renderSavedTimers() {
  const el = document.getElementById('saved-timers-list'); if (!el) return;
  const timers = S.meditation.savedTimers || [];
  if (!timers.length) { el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text3)"><div style="font-size:48px;margin-bottom:12px">⭐</div><div style="font-size:15px;margin-bottom:8px">No saved timers yet</div><div style="font-size:12px;margin-bottom:16px">Save your favourite meditation durations and sounds</div><button class="btn btn-primary" onclick="openAddMedTimer()">+ Create First Timer</button></div>`; return; }
  el.innerHTML = timers.map(t => `
    <div class="saved-timer-card">
      <div class="saved-timer-icon">${t.icon || '🧘'}</div>
      <div class="saved-timer-info">
        <div class="saved-timer-name">${t.name}</div>
        <div class="saved-timer-meta">${t.dur} min · ${t.target} min/day target${t.sound ? ' · ' + ({ brown: 'Brown Noise', rain: 'Rain', waves: 'Waves' }[t.sound] || t.sound) : ''}${t.notes ? `<br><span style="color:var(--text3)">${t.notes}</span>` : ''}</div>
      </div>
      <button class="btn btn-sm" style="background:var(--teal-bg);border-color:var(--teal);color:var(--teal)" onclick='loadSavedTimer(${JSON.stringify(t)})'>▶ Start</button>
      <button class="btn-icon" onclick="openEditMedTimer('${t.id}')">✏️</button>
      <button class="btn-icon danger" onclick="deleteMedTimer('${t.id}')">🗑</button>
    </div>`).join('');
}

// Box Breathing
let breathInt = null, breathRunning = false, breathPhaseIdx = 0, breathPhaseTime = 0, breathCycleCount = 0;
const BREATH_PHASES = [{ key: 'in', label: 'Breathe In', cls: 'expanding', colorHint: 'teal' }, { key: 'hold1', label: 'Hold', cls: 'holding-in', colorHint: 'gold' }, { key: 'out', label: 'Breathe Out', cls: 'contracting', colorHint: 'violet' }, { key: 'hold2', label: 'Hold', cls: 'holding-out', colorHint: 'rose' }];
function getBreathTimings() { return { in: parseInt(document.getElementById('breath-in')?.value || 4), hold1: parseInt(document.getElementById('breath-hold1')?.value || 4), out: parseInt(document.getElementById('breath-out')?.value || 4), hold2: parseInt(document.getElementById('breath-hold2')?.value || 4) }; }
export function updateBreathDisplay() { /* timings read live */ }
export function selectBreathTechnique(btn) { document.querySelectorAll('.breath-technique-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); const { in: i, hold1: h1, out: o, hold2: h2 } = btn.dataset; document.getElementById('breath-in').value = i; document.getElementById('breath-hold1').value = h1; document.getElementById('breath-out').value = o; document.getElementById('breath-hold2').value = h2; breathReset(); haptic('light'); }
export function breathToggle() { if (breathRunning) { clearInterval(breathInt); breathRunning = false; document.getElementById('breath-btn').textContent = '▶'; setBreathVisual(null); } else { breathRunning = true; document.getElementById('breath-btn').textContent = '⏸'; breathPhaseIdx = 0; breathPhaseTime = 0; startBreathPhase(); breathInt = setInterval(breathTick, 1000); window.reqWL(); } }
export function breathReset() { clearInterval(breathInt); breathRunning = false; breathPhaseIdx = 0; breathPhaseTime = 0; breathCycleCount = 0; document.getElementById('breath-btn').textContent = '▶'; document.getElementById('breath-phase-label').textContent = 'Ready'; document.getElementById('breath-count').textContent = '—'; document.getElementById('breath-cycle-info').textContent = 'Press Start to begin'; setBreathVisual(null); window.relWL(); }
function startBreathPhase() { const timings = getBreathTimings(); for (let attempt = 0; attempt < 4; attempt++) { const ph = BREATH_PHASES[breathPhaseIdx % 4]; const dur = timings[ph.key] || 0; if (dur > 0) { breathPhaseTime = dur; document.getElementById('breath-phase-label').textContent = ph.label; document.getElementById('breath-count').textContent = dur; setBreathVisual(ph.cls); return; } breathPhaseIdx++; } }
function breathTick() { breathPhaseTime--; const countEl = document.getElementById('breath-count'); if (countEl) countEl.textContent = Math.max(0, breathPhaseTime); if (breathPhaseTime <= 0) { breathPhaseIdx = (breathPhaseIdx + 1) % 4; if (breathPhaseIdx === 0) { breathCycleCount++; const maxCycles = parseInt(document.getElementById('breath-cycles')?.value || 0); const cycleEl = document.getElementById('breath-cycle-info'); if (cycleEl) cycleEl.textContent = maxCycles > 0 ? `Cycle ${breathCycleCount} of ${maxCycles}` : `Cycle ${breathCycleCount}`; if (maxCycles > 0 && breathCycleCount >= maxCycles) { clearInterval(breathInt); breathRunning = false; window.relWL(); document.getElementById('breath-btn').textContent = '▶'; document.getElementById('breath-phase-label').textContent = 'Complete ✓'; document.getElementById('breath-count').textContent = '—'; setBreathVisual(null); haptic('success'); return; } } startBreathPhase(); } }
function setBreathVisual(cls) { const circle = document.getElementById('breath-circle'); const ring = document.getElementById('breath-outer-ring'); if (!circle || !ring) return; const classes = ['expanding', 'holding-in', 'contracting', 'holding-out']; circle.classList.remove(...classes); ring.classList.remove(...classes); if (cls) { circle.classList.add(cls); ring.classList.add(cls); } }
export function saveBreathPreset() { const timings = getBreathTimings(); const preview = `In ${timings.in}s · Hold ${timings.hold1}s · Out ${timings.out}s · Hold ${timings.hold2}s`; document.getElementById('bp-preview').textContent = preview; document.getElementById('bp-name').value = ''; document.getElementById('m-breath-preset').style.display = 'flex'; }
export function confirmSaveBreathPreset() { const name = document.getElementById('bp-name').value.trim(); if (!name) { window.toast('Enter a name', 'error'); return; } if (!S.meditation.breathPresets) S.meditation.breathPresets = []; const timings = getBreathTimings(); S.meditation.breathPresets.push({ id: uid(), name, ...timings }); save(); window.closeModal('m-breath-preset'); renderBreathPresets(); window.toast('Breathing preset saved ✓'); }
export function deleteBreathPreset(id) { S.meditation.breathPresets = (S.meditation.breathPresets || []).filter(p => p.id !== id); save(); renderBreathPresets(); }
export function renderBreathPresets() {
  const list = document.getElementById('breath-technique-list'); if (!list) return;
  list.querySelectorAll('[data-custom]').forEach(el => el.remove());
  (S.meditation.breathPresets || []).forEach(p => {
    const btn = document.createElement('div'); btn.className = 'breath-technique-btn'; btn.dataset.in = p.in; btn.dataset.hold1 = p.hold1; btn.dataset.out = p.out; btn.dataset.hold2 = p.hold2; btn.dataset.custom = '1';
    btn.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between"><div><div style="font-weight:600;font-size:14px">⭐ ${p.name}</div><div style="font-size:11px;color:var(--text3)">${p.in}s · ${p.hold1}s · ${p.out}s · ${p.hold2}s — Custom</div></div><button class="btn-icon danger" onclick="event.stopPropagation();deleteBreathPreset('${p.id}')">🗑</button></div>`;
    btn.addEventListener('click', function () { selectBreathTechnique(this); });
    list.appendChild(btn);
  });
}

export function renderHeatmaps() {
  const dwM = parseInt(document.getElementById('dw-hm-months')?.value || 1);
  const medM = parseInt(document.getElementById('med-hm-months')?.value || 1);
  window.renderHM('dw-heatmap', dwM * 30, k => { const min = S.deepwork.sessions.filter(s => s.date === k).reduce((a, s) => a + s.min, 0); return { l: min === 0 ? 0 : min < 30 ? 1 : min < 60 ? 2 : min < 120 ? 3 : 4, title: k + ': ' + min + 'min' }; });
  window.renderHM('med-heatmap', medM * 30, k => { const min = S.meditation.sessions.filter(s => s.date === k).reduce((a, s) => a + s.min, 0); return { l: min === 0 ? 0 : min < 5 ? 1 : min < 10 ? 2 : min < 20 ? 3 : 4, title: k + ': ' + min + 'min' }; });
}

window.renderMedStats = renderMedStats;
window.renderSavedTimers = renderSavedTimers;
window.renderBreathPresets = renderBreathPresets;
window.renderHeatmaps = renderHeatmaps;
window.setMedSound = setMedSound;
window.setMedDur = setMedDur;
window.medToggle = medToggle;
window.medReset = medReset;
window.medSkip = medSkip;
window.logMed = logMed;
window.saveMedTarget = saveMedTarget;
window.openAddMedTimer = openAddMedTimer;
window.openEditMedTimer = openEditMedTimer;
window.saveMedTimerPreset = saveMedTimerPreset;
window.deleteMedTimer = deleteMedTimer;
window.loadSavedTimer = loadSavedTimer;
window.updateBreathDisplay = updateBreathDisplay;
window.selectBreathTechnique = selectBreathTechnique;
window.breathToggle = breathToggle;
window.breathReset = breathReset;
window.saveBreathPreset = saveBreathPreset;
window.confirmSaveBreathPreset = confirmSaveBreathPreset;
window.deleteBreathPreset = deleteBreathPreset;
window.saveMedCfg = saveMedCfg;
