// Goals — milestones as expandable sections with due dates, focus timer
// integration, and steps. Time spent (via DW timer) accrues per-milestone
// and per-step, rolled up into goal progress.
import { S, uid, year } from '../../core/state.js';
import { save, goalCats } from '../../core/persistence.js';
import { callAI, extractJSON } from '../../core/ai.js';
import { progressRing } from '../../ui/progressRing.js';
import { goalProgress, linkedTasks } from './progress.js';

const catColor = c => ({ career: 'violet', health: 'green', learning: 'teal', personal: 'gold', finance: 'orange' })[c?.toLowerCase()] || 'violet';

// ── Migration helper: legacy milestones were { text, done }. Upgrade in-place.
export function ensureMilestoneShape(g) {
  if (!Array.isArray(g.milestones)) g.milestones = [];
  for (const m of g.milestones) {
    if (!m.id) m.id = uid();
    if (m.accruedMinutes == null) m.accruedMinutes = 0;
    if (m.due == null) m.due = '';
    if (!Array.isArray(m.steps)) m.steps = [];
    for (const s of m.steps) {
      if (!s.id) s.id = uid();
      if (s.accruedMinutes == null) s.accruedMinutes = 0;
      if (s.due == null) s.due = '';
      if (s.done == null) s.done = false;
    }
  }
}

export function collapseGoals() { S.goals.forEach(g => g.open = false); save(); renderGoals(); }
export function expandGoals() { S.goals.forEach(g => g.open = true); save(); renderGoals(); }

function dueClass(d) {
  if (!d) return '';
  const today = new Date().toISOString().slice(0, 10);
  if (d < today) return 'rose';
  return 'gold';
}

function totalMilestoneMinutes(m) {
  return (m.accruedMinutes || 0) + (m.steps || []).reduce((a, s) => a + (s.accruedMinutes || 0), 0);
}

