// Insights — weekly/monthly review + charts
import { S } from '../../core/state.js';
import { habitCompletionByWeek, dwMinutesByDay, fitnessWeightVolumeByWeek, weekSummary } from './trends.js';
import { goalProgress } from '../goals/progress.js';

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

export function renderInsights() {
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

  const fEl = document.getElementById('ins-fit-chart');
  if (fEl) {
    const data = fitnessWeightVolumeByWeek(8);
    const any = data.some(d => d.volume > 0);
    fEl.innerHTML = any ? barChart(data, d => 'w-' + d.weekOffset, d => d.volume, '') : '<div class="empty-state"><div class="es-icon">💪</div><div class="es-sub">Log a weightlifting session to see volume</div></div>';
  }
}

export async function runWeeklyReview() {
  const card = document.getElementById('ins-review-card');
  const body = document.getElementById('ins-review');
  if (!card || !body) return;
  card.style.display = '';
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
