// Weekly review wizard — 5-question guided reflection saved to journal.
import { S, today, uid } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { weekSummary } from './trends.js';

const QUESTIONS = [
  { id: 'wins',     label: '🏆 What went well this week?', placeholder: 'List 1-3 wins, big or small' },
  { id: 'lessons',  label: '🧠 What did you learn?',         placeholder: 'A new insight, mistake, or pattern' },
  { id: 'gratitude',label: '💗 What are you grateful for?',  placeholder: 'A person, moment, or comfort' },
  { id: 'blockers', label: '🧱 What slowed you down?',       placeholder: 'Friction, distractions, fears' },
  { id: 'focus',    label: '🎯 One focus for next week',     placeholder: 'A single intention to anchor your week' },
];

let _step = 0; let _answers = {};

function setStep(i) {
  _step = Math.max(0, Math.min(QUESTIONS.length, i));
  renderStep();
}

function renderStep() {
  const wrap = document.getElementById('m-wreview'); if (!wrap) return;
  if (_step >= QUESTIONS.length) return renderSummary();
  const q = QUESTIONS[_step];
  const stepLbl = document.getElementById('wr-step-lbl');
  const labelEl = document.getElementById('wr-q-label');
  const taEl = document.getElementById('wr-textarea');
  const back = document.getElementById('wr-back');
  const next = document.getElementById('wr-next');
  if (stepLbl) stepLbl.textContent = `${_step + 1} / ${QUESTIONS.length}`;
  if (labelEl) labelEl.textContent = q.label;
  if (taEl) { taEl.placeholder = q.placeholder; taEl.value = _answers[q.id] || ''; setTimeout(() => taEl.focus(), 60); }
  document.getElementById('wr-summary').style.display = 'none';
  document.getElementById('wr-form').style.display = '';
  if (back) back.disabled = _step === 0;
  if (next) next.textContent = _step === QUESTIONS.length - 1 ? 'See review →' : 'Next →';
}

function renderSummary() {
  const wrap = document.getElementById('m-wreview'); if (!wrap) return;
  document.getElementById('wr-form').style.display = 'none';
  const out = document.getElementById('wr-summary');
  const sum = weekSummary();
  const items = QUESTIONS.map(q => `<div style="margin-bottom:10px"><div style="font-size:12px;color:var(--text3);margin-bottom:2px">${q.label}</div><div style="font-size:13px;line-height:1.5;white-space:pre-wrap">${(_answers[q.id] || '—').trim() || '—'}</div></div>`).join('');
  out.innerHTML = `
    <div style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Numbers</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:11px">
        <div class="stat-card" style="--accent:var(--violet);padding:10px"><div class="stat-num" style="font-size:20px">${sum.habits.pct}%</div><div class="stat-label">Habits</div></div>
        <div class="stat-card" style="--accent:var(--teal);padding:10px"><div class="stat-num" style="font-size:20px">${(sum.dwMin/60).toFixed(1)}h</div><div class="stat-label">Focus</div></div>
        <div class="stat-card" style="--accent:var(--gold);padding:10px"><div class="stat-num" style="font-size:20px">${sum.medMin}</div><div class="stat-label">Med min</div></div>
        <div class="stat-card" style="--accent:var(--green);padding:10px"><div class="stat-num" style="font-size:20px">${sum.tasks}</div><div class="stat-label">Tasks</div></div>
      </div>
    </div>
    <div style="margin-top:6px">${items}</div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="saveWReview()">💾 Save to journal</button>
      <button class="btn" onclick="window.print()">🖨 Print / PDF</button>
      <button class="btn" onclick="closeModal('m-wreview')">Close</button>
    </div>
  `;
  out.style.display = '';
}

export function startWReview() {
  _step = 0; _answers = {};
  ensureModal();
  document.getElementById('m-wreview').style.display = 'flex';
  setStep(0);
}

export function nextWReview() {
  const ta = document.getElementById('wr-textarea');
  if (ta) _answers[QUESTIONS[_step].id] = ta.value;
  setStep(_step + 1);
}

export function backWReview() {
  const ta = document.getElementById('wr-textarea');
  if (ta && _step < QUESTIONS.length) _answers[QUESTIONS[_step].id] = ta.value;
  setStep(_step - 1);
}

export function saveWReview() {
  const text = QUESTIONS.map(q => `${q.label}\n${(_answers[q.id] || '').trim() || '—'}`).join('\n\n');
  S.journal.push({ id: uid(), datetime: new Date().toISOString().slice(0, 16), type: 'review', habitId: '', text });
  save();
  window.toast?.('Weekly review saved ✓');
  window.closeModal?.('m-wreview');
  window.renderJournal?.();
}

function ensureModal() {
  if (document.getElementById('m-wreview')) return;
  const html = `<div class="modal-overlay" id="m-wreview" style="display:none"><div class="modal" style="max-width:480px">
    <div class="modal-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div class="modal-title" style="margin:0">✨ Weekly review</div>
      <span id="wr-step-lbl" style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">1 / 5</span>
    </div>
    <div id="wr-form">
      <div id="wr-q-label" style="font-size:14px;color:var(--text2);margin-bottom:8px">Q</div>
      <textarea id="wr-textarea" rows="4" placeholder=""></textarea>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn" id="wr-back" onclick="backWReview()">← Back</button>
        <button class="btn btn-primary" id="wr-next" style="flex:1" onclick="nextWReview()">Next →</button>
        <button class="btn" onclick="closeModal('m-wreview')">Cancel</button>
      </div>
    </div>
    <div id="wr-summary" style="display:none"></div>
  </div></div>`;
  const wrap = document.createElement('div'); wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
}

window.startWReview = startWReview;
window.nextWReview = nextWReview;
window.backWReview = backWReview;
window.saveWReview = saveWReview;
