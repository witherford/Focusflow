// Projects & Tasks — extracted from focusflow_v10.html lines 1764-1859
import { S, today, uid, year } from '../../core/state.js';
import { save, projCats } from '../../core/persistence.js';

const getChildren = pid => S.tasks.filter(t => t.parentId === pid);
const getRoots = pjId => S.tasks.filter(t => t.projectId === pjId && !t.parentId);
function allDesc(tid) { const k = getChildren(tid); let a = [...k]; k.forEach(c => { a = [...a, ...allDesc(c.id)]; }); return a; }
function projStats(pid) { let total = 0, done = 0; const ct = id => { total++; if (S.tasks.find(t => t.id === id)?.done) done++; getChildren(id).forEach(c => ct(c.id)); }; getRoots(pid).forEach(r => ct(r.id)); return { total, done, pct: total ? Math.round(done / total * 100) : 0 }; }
const dueCls = d => { if (!d) return ''; const diff = (new Date(d) - new Date()) / 864e5; return diff < 0 ? 'var(--rose)' : diff < 3 ? 'var(--gold)' : 'var(--text3)'; };
const priColor = { high: 'var(--rose)', medium: 'var(--gold)', low: 'var(--green)' };
const priIcon = { high: '🔴', medium: '🟡', low: '🟢' };

export function collapseProjects() { S.projects.forEach(p => p.open = false); S.tasks.forEach(t => t.expanded = false); save(); renderProjTree(); }
export function expandProjects() { S.projects.forEach(p => p.open = true); S.tasks.forEach(t => t.expanded = true); save(); renderProjTree(); }

export function renderProjTree() {
  const el = document.getElementById('proj-tree'); if (!el) return;
  if (!S.projects.length) { el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text3)"><div style="font-size:48px;margin-bottom:12px">📁</div><div style="font-size:15px;margin-bottom:16px">No projects yet</div><button class="btn btn-primary" onclick="openAddProject()">+ Create First Project</button></div>`; return; }
  el.innerHTML = S.projects.map(renderProjCard).join('');
}

function renderProjCard(p) {
  const stats = projStats(p.id), roots = getRoots(p.id), open = p.open !== false;
  const overdue = S.tasks.filter(t => t.projectId === p.id && !t.done && t.due && t.due < today()).length;
  return `<div class="proj-card">
    <div class="proj-header" onclick="toggleProj('${p.id}')">
      <div class="proj-color-dot" style="background:${p.color || 'var(--violet)'}"></div>
      <div class="proj-name">${p.name}</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${overdue ? `<span class="badge badge-rose">${overdue} overdue</span>` : ''}
        ${p.due ? `<span class="badge badge-gold">Due ${p.due}</span>` : ''}
        <span class="badge badge-gray">${p.category || 'project'}</span>
      </div>
      <div style="display:flex;gap:2px;margin-left:6px">
        <button class="btn-icon" onclick="event.stopPropagation();openEditProject('${p.id}')">✏️</button>
        <button class="btn-icon" onclick="event.stopPropagation();openAddTaskTo('${p.id}')">+task</button>
        <button class="btn-icon danger" onclick="event.stopPropagation();deleteProject('${p.id}')">🗑</button>
      </div>
      <span style="color:var(--text3);font-size:12px;transition:.3s;transform:rotate(${open ? 90 : 0}deg);display:inline-block">▶</span>
    </div>
    <div style="padding:6px 16px 0;${open ? '' : 'display:none'}">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px"><span>${p.desc || ''}</span><span>${stats.pct}%</span></div>
      <div class="progress-track" style="margin-bottom:0"><div class="fill" style="background:${p.color || 'var(--violet)'};width:${stats.pct}%"></div></div>
    </div>
    <div style="padding:8px 14px 14px;${open ? '' : 'display:none'}">
      ${roots.length ? roots.map(t => renderTaskNode(t, 0)).join('') : `<div style="color:var(--text3);font-size:13px;padding:4px 0">No tasks yet — <span style="color:var(--violet);cursor:pointer" onclick="openAddTaskTo('${p.id}')">add one</span></div>`}
    </div>
  </div>`;
}

