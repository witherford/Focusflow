// Dashboard widget for "all-day" habits — big progress rings, tap/hold/double-tap.
import { S, today, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { isCounter, countFor, isCumulative, increment, complete, reset } from '../habits/counterMode.js';
import { attachHabitGestures } from '../habits/gestures.js';
import { isHabitActiveToday } from '../habits/page.js';

export function getAllDayHabits() {
  return (S.habits || []).filter(h => (h.allDay || h.block === 'allday') && isHabitActiveToday(h));
}

export function renderAllDay() {
  const el = document.getElementById('dash-allday'); if (!el) return;
  const habits = getAllDayHabits();
  if (!habits.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">⏳ All-day habits</div><div style="font-size:11px;color:var(--text3)">tap adds · hold resets · double-tap completes</div></div>
    <div class="allday-grid">${habits.map(h => renderTile(h)).join('')}</div>
  </div>`;
  wireTiles(el);
}

function renderTile(h) {
  const counter = isCounter(h);
  const count = counter ? countFor(h) : 0;
  const target = h.target || 1;
  const pct = counter && target > 0 ? Math.min(100, Math.round(count / target * 100)) : (count ? 100 : 0);
  const unit = h.unit || '';
  const label = isCumulative(h) ? `${count}${unit ? ' ' + unit : ''}` : `${count}${unit ? ' ' + unit : ''} / ${target}${unit ? ' ' + unit : ''}`;
  const circ = 188.5;
  const off = circ * (1 - pct / 100);
  const streak = (typeof window.calcStreak === 'function') ? window.calcStreak(h.id) : 0;
  const xpAward = (window.XP_TABLE && window.XP_TABLE.habit) || 10;
  return `<div class="allday-tile${pct >= 100 ? ' done' : ''}" data-habit-id="${h.id}">
    <svg class="allday-ring" width="88" height="88" viewBox="0 0 88 88">
      <circle class="ring-track" cx="44" cy="44" r="30" />
      <circle class="ring-fill" cx="44" cy="44" r="30" style="stroke-dasharray:${circ};stroke-dashoffset:${off}" />
      <text x="44" y="49" text-anchor="middle" class="allday-icon">${h.icon || '●'}</text>
    </svg>
    <div class="allday-name">${h.name}</div>
    <div class="allday-meta">${label}</div>
    <div class="allday-foot">${streak > 0 ? `🔥 ${streak}d` : ''}<span class="xp-chip" style="margin-left:4px">+${xpAward} XP</span></div>
  </div>`;
}

function wireTiles(container) {
  container.querySelectorAll('.allday-tile').forEach(tile => {
    const id = tile.dataset.habitId;
    const h = S.habits.find(x => x.id === id); if (!h) return;
    attachHabitGestures(tile, {
      onTap: () => {
        if (isCounter(h)) increment(h);
        else { if (!S.habitLog[today()]) S.habitLog[today()] = {}; S.habitLog[today()][h.id] = true; }
        haptic('light'); save(); renderAllDay(); window.renderDash?.();
      },
      onDoubleTap: () => {
        complete(h); haptic('medium'); save(); renderAllDay(); window.renderDash?.();
        window.toast?.(`${h.name} complete ✓`);
      },
      onLongPress: () => {
        reset(h); haptic('heavy'); save(); renderAllDay(); window.renderDash?.();
        window.toast?.(`${h.name} reset`);
      },
    });
  });
}

window.renderAllDay = renderAllDay;
