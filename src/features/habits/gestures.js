// Gesture state machine for habit cards.
// tap = primary action (toggle / increment)
// double-tap = secondary (complete)
// triple-tap = tertiary (complete + open journal)
// long-press (500ms) = quaternary (reset)
// Cancels if the pointer moves > MOVE_TOLERANCE px (so scrolling never fires a tap).

const LONG_PRESS_MS = 500;
const MULTI_TAP_MS = 280;        // window between taps to count as double/triple
const MOVE_TOLERANCE = 10;       // px the finger can drift before we treat as scroll

const isInteractiveTarget = (e) =>
  !!(e.target && e.target.closest && e.target.closest('[data-habit-action], button, a, input, select, textarea'));

export function attachHabitGestures(el, { onTap, onDoubleTap, onTripleTap, onLongPress } = {}) {
  let pressTimer = null, multiTimer = null;
  let tapCount = 0, longFired = false, skipGesture = false;
  let startX = 0, startY = 0, moved = false;

  const start = (e) => {
    longFired = false;
    moved = false;
    skipGesture = isInteractiveTarget(e);
    if (skipGesture) {
      // Tapping a button must not be interpreted as completing the habit. Cancel
      // any pending multi-tap from a previous interaction so its setTimeout
      // doesn't fire after the user moves to the edit / delete button.
      clearTimeout(multiTimer); multiTimer = null;
      tapCount = 0;
      return;
    }
    startX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    startY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    if (onLongPress) {
      pressTimer = setTimeout(() => {
        longFired = true;
        clearTimeout(multiTimer); tapCount = 0;
        onLongPress({ event: e });
      }, LONG_PRESS_MS);
    }
  };

  const move = (e) => {
    if (skipGesture) return;
    const x = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const y = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    const dx = Math.abs(x - startX), dy = Math.abs(y - startY);
    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) {
      moved = true;
      // user is scrolling/dragging — abort any pending tap or long-press
      cancel();
    }
  };

  const cancel = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  };

  const end = (e) => {
    cancel();
    if (skipGesture) { skipGesture = false; return; }
    if (longFired) return;
    if (moved) { tapCount = 0; return; }   // pointer moved → was a scroll, not a tap
    tapCount++;
    clearTimeout(multiTimer);
    multiTimer = setTimeout(() => {
      const n = tapCount;
      tapCount = 0;
      if (n >= 3 && onTripleTap) onTripleTap({ event: e });
      else if (n === 2 && onDoubleTap) onDoubleTap({ event: e });
      else if (n === 1 && onTap) onTap({ event: e });
    }, MULTI_TAP_MS);
  };

  el.addEventListener('pointerdown', start);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointerleave', () => { cancel(); /* don't reset tapCount on leave during multi-tap window */ });
  el.addEventListener('pointercancel', () => { cancel(); tapCount = 0; });

  return () => {
    cancel();
    clearTimeout(multiTimer);
    el.removeEventListener('pointerdown', start);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', end);
  };
}