function renderTaskNode(task, depth) {
  const children = getChildren(task.id), dc = dueCls(task.due);
  const cbCls = task.done ? 'done' : children.length && children.some(c => c.done) && !children.every(c => c.done) ? 'partial' : '';
  return `<div style="margin-left:${depth * 16}px">
    <div class="task-row ${task.done ? 'is-done' : ''}">
      <div style="width:3px;align-self:stretch;border-radius:2px;background:${priColor[task.priority || 'medium']};flex-shrink:0"></div>
      <div class="task-cb ${cbCls}" onclick="event.stopPropagation();toggleTask('${task.id}')">✓</div>
      ${children.length ? `<button class="btn-icon btn-xs" onclick="event.stopPropagation();expandTask('${task.id}')" style="font-size:10px;width:20px;height:20px">${task.expanded ? '▾' : '▸'}</button>` : ``}
      <div style="flex:1;min-width:0">
        <div class="task-name">${priIcon[task.priority || 'medium']} ${task.name}</div>
        ${task.due ? `<div style="font-size:11px;color:${dc};margin-top:2px">📅 ${task.due}</div>` : ''}
        ${task.notes ? `<div style="font-size:11px;color:var(--text3);margin-top:3px;padding:4px 6px;background:var(--bg3);border-radius:6px;border-left:2px solid var(--border2)">${task.notes}</div>` : ''}
      </div>
      <div style="display:flex;gap:2px">
        <button class="btn-icon btn-xs" onclick="event.stopPropagation();openAddSubtask('${task.id}')">+</button>
        <button class="btn-icon" onclick="event.stopPropagation();openEditTask('${task.id}')">✏️</button>
        <button class="btn-icon danger" onclick="event.stopPropagation();deleteTask('${task.id}')">🗑</button>
      </div>
    </div>
    ${task.expanded && children.length ? `<div>${children.map(c => renderTaskNode(c, 1)).join('')}</div>` : ''}
  </div>`;
}

export function toggleProj(id) { const p = S.projects.find(x => x.id === id); if (!p) return; p.open = !(p.open !== false); save(); renderProjTree(); }
export function toggleTask(id) { const t = S.tasks.find(x => x.id === id); if (!t) return; t.done = !t.done; t.doneAt = t.done ? today() : null; if (t.done) allDesc(id).forEach(d => { d.done = true; d.doneAt = today(); }); save(); renderProjTree(); window.renderDash?.(); window.renderGoals?.(); }
export function expandTask(id) { const t = S.tasks.find(x => x.id === id); if (!t) return; t.expanded = !t.expanded; save(); renderProjTree(); }
export function deleteTask(id) { const desc = allDesc(id).map(d => d.id); S.tasks = S.tasks.filter(t => t.id !== id && !desc.includes(t.id)); save(); renderProjTree(); }
export function deleteProject(id) { if (!confirm('Delete project and all tasks?')) return; S.projects = S.projects.filter(p => p.id !== id); S.tasks = S.tasks.filter(t => t.projectId !== id); save(); renderProjTree(); }

function renderFlatTasks(el, tasks, empty) {
  if (!tasks.length) { el.innerHTML = `<div style="color:var(--text3);text-align:center;padding:40px">${empty}</div>`; return; }
  el.innerHTML = tasks.map(t => { const proj = S.projects.find(p => p.id === t.projectId), dc = dueCls(t.due); return `<div class="task-row ${t.done ? 'is-done' : ''}" style="margin-bottom:4px;border-radius:var(--r-sm);background:var(--surface)"><div style="width:3px;align-self:stretch;border-radius:2px;background:${priColor[t.priority || 'medium']};flex-shrink:0"></div><div class="task-cb ${t.done ? 'done' : ''}" onclick="toggleTask('${t.id}')" style="cursor:pointer">✓</div>${proj ? `<div style="width:8px;height:8px;border-radius:50%;background:${proj.color || 'var(--violet)'};flex-shrink:0;margin-top:4px"></div>` : ''}<div style="flex:1;min-width:0"><div class="task-name">${priIcon[t.priority || 'medium']} ${t.name}</div>${proj ? `<div style="font-size:11px;color:var(--text3)">${proj.name}</div>` : ''}</div>${t.due ? `<span style="font-size:11px;color:${dc}">📅 ${t.due}</span>` : ''}<button class="btn-icon" onclick="openEditTask('${t.id}')">✏️</button></div>`; }).join('');
}

