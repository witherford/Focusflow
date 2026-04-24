// Starter templates — drop-in presets for common habits / projects / goals.
import { S, uid } from './state.js';
import { save } from './persistence.js';

export const HABIT_TEMPLATES = [
  { icon: '📖', name: 'Read 20 min', block: 'evening' },
  { icon: '💧', name: 'Drink water', block: 'morning', mode: 'counter', target: 8, unit: 'glasses' },
  { icon: '🚶', name: '10k steps', block: 'afternoon', mode: 'counter', target: 10000, unit: 'steps', incrementStep: 1000 },
  { icon: '🧘', name: '10 min meditate', block: 'morning' },
  { icon: '🛏️', name: 'No phone 1h before bed', block: 'evening' },
  { icon: '🌞', name: 'Morning sunlight', block: 'morning' },
  { icon: '🥗', name: 'Home-cooked meal', block: 'evening' },
  { icon: '✍️', name: 'Journal 3 lines', block: 'evening' },
];

export const PROJECT_TEMPLATES = [
  { name: 'Ship side project', color: '#7c6ef7', tasks: ['Define scope', 'Set up repo', 'Build MVP', 'Deploy', 'Share'] },
  { name: 'Declutter home', color: '#3ecfb0', tasks: ['Closet', 'Kitchen', 'Desk', 'Garage'] },
  { name: 'Read 12 books', color: '#e8b84b', tasks: ['Pick this quarter’s list', 'Reserve reading slot', 'Start book 1'] },
];

export const GOAL_TEMPLATES = [
  { name: 'Run a 10k', cat: 'health', milestones: ['Run 2k non-stop', 'Run 5k', 'Run 7k', 'Race day'] },
  { name: 'Learn a language — B1', cat: 'learning', milestones: ['500 words', 'Complete A1', 'Complete A2', 'B1 exam'] },
  { name: 'Save £5,000', cat: 'finance', milestones: ['Track spending 1 month', 'Cancel 3 subs', 'Automate 10% savings', 'Hit £5k'] },
];

export function applyHabitTemplate(t) {
  S.habits.push({ id: uid(), mode: 'binary', ...t });
  save();
  window.renderHabitsToday?.(); window.renderHabitsAll?.(); window.renderDash?.();
  window.toast?.('Habit added ✓');
}

export function applyProjectTemplate(t) {
  const pid = uid();
  S.projects.push({ id: pid, name: t.name, description: '', color: t.color, cat: 'personal', due: '' });
  for (const name of (t.tasks || [])) {
    S.tasks.push({ id: uid(), name, priority: 'medium', due: '', projectId: pid, parentId: null, done: false, doneAt: null, notes: '' });
  }
  save();
  window.renderAll?.();
  window.toast?.('Project added ✓');
}

export function applyGoalTemplate(t) {
  S.goals.push({ id: uid(), name: t.name, cat: t.cat, date: '', minuteTarget: 0, milestones: (t.milestones || []).map(m => ({ id: uid(), text: m, done: false })) });
  save();
  window.renderGoals?.(); window.renderDash?.();
  window.toast?.('Goal added ✓');
}

// Simple empty-state helper — used across feature pages.
export function emptyState({ icon, title, sub, ctaLabel, ctaCall }) {
  return `<div class="empty-state"><div class="es-icon">${icon}</div><div class="es-title">${title}</div>${sub ? `<div class="es-sub">${sub}</div>` : ''}${ctaLabel ? `<button class="btn btn-primary btn-sm" onclick="${ctaCall}">${ctaLabel}</button>` : ''}</div>`;
}

window.applyHabitTemplate = applyHabitTemplate;
window.applyProjectTemplate = applyProjectTemplate;
window.applyGoalTemplate = applyGoalTemplate;
