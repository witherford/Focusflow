// Insights — weekly/monthly review + charts.
// Also surfaces the "today" stats / heatstrip / goals / priorities that used
// to live on the dashboard.
import { S, today } from '../../core/state.js';
import { habitCompletionByWeek, dwMinutesByDay, fitnessWeightVolumeByWeek, weekSummary, productivityByHour } from './trends.js';
import './reviewWizard.js';
import { goalProgress, tasksTowardGoals } from '../goals/progress.js';
import { renderLevelCard, renderBadges } from '../../core/gamification.js';
import { metOn } from '../habits/counterMode.js';
import { progressRing } from '../../ui/progressRing.js';

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function barChart(data, labelFn, valueFn, unit = '') {
  const max = Math.max(1, ...data.map(valueFn));
  return `<div class="chart-bars">${data.map(d => {
    const v = valueFn(d), h = Math.round(v / max * 100);
    return `<div class="chart-bar-col"><div class="chart-bar" style="height:${h}%" title="${labelFn(d)}: ${v}${unit}"></div><div>${labelFn(d)}</div></div>`;
  }).join('')}</div>`;
}

function sparkLine(data, valueFn) {
  const max = Math.max(1, ...data.map(valueFn));
  const w = 300, h = 60;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (valueFn(d) / max) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return `<svg class="chart-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polygon points="${area}" fill="rgba(62,207,176,0.15)"/>
    <polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

function calcGlobalStreak() {
  if (!S.habits?.length) return 0;
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    if (S.habits.some(h => metOn(h, k))) s++; else break;
  }
  return s;
}

function renderInsightsTodayStats() {
  const log = S.habitLog[today()] || {};
  const done = (S.habits || []).filter(h => metOn(h, today())).length;
  const pct = (S.habits || []).length ? Math.round(done / S.habits.length * 100) : 0;
  setText('ins-today-habits', pct + '%');
  setText('ins-today-tasks', (S.tasks || []).filter(t => t.done && t.doneAt === today()).length);
  const dwMin = window.getTodayDwMin?.() || 0;
  setText('ins-today-focus', (dwMin / 60).toFixed(1) + 'h');
  setText('ins-today-streak', calcGlobalStreak());
}

function renderInsightsHeatStrip() {
  const el = document.getElementById('ins-heatstrip'); if (!el) return;
  if (!S.habits?.length) { el.innerHTML = ''; return; }
  const days = 30; let cells = '';
  for (let i = days - 1; i >= 0; i--) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    const total = S.habits.length;
    const doneN = S.habits.filter(h => metOn(h, k)).length;
    const p = total ? doneN / total : 0;
    const l = doneN === 0 ? 0 : p < .25 ? 1 : p < .5 ? 2 : p < 1 ? 3 : 4;
    cells += `<div class="hm-cell" data-l="${l}" title="${k}: ${doneN}/${total}"></div>`;
  }
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">Last 30 days</div><div style="font-size:11px;color:var(--text3)">habit density</div></div><div class="heat-strip">${cells}</div></div>`;
}

