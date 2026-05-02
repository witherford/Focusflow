// Dashboard — "Today" home view
import { S, today, haptic, uid } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { progressRing } from '../../ui/progressRing.js';
import { goalProgress, tasksTowardGoals } from '../goals/progress.js';
import { metOn } from '../habits/counterMode.js';
import { effectivePeriodKey } from '../chores/period.js';
import { isHabitActiveToday, weeklyCompletion } from '../habits/page.js';
import { renderWakeCard, renderBedCard } from '../sleepHabit/page.js';
import { openQuickCapture, qcUpdateFields, saveQuickCapture } from './quickCapture.js';
import { renderAllDay } from './allDay.js';
import { renderCheckin } from './checkin.js';
import { isWidgetOn } from './widgetVisibility.js';

function clear(id) { const el = document.getElementById(id); if (el) el.innerHTML = ''; }
function show(id, on) { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; }

const fmtT = t => { if (!t) return '—'; const [h, m] = t.split(':'); const hr = +h; return (hr === 0 ? 12 : hr > 12 ? hr - 12 : hr) + ':' + m + (hr >= 12 ? 'pm' : 'am'); };
const calcDur = (s, e) => { if (!s || !e) return ''; const [sh, sm] = s.split(':').map(Number); const [eh, em] = e.split(':').map(Number); const d = (eh * 60 + em) - (sh * 60 + sm); if (d <= 0) return ''; return d >= 60 ? Math.floor(d / 60) + 'h' + (d % 60 ? ' ' + d % 60 + 'm' : '') : d + 'm'; };

function currentBlock() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function habitDoneToday(h) { return metOn(h, today()); }

const stackOpen = {};
export function toggleStackOpen(id) { stackOpen[id] = !stackOpen[id]; renderDash(); }