export function renderAllFlat() { const el = document.getElementById('all-flat'); if (!el) return; let tasks = [...S.tasks]; const f = document.getElementById('all-filter')?.value || 'active'; if (f === 'active') tasks = tasks.filter(t => !t.done); else if (f === 'done') tasks = tasks.filter(t => t.done); const srt = document.getElementById('all-sort')?.value || 'priority'; const po = { high: 0, medium: 1, low: 2 }; if (srt === 'priority') tasks.sort((a, b) => (po[a.priority] || 1) - (po[b.priority] || 1)); else if (srt === 'due') tasks.sort((a, b) => { if (!a.due && !b.due) return 0; if (!a.due) return 1; if (!b.due) return -1; return a.due.localeCompare(b.due); }); else if (srt === 'name') tasks.sort((a, b) => a.name.localeCompare(b.name)); renderFlatTasks(el, tasks, 'No tasks'); }
export function renderDueToday() { const el = document.getElementById('today-tasks'); if (!el) return; renderFlatTasks(el, S.tasks.filter(t => t.due === today() && !t.done), 'Nothing due today 🎉'); }
export function renderOverdue() { const el = document.getElementById('overdue-tasks'); if (!el) return; renderFlatTasks(el, S.tasks.filter(t => t.due && t.due < today() && !t.done), 'No overdue tasks ✓'); }
export function renderBreakdown() {
  const el = document.getElementById('breakdown'); if (!el) return;
  const all = S.tasks, done = all.filter(t => t.done).length, ov = all.filter(t => !t.done && t.due && t.due < today()).length;
  el.innerHTML = `<div class="kanban-grid">
    <div class="kanban-col"><div class="card-title">Active</div><div class="kanban-num" style="color:var(--violet)">${all.length - done}</div></div>
    <div class="kanban-col"><div class="card-title">Done</div><div class="kanban-num" style="color:var(--green)">${done}</div></div>
    <div class="kanban-col"><div class="card-title">Overdue</div><div class="kanban-num" style="color:var(--rose)">${ov}</div></div>
  </div>${S.projects.map(p => { const s = projStats(p.id); return `<div class="card" style="margin-bottom:10px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="width:10px;height:10px;border-radius:50%;background:${p.color || 'var(--violet)'}"></div><span style="font-weight:600;flex:1">${p.name}</span><span style="font-size:12px;color:var(--text3)">${s.done}/${s.total} · ${s.pct}%</span></div><div class="progress-track"><div class="fill" style="background:${p.color || 'var(--violet)'};width:${s.pct}%"></div></div></div>`; }).join('')}`;
}

