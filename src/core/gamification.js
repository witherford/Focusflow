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
  badAvoided: 8,          // bad-habit avoided for the day
  badIndulged: -15,       // negative — penalty deducted on indulgence
};

export function award(kind, n = 1) {
  const g = ensure();
  const unit = XP_TABLE[kind] || 0;
  g.xp = Math.max(0, g.xp + unit * n);
  g.lastAward = { kind, at: Date.now(), amount: unit * n };
  const lv = levelFromXp(g.xp);
  const prev = g.level || 1;
  g.level = lv.level;
  save();
  if (lv.level > prev) {
    window.toast?.(`🎉 Level up! Level ${lv.level}`);
  } else if (lv.level < prev) {
    window.toast?.(`Level dropped to ${lv.level}`);
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
  { id: 'level-20', icon: '💫', name: 'Level 20', check: () => progress().level >= 20 },
  { id: 'level-50', icon: '🌠', name: 'Level 50', check: () => progress().level >= 50 },
  { id: 'fifty-tasks', icon: '✅', name: '50 tasks done', check: () => (S.tasks || []).filter(t => t.done).length >= 50 },
  { id: 'ten-weight-logs', icon: '📉', name: '10 weight logs', check: () => (S.profile?.weightLog || []).length >= 10 },
  { id: 'fifty-sessions', icon: '🧨', name: '50 focus sessions', check: () => (S.deepwork?.sessions || []).length >= 50 },
  { id: 'hundred-sessions', icon: '🎇', name: '100 focus sessions', check: () => (S.deepwork?.sessions || []).length >= 100 },
  { id: 'five-fit', icon: '🏋️', name: '5 workouts', check: () => (S.fitness?.sessions || []).length >= 5 },
  { id: 'twenty-fit', icon: '🥇', name: '20 workouts', check: () => (S.fitness?.sessions || []).length >= 20 },
  { id: 'ten-meds', icon: '☯️', name: '10 meditations', check: () => (S.meditation?.sessions || []).length >= 10 },
  { id: 'fifty-meds', icon: '🕉️', name: '50 meditations', check: () => (S.meditation?.sessions || []).length >= 50 },
  { id: 'ten-journals', icon: '📔', name: '10 journal entries', check: () => (S.journal || []).length >= 10 },
  { id: 'fifty-journals', icon: '📖', name: '50 journal entries', check: () => (S.journal || []).length >= 50 },
  { id: 'streak-7', icon: '🔥', name: '7-day habit streak', check: () => {
      if (typeof window.calcStreak !== 'function') return false;
      return (S.habits || []).some(h => window.calcStreak(h.id) >= 7);
    } },
  { id: 'streak-30', icon: '🌋', name: '30-day habit streak', check: () => {
      if (typeof window.calcStreak !== 'function') return false;
      return (S.habits || []).some(h => window.calcStreak(h.id) >= 30);
    } },
  { id: 'streak-100', icon: '🏔️', name: '100-day habit streak', check: () => {
      if (typeof window.calcStreak !== 'function') return false;
      return (S.habits || []).some(h => window.calcStreak(h.id) >= 100);
    } },
  { id: 'first-routine', icon: '📋', name: 'First training routine', check: () => (S.profile?.trainRoutines || []).length >= 1 },
  { id: 'three-goals', icon: '🎯', name: '3 goals set', check: () => (S.goals || []).length >= 3 },
  { id: 'goal-complete', icon: '🏁', name: 'First goal complete', check: () => (S.goals || []).some(g => g.done || g.completed) },
  { id: 'sleep-week', icon: '🌙', name: 'Week of sleep logs', check: () => (S.sleepLog || []).length >= 7 },
  { id: 'sleep-month', icon: '🌜', name: 'Month of sleep logs', check: () => (S.sleepLog || []).length >= 30 },
  { id: 'all-day-habit', icon: '⏳', name: 'First all-day habit', check: () => (S.habits || []).some(h => h.allDay || h.block === 'allday') },
  { id: 'linked-habit', icon: '🔗', name: 'First linked habit', check: () => (S.habits || []).some(h => h.linkedType) },
  { id: 'level-25', icon: '🌌', name: 'Level 25', check: () => progress().level >= 25 },
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

// Categorize each badge into a group and pull a numeric "rank" out of its
// id/name so we can sort low → high inside each group.
function badgeCategory(b) {
  const id = b.id;
  if (id.startsWith('level-')) return { key: 'level', label: '⭐ Levels' };
  if (id.startsWith('streak-')) return { key: 'streak', label: '🔥 Habit streaks' };
  if (/sessions$/.test(id) || id.endsWith('-sessions')) return { key: 'focus', label: '🧠 Focus sessions' };
  if (/(meds|meditation)/.test(id)) return { key: 'meditation', label: '🧘 Meditation' };
  if (/journal/.test(id)) return { key: 'journal', label: '📓 Journal' };
  if (/(fit|workout)/.test(id) && id !== 'first-fitness') return { key: 'fit', label: '🏋️ Training' };
  if (id === 'first-fitness') return { key: 'fit', label: '🏋️ Training' };
  if (/weight/.test(id)) return { key: 'weight', label: '⚖️ Weight' };
  if (/sleep/.test(id)) return { key: 'sleep', label: '😴 Sleep' };
  if (/task/.test(id)) return { key: 'tasks', label: '📋 Tasks' };
  if (/goal/.test(id)) return { key: 'goals', label: '🎯 Goals' };
  if (/habit|all-day|linked|routine/.test(id)) return { key: 'habits', label: '✅ Habits' };
  return { key: 'misc', label: '✨ Other' };
}

const CATEGORY_ORDER = ['level', 'habits', 'streak', 'tasks', 'goals', 'focus', 'meditation', 'fit', 'journal', 'weight', 'sleep', 'misc'];

function badgeRank(b) {
  // Pull the largest number out of id+name for ordering. Falls back to 0.
  const m = (b.id + ' ' + b.name).match(/(\d+)/g);
  if (!m) return 0;
  return Math.max(...m.map(n => parseInt(n)));
}

export function renderBadges() {
  const el = document.getElementById('badges-grid'); if (!el) return;
  const g = ensure();
  // Group badges by category.
  const groups = {};
  for (const b of BADGES) {
    const cat = badgeCategory(b);
    if (!groups[cat.key]) groups[cat.key] = { label: cat.label, items: [] };
    groups[cat.key].items.push(b);
  }
  // Sort items within each group by numeric rank ascending, then name.
  Object.values(groups).forEach(g2 => {
    g2.items.sort((a, b) => {
      const ra = badgeRank(a), rb = badgeRank(b);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  });
  // Order groups per CATEGORY_ORDER.
  const orderedKeys = CATEGORY_ORDER.filter(k => groups[k]);
  // Append any unforeseen keys.
  Object.keys(groups).forEach(k => { if (!orderedKeys.includes(k)) orderedKeys.push(k); });

  const groupsHtml = orderedKeys.map(k => {
    const grp = groups[k];
    const unlockedInGrp = grp.items.filter(b => g.badges[b.id]).length;
    const tiles = grp.items.map(b => {
      const on = !!g.badges[b.id];
      return `<div class="badge-tile ${on ? 'unlocked' : 'locked'}" title="${on ? 'Unlocked' : 'Locked'}"><div class="b-icon">${b.icon}</div><div>${b.name}</div></div>`;
    }).join('');
    return `<div class="badge-cat">
      <div class="badge-cat-head"><span>${grp.label}</span><span class="badge-cat-count">${unlockedInGrp}/${grp.items.length}</span></div>
      <div class="badge-grid">${tiles}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🏅 Badges</div><div style="font-size:11px;color:var(--text3)">${Object.keys(g.badges).length}/${BADGES.length}</div></div>
    ${groupsHtml}
  </div>`;
}

window.awardXP = award;
window.gamificationProgress = progress;
window.renderLevelCard = renderLevelCard;
window.renderBadges = renderBadges;
window.checkBadges = checkBadges;