function renderInsightsPriorities() {
  const el = document.getElementById('ins-priorities'); if (!el) return;
  const overdue = (S.tasks || []).filter(t => !t.done && t.due && t.due < today());
  const high = (S.tasks || []).filter(t => !t.done && t.priority === 'high');
  if (!overdue.length && !high.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🚨 Priorities</div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${overdue.length ? `<span class="badge badge-rose">${overdue.length} overdue</span>` : ''}${high.length ? `<span class="badge badge-gold">${high.length} high-priority</span>` : ''}</div></div>`;
}

function renderInsightsTowardGoals() {
  const el = document.getElementById('ins-toward-goals'); if (!el) return;
  if (!S.goals?.length) { el.innerHTML = ''; return; }
  const tg = tasksTowardGoals();
  const top = [...S.goals].map(g => ({ g, p: goalProgress(g) })).sort((a, b) => b.p.pct - a.p.pct).slice(0, 3);
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🎯 Toward goals</div><div style="font-size:11px;color:var(--text3)">${tg.done}/${tg.total} task${tg.total === 1 ? '' : 's'} linked</div></div><div style="display:flex;gap:12px;overflow-x:auto;padding:4px 0">${top.map(({ g, p }) => `<div style="display:flex;flex-direction:column;align-items:center;min-width:88px;cursor:pointer" onclick="goPage('goals')">${progressRing({ pct: p.pct, size: 56, stroke: 5, color: 'var(--teal)' })}<div style="font-size:11px;color:var(--text2);margin-top:4px;text-align:center;max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.name}</div></div>`).join('')}</div></div>`;
}

export function renderInsightsSleepLog() {
  const el = document.getElementById('ins-sleep-log'); if (!el) return;
  const log = (S.sleepLog || []).slice();
  const target = parseFloat(S.profile?.sleepTarget) || 8;

  // Anchor to Monday of this week (matching weekKey() in core/state.js).
  const now = new Date();
  const dy = now.getDay();
  const monOffset = dy === 0 ? -6 : 1 - dy;
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() + monOffset);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    days.push({ key: d.toISOString().split('T')[0], dow: d.toLocaleDateString('en-GB', { weekday: 'short' }), dStr: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) });
  }

  const byDate = {};
  log.forEach(s => { byDate[s.date] = s; });

  // Bar scale — keep stable so visual comparisons across nights stay honest.
  const allHrs = log.map(s => s.hours || 0);
  const scaleMax = Math.max(target + 1, ...allHrs, 9) + 0.5;
  const targetLeft = (target / scaleMax) * 100;

  const rowsHtml = days.map(({ key, dow, dStr }) => {
    const s = byDate[key];
    if (!s) {
      return `<div class="sleep-row" style="opacity:.55">
        <div class="sleep-date"><div class="sleep-dow">${dow}</div><div class="sleep-dstr">${dStr}</div></div>
        <div class="sleep-hours" style="color:var(--text3)">—</div>
        <div class="sleep-bar-wrap" title="No entry">
          <div class="sleep-bar-track">
            <div class="sleep-bar-target" style="left:${targetLeft}%"></div>
          </div>
        </div>
        <div class="sleep-delta" style="color:var(--text3)">—</div>
        <div></div>
      </div>`;
    }
    const v = s.hours || 0;
    const pct = Math.max(2, (v / scaleMax) * 100);
    const colour = v >= target ? 'var(--green)' : v >= target - 1 ? 'var(--teal)' : v >= target - 2.5 ? 'var(--gold)' : 'var(--rose)';
    const delta = v - target;
    const deltaLbl = (delta >= 0 ? '+' : '') + delta.toFixed(1) + 'h';
    const deltaCol = delta >= 0 ? 'var(--green)' : 'var(--rose)';
    const q = s.quality ? `<span class="sleep-q" title="Quality">${'★'.repeat(s.quality)}<span style="opacity:.3">${'★'.repeat(5 - s.quality)}</span></span>` : '';
    return `<div class="sleep-row">
      <div class="sleep-date"><div class="sleep-dow">${dow}</div><div class="sleep-dstr">${dStr}</div></div>
      <div class="sleep-hours">${v.toFixed(1)}h</div>
      <div class="sleep-bar-wrap" title="${v}h logged · target ${target}h">
        <div class="sleep-bar-track">
          <div class="sleep-bar-fill" style="width:${pct}%;background:${colour}"></div>
          <div class="sleep-bar-target" style="left:${targetLeft}%" title="Target ${target}h"></div>
        </div>
      </div>
      <div class="sleep-delta" style="color:${deltaCol}">${deltaLbl}</div>
      ${q ? `<div class="sleep-q-cell">${q}</div>` : '<div></div>'}
    </div>`;
  }).join('');

  // Averages — this week, this month, all time.
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const weekKeys = new Set(days.map(d => d.key));
  const weekHrs = log.filter(s => weekKeys.has(s.date)).map(s => s.hours || 0);
  const monthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
  const monthHrs = log.filter(s => s.date.startsWith(monthPrefix)).map(s => s.hours || 0);
  const allTimeHrs = allHrs;

  const stat = (label, hrs) => {
    if (!hrs.length) return `<div style="flex:1;min-width:90px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">${label}</div><div style="font-size:18px;font-weight:700;color:var(--text3)">—</div><div style="font-size:11px;color:var(--text3)">no entries</div></div>`;
    const a = avg(hrs);
    const col = a >= target ? 'var(--green)' : a >= target - 1 ? 'var(--teal)' : a >= target - 2.5 ? 'var(--gold)' : 'var(--rose)';
    return `<div style="flex:1;min-width:90px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">${label}</div><div style="font-size:18px;font-weight:700;color:${col}">${a.toFixed(1)}h</div><div style="font-size:11px;color:var(--text3)">${hrs.length} night${hrs.length === 1 ? '' : 's'}</div></div>`;
  };

  const header = log.length
    ? `<div style="display:flex;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">${stat('This week', weekHrs)}${stat('This month', monthHrs)}${stat('All time', allTimeHrs)}<div style="flex:1;min-width:90px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Target</div><div style="font-size:18px;font-weight:700;color:var(--text)">${target}h</div><div style="font-size:11px;color:var(--text3)">per night</div></div></div>`
    : '<div class="caption" style="text-align:center;padding:8px 0 14px">No sleep entries yet — log a night on the Sleep page.</div>';

  el.innerHTML = `
    ${header}
    <div style="font-size:11px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">This week (Mon → Sun)</div>
    <div class="sleep-grid">${rowsHtml}</div>
  `;
}

