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
  const log = (S.sleepLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!log.length) { el.innerHTML = '<div class="empty-state"><div class="es-icon">😴</div><div class="es-sub">No sleep data yet — log a night on the Sleep page.</div></div>'; return; }
  const rangeSel = document.getElementById('ins-sleep-range');
  const range = rangeSel?.value || '7';
  let cutoffDays = parseInt(range);
  let filtered = log;
  if (range !== 'all' && cutoffDays > 0) {
    const cutoff = new Date(Date.now() - cutoffDays * 864e5).toISOString().split('T')[0];
    filtered = log.filter(s => s.date >= cutoff);
  }
  if (!filtered.length) { el.innerHTML = '<div class="caption" style="text-align:center;padding:14px">No sleep entries in this range.</div>'; return; }
  const hours = filtered.map(s => s.hours || 0);
  const total = hours.reduce((a, b) => a + b, 0);
  const avg = total / hours.length;
  const max = Math.max(10, ...hours);
  const min = Math.min(...hours);
  // Bar chart (or thin line for very long ranges)
  const barWidth = filtered.length > 60 ? 1 : Math.max(2, Math.floor(280 / filtered.length));
  const w = filtered.length * (barWidth + 1);
  const h = 110;
  const bars = filtered.map((s, i) => {
    const v = s.hours || 0;
    const bh = Math.max(1, (v / max) * h);
    const colour = v >= 8 ? 'var(--green)' : v >= 6.5 ? 'var(--teal)' : v >= 5 ? 'var(--gold)' : 'var(--rose)';
    return `<rect x="${i * (barWidth + 1)}" y="${h - bh}" width="${barWidth}" height="${bh}" fill="${colour}" rx="1"><title>${s.date}: ${v}h${s.quality ? ' · q' + s.quality : ''}</title></rect>`;
  }).join('');
  // 8h reference line
  const refY = h - (8 / max) * h;
  el.innerHTML = `
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;margin-bottom:8px">
      <span><strong style="color:var(--text)">${avg.toFixed(1)}h</strong> <span style="color:var(--text3)">avg</span></span>
      <span><strong style="color:var(--text)">${total.toFixed(1)}h</strong> <span style="color:var(--text3)">total · ${filtered.length} night${filtered.length === 1 ? '' : 's'}</span></span>
      <span><strong style="color:var(--text)">${min}–${max.toFixed(1)}h</strong> <span style="color:var(--text3)">range</span></span>
    </div>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
      <line x1="0" x2="${w}" y1="${refY}" y2="${refY}" stroke="var(--teal)" stroke-dasharray="3 3" stroke-width="0.6" opacity="0.6"/>
      ${bars}
    </svg>
    <div style="font-size:10px;color:var(--text3);text-align:right;margin-top:4px">teal dashed = 8h target</div>
  `;
}

export function renderInsights() {
  renderLevelCard();
  renderBadges();
  renderInsightsTodayStats();
  renderInsightsHeatStrip();
  renderInsightsPriorities();
  renderInsightsTowardGoals();
  renderInsightsSleepLog();
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
