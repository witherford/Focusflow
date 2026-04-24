// Tiered streak thresholds + computation — Phase 4
// Tier auto-promotes as consecutive streak days reach each threshold.
export const DEFAULT_TIERS = [3, 5, 8, 13, 21];

export const TIER_STYLES = [
  { emoji: '·',  label: 'No streak',  color: 'var(--text3)',    bg: 'transparent' },
  { emoji: '🌱', label: 'Sprout',     color: 'var(--green)',    bg: 'var(--green-bg)' },
  { emoji: '🔥', label: 'Ignited',    color: 'var(--orange)',   bg: 'var(--orange-bg)' },
  { emoji: '⚡', label: 'Charged',    color: 'var(--teal)',     bg: 'var(--teal-bg)' },
  { emoji: '💎', label: 'Crystalline',color: 'var(--violet)',   bg: 'var(--violet-bg)' },
  { emoji: '👑', label: 'Sovereign',  color: 'var(--gold)',     bg: 'var(--gold-bg)' },
];

// Returns tier index (0..5) for a given streak length using the habit's thresholds.
export function tierFor(streak, thresholds = DEFAULT_TIERS) {
  if (!streak || streak < 1) return 0;
  let t = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (streak >= thresholds[i]) t = i + 1;
  }
  return t;
}

// Pretty badge for a streak.
export function streakBadge(streak, thresholds = DEFAULT_TIERS) {
  const t = tierFor(streak, thresholds);
  const s = TIER_STYLES[t];
  return `<span class="streak-tier tier-${t}" title="${s.label}" style="color:${s.color};background:${s.bg}">${s.emoji} ${streak}</span>`;
}