export function renderGoals() {
  S.goals.forEach(ensureMilestoneShape);
  const el = document.getElementById('goals-list'); if (!el) return;
  if (!S.goals.length) { el.innerHTML = '<div style="color:var(--text3);text-align:center;padding:40px">No goals yet</div>'; return; }
  el.innerHTML = S.goals.map(g => {
    const prog = goalProgress(g);
    const pct = prog.pct;
    const col = catColor(g.category), open = g.open !== false;
    const tasks = linkedTasks(g.id);
    const totalMinutes = (g.milestones || []).reduce((a, m) => a + totalMilestoneMinutes(m), 0) + tasks.reduce((a, t) => a + (t.accruedMinutes || 0), 0);
    const minuteLine = g.minuteTarget ? ` · ${totalMinutes}/${g.minuteTarget}min focus` : (totalMinutes ? ` · ${totalMinutes}min focus` : '');
    return `<div class="goal-card">
      <div class="goal-header" style="gap:12px;align-items:center">
        <div style="flex-shrink:0;cursor:pointer" onclick="toggleGoal('${g.id}')">${progressRing({ pct, size: 44, stroke: 4, color: `var(--${col})` })}</div>
        <div style="flex:1;min-width:0;cursor:pointer" onclick="toggleGoal('${g.id}')"><div style="font-weight:600;font-size:14px">${g.name}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${prog.done.toFixed ? prog.done.toFixed(1) : prog.done}/${prog.total} · ${g.targetDate || 'no target'}${minuteLine}</div></div>
        <span class="badge badge-${col}">${g.category}</span>
        <button class="btn-icon" title="Quick-add milestone" onclick="event.stopPropagation();quickAddMilestone('${g.id}')">＋</button>
        <button class="btn-icon" title="Edit" onclick="event.stopPropagation();openEditGoal('${g.id}')">✏️</button>
        <button class="btn-icon danger" title="Delete" onclick="event.stopPropagation();deleteGoal('${g.id}')">🗑</button>
        <span style="color:var(--text3);font-size:12px;margin-left:4px;cursor:pointer;transition:.3s;transform:rotate(${open ? 90 : 0}deg);display:inline-block" onclick="toggleGoal('${g.id}')">▶</span>
      </div>
      ${open ? `<div style="padding:0 16px 14px">
        <div class="progress-track" style="margin-bottom:10px"><div class="fill" style="background:var(--${col});width:${pct}%"></div></div>
        ${(g.milestones || []).map((m, i) => renderMilestoneSection(g, m, i)).join('')}
        ${tasks.length ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Linked tasks (${tasks.filter(t => t.done).length}/${tasks.length})</div>${tasks.map(t => `<div class="milestone-row ${t.done ? 'is-done' : ''}" onclick="toggleTask('${t.id}')"><div class="milestone-check ${t.done ? 'done' : ''}">✓</div><div class="milestone-text">${t.name}${t.accruedMinutes ? ` <span style="color:var(--text3);font-size:10px">· ${t.accruedMinutes}min</span>` : ''}</div></div>`).join('')}</div>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');
}

function renderMilestoneSection(g, m, idx) {
  const minutes = totalMilestoneMinutes(m);
  const stepsDone = (m.steps || []).filter(s => s.done).length;
  const stepsTotal = (m.steps || []).length;
  const dueCls = dueClass(m.due);
  return `<div class="ms-section ${m.done ? 'is-done' : ''}" data-ms-id="${m.id}">
    <div class="ms-header">
      <div class="milestone-check ${m.done ? 'done' : ''}" onclick="toggleMS('${g.id}','${m.id}')">✓</div>
      <div style="flex:1;min-width:0">
        <div class="milestone-text" style="font-weight:600">${m.text}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          ${m.due ? `<span style="color:var(--${dueCls || 'text3'})">📅 ${m.due}</span> · ` : ''}
          ${minutes ? `${minutes}min · ` : ''}${stepsTotal ? `${stepsDone}/${stepsTotal} steps` : 'no steps'}
        </div>
      </div>
      <button class="btn-icon" title="Focus on this milestone" onclick="focusOnMilestone('${g.id}','${m.id}')">🧠</button>
      <button class="btn-icon" title="Edit milestone" onclick="openEditMilestone('${g.id}','${m.id}')">✏️</button>
      <button class="btn-icon" title="Add step" onclick="quickAddStep('${g.id}','${m.id}')">＋</button>
      <button class="btn-icon danger" title="Delete milestone" onclick="deleteMilestone('${g.id}','${m.id}')">🗑</button>
    </div>
    ${(m.steps || []).length ? `<div class="ms-steps">${m.steps.map(s => renderStep(g, m, s)).join('')}</div>` : ''}
  </div>`;
}

function renderStep(g, m, s) {
  const dueCls = dueClass(s.due);
  return `<div class="step-row ${s.done ? 'is-done' : ''}">
    <div class="milestone-check ${s.done ? 'done' : ''}" onclick="toggleStep('${g.id}','${m.id}','${s.id}')">✓</div>
    <div style="flex:1;min-width:0">
      <div class="milestone-text">${s.text}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:1px">
        ${s.due ? `<span style="color:var(--${dueCls || 'text3'})">📅 ${s.due}</span>` : ''}
        ${s.accruedMinutes ? ` · ${s.accruedMinutes}min` : ''}
      </div>
    </div>
    <button class="btn-icon btn-xs" title="Focus on this step" onclick="focusOnStep('${g.id}','${m.id}','${s.id}')">🧠</button>
    <button class="btn-icon btn-xs" title="Edit" onclick="openEditStep('${g.id}','${m.id}','${s.id}')">✏️</button>
    <button class="btn-icon btn-xs danger" title="Delete" onclick="deleteStep('${g.id}','${m.id}','${s.id}')">✕</button>
  </div>`;
}

// ── Goal CRUD (unchanged) ───────────────────────────────────────────────────
export function toggleGoal(id) { const g = S.goals.find(x => x.id === id); if (!g) return; g.open = !(g.open !== false); save(); renderGoals(); }
export function deleteGoal(id) {
  const g = S.goals.find(x => x.id === id); if (!g) return;
  if (!confirm(`Delete goal "${g.name}"?`)) return;
  S.goals = S.goals.filter(x => x.id !== id); save(); renderGoals(); window.renderDash?.();
}

export function openAddGoal() {
  document.getElementById('m-goal-title').textContent = 'Add Goal';
  document.getElementById('goal-edit-id').value = '';
  document.getElementById('goal-name').value = '';
  document.getElementById('goal-milestones').value = '';
  document.getElementById('goal-date').value = year() + '-12-31';
  const mt = document.getElementById('goal-minutes'); if (mt) mt.value = '';
  window.populateSel('goal-cat', goalCats(), 'health');
  document.getElementById('m-goal').style.display = 'flex';
}

export function openEditGoal(id) {
  const g = S.goals.find(x => x.id === id); if (!g) return;
  document.getElementById('m-goal-title').textContent = 'Edit Goal';
  document.getElementById('goal-edit-id').value = id;
  document.getElementById('goal-name').value = g.name;
  document.getElementById('goal-milestones').value = (g.milestones || []).map(m => m.text).join('\n');
  document.getElementById('goal-date').value = g.targetDate || '';
  const mt = document.getElementById('goal-minutes'); if (mt) mt.value = g.minuteTarget ?? '';
  window.populateSel('goal-cat', goalCats(), g.category || 'health');
  document.getElementById('m-goal').style.display = 'flex';
}

export function saveGoal() {
  const name = document.getElementById('goal-name').value.trim(); if (!name) return;
  const editId = document.getElementById('goal-edit-id').value;
  const lines = document.getElementById('goal-milestones').value.split('\n').filter(x => x.trim());
  const minuteTarget = parseInt(document.getElementById('goal-minutes')?.value) || undefined;
  const data = {
    name,
    category: document.getElementById('goal-cat').value,
    targetDate: document.getElementById('goal-date').value,
    minuteTarget,
  };
  if (editId) {
    const g = S.goals.find(x => x.id === editId);
    if (g) {
      Object.assign(g, data);
      // Reconcile milestones by text — keep existing where text matches.
      const existing = g.milestones || [];
      const next = lines.map(text => {
        const found = existing.find(m => m.text === text.trim());
        return found || { id: uid(), text: text.trim(), done: false, due: '', accruedMinutes: 0, steps: [] };
      });
      g.milestones = next;
      ensureMilestoneShape(g);
    }
  } else {
    const milestones = lines.map(t => ({ id: uid(), text: t.trim(), done: false, due: '', accruedMinutes: 0, steps: [] }));
    S.goals.push({ id: uid(), open: true, milestones, ...data });
  }
  save(); window.closeModal('m-goal'); renderGoals(); window.renderDash?.();
}

// ── Milestone CRUD ──────────────────────────────────────────────────────────
export function toggleMS(gid, mid) {
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const m = (g.milestones || []).find(x => x.id === mid); if (!m) return;
  m.done = !m.done; m.doneAt = m.done ? new Date().toISOString().slice(0, 10) : null;
  save(); renderGoals(); window.renderDash?.();
}

export function quickAddMilestone(gid) {
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const text = prompt('New milestone:', '');
  if (!text || !text.trim()) return;
  ensureMilestoneShape(g);
  g.milestones.push({ id: uid(), text: text.trim(), done: false, due: '', accruedMinutes: 0, steps: [] });
  g.open = true;
  save(); renderGoals();
  window.toast?.('Milestone added ✓');
}

export function deleteMilestone(gid, mid) {
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const idx = (g.milestones || []).findIndex(m => m.id === mid); if (idx < 0) return;
  const removed = g.milestones[idx];
  if (!confirm(`Delete milestone "${removed.text}"?`)) return;
  g.milestones.splice(idx, 1);
  save(); renderGoals();
  window.toastUndo?.(`Deleted "${removed.text}"`, () => {
    g.milestones.splice(idx, 0, removed); save(); renderGoals();
  });
}

export function openEditMilestone(gid, mid) {
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const m = (g.milestones || []).find(x => x.id === mid); if (!m) return;
  ensureMilestoneEditModal();
  document.getElementById('mse-gid').value = gid;
  document.getElementById('mse-mid').value = mid;
  document.getElementById('mse-text').value = m.text || '';
  document.getElementById('mse-due').value = m.due || '';
  document.getElementById('m-milestone').style.display = 'flex';
}

export function saveMilestoneEdit() {
  const gid = document.getElementById('mse-gid').value;
  const mid = document.getElementById('mse-mid').value;
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const m = (g.milestones || []).find(x => x.id === mid); if (!m) return;
  m.text = (document.getElementById('mse-text').value || '').trim() || m.text;
  m.due = document.getElementById('mse-due').value || '';
  save(); window.closeModal?.('m-milestone'); renderGoals();
}

// ── Step CRUD ───────────────────────────────────────────────────────────────
export function quickAddStep(gid, mid) {
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const m = (g.milestones || []).find(x => x.id === mid); if (!m) return;
  const text = prompt('New step:', '');
  if (!text || !text.trim()) return;
  if (!Array.isArray(m.steps)) m.steps = [];
  m.steps.push({ id: uid(), text: text.trim(), done: false, due: '', accruedMinutes: 0 });
  save(); renderGoals();
}

export function toggleStep(gid, mid, sid) {
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const m = (g.milestones || []).find(x => x.id === mid); if (!m) return;
  const s = (m.steps || []).find(x => x.id === sid); if (!s) return;
  s.done = !s.done; s.doneAt = s.done ? new Date().toISOString().slice(0, 10) : null;
  save(); renderGoals();
}

export function deleteStep(gid, mid, sid) {
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const m = (g.milestones || []).find(x => x.id === mid); if (!m) return;
  const idx = (m.steps || []).findIndex(s => s.id === sid); if (idx < 0) return;
  const removed = m.steps[idx];
  m.steps.splice(idx, 1);
  save(); renderGoals();
  window.toastUndo?.(`Deleted step "${removed.text}"`, () => { m.steps.splice(idx, 0, removed); save(); renderGoals(); });
}

export function openEditStep(gid, mid, sid) {
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const m = (g.milestones || []).find(x => x.id === mid); if (!m) return;
  const s = (m.steps || []).find(x => x.id === sid); if (!s) return;
  ensureStepEditModal();
  document.getElementById('se-gid').value = gid;
  document.getElementById('se-mid').value = mid;
  document.getElementById('se-sid').value = sid;
  document.getElementById('se-text').value = s.text || '';
  document.getElementById('se-due').value = s.due || '';
  document.getElementById('m-step').style.display = 'flex';
}

export function saveStepEdit() {
  const gid = document.getElementById('se-gid').value;
  const mid = document.getElementById('se-mid').value;
  const sid = document.getElementById('se-sid').value;
  const g = S.goals.find(x => x.id === gid); if (!g) return;
  const m = (g.milestones || []).find(x => x.id === mid); if (!m) return;
  const s = (m.steps || []).find(x => x.id === sid); if (!s) return;
  s.text = (document.getElementById('se-text').value || '').trim() || s.text;
  s.due = document.getElementById('se-due').value || '';
  save(); window.closeModal?.('m-step'); renderGoals();
}

// ── Focus integration ───────────────────────────────────────────────────────
export function focusOnMilestone(gid, mid) {
  const g = S.goals.find(x => x.id === gid);
  const m = (g?.milestones || []).find(x => x.id === mid);
  if (!g || !m) return;
  // Hand off to deep work with a "linked target".
  window.dwLinkMilestone?.({ goalId: gid, milestoneId: mid, label: g.name + ' — ' + m.text });
  window.goPage?.('deepwork');
}

export function focusOnStep(gid, mid, sid) {
  const g = S.goals.find(x => x.id === gid);
  const m = (g?.milestones || []).find(x => x.id === mid);
  const s = (m?.steps || []).find(x => x.id === sid);
  if (!g || !m || !s) return;
  window.dwLinkMilestone?.({ goalId: gid, milestoneId: mid, stepId: sid, label: g.name + ' — ' + m.text + ' › ' + s.text });
  window.goPage?.('deepwork');
}

// ── Edit modals (lazily injected) ───────────────────────────────────────────
function ensureMilestoneEditModal() {
  if (document.getElementById('m-milestone')) return;
  const html = `<div class="modal-overlay" id="m-milestone" style="display:none"><div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title">Edit milestone</div>
    <input type="hidden" id="mse-gid"><input type="hidden" id="mse-mid">
    <div class="form-row"><label>Title</label><input type="text" id="mse-text" autocapitalize="sentences"></div>
    <div class="form-row"><label>Due date</label><input type="date" id="mse-due"></div>
    <div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" style="flex:1" onclick="saveMilestoneEdit()">Save</button><button class="btn" onclick="closeModal('m-milestone')">Cancel</button></div>
  </div></div>`;
  const wrap = document.createElement('div'); wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
}

function ensureStepEditModal() {
  if (document.getElementById('m-step')) return;
  const html = `<div class="modal-overlay" id="m-step" style="display:none"><div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title">Edit step</div>
    <input type="hidden" id="se-gid"><input type="hidden" id="se-mid"><input type="hidden" id="se-sid">
    <div class="form-row"><label>Title</label><input type="text" id="se-text" autocapitalize="sentences"></div>
    <div class="form-row"><label>Due date</label><input type="date" id="se-due"></div>
    <div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary" style="flex:1" onclick="saveStepEdit()">Save</button><button class="btn" onclick="closeModal('m-step')">Cancel</button></div>
  </div></div>`;
  const wrap = document.createElement('div'); wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
}

// ── AI milestones (unchanged) ───────────────────────────────────────────────
export async function aiGoalMilestones() {
  const name = document.getElementById('goal-name').value.trim(); if (!name) { window.toast('Enter a goal name first'); return; }
  const status = document.getElementById('ai-ms-status');
  if (status) status.textContent = 'Generating…';
  const prompt = `Create 5-8 practical milestones for: "${name}". Return ONLY a JSON array of strings. Example: ["Research options","Complete first step"]`;
  try {
    const raw = await callAI(prompt); const ms = extractJSON(raw, true);
    document.getElementById('goal-milestones').value = ms.join('\n');
    if (status) status.textContent = `Generated ${ms.length} milestones ✓`;
  } catch (e) { if (status) status.textContent = 'Failed — try again'; }
}

window.renderGoals = renderGoals;
window.toggleGoal = toggleGoal;
window.toggleMS = toggleMS;
window.deleteGoal = deleteGoal;
window.openAddGoal = openAddGoal;
window.openEditGoal = openEditGoal;
window.saveGoal = saveGoal;
window.aiGoalMilestones = aiGoalMilestones;
window.collapseGoals = collapseGoals;
window.expandGoals = expandGoals;
window.quickAddMilestone = quickAddMilestone;
window.deleteMilestone = deleteMilestone;
window.openEditMilestone = openEditMilestone;
window.saveMilestoneEdit = saveMilestoneEdit;
window.quickAddStep = quickAddStep;
window.toggleStep = toggleStep;
window.deleteStep = deleteStep;
window.openEditStep = openEditStep;
window.saveStepEdit = saveStepEdit;
window.focusOnMilestone = focusOnMilestone;
window.focusOnStep = focusOnStep;
