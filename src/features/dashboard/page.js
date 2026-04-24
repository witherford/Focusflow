// Dashboard — extracted from focusflow_v10.html lines 1536-1618
import { S, today, weekKey, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { progressRing } from '../../ui/progressRing.js';
import { goalProgress, tasksTowardGoals } from '../goals/progress.js';

const fmtT = t => { if (!t) return '—'; const [h, m] = t.split(':'); const hr = +h; return (hr === 0 ? 12 : hr > 12 ? hr - 12 : hr) + ':' + m + (hr >= 12 ? 'pm' : 'am'); };
const calcDur = (s, e) => { if (!s || !e) return ''; const [sh, sm] = s.split(':').map(Number); const [eh, em] = e.split(':').map(Number); const d = (eh * 60 + em) - (sh * 60 + sm); if (d <= 0) return ''; return d >= 60 ? Math.floor(d / 60) + 'h' + (d % 60 ? ' ' + d % 60 + 'm' : '') : d + 'm'; };

export function renderDash() {
  const d = new Date(), hr = d.getHours();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('dash-date-label').textContent = days[d.getDay()] + ' · ' + months[d.getMonth()] + ' ' + d.getDate();
  document.getElementById('dash-greeting').textContent = (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (S.profile.name ? ' ' + S.profile.name : '');
  const log = S.habitLog[today()] || {};
  const done = S.habits.filter(h => log[h.id]).length;
  document.getElementById('s-habits').textContent = (S.habits.length ? Math.round(done / S.habits.length * 100) : 0) + '%';
  document.getElementById('s-tasks').textContent = S.tasks.filter(t => t.done && t.doneAt === today()).length;
  document.getElementById('s-focus').textContent = (window.getTodayDwMin() / 60).toFixed(1) + 'h';
  document.getElementById('s-streak').textContent = calcStreak_global();
  renderSchedule(); renderGoalsDash(); renderPriorities(); renderBadHabits(); renderTimeblocks();
}

export function renderGoalsDash() {
  const el = document.getElementById('dash-goals'); if (!el) return;
  if (!S.goals?.length) { el.innerHTML = ''; return; }
  const tg = tasksTowardGoals();
  const top = [...S.goals].map(g => ({ g, p: goalProgress(g) })).sort((a, b) => b.p.pct - a.p.pct).slice(0, 3);
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🎯 Toward goals</div><div style="font-size:11px;color:var(--text3)">${tg.done}/${tg.total} task${tg.total === 1 ? '' : 's'} linked</div></div><div style="display:flex;gap:12px;overflow-x:auto;padding:4px 0">${top.map(({ g, p }) => `<div style="display:flex;flex-direction:column;align-items:center;min-width:88px;cursor:pointer" onclick="goPage('goals')">${progressRing({ pct: p.pct, size: 56, stroke: 5, color: 'var(--teal)' })}<div style="font-size:11px;color:var(--text2);margin-top:4px;text-align:center;max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.name}</div></div>`).join('')}</div></div>`;
}

export function renderPriorities() {
  const el = document.getElementById('dash-priorities'); if (!el) return;
  const overdue = (S.tasks || []).filter(t => !t.done && t.due && t.due < today());
  const highPri = (S.tasks || []).filter(t => !t.done && t.priority === 'high');
  if (!overdue.length && !highPri.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🚨 Priorities</div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${overdue.length ? `<span class="badge badge-rose">${overdue.length} overdue</span>` : ''}${highPri.length ? `<span class="badge badge-gold">${highPri.length} high-priority</span>` : ''}</div></div>`;
}

export function renderSchedule() {
  const el = document.getElementById('dash-schedule'); if (!el) return;
  const p = S.profile, todayShort = new Date().toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3);
  const routines = (p.trainRoutines || []).filter(r => (r.days || []).includes(todayShort));
  let html = `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:4px">
    <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface);border:1px solid var(--border);border-radius:20px;font-size:12px;font-weight:500">☀️ <span style="color:var(--text3)">Wake</span> ${fmtT(p.wake)}</div>
    <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface);border:1px solid var(--border);border-radius:20px;font-size:12px;font-weight:500">🌙 <span style="color:var(--text3)">Bed</span> ${fmtT(p.bed)}</div>`;
  routines.forEach(r => { const dur = calcDur(r.start, r.end); html += `<div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--teal-bg);border:1px solid var(--teal);border-radius:20px;font-size:12px;font-weight:500;color:var(--teal)">${r.icon || '🏋️'} ${r.name}${dur ? ' · ' + dur : ''}</div>`; });
  if (!routines.length) html += `<div style="font-size:12px;color:var(--text3)">No training today</div>`;
  el.innerHTML = html + '</div>';
}

export function renderBadHabits() {
  const el = document.getElementById('dash-bad-habits'); if (!el) return;
  const neg = [...(S.profile.negHabits || []), ...(S.profile.negCustom || '').split('\n').filter(x => x.trim())];
  if (!neg.length) { el.style.display = 'none'; return; }
  el.style.display = ''; const td = today();
  let html = `<div class="card"><div class="card-header"><div class="card-title">🔴 Bad Habit Tracker</div></div><div style="display:flex;flex-wrap:wrap;gap:8px">`;
  neg.forEach(h => {
    const entries = S.journal.filter(j => j.habitId === h && j.datetime?.startsWith(td));
    const last = entries.length ? entries[entries.length - 1].type : '';
    const bc = last === 'avoided' ? 'var(--green)' : last === 'indulged' ? 'var(--rose)' : 'var(--border2)';
    const icon = last === 'avoided' ? '✅ ' : last === 'indulged' ? '❌ ' : '⬜ ';
    html += `<button class="btn btn-sm" onclick="openBH('${h.replace(/'/g, "\\'")}')" style="border-color:${bc};font-size:12px">${icon}${h}</button>`;
  });
  el.innerHTML = html + '</div></div>';
}

export function renderTimeblocks() {
  const blocks = [{ id: 'morning', label: 'Morning', icon: '☀️', time: S.profile.wake || '06:00' }, { id: 'afternoon', label: 'Afternoon', icon: '🌤', time: '12:00' }, { id: 'evening', label: 'Evening', icon: '🌙', time: '18:00' }];
  const log = S.habitLog[today()] || {}, cl = S.choreLog[weekKey()] || {};
  const todayDay = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
  document.getElementById('dash-timeblocks').innerHTML = blocks.map(b => {
    const bH = S.habits.filter(h => h.block === b.id);
    const bC = b.id === 'morning' ? S.chores.filter(c => c.day === todayDay) : [];
    const bT = b.id === 'morning' ? S.tasks.filter(t => !t.done && !t.parentId && t.due === today()) : [];
    const items = [
      ...bH.map(h => `<div class="timeblock-item" onclick="toggleHabitDash('${h.id}')"><div class="tb-check ${log[h.id] ? 'done' : ''}">✓</div><span style="flex:1">${h.icon || '●'} ${h.name}</span><span class="badge badge-violet" style="font-size:10px">habit</span></div>`),
      ...bC.map(c => `<div class="timeblock-item" onclick="toggleChoreDash('${c.id}')"><div class="tb-check ${cl[c.id] ? 'done' : ''}">✓</div><span style="flex:1">🧹 ${c.name}</span><span class="badge badge-teal" style="font-size:10px">chore</span></div>`),
      ...bT.map(t => `<div class="timeblock-item" onclick="toggleTaskQuick('${t.id}')"><div class="tb-check">✓</div><span style="flex:1">📋 ${t.name}</span><span class="badge badge-${t.priority === 'high' ? 'rose' : t.priority === 'medium' ? 'gold' : 'green'}" style="font-size:10px">${t.priority}</span></div>`)
    ].join('');
    return `<div class="timeblock"><div class="timeblock-header"><span style="font-size:18px">${b.icon}</span><span style="font-weight:600;font-size:14px;margin-left:4px">${b.label}</span><span class="timeblock-time">${b.time}</span></div><div class="timeblock-body">${items || '<div style="color:var(--text3);font-size:13px;padding:4px">Nothing scheduled</div>'}</div></div>`;
  }).join('');
}

export function toggleHabitDash(id) { if (!S.habitLog[today()]) S.habitLog[today()] = {}; S.habitLog[today()][id] = !S.habitLog[today()][id]; haptic('medium'); save(); renderDash(); }
export function toggleChoreDash(id) { if (!S.choreLog[weekKey()]) S.choreLog[weekKey()] = {}; S.choreLog[weekKey()][id] = !S.choreLog[weekKey()][id]; haptic('light'); save(); renderDash(); }
export function toggleTaskQuick(id) { const t = S.tasks.find(x => x.id === id); if (!t) return; t.done = !t.done; t.doneAt = t.done ? today() : null; haptic('medium'); save(); renderDash(); }

// Bad Habit modal
export function openBH(name) {
  document.getElementById('m-bh-title').textContent = 'Log: ' + name;
  document.getElementById('bh-habit-id').value = name; document.getElementById('bh-edit-id').value = '';
  document.getElementById('bh-dt').value = new Date().toISOString().slice(0, 16);
  document.getElementById('bh-text').value = ''; setBhType('avoided');
  document.getElementById('m-bh').style.display = 'flex';
}
export function setBhType(t) {
  document.getElementById('bh-type').value = t;
  document.getElementById('bh-avoided-btn').className = 'type-btn avoided' + (t === 'avoided' ? ' active' : '');
  document.getElementById('bh-indulged-btn').className = 'type-btn indulged' + (t === 'indulged' ? ' active' : '');
}
export function saveBH() {
  const habitId = document.getElementById('bh-habit-id').value, type = document.getElementById('bh-type').value, datetime = document.getElementById('bh-dt').value, text = document.getElementById('bh-text').value.trim(); if (!datetime) return;
  const editId = document.getElementById('bh-edit-id').value, entry = { id: editId || window.uid(), habitId, type, datetime, text };
  if (editId) { const idx = S.journal.findIndex(j => j.id === editId); if (idx > -1) S.journal[idx] = entry; } else S.journal.push(entry);
  save(); window.closeModal('m-bh'); renderDash(); window.renderJournal(); window.toast('Entry saved ✓');
}

export function calcStreak_global() {
  if (!S.habits.length) return 0;
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    if (S.habits.some(h => S.habitLog[k]?.[h.id])) s++; else break;
  }
  return s;
}

// Expose
window.renderDash = renderDash;
window.renderSchedule = renderSchedule;
window.renderBadHabits = renderBadHabits;
window.renderTimeblocks = renderTimeblocks;
window.renderGoalsDash = renderGoalsDash;
window.renderPriorities = renderPriorities;
window.toggleHabitDash = toggleHabitDash;
window.toggleChoreDash = toggleChoreDash;
window.toggleTaskQuick = toggleTaskQuick;
window.openBH = openBH;
window.setBhType = setBhType;
window.saveBH = saveBH;
window.calcStreak_global = calcStreak_global;
