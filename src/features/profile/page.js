// Profile — extracted from focusflow_v10.html lines 2366-2391 + 2358-2364
import { S, uid, year } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { callAI, extractJSON } from '../../core/ai.js';
import { syncPositiveHabit } from './habitLinks.js';

export const calcDur = (s, e) => {
  if (!s || !e) return '';
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  const d = (eh * 60 + em) - (sh * 60 + sm);
  if (d <= 0) return '';
  return d >= 60 ? Math.floor(d / 60) + 'h' + (d % 60 ? ' ' + d % 60 + 'm' : '') : d + 'm';
};

const POS = ['Daily exercise','Morning walk','Read 30 mins','Cold shower','Journaling','Drink 2L water','Gratitude practice','Meal prep','Meditate','Learn something new','Evening stretch','No phone first hour'];
const NEG = ['Doom scrolling','Snooze alarm','Skip workouts','Junk food','Alcohol','Smoking','Late night screens','Procrastinate','Skip breakfast','Overspend'];

let _rDays = [];
let _ast = null;

export function renderProfile() {
  const pos = document.getElementById('pos-checks');
  if (pos) pos.innerHTML = POS.map(h => `<div class="check-item ${(S.profile.posHabits || []).includes(h) ? 'selected' : ''}" onclick="togglePH('pos','${h}')"><input type="checkbox" ${(S.profile.posHabits || []).includes(h) ? 'checked' : ''} onclick="event.stopPropagation()"><span style="font-size:12px">${h}</span></div>`).join('');
  const neg = document.getElementById('neg-checks');
  if (neg) neg.innerHTML = NEG.map(h => `<div class="check-item ${(S.profile.negHabits || []).includes(h) ? 'selected' : ''}" onclick="togglePH('neg','${h}')"><input type="checkbox" ${(S.profile.negHabits || []).includes(h) ? 'checked' : ''} onclick="event.stopPropagation()"><span style="font-size:12px">${h}</span></div>`).join('');
  ['p-name','p-weight','p-wake','p-bed'].forEach(f => { const el = document.getElementById(f); if (el && S.profile[f.slice(2)] !== undefined) el.value = S.profile[f.slice(2)]; });
  document.getElementById('p-sleep-now').value = S.profile.sleepNow || 7;
  document.getElementById('p-sleep-target').value = S.profile.sleepTarget || 8;
  document.getElementById('pos-custom').value = S.profile.posCustom || '';
  document.getElementById('neg-custom').value = S.profile.negCustom || '';
  document.getElementById('p-goals').value = S.profile.goals || '';
  document.getElementById('p-diet').value = S.profile.diet || 'balanced';
  document.getElementById('p-allergies').value = S.profile.allergies || '';
  document.getElementById('p-meals').value = S.profile.meals || 3;
  renderRoutinesList();
}

export function togglePH(type, h) {
  const arr = type === 'pos' ? (S.profile.posHabits || (S.profile.posHabits = [])) : (S.profile.negHabits || (S.profile.negHabits = []));
  const idx = arr.indexOf(h);
  if (idx > -1) arr.splice(idx, 1); else arr.push(h);
  // Selecting a positive habit in the profile no longer auto-creates one in
  // your habit list — that caused habits to appear without your input on
  // every reload. Add habits explicitly via the Habits page or Quick Capture.
  saveProfile(true); renderProfile(); window.renderBadHabits?.();
}

export function saveProfile(silent) {
  S.profile.name = document.getElementById('p-name')?.value || '';
  S.profile.weight = document.getElementById('p-weight')?.value || '';
  S.profile.wake = document.getElementById('p-wake')?.value || '06:30';
  S.profile.bed = document.getElementById('p-bed')?.value || '22:30';
  S.profile.sleepNow = parseFloat(document.getElementById('p-sleep-now')?.value) || 7;
  S.profile.sleepTarget = parseFloat(document.getElementById('p-sleep-target')?.value) || 8;
  S.profile.posCustom = document.getElementById('pos-custom')?.value || '';
  S.profile.negCustom = document.getElementById('neg-custom')?.value || '';
  S.profile.goals = document.getElementById('p-goals')?.value || '';
  S.profile.diet = document.getElementById('p-diet')?.value || 'balanced';
  S.profile.allergies = document.getElementById('p-allergies')?.value || '';
  S.profile.meals = parseInt(document.getElementById('p-meals')?.value) || 3;
  save(); window.renderSchedule?.(); window.renderBadHabits?.();
}

