// Goals — extracted from focusflow_v10.html lines 1861-1895
import { S, uid, year } from '../../core/state.js';
import { save, goalCats } from '../../core/persistence.js';
import { callAI, extractJSON } from '../../core/ai.js';
import { progressRing } from '../../ui/progressRing.js';
import { goalProgress, linkedTasks } from './progress.js';

const catColor = c => ({ career: 'violet', health: 'green', learning: 'teal', personal: 'gold', finance: 'orange' })[c?.toLowerCase()] || 'violet';

export function collapseGoals() { S.goals.forEach(g => g.open = false); save(); renderGoals(); }
export function expandGoals() { S.goals.forEach(g => g.open = true); save(); renderGoals(); }

export function renderGoals() {
  const el = document.getElementById('goals-list'); if (!el) return;
  if (!S.goals.length) { el.innerHTML = '<div style="color:var(--text3);text-align:center;padding:40px">No goals yet</div>'; return; }
  el.innerHTML = S.goals.map(g => {
    const prog = goalProgress(g);
    const pct = prog.pct;
    const col = catColor(g.category), open = g.open !== false;
    const tasks = linkedTasks(g.id);
    const minuteLine = g.minuteTarget ? ` · ${prog.minutes}/${g.minuteTarget}min focus` : '';
    return `<div class="goal-card">
      <div class="goal-header" onclick="toggleGoal('${g.id}')" style="gap:12px">
        <div style="flex-shrink:0">${progressRing({ pct, size: 44, stroke: 4, color: `var(--${col})` })}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">${g.name}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${prog.done.toFixed ? prog.done.toFixed(1) : prog.done}/${prog.total} · ${g.targetDate || 'no target'}${minuteLine}</div></div>
        <span class="badge badge-${col}">${g.category}</span>
        <button class="btn-icon" onclick="event.stopPropagation();openEditGoal('${g.id}')">✏️</button>
        <button class="btn-icon danger" onclick="event.stopPropagation();deleteGoal('${g.id}')">🗑</button>
        <span style="color:var(--text3);font-size:12px;margin-left:4px;transition:.3s;transform:rotate(${open ? 90 : 0}deg);display:inline-block">▶</span>
      </div>
      ${open ? `<div style="padding:0 16px 14px">
        <div class="progress-track" style="margin-bottom:10px"><div class="fill" style="background:var(--${col});width:${pct}%"></div></div>
        ${g.milestones.map((m, i) => `<div class="milestone-row ${m.done ? 'is-done' : ''}" onclick="toggleMS('${g.id}',${i})">
          <div class="milestone-check ${m.done ? 'done' : ''}">✓</div>
          <div class="milestone-text">${m.text}</div>
          <span style="font-size:10px;color:var(--text3)">${i + 1}/${g.milestones.length}</span>
        </div>`).join('')}
        ${tasks.length ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Linked tasks (${tasks.filter(t => t.done).length}/${tasks.length})</div>${tasks.map(t => `<div class="milestone-row ${t.done ? 'is-done' : ''}" onclick="toggleTask('${t.id}')"><div class="milestone-check ${t.done ? 'done' : ''}">✓</div><div class="milestone-text">${t.name}${t.accruedMinutes ? ` <span style="color:var(--text3);font-size:10px">· ${t.accruedMinutes}min</span>` : ''}</div></div>`).join('')}</div>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');
}

export function toggleGoal(id) { const g = S.goals.find(x => x.id === id); if (!g) return; g.open = !(g.open !== false); save(); renderGoals(); }
export function toggleMS(gid, idx) { const g = S.goals.find(x => x.id === gid); if (!g) return; g.milestones[idx].done = !g.milestones[idx].done; save(); renderGoals(); }
export function deleteGoal(id) { S.goals = S.goals.filter(g => g.id !== id); save(); renderGoals(); }
export function openAddGoal() { document.getElementById('m-goal-title').textContent = 'Add Goal'; document.getElementById('goal-edit-id').value = ''; document.getElementById('goal-name').value = ''; document.getElementById('goal-milestones').value = ''; document.getElementById('goal-date').value = year() + '-12-31'; const mt = document.getElementById('goal-minutes'); if (mt) mt.value = ''; window.populateSel('goal-cat', goalCats(), 'health'); document.getElementById('m-goal').style.display = 'flex'; }
export function openEditGoal(id) { const g = S.goals.find(x => x.id === id); if (!g) return; document.getElementById('m-goal-title').textContent = 'Edit Goal'; document.getElementById('goal-edit-id').value = id; document.getElementById('goal-name').value = g.name; document.getElementById('goal-milestones').value = g.milestones.map(m => m.text).join('\n'); document.getElementById('goal-date').value = g.targetDate || ''; const mt = document.getElementById('goal-minutes'); if (mt) mt.value = g.minuteTarget ?? ''; window.populateSel('goal-cat', goalCats(), g.category || 'health'); document.getElementById('m-goal').style.display = 'flex'; }
export function saveGoal() { const name = document.getElementById('goal-name').value.trim(); if (!name) return; const editId = document.getElementById('goal-edit-id').value, ms = document.getElementById('goal-milestones').value.split('\n').filter(x => x.trim()); let arr = ms.map(t => ({ text: t.trim(), done: false })); if (editId) { const existing = S.goals.find(x => x.id === editId); if (existing) arr = ms.map(t => { const ex = existing.milestones.find(m => m.text === t.trim()); return { text: t.trim(), done: ex ? ex.done : false }; }); } const minuteTarget = parseInt(document.getElementById('goal-minutes')?.value) || undefined; const data = { name, category: document.getElementById('goal-cat').value, targetDate: document.getElementById('goal-date').value, milestones: arr, minuteTarget }; if (editId) { const g = S.goals.find(x => x.id === editId); if (g) Object.assign(g, data); } else S.goals.push({ id: uid(), open: true, ...data }); save(); window.closeModal('m-goal'); renderGoals(); window.renderDash?.(); }

export async function aiGoalMilestones() {
  const name = document.getElementById('goal-name').value.trim(); if (!name) { window.toast('Enter a goal name first'); return; }
  const btn = document.getElementById('ai-milestone-btn'); const status = document.getElementById('ai-ms-status');
  if (btn) btn.disabled = true; status.textContent = 'Generating…';
  const prompt = `Create 5-8 practical milestones for: "${name}". Return ONLY a JSON array of strings. Example: ["Research options","Complete first step"]`;
  try {
    const raw = await callAI(prompt); const ms = extractJSON(raw, true);
    document.getElementById('goal-milestones').value = ms.join('\n');
    if (btn) btn.disabled = false; status.textContent = `Generated ${ms.length} milestones ✓`;
  } catch (e) { if (btn) btn.disabled = false; status.textContent = 'Failed — try again'; }
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
