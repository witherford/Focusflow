// Gamification — XP, levels, badges. Event-driven: callers emit `award(kind, amount)`.
import { S } from './state.js';
import { save } from './persistence.js';

function ensure() {
  if (!S.gamification) S.gamification = { xp: 0, level: 1, badges: {}, lastAward: null };
  const g = S.gamification;
  if (g.badges == null) g.badges = {};
  return g;
}

// XP required to go from level L to L+1: L * 100 (so level 2 needs 100, level 5 needs 400 cumulative = 100+200+300+400).
function xpForLevel(L) { return L * 100; }
function levelFromXp(xp) {
  let L = 1, need = xpForLevel(1);
  while (xp >= need) { xp -= need; L++; need = xpForLevel(L); }
  return { level: L, into: xp, need };
}

export const XP_TABLE = {
  habit: 10,
  habitAllDone: 30,       // bonus for finishing all habits in a day
  chore: 8,
  task: 15,
  taskHighPri: 25,
  dwSession: 20,
  medSession: 10,
  fitSession: 20,
  journal: 5,
  streakMilestone: 50,   // when hitting a tier
  weightLog: 5,
  checkin: 3,
};

export function award(kind, n = 1) {
  const g = ensure();
  const unit = XP_TABLE[kind] || 0;
  g.xp += unit * n;
  g.lastAward = { kind, at: Date.now(), amount: unit * n };
  const lv = levelFromXp(g.xp);
  const prev = g.level || 1;
  g.level = lv.level;
  save();
  if (lv.level > prev) {
    window.toast?.(`🎉 Level up! Level ${lv.level}`);
  }
  checkBadges();
  return g;
}

export function progress() {
  const g = ensure();
  const lv = levelFromXp(g.xp);
  return { xp: g.xp, level: lv.level, into: lv.into, need: lv.need, pct: Math.round(lv.into / lv.need * 100) };
}

export const BADGES = [
  { id: 'first-habit', icon: '🌱', name: 'First habit', check: () => (S.habits || []).length >= 1 },
  { id: 'five-habits', icon: '🌿', name: 'Five habits', check: () => (S.habits || []).length >= 5 },
  { id: 'ten-tasks-done', icon: '📋', name: '10 tasks', check: () => (S.tasks || []).filter(t => t.done).length >= 10 },
  { id: 'hundred-tasks-done', icon: '🏆', name: '100 tasks', check: () => (S.tasks || []).filter(t => t.done).length >= 100 },
  { id: 'first-goal', icon: '🎯', name: 'First goal', check: () => (S.goals || []).length >= 1 },
  { id: 'first-session', icon: '🧠', name: 'First focus session', check: () => (S.deepwork?.sessions || []).length >= 1 },
  { id: 'ten-sessions', icon: '🔥', name: '10 focus sessions', check: () => (S.deepwork?.sessions || []).length >= 10 },
  { id: 'first-meditation', icon: '🧘', name: 'First meditation', check: () => (S.meditation?.sessions || []).length >= 1 },
  { id: 'first-fitness', icon: '💪', name: 'First workout', check: () => (S.fitness?.sessions || []).length >= 1 },
  { id: 'first-journal', icon: '📓', name: 'First journal', check: () => (S.journal || []).length >= 1 },
  { id: 'first-weight', icon: '⚖️', name: 'First weight log', check: () => (S.profile?.weightLog || []).length >= 1 },
  { id: 'week-check-in', icon: '📝', name: 'Week of check-ins', check: () => Object.values(S.checkins || {}).filter(c => c && (c.mood || c.sleepHrs)).length >= 7 },
  { id: 'level-5', icon: '⭐', name: 'Level 5', check: () => progress().level >= 5 },
  { id: 'level-10', icon: '🌟', name: 'Level 10', check: () => progress().level >= 10 },
];

export function checkBadges() {
  const g = ensure();
  let unlocked = 0;
  for (const b of BADGES) {
    if (!g.badges[b.id] && b.check()) {
      g.badges[b.id] = { at: Date.now() };
      unlocked++;
      window.toast?.(`🏅 Badge unlocked: ${b.name}`);
    }
  }
  if (unlocked) save();
  return unlocked;
}

export function renderLevelCard() {
  const el = document.getElementById('level-card'); if (!el) return;
  const p = progress();
  el.innerHTML = `<div class="card" style="margin-bottom:14px">
    <div class="level-card">
      <div class="level-badge">L${p.level}</div>
      <div class="xp-bar">
        <div class="xp-label"><span>Level ${p.level}</span><span>${p.into}/${p.need} xp</span></div>
        <div class="xp-track"><div class="xp-fill" style="width:${p.pct}%"></div></div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">Total XP: ${p.xp}</div>
      </div>
    </div>
  </div>`;
}

export function renderBadges() {
  const el = document.getElementById('badges-grid'); if (!el) return;
  const g = ensure();
  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🏅 Badges</div><div style="font-size:11px;color:var(--text3)">${Object.keys(g.badges).length}/${BADGES.length}</div></div>
    <div class="badge-grid">${BADGES.map(b => {
      const on = !!g.badges[b.id];
      return `<div class="badge-tile ${on ? 'unlocked' : 'locked'}" title="${on ? 'Unlocked' : 'Locked'}"><div class="b-icon">${b.icon}</div><div>${b.name}</div></div>`;
    }).join('')}</div>
  </div>`;
}

window.awardXP = award;
window.renderLevelCard = renderLevelCard;
window.renderBadges = renderBadges;
window.checkBadges = checkBadges;