// Wake/Bed adherence — streaks + last 28 days strip + actual time entries.
export function renderInsightsSleepHabit() {
  const el = document.getElementById('ins-sleep-habit'); if (!el) return;
  const log = S.sleepHabitLog || {};
  const fmtT = t => { if (!t) return '—'; const [h, m] = t.split(':'); const hr = +h; return (hr === 0 ? 12 : hr > 12 ? hr - 12 : hr) + ':' + m + (hr >= 12 ? 'pm' : 'am'); };

  const calcStreak = kind => {
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
      const e = log[k]?.[kind]; if (!e) continue;
      if (e.onTime) s++; else break;
    }
    return s;
  };

  const stripFor = kind => {
    const days = 28; let cells = '';
    let lateRows = [];
    for (let i = days - 1; i >= 0; i--) {
      const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
      const e = log[k]?.[kind];
      let bg = 'var(--bg3)', tip = k + ': not logged', sym = '';
      if (e) {
        if (e.onTime) { bg = 'var(--green)'; tip = `${k}: on time`; sym = '✓'; }
        else { bg = 'var(--rose)'; tip = `${k}: late by ${e.lateMins}m (${fmtT(e.actualTime)})`; sym = '✕'; lateRows.push({ k, e }); }
      }
      cells += `<div title="${tip}" style="width:14px;height:14px;border-radius:3px;background:${bg};display:inline-flex;align-items:center;justify-content:center;font-size:9px;color:white">${sym}</div>`;
    }
    return { cells, lateRows };
  };

  const wakeS = calcStreak('wake'), bedS = calcStreak('bed');
  const wake = stripFor('wake'), bed = stripFor('bed');

  const block = (kind, icon, label, streak, strip) => {
    const lateList = strip.lateRows.length
      ? `<div style="font-size:11px;color:var(--text3);margin-top:8px">Recent misses (actual time):</div>
         <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${strip.lateRows.slice(-6).map(r => {
            const noteTip = r.e.note ? ' — ' + r.e.note.replace(/"/g, '&quot;') : '';
            return `<span class="badge badge-rose" title="${r.k}${noteTip}" style="font-size:11px">${r.k.slice(5)} · ${fmtT(r.e.actualTime)}</span>`;
         }).join('')}</div>`
      : '';
    return `<div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-weight:600;font-size:14px">${icon} ${label}</span>
        <span style="font-size:11px;color:var(--text3)">target ${fmtT(S.profile?.[kind] || (kind === 'wake' ? '06:30' : '22:30'))}</span>
        <span style="margin-left:auto;font-family:'DM Mono',monospace;font-size:13px;color:var(--gold)">🔥 ${streak}d</span>
      </div>
      <div style="display:flex;gap:3px;flex-wrap:wrap">${strip.cells}</div>
      ${lateList}
    </div>`;
  };

  el.innerHTML = block('wake', '☀️', 'Wake', wakeS, wake) + block('bed', '🌙', 'Bed', bedS, bed);
}

