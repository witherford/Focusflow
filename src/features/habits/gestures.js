// Gesture state machine for habit cards — Phase 4
// tap = primary action, double-tap = secondary, long-press (500ms) = tertiary.
// Primary binding is per-card (binary toggles, counter increments, etc.)

const LONG_PRESS_MS = 500;
const DOUBLE_TAP_MS = 250;

// Attach gesture handlers to an element. Handlers get ({event}).
// Returns a cleanup function.
// True if the pointer event originated on an interactive child that should
// handle its own click (edit/delete buttons, inputs, etc.) — gestures must
// not steal those interactions.
const isInteractiveTarget = (e) =>
  !!(e.target && e.target.closest && e.target.closest('[data-habit-action], button, a, input, select, textarea'));

export function attachHabitGestures(el, { onTap, onDoubleTap, onLongPress } = {}) {
  let pressTimer = null, lastTap = 0, fired = false, longFired = false, skipGesture = false;

  const start = (e) => {
    fired = false; longFired = false;
    skipGesture = isInteractiveTarget(e);
    if (skipGesture) return; // let the button handle its own click
    if (onLongPress) {
      pressTimer = setTimeout(() => {
        longFired = true; fired = true;
        onLongPress({ event: e });
      }, LONG_PRESS_MS);
    }
  };
  const cancel = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
  const end = (e) => {
    cancel();
    if (skipGesture) { skipGesture = false; return; } // interactive child handles itself
    if (longFired) return;               // long-press consumed the interaction
    const now = Date.now();
    if (lastTap && (now - lastTap) < DOUBLE_TAP_MS && onDoubleTap) {
      lastTap = 0; fired = true;
      onDoubleTap({ event: e });
      return;
    }
    lastTap = now;
    // defer single-tap in case a double follows
    setTimeout(() => {
      if (Date.now() - lastTap >= DOUBLE_TAP_MS - 10 && !fired && onTap) {
        fired = true; onTap({ event: e });
      }
    }, DOUBLE_TAP_MS);
  };

  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);

  return () => {
    cancel();
    el.removeEventListener('pointerdown', start);
    el.removeEventListener('pointerup', end);
    el.removeEventListener('pointerleave', cancel);
    el.removeEventListener('pointercancel', cancel);
  };
}