export function autoSave() { clearTimeout(_ast); _ast = setTimeout(() => saveProfile(true), 600); }
export function attachAutoSave() { /* handled by document-level listeners in persistence.js */ }

export function renderRoutinesList() {
  const el = document.getElementById('routines-list'); if (!el) return;
  const routines = S.profile.trainRoutines || [];
  if (!routines.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px;margin-bottom:8px">No routines yet</div>'; return; }
  el.innerHTML = routines.map(r => {
    const dur = calcDur(r.start, r.end);
    return `<div class="routine-card"><div class="routine-emoji">${r.icon || '🏋️'}</div><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">${r.name}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${r.start || ''}${r.end ? ' → ' + r.end : ''}${dur ? ' (' + dur + ')' : ''} · ${(r.days || []).join(', ') || 'No days'}</div>${r.notes ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${r.notes}</div>` : ''}</div><button class="btn-icon" onclick="openEditRoutine('${r.id}')">✏️</button><button class="btn-icon danger" onclick="delRoutine('${r.id}')">🗑</button></div>`;
  }).join('');
}

export function openAddRoutine() {
  _rDays = [];
  document.getElementById('m-routine-title').textContent = 'Add Routine';
  document.getElementById('routine-edit-id').value = '';
  ['routine-name','routine-icon','routine-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('routine-start').value = '07:00';
  document.getElementById('routine-end').value = '08:00';
  document.querySelectorAll('#routine-days .day-dot').forEach(d => d.classList.remove('active'));
  document.getElementById('m-routine').style.display = 'flex';
}

export function openEditRoutine(id) {
  const r = (S.profile.trainRoutines || []).find(x => x.id === id); if (!r) return;
  _rDays = [...(r.days || [])];
  document.getElementById('m-routine-title').textContent = 'Edit Routine';
  document.getElementById('routine-edit-id').value = id;
  document.getElementById('routine-name').value = r.name || '';
  document.getElementById('routine-icon').value = r.icon || '';
  document.getElementById('routine-start').value = r.start || '07:00';
  document.getElementById('routine-end').value = r.end || '08:00';
  document.getElementById('routine-notes').value = r.notes || '';
  document.querySelectorAll('#routine-days .day-dot').forEach(d => d.classList.toggle('active', _rDays.includes(d.dataset.d)));
  document.getElementById('m-routine').style.display = 'flex';
}

export function saveRoutine() {
  const name = document.getElementById('routine-name').value.trim(); if (!name) return;
  const editId = document.getElementById('routine-edit-id').value;
  const data = { name, icon: document.getElementById('routine-icon').value || '🏋️', start: document.getElementById('routine-start').value, end: document.getElementById('routine-end').value, notes: document.getElementById('routine-notes').value, days: [..._rDays] };
  if (!S.profile.trainRoutines) S.profile.trainRoutines = [];
  if (editId) { const r = S.profile.trainRoutines.find(x => x.id === editId); if (r) Object.assign(r, data); }
  else S.profile.trainRoutines.push({ id: uid(), ...data });
  save(); window.closeModal('m-routine'); renderRoutinesList(); window.renderSchedule?.();
}

export function delRoutine(id) {
  S.profile.trainRoutines = (S.profile.trainRoutines || []).filter(r => r.id !== id);
  save(); renderRoutinesList(); window.renderSchedule?.();
}

export function initRoutineDays() {
  const el = document.getElementById('routine-days'); if (!el) return;
  el.addEventListener('click', e => {
    const d = e.target.closest('.day-dot'); if (!d) return;
    const day = d.dataset.d, idx = _rDays.indexOf(day);
    if (idx > -1) _rDays.splice(idx, 1); else _rDays.push(day);
    d.classList.toggle('active');
  });
}

// ── AI Plan ──────────────────────────────────────────────────────────────────

export async function generatePlan() {
  saveProfile(true);
  const btn = document.getElementById('gen-btn'), thinking = document.getElementById('ai-thinking'), streamBox = document.getElementById('ai-stream-box'), summaryEl = document.getElementById('ai-plan-summary');
  btn.disabled = true; btn.textContent = '⏳ Generating…'; thinking.style.display = 'flex'; streamBox.style.display = 'block'; streamBox.textContent = ''; summaryEl.style.display = 'none';
  const p = S.profile;
  const prompt = `You are a personal development coach. Return ONLY a raw JSON object, no markdown.\nProfile: Name: ${p.name || 'User'}, Wake: ${p.wake}, Bed: ${p.bed}, Sleep: ${p.sleepNow}h/${p.sleepTarget}h target, Training: ${JSON.stringify(p.trainRoutines || [])}, Habits to build: ${[...(p.posHabits || []), ...(p.posCustom || '').split('\n').filter(x => x.trim())].join(', ')}, Habits to stop: ${[...(p.negHabits || []), ...(p.negCustom || '').split('\n').filter(x => x.trim())].join(', ')}, Goals: ${p.goals || 'general self improvement'}, Diet: ${p.diet}\nReturn: {"summary":"2-3 sentence coaching insight","habits":[{"name":"","block":"morning|afternoon|evening","icon":"emoji"}],"goals":[{"name":"","category":"career|health|learning|personal|finance","targetDate":"${year()}-12-31","milestones":["step1","step2"]}],"chores":[{"name":"","day":"Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday"}],"deepWorkTarget":4,"meditationTarget":10}\nMake 8-12 specific habits, 2-3 goals with 4 milestones each, 7-10 chores.`;
  try {
    const full = await callAI(prompt, partial => { streamBox.textContent = partial.slice(0, 500) + (partial.length > 500 ? '…' : ''); streamBox.scrollTop = streamBox.scrollHeight; });
    thinking.style.display = 'none';
    const plan = extractJSON(full, false);
    if (plan.habits) S.habits = [...S.habits, ...plan.habits.map(h => ({ id: uid(), name: h.name, block: h.block || 'morning', icon: h.icon || '●' }))];
    if (plan.goals) S.goals = [...S.goals, ...plan.goals.map(g => ({ id: uid(), open: true, name: g.name, category: g.category || 'personal', targetDate: g.targetDate || '', milestones: (g.milestones || []).map(m => ({ text: m, done: false })) }))];
    if (plan.chores) S.chores = [...S.chores, ...plan.chores.map(c => ({ id: uid(), name: c.name, day: c.day || 'Monday' }))];
    if (plan.deepWorkTarget) S.deepwork.target = plan.deepWorkTarget;
    if (plan.meditationTarget) S.meditation.target = plan.meditationTarget;
    save(); window.renderAll?.();
    streamBox.textContent = '✓ Plan applied!';
    if (plan.summary) { summaryEl.style.display = 'block'; summaryEl.textContent = '💬 ' + plan.summary; }
    btn.disabled = false; btn.textContent = '✨ Regenerate Plan'; window.toast('Dashboard populated ✓');
  } catch (e) {
    thinking.style.display = 'none'; streamBox.textContent = 'Error: ' + e.message;
    btn.disabled = false; btn.textContent = '✨ Try Again';
  }
}

export function clearPlan() {
  if (!confirm('Clear all AI-generated habits, goals and chores?')) return;
  S.habits = []; S.goals = []; S.chores = []; save(); window.renderAll?.();
  document.getElementById('ai-plan-summary').style.display = 'none';
  document.getElementById('ai-stream-box').style.display = 'none';
  window.toast('Plan cleared ✓');
}

export function toggleAI() { S.settings.aiEnabled = document.getElementById('ai-toggle').checked; save(); applyAIVis(); }

export function applyAIVis() {
  const on = S.settings.aiEnabled !== false;
  const cb = document.getElementById('ai-toggle'); if (cb) cb.checked = on;
  ['ai-plan-banner'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; });
}

window.renderProfile = renderProfile;
window.togglePH = togglePH;
window.saveProfile = saveProfile;
window.autoSave = autoSave;
window.attachAutoSave = attachAutoSave;
window.renderRoutinesList = renderRoutinesList;
window.openAddRoutine = openAddRoutine;
window.openEditRoutine = openEditRoutine;
window.saveRoutine = saveRoutine;
window.delRoutine = delRoutine;
window.generatePlan = generatePlan;
window.clearPlan = clearPlan;
window.toggleAI = toggleAI;
window.applyAIVis = applyAIVis;
window.calcDur = calcDur;
