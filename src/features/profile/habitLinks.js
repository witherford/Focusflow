// Profile → habits auto-sync (Phase 4)
// When a positive habit is checked in Profile, create a matching habit in
// S.habits[] marked as profile-linked. When unchecked, remove that linked habit
// (but leave user-created habits alone).
import { S, uid } from '../../core/state.js';

// Simple keyword-based block guess so the generated habit lands in a sensible place.
function guessBlock(name) {
  const n = name.toLowerCase();
  if (/morning|wake|breakfast|cold shower|stretch.*morn|walk/.test(n)) return 'morning';
  if (/evening|night|bed|stretch|journal|reflection|wind/.test(n)) return 'evening';
  return 'afternoon';
}

function guessIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('exercise') || n.includes('workout')) return '💪';
  if (n.includes('walk')) return '🚶';
  if (n.includes('read')) return '📖';
  if (n.includes('shower')) return '🚿';
  if (n.includes('journal')) return '📓';
  if (n.includes('water')) return '💧';
  if (n.includes('gratitude')) return '🙏';
  if (n.includes('meal')) return '🍱';
  if (n.includes('meditat')) return '🧘';
  if (n.includes('learn')) return '🧠';
  if (n.includes('stretch')) return '🤸';
  if (n.includes('phone')) return '📵';
  return '●';
}

// Called when a positive habit is toggled in the profile.
export function syncPositiveHabit(name, isSelected) {
  S.habits = S.habits || [];
  const existing = S.habits.find(h => h.profileLink === name);
  if (isSelected && !existing) {
    S.habits.push({
      id: uid(),
      name,
      block: guessBlock(name),
      icon: guessIcon(name),
      mode: 'binary',
      profileLink: name,
    });
  } else if (!isSelected && existing) {
    // Only remove if it's still a profile-linked habit (user hasn't edited beyond recognition).
    S.habits = S.habits.filter(h => h !== existing);
  }
}
