// Habit journaling mini-modal — Phase 6
// Shown briefly when a habit is completed (binary done or counter target hit).
// Auto-dismisses in ~6s if user doesn't engage. Logs to S.journal as a
// reflection entry tied to the habit.
import { S, uid, today } from '../../core/state.js';
import { save } from '../../core/persistence.js';

let _autoDismiss = null;
let _currentHabitId = null;

export function promptHabitJournal(habit) {
  if (!habit) return;
  // Respect setting to disable (defaults to on).
  if (S.settings && S.settings.habitJournalPrompt === false) return;
  _currentHabitId = habit.id;
  const m = document.getElementById('m-habit-journal'); if (!m) return;
  document.getElementById('hj-habit-name').textContent = habit.name;
  document.getElementById('hj-text').value = '';
  m.style.display = 'flex';
  if (_autoDismiss) clearTimeout(_autoDismiss);
  _autoDismiss = setTimeout(dismissHabitJournal, 6000);
}

export function saveHabitJournal() {
  const txt = document.getElementById('hj-text')?.value.trim();
  if (txt && _currentHabitId) {
    S.journal = S.journal || [];
    S.journal.push({
      id: uid(),
      habitId: _currentHabitId,
      type: 'reflection',
      datetime: new Date().toISOString().slice(0, 16),
      text: txt,
    });
    save();
    window.renderJournal?.();
    window.toast?.('Reflection saved ✓');
  }
  dismissHabitJournal();
}

export function dismissHabitJournal() {
  if (_autoDismiss) { clearTimeout(_autoDismiss); _autoDismiss = null; }
  const m = document.getElementById('m-habit-journal'); if (m) m.style.display = 'none';
  _currentHabitId = null;
}

if (typeof window !== 'undefined') {
  window.promptHabitJournal = promptHabitJournal;
  window.saveHabitJournal = saveHabitJournal;
  window.dismissHabitJournal = dismissHabitJournal;
}
