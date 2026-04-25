// Calendar view — monthly grid of tasks by due date.
import { S, today } from '../../core/state.js';

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();

function fmt(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function renderCalendar() {
  const el = document.getElementById('calendar-view'); if (!el) return;
  const first = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // start week on Monday
  const td = today();
  const byDate = {};
  (S.tasks || []).forEach(t => { if (t.due) (byDate[t.due] ||= []).push(t); });

  const monthName = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const days = [];
  const prevLast = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = leading; i > 0; i--) days.push({ y: viewYear, m: viewMonth - 1, d: prevLast - i + 1, other: true });
  for (let d = 1; d <= lastDay; d++) days.push({ y: viewYear, m: viewMonth, d, other: false });
  while (days.length % 7 !== 0 || days.length < 42) {
    const last = days[days.length - 1];
    const nd = new Date(last.y, last.m, last.d + 1);
    days.push({ y: nd.getFullYear(), m: nd.getMonth(), d: nd.getDate(), other: nd.getMonth() !== viewMonth });
    if (days.length >= 42) break;
  }

  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px">
    <button class="btn btn-sm" onclick="calNav(-1)">‹</button>
    <div style="flex:1;text-align:center;font-weight:600">${monthName}</div>
    <button class="btn btn-sm" onclick="calGoToday()">Today</button>
    <button class="btn btn-sm" onclick="calNav(1)">›</button>
  </div>
  <div class="cal-head">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<div>${d}</div>`).join('')}</div>
  <div class="cal-grid">${days.map(cell => {
    const dk = fmt(cell.y, cell.m, cell.d);
    const tasks = byDate[dk] || [];
    const isToday = dk === td;
    const dots = tasks.slice(0, 5).map(t => `<div class="cal-dot p-${t.priority || 'medium'}${t.done ? ' done' : ''}" title="${t.name}"></div>`).join('');
    return `<div class="cal-day${cell.other ? ' other-month' : ''}${isToday ? ' today' : ''}" onclick="calSelectDay('${dk}')">
      <div class="cal-num">${cell.d}</div>
      <div class="cal-dots">${dots}${tasks.length > 5 ? `<div style="font-size:9px;color:var(--text3)">+${tasks.length - 5}</div>` : ''}</div>
    </div>`;
  }).join('')}</div>
  <div id="cal-day-detail" style="margin-top:14px"></div>`;
}

export function calNav(delta) {
  viewMonth += delta;
  while (viewMonth < 0) { viewMonth += 12; viewYear--; }
  while (viewMonth > 11) { viewMonth -= 12; viewYear++; }
  renderCalendar();
}

export function calGoToday() {
  const d = new Date(); viewYear = d.getFullYear(); viewMonth = d.getMonth();
  renderCalendar();
}

export function calSelectDay(dk) {
  const el = document.getElementById('cal-day-detail'); if (!el) return;
  const tasks = (S.tasks || []).filter(t => t.due === dk);
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">${dk}</div><div style="font-size:11px;color:var(--text3)">${tasks.length} task${tasks.length === 1 ? '' : 's'}</div></div>
    ${tasks.length ? tasks.map(t => {
      const proj = t.projectId ? S.projects.find(p => p.id === t.projectId) : null;
      return `<div class="up-next-row" onclick="toggleTaskQuick('${t.id}')"><div class="tb-check ${t.done ? 'done' : ''}">✓</div><span style="flex:1">${t.name}${proj ? ` <span style="font-size:11px;color:var(--text3)">· ${proj.name}</span>` : ''}</span><span class="badge badge-${t.priority === 'high' ? 'rose' : t.priority === 'medium' ? 'gold' : 'green'}" style="font-size:10px">${t.priority || 'med'}</span></div>`;
    }).join('') : '<div class="caption">Nothing due on this day</div>'}
  </div>`;
}

window.renderCalendar = renderCalendar;
window.calNav = calNav;
window.calGoToday = calGoToday;
window.calSelectDay = calSelectDay;
