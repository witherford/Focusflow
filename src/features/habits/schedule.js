// Habit scheduling helpers — weekday picker + active-day filtering.
import { today } from '../../core/state.js';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// True if the habit is scheduled to run on the given date (a YYYY-MM-DD string).
// Empty / missing activeDays = every day.
export function isHabitActiveOnDate(h, dateStr) {
  // Expiry — medication-linked habits with an expiry date drop off the
  // dashboard and all habit views once `dateStr` is past `h.expiryDate`.
  if (h?.expiryDate && !h?.noExpiry) {
    if (dateStr > h.expiryDate) return false;
  }
  if (!h?.activeDays || !Array.isArray(h.activeDays) || h.activeDays.length === 0) return true;
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  return h.activeDays.includes(WEEKDAY_SHORT[dow]);
}

export function isHabitActiveToday(h) {
  return isHabitActiveOnDate(h, today());
}

// Read the picker into a list of "Mon" / "Tue" ... or null when all 7 are
// ticked (we treat an empty / undefined `activeDays` as "every day").
export function readWeekdayPickerValue() {
  const inputs = document.querySelectorAll('#habit-weekday-picker input[data-day]');
  const picked = Array.from(inputs).filter(i => i.checked).map(i => i.dataset.day);
  if (picked.length === 0 || picked.length === 7) return null;
  return picked;
}

export function setWeekdayPickerValue(arr) {
  const inputs = document.querySelectorAll('#habit-weekday-picker input[data-day]');
  if (!Array.isArray(arr) || arr.length === 0) {
    inputs.forEach(i => { i.checked = true; });
  } else {
    inputs.forEach(i => { i.checked = arr.includes(i.dataset.day); });
  }
}
