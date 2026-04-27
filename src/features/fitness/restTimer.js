// Rest timer — auto-starts when a set is marked done. Compounds get longer
// defaults than accessories. The user can dismiss with one tap.
import { playChime } from '../../core/audio.js';
import { haptic } from '../../core/state.js';

const COMPOUNDS = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'OHP', 'Barbell Row', 'Romanian DL', 'Romanian Deadlift'];
const COMPOUND_REST = 180;   // 3 min
const ACCESSORY_REST = 90;   // 90 s

let _state = { running: false, secsLeft: 0, totalSec: 0, exercise: '', tickId: null };

export function defaultRestSeconds(exercise) {
  if (!exercise) return ACCESSORY_REST;
  for (const c of COMPOUNDS) if (exercise.toLowerCase().includes(c.toLowerCase())) return COMPOUND_REST;
  return ACCESSORY_REST;
}

function getMountTarget() {
  // Prefer the inline slot inside the workout modal if it exists; otherwise
  // fall back to a floating bottom card.
  return document.getElementById('wo-rest') || document.getElementById('rest-timer-floating-mount');
}

function ensureFloatingMount() {
  if (document.getElementById('rest-timer-floating-mount')) return;
  const wrap = document.createElement('div');
  wrap.id = 'rest-timer-floating-mount';
  wrap.className = 'rest-timer-floating';
  document.body.appendChild(wrap);
}

function html() {
  return `<div class="rest-timer">
    <div class="rt-inner">
      <div class="rt-label" id="rt-label">Rest</div>
      <div class="rt-time" id="rt-time">00:00</div>
      <div class="rt-bar"><div class="rt-bar-fill" id="rt-bar-fill"></div></div>
      <div class="rt-controls">
        <button class="btn btn-sm" onclick="restAdjust(-15)">-15s</button>
        <button class="btn btn-sm" onclick="restAdjust(15)">+15s</button>
        <button class="btn btn-sm btn-primary" onclick="restDismiss()">Skip</button>
      </div>
    </div>
  </div>`;
}

function ensureNode() {
  let target = document.getElementById('wo-rest');
  if (!target) { ensureFloatingMount(); target = document.getElementById('rest-timer-floating-mount'); }
  if (!target.querySelector('.rest-timer')) target.innerHTML = html();
}

function render() {
  ensureNode();
  // Inline slot lives inside the workout modal — show/hide via parent's existence.
  const inline = document.getElementById('wo-rest');
  const floating = document.getElementById('rest-timer-floating-mount');
  if (!_state.running) {
    if (inline) inline.innerHTML = '';
    if (floating) floating.style.display = 'none';
    return;
  }
  if (inline && inline.children.length === 0) inline.innerHTML = html();
  if (!inline && floating) floating.style.display = '';
  const m = Math.floor(Math.max(0, _state.secsLeft) / 60);
  const s = Math.max(0, _state.secsLeft) % 60;
  const t = document.getElementById('rt-time');
  if (t) t.textContent = `${m}:${String(s).padStart(2, '0')}`;
  const lbl = document.getElementById('rt-label');
  if (lbl) lbl.textContent = `Rest · ${_state.exercise || 'set'}`;
  const pct = _state.totalSec ? Math.max(0, _state.secsLeft / _state.totalSec) * 100 : 0;
  const fill = document.getElementById('rt-bar-fill');
  if (fill) fill.style.width = pct + '%';
}

export function startRest(exercise, secs) {
  ensureNode();
  const total = secs || defaultRestSeconds(exercise);
  _state = { running: true, secsLeft: total, totalSec: total, exercise: exercise || '', tickId: null };
  render();
  clearInterval(_state.tickId);
  _state.tickId = setInterval(() => {
    if (!_state.running) return;
    _state.secsLeft--;
    render();
    if (_state.secsLeft <= 0) {
      stopRest(true);
    }
  }, 1000);
}

export function stopRest(chime = false) {
  if (_state.tickId) { clearInterval(_state.tickId); _state.tickId = null; }
  if (_state.running && chime) {
    try { playChime('start'); } catch {}
    haptic('medium');
  }
  _state.running = false;
  render();
}

export function adjustRest(delta) {
  if (!_state.running) return;
  _state.secsLeft = Math.max(0, _state.secsLeft + delta);
  _state.totalSec = Math.max(_state.totalSec, _state.secsLeft);
  render();
  if (_state.secsLeft <= 0) stopRest(true);
}

if (typeof window !== 'undefined') {
  window.startRest = startRest;
  window.restDismiss = () => stopRest(false);
  window.restAdjust = adjustRest;
}
