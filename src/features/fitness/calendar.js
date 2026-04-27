// Training schedule grid — last 4 weeks + next 4 weeks, color-coded.
import { S } from '../../core/state.js';
import { dayLabelForDate, ymd } from './routines.js';
import { activeRoutine } from './workout.js';

function startOfWeekMon(d) {
  const x = new Date(d); const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x;
}

export function renderTrainingSchedule() {
  const el = document.getElementById('train-schedule'); if (!el) return;
  const r = activeRoutine();
  if (!r) { el.innerHTML = '<div class="empty-state"><div class="es-icon">🏋️</div><div class="es-sub">Activate a routine to see your schedule</div></div>'; return; }
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const start = startOfWeekMon(new Date(today0.getTime() - 4 * 7 * 864e5));
  const days = [];
  for (let i = 0; i < 8 * 7; i++) {
    const d = new Date(start.getTime() + i * 864e5);
    days.push(d);
  }
  const sessionsByDate = {};
  for (const h of (S.training?.history || [])) (sessionsByDate[h.date] ||= []).push(h);
  const td = ymd(today0);
  const html = `
    <div class="cal-head" style="grid-template-columns:repeat(7,1fr)">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<div>${d}</div>`).join('')}</div>
    <div class="cal-grid" style="grid-template-columns:repeat(7,1fr)">${days.map(d => {
      const dk = ymd(d);
      const planned = dayLabelForDate(r, d);
      const done = sessionsByDate[dk]?.length;
      const isToday = dk === td;
      const inPast = dk < td;
      const isRest = planned === 'rest';
      let cls = 'cal-day';
      if (isToday) cls += ' today';
      if (done) cls += ' tr-done';
      else if (planned !== 'rest' && inPast) cls += ' tr-missed';
      else if (planned !== 'rest') cls += ' tr-planned';
      if (isRest) cls += ' tr-rest';
      const dayNum = d.getDate();
      return `<button class="${cls}" onclick="trainSelectDay('${dk}')">
        <div class="cal-num">${dayNum}</div>
        <div style="font-size:9px;color:var(--text3)">${isRest ? '·' : planned}</div>
        ${done ? '<div style="font-size:9px;color:var(--green)">✓</div>' : ''}
      </button>`;
    }).join('')}</div>
    <div id="train-day-detail" style="margin-top:14px"></div>
  `;
  el.innerHTML = html;
}

export function trainSelectDay(dk) {
  const el = document.getElementById('train-day-detail'); if (!el) return;
  const r = activeRoutine(); if (!r) return;
  const sessions = (S.training?.history || []).filter(h => h.date === dk);
  const date = new Date(dk + 'T00:00:00');
  const planned = dayLabelForDate(r, date);
  if (sessions.length) {
    el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">${dk} · Logged</div></div>
      ${sessions.map(s => `<div style="margin-bottom:8px">
        <div style="font-weight:600;font-size:13px">${s.dayLabel}</div>
        ${s.exercises.map(e => `<div style="font-size:12px;color:var(--text2);margin-left:6px">${e.exercise}: ${(e.sets || []).map(set => `${set.reps}×${set.weight}kg`).join(', ')}</div>`).join('')}
      </div>`).join('')}
    </div>`;
  } else if (planned !== 'rest') {
    const dayPlan = r.days?.[planned] || [];
    el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">${dk} · Planned: ${planned}</div></div>
      ${dayPlan.length ? dayPlan.map(e => `<div style="font-size:13px;padding:4px 0">${e.exercise} <span style="color:var(--text3);font-family:'DM Mono',monospace">${e.sets}×${e.reps}</span></div>`).join('') : '<div class="caption">No exercises configured</div>'}
      <div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="openWorkoutLogger('${planned}')">Start workout</button></div>
    </div>`;
  } else {
    el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">${dk} · Rest day</div></div><div class="caption">No training scheduled</div></div>`;
  }
}

if (typeof window !== 'undefined') {
  window.renderTrainingSchedule = renderTrainingSchedule;
  window.trainSelectDay = trainSelectDay;
}