// V1.1.3 — bad-habit stats card on Insights.
export function renderInsightsBadHabits() {
  const el = document.getElementById('ins-bad-habits'); if (!el) return;
  const card = document.getElementById('ins-bad-habits-card');
  const bads = (S.habits || []).filter(h => h.kind === 'bad');
  if (!bads.length) {
    if (card) card.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  if (card) card.style.display = '';
  const log = S.badHabitLog || {};
  // Build a 30-day window
  const days = [];
  for (let i = 29; i >= 0; i--) {
    days.push(new Date(Date.now() - i * 864e5).toISOString().split('T')[0]);
  }
  const rows = bads.map(h => {
    let avoided = 0, indulged = 0;
    days.forEach(d => {
      const v = log[d]?.[h.id]; if (v === 'avoided') avoided++; else if (v === 'indulged') indulged++;
    });
    const logged = avoided + indulged;
    const cleanRate = logged ? Math.round(avoided / logged * 100) : 0;
    const streak = window.calcBadStreak ? window.calcBadStreak(h) : 0;
    // Strip of 30 mini cells
    const strip = days.map(d => {
      const v = log[d]?.[h.id];
      const c = v === 'avoided' ? 'var(--green)' : v === 'indulged' ? 'var(--rose)' : 'var(--bg3)';
      return `<span class="bh-cell" style="background:${c}" title="${d}: ${v || '—'}"></span>`;
    }).join('');
    const rateColour = cleanRate >= 80 ? 'var(--green)' : cleanRate >= 50 ? 'var(--teal)' : 'var(--rose)';
    return `<div class="bh-stat-row">
      <div class="bh-stat-head"><span class="bh-stat-name">${h.icon || '🚫'} ${h.name}</span>${streak > 0 ? `<span class="bh-stat-streak">🔥 ${streak}d</span>` : ''}</div>
      <div class="bh-stat-strip" title="Last 30 days">${strip}</div>
      <div class="bh-stat-meta">
        <span><strong style="color:var(--green)">${avoided}</strong> avoided</span>
        <span><strong style="color:var(--rose)">${indulged}</strong> indulged</span>
        <span style="color:${rateColour}"><strong>${cleanRate}%</strong> clean</span>
        <span style="color:var(--text3)">${logged}/30 days logged</span>
      </div>
    </div>`;
  }).join('');
  el.innerHTML = rows + '<div style="font-size:10px;color:var(--text3);margin-top:8px">Last 30 days · green = avoided · red = indulged · grey = unlogged</div>';
}

export function renderInsights() {
  renderLevelCard();
  renderBadges();
  renderInsightsTodayStats();
  renderInsightsHeatStrip();
  renderInsightsPriorities();
  renderInsightsTowardGoals();
  renderInsightsSleepHabit();
  renderInsightsSleepLog();
  renderInsightsBadHabits();
  const sum = weekSummary();
  setText('ins-hab-week', sum.habits.pct + '%');
  setText('ins-focus-week', (sum.dwMin / 60).toFixed(1) + 'h');
  setText('ins-med-week', sum.medMin);
  setText('ins-tasks-week', sum.tasks);

  const habEl = document.getElementById('ins-hab-chart');
  if (habEl) {
    const data = habitCompletionByWeek(8);
    habEl.innerHTML = S.habits.length ? barChart(data, d => 'w-' + d.weekOffset, d => d.pct, '%') : '<div class="empty-state"><div class="es-icon">📊</div><div class="es-sub">Add a habit to see trends</div></div>';
  }

  const dwEl = document.getElementById('ins-dw-chart');
  if (dwEl) {
    const data = dwMinutesByDay(30);
    dwEl.innerHTML = (S.deepwork?.sessions?.length) ? sparkLine(data, d => d.min) : '<div class="empty-state"><div class="es-icon">🧠</div><div class="es-sub">No deep-work sessions yet</div></div>';
  }

  const gEl = document.getElementById('ins-goals');
  if (gEl) {
    gEl.innerHTML = (S.goals || []).length
      ? S.goals.map(g => {
          const p = goalProgress(g);
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1"><div style="font-size:13px;font-weight:500">${g.name}</div><div style="font-size:11px;color:var(--text3)">${p.done}/${p.total} · ${p.minutes}min linked</div></div>
            <div style="width:120px;"><div class="progress-track"><div class="fill" style="background:var(--teal);width:${p.pct}%"></div></div></div>
            <div style="font-size:12px;font-weight:600;color:var(--teal);min-width:38px;text-align:right">${p.pct}%</div>
          </div>`;
        }).join('')
      : '<div class="empty-state"><div class="es-icon">🎯</div><div class="es-sub">No goals yet</div></div>';
  }

  const todEl = document.getElementById('ins-tod-chart');
  if (todEl) {
    const bins = productivityByHour(30);
    const max = Math.max(1, ...bins);
    const peak = bins.indexOf(max);
    const html = `<div class="chart-bars" style="height:90px">${bins.map((v, h) => {
      const pct = (v / max * 100).toFixed(0);
      return `<div class="chart-bar-col"><div class="chart-bar" style="height:${pct}%" title="${h}:00 - ${v}min"></div><div style="font-size:9px">${h % 6 === 0 ? h : ''}</div></div>`;
    }).join('')}</div>${max > 0 ? `<div style="font-size:11px;color:var(--text3);text-align:center;margin-top:6px">Most productive: <strong style="color:var(--teal)">${peak}:00 - ${peak + 1}:00</strong></div>` : '<div class="caption" style="text-align:center">Log focus sessions to see your peak hours</div>'}`;
    todEl.innerHTML = html;
  }
  const fEl = document.getElementById('ins-fit-chart');
  if (fEl) {
    const data = fitnessWeightVolumeByWeek(8);
    const any = data.some(d => d.volume > 0);
    fEl.innerHTML = any ? barChart(data, d => 'w-' + d.weekOffset, d => d.volume, '') : '<div class="empty-state"><div class="es-icon">💪</div><div class="es-sub">Log a weightlifting session to see volume</div></div>';
  }
}

export async function runWeeklyReview() {
  // Prefer the top-of-page review card (V1.1.2). Fall back to the bottom one
  // if the user is on an older HTML cache.
  const card = document.getElementById('ins-review-card-top') || document.getElementById('ins-review-card');
  const body = document.getElementById('ins-review-top') || document.getElementById('ins-review');
  if (!card || !body) return;
  card.style.display = '';
  // Scroll into view so the user sees the result without hunting.
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  body.innerHTML = '<span style="color:var(--text3)">Thinking…</span>';
  const sum = weekSummary();
  const lines = [];
  lines.push(`<strong>Habits:</strong> ${sum.habits.done}/${sum.habits.total} completions (${sum.habits.pct}%).`);
  if (sum.top) lines.push(`<strong>Most consistent:</strong> ${sum.top.name} — ${sum.top.hit}/7 days.`);
  if (sum.worst) lines.push(`<strong>Most missed:</strong> ${sum.worst.name} — only ${sum.worst.hit}/7 days.`);
  lines.push(`<strong>Focus:</strong> ${(sum.dwMin/60).toFixed(1)} hours this week.`);
  lines.push(`<strong>Meditation:</strong> ${sum.medMin} minutes.`);
  lines.push(`<strong>Tasks completed:</strong> ${sum.tasks}.`);
  lines.push(`<strong>Journal:</strong> ${sum.journalWords} words.`);

  // Try AI suggestion if enabled
  let aiSugg = '';
  try {
    if (S.settings?.aiEnabled && window.aiComplete) {
      const prompt = `In 1-2 short sentences, suggest a focus for next week based on: habits ${sum.habits.pct}%, top "${sum.top?.name || 'n/a'}", most-missed "${sum.worst?.name || 'n/a'}", focus ${(sum.dwMin/60).toFixed(1)}h, meditation ${sum.medMin}m.`;
      aiSugg = await window.aiComplete(prompt, { max: 120 });
    }
  } catch (e) { /* ignore */ }

  body.innerHTML = lines.map(l => `<div>• ${l}</div>`).join('') + (aiSugg ? `<div style="margin-top:10px;padding:10px;border-left:3px solid var(--violet);background:var(--violet-bg);border-radius:4px"><strong>Focus next week:</strong> ${aiSugg}</div>` : '');
}

window.renderInsights = renderInsights;
window.runWeeklyReview = runWeeklyReview;
window.renderInsightsBadHabits = renderInsightsBadHabits;
window.renderInsightsSleepHabit = renderInsightsSleepHabit;
window.renderInsightsSleepLog = renderInsightsSleepLog;