export function renderDash() {
  const d = new Date(), hr = d.getHours();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateLbl = document.getElementById('dash-date-label'); if (dateLbl) dateLbl.textContent = days[d.getDay()] + ' · ' + months[d.getMonth()] + ' ' + d.getDate();
  const greetEl = document.getElementById('dash-greeting'); if (greetEl) greetEl.textContent = (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (S.profile.name ? ' ' + S.profile.name : '');
  // V1.1.3 — overall streak chip removed; per-habit streaks now appear next
  // to each habit row (more meaningful than a single rolled-up number).
  const streakChipEl = document.getElementById('dash-streak-chip');
  if (streakChipEl) streakChipEl.style.display = 'none';

  show('stat-grid', isWidgetOn('stats'));
  if (isWidgetOn('stats')) {
    const log = S.habitLog[today()] || {};
    const done = S.habits.filter(h => habitDoneToday(h)).length;
    const pct = S.habits.length ? Math.round(done / S.habits.length * 100) : 0;
    setText('s-habits', pct + '%');
    setText('s-tasks', (S.tasks || []).filter(t => t.done && t.doneAt === today()).length);
    const dwMin = (window.getTodayDwMin?.() || 0);
    setText('s-focus', (dwMin / 60).toFixed(1) + 'h');
    setText('s-streak', calcStreak_global());
    renderLevelTile();
  }

  if (isWidgetOn('schedule'))   renderSchedule();   else clear('dash-schedule');
  renderWakeCard();
  if (isWidgetOn('checkin'))    renderCheckin();    else clear('dash-checkin');
  if (isWidgetOn('timeblocks')) renderTimeblocks(); else clear('dash-timeblocks');
  renderBedCard();
  if (isWidgetOn('allday'))     renderAllDay();     else clear('dash-allday');
  if (isWidgetOn('tasksdue'))   renderTasksDue();   else clear('dash-tasks-due');
  if (isWidgetOn('heatstrip'))  renderHeatStrip();  else clear('dash-heatstrip');
  if (isWidgetOn('goals'))      renderGoalsDash();  else clear('dash-goals');
  if (isWidgetOn('priorities')) renderPriorities(); else clear('dash-priorities');
  // V1.1.3 — legacy bad-habits widget retired in favour of bad habits living
  // inside their time-blocks alongside good habits. Keep the container empty.
  const bhEl = document.getElementById('dash-bad-habits'); if (bhEl) { bhEl.innerHTML = ''; bhEl.style.display = 'none'; }
}

function renderLevelTile() {
  const el = document.getElementById('dash-level-tile'); if (!el) return;
  const p = window.gamificationProgress?.() || null;
  if (!p) {
    // Fallback if helper not exposed: import directly
    try {
      const mod = window.S?.gamification;
      if (!mod) { el.innerHTML = '<div class="stat-num">L1</div><div class="stat-label">Level</div>'; return; }
    } catch {}
  }
  const prog = p || { level: 1, into: 0, need: 100, pct: 0, xp: 0 };
  el.innerHTML = `
    <div class="level-badge">L${prog.level}</div>
    <div class="xp-bar">
      <div class="xp-label"><span>Level ${prog.level}</span><span>${prog.into}/${prog.need} xp</span></div>
      <div class="xp-track"><div class="xp-fill" style="width:${prog.pct}%"></div></div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">${prog.xp} XP total</div>
    </div>`;
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

export function renderUpNext() {
  const el = document.getElementById('dash-up-next'); if (!el) return;
  const log = S.habitLog[today()] || {};
  const todayDay = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
  const block = currentBlock();
  const items = [];
  const bhLog = S.badHabitLog?.[today()] || {};
  S.habits.filter(h => h.block === block && isHabitActiveToday(h)).filter(h => {
    if (h.kind === 'bad') return !bhLog[h.id]; // un-logged bad habits show until tapped
    return !habitDoneToday(h);
  }).slice(0, 3).forEach(h => {
    const streak = window.calcStreak?.(h.id) ?? 0;
    items.push({ kind: h.kind === 'bad' ? 'badhabit' : 'habit', id: h.id, icon: h.icon || (h.kind === 'bad' ? '🚫' : '●'), name: h.name, streak });
  });
  if (block === 'morning') {
    S.chores.filter(c => c.day === todayDay && !(S.choreLog[effectivePeriodKey(c)]?.[c.id])).slice(0, 2).forEach(c => items.push({ kind: 'chore', id: c.id, icon: '🧹', name: c.name }));
  }
  if (!items.length) { el.innerHTML = ''; return; }
  const blockIcon = { morning: '☀️', afternoon: '🌤', evening: '🌙' }[block];
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">${blockIcon} Up next · ${block}</div><div style="font-size:11px;color:var(--text3)">${items.length} to go</div></div>
    ${items.map(it => {
      const sChip = it.streak ? `<span class="dash-row-streak" title="Streak">🔥${it.streak}</span>` : '';
      const badgeClass = it.kind === 'badhabit' ? 'badge-rose' : it.kind === 'chore' ? 'badge-teal' : 'badge-violet';
      const badgeText = it.kind === 'badhabit' ? 'bad habit' : it.kind;
      return `<div class="up-next-row" onclick="dashUpNextClick('${it.kind}','${it.id}')"><div class="tb-check"></div><span style="flex:1">${it.icon} ${it.name}</span>${sChip}<span class="badge ${badgeClass}" style="font-size:10px">${badgeText}</span></div>`;
    }).join('')}
  </div>`;
}

export function dashUpNextClick(kind, id) {
  if (kind === 'habit') return toggleHabitDash(id);
  if (kind === 'badhabit') return openBadHabitLog(id);
  if (kind === 'chore') return toggleChoreDash(id);
}

export function renderQuickStart() {
  const el = document.getElementById('dash-quickstart'); if (!el) return;
  const presets = (S.deepwork?.presets || []);
  if (!presets.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">⏱ Quick start focus</div><div style="font-size:11px;color:var(--text3)">tap to launch · ${presets.length}</div></div>
    <div class="qs-row">${presets.map(p => `<button class="qs-chip" onclick="dashStartPreset('${p.id}')"><div class="qs-icon">${p.icon || '⏱'}</div><div class="qs-mins">${p.mins}m</div><div class="qs-label">${p.label}</div></button>`).join('')}</div>
  </div>`;
}

export function dashStartPreset(id) {
  window.goPage?.('deepwork');
  setTimeout(() => { window.applyPreset?.(id); window.dwToggle?.(); }, 100);
}

export function renderTasksDue() {
  const el = document.getElementById('dash-tasks-due'); if (!el) return;
  const td = today();
  const tasks = (S.tasks || []).filter(t => !t.done && (t.due === td || (t.due && t.due < td))).sort((a, b) => {
    const po = { high: 0, medium: 1, low: 2 };
    return (po[a.priority] ?? 1) - (po[b.priority] ?? 1);
  }).slice(0, 5);
  if (!tasks.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">📋 Tasks for today</div><button class="btn btn-xs btn-ghost" onclick="goProjView('today')">All →</button></div>
    ${tasks.map(t => {
      const overdue = t.due && t.due < td;
      const dot = t.priority === 'high' ? 'var(--rose)' : t.priority === 'medium' ? 'var(--gold)' : 'var(--green)';
      return `<div class="up-next-row" onclick="toggleTaskQuick('${t.id}')"><div class="tb-check" style="border-color:${dot}"></div><span style="flex:1">${t.name}</span>${overdue ? '<span class="badge badge-rose" style="font-size:10px">overdue</span>' : ''}</div>`;
    }).join('')}
  </div>`;
}

export function renderHeatStrip() {
  const el = document.getElementById('dash-heatstrip'); if (!el) return;
  if (!S.habits.length) { el.innerHTML = ''; return; }
  const days = 30;
  let cells = '';
  for (let i = days - 1; i >= 0; i--) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    const total = S.habits.length;
    const done = S.habits.filter(h => metOn(h, k)).length;
    const p = total ? done / total : 0;
    const l = done === 0 ? 0 : p < .25 ? 1 : p < .5 ? 2 : p < 1 ? 3 : 4;
    cells += `<div class="hm-cell" data-l="${l}" title="${k}: ${done}/${total}"></div>`;
  }
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">Last 30 days</div><div style="font-size:11px;color:var(--text3)">habit density</div></div><div class="heat-strip">${cells}</div></div>`;
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
  let html = `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:4px">`;
  routines.forEach(r => { const dur = calcDur(r.start, r.end); html += `<div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--teal-bg);border:1px solid var(--teal);border-radius:20px;font-size:12px;font-weight:500;color:var(--teal)">${r.icon || '🏋️'} ${r.name}${dur ? ' · ' + dur : ''}</div>`; });
  if (!routines.length) html += `<div style="font-size:12px;color:var(--text3)">No training today</div>`;
  el.innerHTML = html + '</div>';
}

// Streak count for a bad habit = consecutive days from today backwards
// where the user has NOT logged an "indulged" entry. Capped at 365.
function badHabitStreak(habitName) {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    const indulged = (S.journal || []).some(j => j.habitId === habitName && j.type === 'indulged' && j.datetime?.startsWith(k));
    if (indulged) break;
    streak++;
  }
  return streak;
}

export function renderBadHabits() {
  const el = document.getElementById('dash-bad-habits'); if (!el) return;
  const neg = [...(S.profile.negHabits || []), ...(S.profile.negCustom || '').split('\n').filter(x => x.trim())];
  if (!neg.length) { el.style.display = 'none'; return; }
  el.style.display = ''; const td = today();
  let html = `<div class="card"><div class="card-header"><div class="card-title">🔴 Bad Habit Tracker</div></div><div style="display:flex;flex-wrap:wrap;gap:8px">`;
  neg.forEach(h => {
    const entries = (S.journal || []).filter(j => j.habitId === h && j.datetime?.startsWith(td));
    const last = entries.length ? entries[entries.length - 1].type : '';
    const bc = last === 'avoided' ? 'var(--green)' : last === 'indulged' ? 'var(--rose)' : 'var(--border2)';
    const icon = last === 'avoided' ? '✅ ' : last === 'indulged' ? '❌ ' : '⬜ ';
    const streak = badHabitStreak(h);
    const streakChip = streak > 0 ? ` <span style="font-size:10px;color:var(--gold);font-family:'DM Mono',monospace">🔥${streak}d</span>` : '';
    html += `<button class="btn btn-sm" onclick="openBH('${h.replace(/'/g, "\\'")}')" style="border-color:${bc};font-size:12px">${icon}${h}${streakChip}</button>`;
  });
  el.innerHTML = html + '</div></div>';
}

export function renderTimeblocks() {
  const blocks = [{ id: 'morning', label: 'Morning', icon: '☀️', time: S.profile.wake || '06:00' }, { id: 'afternoon', label: 'Afternoon', icon: '🌤', time: '12:00' }, { id: 'evening', label: 'Evening', icon: '🌙', time: '18:00' }];
  const log = S.habitLog[today()] || {};
  const todayDay = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
  const el = document.getElementById('dash-timeblocks'); if (!el) return;
  const bhLog = S.badHabitLog?.[today()] || {};
  el.innerHTML = blocks.map(b => {
    const bH = S.habits.filter(h => h.block === b.id && isHabitActiveToday(h));
    const bC = b.id === 'morning' ? S.chores.filter(c => c.day === todayDay) : [];
    const bT = b.id === 'morning' ? S.tasks.filter(t => !t.done && !t.parentId && t.due === today()) : [];
    const items = [
      ...bH.map(h => {
        const wk = weeklyCompletion(h.id);
        const wkPct = wk.target ? Math.min(100, Math.round(wk.done / wk.target * 100)) : 0;
        const wkColor = wkPct >= 100 ? 'var(--green)' : wkPct >= 50 ? 'var(--teal)' : 'var(--violet)';
        const wkChip = `<span class="dash-row-week" title="${wk.done}/${wk.target} this week" style="font-size:10px;color:${wkColor};font-family:'DM Mono',monospace;font-weight:600">${wk.done}/${wk.target}</span>`;
        if (h.kind === 'bad') {
          const v = bhLog[h.id];
          const checkClass = v === 'avoided' ? 'done' : v === 'indulged' ? 'indulged' : '';
          const checkChar = v === 'avoided' ? '✓' : v === 'indulged' ? '✕' : '·';
          return `<div class="timeblock-item" onclick="openBadHabitLog('${h.id}')"><div class="tb-check ${checkClass}">${checkChar}</div><span style="flex:1">${h.icon || '🚫'} ${h.name}</span>${wkChip}<span class="badge badge-rose" style="font-size:10px">bad</span></div>`;
        }
        if (h.isStack) {
          const open = !!stackOpen[h.id];
          const chev = open ? '▾' : '▸';
          const done = habitDoneToday(h);
          const parentRow = `<div class="timeblock-item" onclick="toggleStackOpen('${h.id}')"><div class="tb-check ${done ? 'done' : ''}" style="cursor:pointer">${chev}</div><span style="flex:1">${h.icon || '🔗'} ${h.name}</span>${wkChip}<span class="badge badge-violet" style="font-size:10px">stack</span></div>`;
          if (!open) return parentRow;
          const kids = (h.children || []).map(c => {
            const cdone = habitDoneToday(c);
            const cIcon = c.icon || (c.kind === 'bad' ? '🚫' : '●');
            return `<div class="timeblock-item" style="margin-left:18px;border-left:2px solid var(--border)" onclick="toggleHabitDash('${c.id}')"><div class="tb-check ${cdone ? 'done' : ''}">✓</div><span style="flex:1;font-size:13px">${cIcon} ${c.name}</span></div>`;
          }).join('');
          return parentRow + kids;
        }
        return `<div class="timeblock-item" onclick="toggleHabitDash('${h.id}')"><div class="tb-check ${habitDoneToday(h) ? 'done' : ''}">✓</div><span style="flex:1">${h.icon || '●'} ${h.name}</span>${wkChip}<span class="badge badge-violet" style="font-size:10px">habit</span></div>`;
      }),
      ...bC.map(c => `<div class="timeblock-item" onclick="toggleChoreDash('${c.id}')"><div class="tb-check ${S.choreLog[effectivePeriodKey(c)]?.[c.id] ? 'done' : ''}">✓</div><span style="flex:1">🧹 ${c.name}</span><span class="badge badge-teal" style="font-size:10px">chore</span></div>`),
      ...bT.map(t => `<div class="timeblock-item" onclick="toggleTaskQuick('${t.id}')"><div class="tb-check">✓</div><span style="flex:1">📋 ${t.name}</span><span class="badge badge-${t.priority === 'high' ? 'rose' : t.priority === 'medium' ? 'gold' : 'green'}" style="font-size:10px">${t.priority}</span></div>`)
    ].join('');
    return `<div class="timeblock"><div class="timeblock-header"><span style="font-size:18px">${b.icon}</span><span style="font-weight:600;font-size:14px;margin-left:4px">${b.label}</span><span class="timeblock-time">${b.time}</span></div><div class="timeblock-body">${items || '<div style="color:var(--text3);font-size:13px;padding:4px">Nothing scheduled</div>'}</div></div>`;
  }).join('');
}

function findHabitOrChild(id) {
  let h = S.habits.find(x => x.id === id);
  if (h) return h;
  for (const p of S.habits) {
    if (p.isStack && Array.isArray(p.children)) {
      const c = p.children.find(x => x.id === id);
      if (c) return c;
    }
  }
  return null;
}

export function toggleHabitDash(id) {
  const h = findHabitOrChild(id);
  if (h?.kind === 'bad') return openBadHabitLog(id);
  // Linked habits jump to their tool with the saved config — same behaviour as
  // tapping them on the Habits page.
  if (h?.linkedType) { window.openLinkedHabit?.(h); return; }
  if (!S.habitLog[today()]) S.habitLog[today()] = {};
  S.habitLog[today()][id] = !S.habitLog[today()][id];
  haptic('medium'); save(); renderDash();
}

// Bad-habit dashboard log — pop a tiny chooser for "avoided" vs "indulged".
export function openBadHabitLog(id) {
  const h = S.habits.find(x => x.id === id); if (!h) return;
  document.getElementById('m-bhl-title').textContent = h.icon ? `${h.icon} ${h.name}` : h.name;
  document.getElementById('m-bhl-id').value = id;
  const td = today();
  const cur = S.badHabitLog?.[td]?.[id];
  document.getElementById('m-bhl-current').textContent = cur ? `Today's log: ${cur === 'avoided' ? '✅ avoided' : '❌ indulged'} (tap to overwrite)` : 'No entry yet for today.';
  const streak = window.calcStreak?.(id) ?? 0;
  document.getElementById('m-bhl-streak').textContent = streak > 0 ? `🔥 ${streak}-day avoided streak` : 'No avoided streak yet';
  document.getElementById('m-bhl').style.display = 'flex';
}

export function logBadHabit(verdict) {
  const id = document.getElementById('m-bhl-id').value;
  const h = S.habits.find(x => x.id === id); if (!h) return;
  if (!S.badHabitLog) S.badHabitLog = {};
  if (!S.badHabitLog[today()]) S.badHabitLog[today()] = {};
  const prev = S.badHabitLog[today()][id];
  S.badHabitLog[today()][id] = verdict;
  if (prev !== verdict) {
    if (verdict === 'avoided') {
      window.awardXP?.('badAvoided');
      window.toast?.(`✅ Avoided ${h.name} (+${window.XP_TABLE?.badAvoided || 0} XP)`);
    } else if (verdict === 'indulged') {
      window.awardXP?.('badIndulged');
      window.toast?.(`❌ Indulged ${h.name} (${window.XP_TABLE?.badIndulged || 0} XP)`);
    }
  }
  haptic(verdict === 'indulged' ? 'heavy' : 'medium');
  save(); window.closeModal?.('m-bhl'); renderDash();
  window.renderHabitsToday?.(); window.renderHabitsAll?.();
}
export function toggleChoreDash(id) {
  const c = S.chores.find(x => x.id === id); if (!c) return;
  const key = effectivePeriodKey(c);
  if (!S.choreLog[key]) S.choreLog[key] = {};
  S.choreLog[key][id] = !S.choreLog[key][id];
  if (S.choreLog[key][id]) c.lastDoneAt = today();
  haptic('light'); save(); renderDash();
}
export function toggleTaskQuick(id) { const t = S.tasks.find(x => x.id === id); if (!t) return; const wasDone = t.done; t.done = !t.done; t.doneAt = t.done ? today() : null; haptic('medium'); save(); if (!wasDone && t.done) window.awardXP?.(t.priority === 'high' ? 'taskHighPri' : 'task'); renderDash(); }

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
  const editId = document.getElementById('bh-edit-id').value, entry = { id: editId || uid(), habitId, type, datetime, text };
  if (editId) { const idx = S.journal.findIndex(j => j.id === editId); if (idx > -1) S.journal[idx] = entry; } else S.journal.push(entry);
  save(); window.closeModal('m-bh'); renderDash(); window.renderJournal?.(); window.toast?.('Entry saved ✓');
}

export function calcStreak_global() {
  if (!S.habits.length) return 0;
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    if (S.habits.some(h => metOn(h, k))) s++; else break;
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
window.renderUpNext = renderUpNext;
window.renderQuickStart = renderQuickStart;
window.renderTasksDue = renderTasksDue;
window.renderHeatStrip = renderHeatStrip;
window.dashUpNextClick = dashUpNextClick;
window.dashStartPreset = dashStartPreset;
window.toggleHabitDash = toggleHabitDash;
window.toggleChoreDash = toggleChoreDash;
window.toggleStackOpen = toggleStackOpen;
window.toggleTaskQuick = toggleTaskQuick;
window.openBH = openBH;
window.openBadHabitLog = openBadHabitLog;
window.logBadHabit = logBadHabit;
window.setBhType = setBhType;
window.saveBH = saveBH;
window.calcStreak_global = calcStreak_global;
window.openQuickCapture = openQuickCapture;
window.qcUpdateFields = qcUpdateFields;
window.saveQuickCapture = saveQuickCapture;