let _projColor = '#7c6ef7';
export function openAddProject() { document.getElementById('m-project-title').textContent = 'New Project'; document.getElementById('proj-edit-id').value = ''; ['proj-name', 'proj-desc'].forEach(id => document.getElementById(id).value = ''); document.getElementById('proj-due').value = year() + '-12-31'; window.populateSel('proj-cat', projCats(), 'work'); setProjColor('#7c6ef7'); document.getElementById('m-project').style.display = 'flex'; }
export function openEditProject(id) { const p = S.projects.find(x => x.id === id); if (!p) return; document.getElementById('m-project-title').textContent = 'Edit Project'; document.getElementById('proj-edit-id').value = id; document.getElementById('proj-name').value = p.name; document.getElementById('proj-desc').value = p.desc || ''; document.getElementById('proj-due').value = p.due || ''; window.populateSel('proj-cat', projCats(), p.category || 'work'); setProjColor(p.color || '#7c6ef7'); document.getElementById('m-project').style.display = 'flex'; }
export function setProjColor(c) { _projColor = c; document.getElementById('proj-color-val').value = c; document.querySelectorAll('#proj-swatches .swatch').forEach(s => s.classList.toggle('selected', s.dataset.c === c)); }
export function saveProject() { const name = document.getElementById('proj-name').value.trim(); if (!name) return; const editId = document.getElementById('proj-edit-id').value, data = { name, desc: document.getElementById('proj-desc').value, due: document.getElementById('proj-due').value, category: document.getElementById('proj-cat').value, color: _projColor, open: true }; if (editId) { const p = S.projects.find(x => x.id === editId); if (p) Object.assign(p, data); } else S.projects.push({ id: uid(), createdAt: Date.now(), ...data }); save(); window.closeModal('m-project'); renderProjTree(); }
function populateTaskProjs(selId, projId) { const s = document.getElementById(selId); if (!s) return; s.innerHTML = S.projects.map(p => `<option value="${p.id}"${p.id === projId ? ' selected' : ''}>${p.name}</option>`).join(''); }
function populateTaskGoals(goalId) { const s = document.getElementById('task-goal'); if (!s) return; s.innerHTML = '<option value="">— none —</option>' + (S.goals || []).map(g => `<option value="${g.id}"${g.id === goalId ? ' selected' : ''}>${g.name}</option>`).join(''); }
export function openAddTaskTo(projId) { document.getElementById('m-task-title').textContent = 'Add Task'; document.getElementById('task-edit-id').value = ''; document.getElementById('task-parent-id').value = ''; ['task-name', 'task-notes'].forEach(id => document.getElementById(id).value = ''); document.getElementById('task-priority').value = 'medium'; document.getElementById('task-due').value = year() + '-12-31'; populateTaskProjs('task-project', projId); populateTaskGoals(''); document.getElementById('m-task').style.display = 'flex'; }
export function openAddSubtask(pid) { const par = S.tasks.find(x => x.id === pid); if (!par) return; document.getElementById('m-task-title').textContent = 'Add Step'; document.getElementById('task-edit-id').value = ''; document.getElementById('task-parent-id').value = pid; ['task-name', 'task-notes'].forEach(id => document.getElementById(id).value = ''); document.getElementById('task-priority').value = 'medium'; document.getElementById('task-due').value = year() + '-12-31'; populateTaskProjs('task-project', par.projectId); populateTaskGoals(par.goalId || ''); document.getElementById('m-task').style.display = 'flex'; }
export function openEditTask(id) { const t = S.tasks.find(x => x.id === id); if (!t) return; document.getElementById('m-task-title').textContent = 'Edit Task'; document.getElementById('task-edit-id').value = id; document.getElementById('task-parent-id').value = t.parentId || ''; document.getElementById('task-name').value = t.name; document.getElementById('task-notes').value = t.notes || ''; document.getElementById('task-priority').value = t.priority || 'medium'; document.getElementById('task-due').value = t.due || ''; populateTaskProjs('task-project', t.projectId); populateTaskGoals(t.goalId || ''); document.getElementById('m-task').style.display = 'flex'; }
export function saveTask() { const name = document.getElementById('task-name').value.trim(); if (!name) return; const editId = document.getElementById('task-edit-id').value, pid = document.getElementById('task-parent-id').value, projId = document.getElementById('task-project').value, goalId = document.getElementById('task-goal')?.value || null, data = { name, notes: document.getElementById('task-notes').value, priority: document.getElementById('task-priority').value, due: document.getElementById('task-due').value, projectId: projId, parentId: pid || null, goalId }; if (editId) { const t = S.tasks.find(x => x.id === editId); if (t) Object.assign(t, data); } else S.tasks.push({ id: uid(), done: false, doneAt: null, expanded: false, createdAt: Date.now(), accruedMinutes: 0, ...data }); if (pid) { const pt = S.tasks.find(x => x.id === pid); if (pt) pt.expanded = true; } save(); window.closeModal('m-task'); renderProjTree(); window.renderGoals?.(); window.renderDash?.(); }

export function initProjSwatches() {
  document.getElementById('proj-swatches')?.addEventListener('click', e => { const s = e.target.closest('.swatch'); if (s) setProjColor(s.dataset.c); });
}

window.renderProjTree = renderProjTree;
window.toggleProj = toggleProj;
window.toggleTask = toggleTask;
window.expandTask = expandTask;
window.deleteTask = deleteTask;
window.deleteProject = deleteProject;
window.renderAllFlat = renderAllFlat;
window.renderDueToday = renderDueToday;
window.renderOverdue = renderOverdue;
window.renderBreakdown = renderBreakdown;
window.openAddProject = openAddProject;
window.openEditProject = openEditProject;
window.setProjColor = setProjColor;
window.saveProject = saveProject;
window.openAddTaskTo = openAddTaskTo;
window.openAddSubtask = openAddSubtask;
window.openEditTask = openEditTask;
window.saveTask = saveTask;
window.collapseProjects = collapseProjects;
window.expandProjects = expandProjects;
