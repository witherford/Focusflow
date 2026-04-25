// Daily check-in — mood (1-5) + sleep (hours) stored on S.checkins[dateKey].
import { S, today, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';

const MOODS = ['😔', '🙁', '😐', '🙂', '😄'];

function ensureStore() {
  if (!S.checkins) S.checkins = {};
  return S.checkins;
}

export function setMood(v) {
  const store = ensureStore();
  if (!store[today()]) store[today()] = {};
  store[today()].mood = v;
  haptic('light'); save();
  renderCheckin();
}

export function setSleep(v) {
  const store = ensureStore();
  if (!store[today()]) store[today()] = {};
  store[today()].sleepHrs = parseFloat(v) || 0;
  save();
}

export function renderCheckin() {
  const el = document.getElementById('dash-checkin'); if (!el) return;
  const store = ensureStore();
  const t = store[today()] || {};
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">📝 Check-in</div><div style="font-size:11px;color:var(--text3)">today</div></div>
    <div class="checkin-card">
      <div class="checkin-col">
        <div style="font-size:12px;color:var(--text3)">Mood</div>
        <div class="mood-row">${MOODS.map((emo, i) => `<button class="mood-btn${t.mood === i + 1 ? ' active' : ''}" onclick="setMood(${i + 1})" aria-label="Mood ${i + 1}">${emo}</button>`).join('')}</div>
      </div>
      <div class="checkin-col" style="max-width:140px">
        <div style="font-size:12px;color:var(--text3)">Sleep (hrs)</div>
        <input type="number" id="ci-sleep" step="0.5" inputmode="decimal" value="${t.sleepHrs || ''}" onchange="setSleep(this.value)" placeholder="7.5" style="margin-top:4px">
      </div>
    </div>
  </div>`;
}

window.renderCheckin = renderCheckin;
window.setMood = setMood;
window.setSleep = setSleep;
