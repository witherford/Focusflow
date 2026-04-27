// Cardio modules — stopwatch and interval (HIIT) timer for use inside the
// workout logger. Each module renders into a target element and exposes a
// `getResult()` that the saver can pull at workout-end.
import { playChime } from '../../core/audio.js';
import { haptic } from '../../core/state.js';

// ── Stopwatch ───────────────────────────────────────────────────────────────
const _sw = new Map(); // key → { startMs, accumMs, running, intId, result }

function fmtMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60), s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function renderStopwatch(targetEl, key) {
  if (!targetEl) return;
  if (!_sw.has(key)) _sw.set(key, { startMs: 0, accumMs: 0, running: false, intId: null, result: 0 });
  const st = _sw.get(key);
  targetEl.innerHTML = `<div class="cardio-mod">
    <div class="cm-label">Stopwatch</div>
    <div class="cm-time" id="${key}-disp">${fmtMs(st.accumMs)}</div>
    <div class="cm-controls">
      <button class="btn btn-sm" onclick="cardioSwReset('${key}')">↺ Reset</button>
      <button class="btn btn-sm btn-primary" id="${key}-btn" onclick="cardioSwToggle('${key}')">${st.running ? '⏸' : '▶'}</button>
      <button class="btn btn-sm" onclick="cardioSwLog('${key}')">💾 Log time</button>
    </div>
    <div class="cm-meta" id="${key}-meta">${st.result ? `Logged: ${fmtMs(st.result)}` : ''}</div>
  </div>`;
}

export function swToggle(key) {
  const st = _sw.get(key); if (!st) return;
  if (st.running) {
    st.accumMs += Date.now() - st.startMs;
    st.running = false; clearInterval(st.intId); st.intId = null;
    document.getElementById(key + '-btn')?.replaceChildren('▶');
  } else {
    st.startMs = Date.now(); st.running = true;
    st.intId = setInterval(() => {
      const el = document.getElementById(key + '-disp');
      if (el) el.textContent = fmtMs(st.accumMs + (Date.now() - st.startMs));
    }, 200);
    document.getElementById(key + '-btn')?.replaceChildren('⏸');
  }
}

export function swReset(key) {
  const st = _sw.get(key); if (!st) return;
  if (st.intId) { clearInterval(st.intId); st.intId = null; }
  st.startMs = 0; st.accumMs = 0; st.running = false;
  const el = document.getElementById(key + '-disp'); if (el) el.textContent = '00:00';
  const btn = document.getElementById(key + '-btn'); if (btn) btn.textContent = '▶';
}

export function swLog(key) {
  const st = _sw.get(key); if (!st) return 0;
  if (st.running) swToggle(key);
  st.result = st.accumMs;
  const m = document.getElementById(key + '-meta'); if (m) m.textContent = `Logged: ${fmtMs(st.result)}`;
  haptic('medium');
  return st.result;
}

export function swGetResult(key) { return _sw.get(key)?.result || 0; }
export function swClear(key) { _sw.delete(key); }

// ── Interval (HIIT) timer ───────────────────────────────────────────────────
// State per key: { work, rest, rounds, phase ('work'|'rest'|'idle'|'done'),
//                  remainingSec, currentRound, intId, result }
const _iv = new Map();

function ivState(key) {
  if (!_iv.has(key)) _iv.set(key, { work: 30, rest: 30, rounds: 8, phase: 'idle', remainingSec: 0, currentRound: 0, intId: null, result: null });
  return _iv.get(key);
}

export function renderInterval(targetEl, key, opts = {}) {
  if (!targetEl) return;
  const st = ivState(key);
  if (opts.work) st.work = opts.work;
  if (opts.rest) st.rest = opts.rest;
  if (opts.rounds) st.rounds = opts.rounds;
  targetEl.innerHTML = `<div class="cardio-mod">
    <div class="cm-label">Interval timer (HIIT)</div>
    <div class="form-grid3" style="margin-bottom:6px">
      <div class="form-row" style="margin:0"><label>Work s</label><input type="number" id="${key}-work" value="${st.work}" min="5" oninput="cardioIvCfg('${key}')"></div>
      <div class="form-row" style="margin:0"><label>Rest s</label><input type="number" id="${key}-rest" value="${st.rest}" min="0" oninput="cardioIvCfg('${key}')"></div>
      <div class="form-row" style="margin:0"><label>Rounds</label><input type="number" id="${key}-rounds" value="${st.rounds}" min="1" oninput="cardioIvCfg('${key}')"></div>
    </div>
    <div class="cm-time" id="${key}-disp">${fmtMs(st.work * 1000)}</div>
    <div class="cm-phase" id="${key}-phase">${st.phase.toUpperCase()}</div>
    <div class="cm-controls">
      <button class="btn btn-sm" onclick="cardioIvReset('${key}')">↺ Reset</button>
      <button class="btn btn-sm btn-primary" id="${key}-btn" onclick="cardioIvToggle('${key}')">▶</button>
    </div>
    <div class="cm-meta" id="${key}-meta">${st.result ? `Done · ${st.result.rounds} rounds · total ${fmtMs(st.result.totalMs)}` : ''}</div>
  </div>`;
}

export function ivCfg(key) {
  const st = ivState(key); if (st.phase !== 'idle' && st.phase !== 'done') return;
  st.work = Math.max(5, parseInt(document.getElementById(key + '-work')?.value) || 30);
  st.rest = Math.max(0, parseInt(document.getElementById(key + '-rest')?.value) || 0);
  st.rounds = Math.max(1, parseInt(document.getElementById(key + '-rounds')?.value) || 1);
  const el = document.getElementById(key + '-disp');
  if (el) el.textContent = fmtMs(st.work * 1000);
}

export function ivToggle(key) {
  const st = ivState(key);
  if (st.intId) { clearInterval(st.intId); st.intId = null; }
  if (st.phase === 'idle' || st.phase === 'done') {
    st.phase = 'work'; st.currentRound = 1; st.remainingSec = st.work;
    st.totalMs = 0; st.startMs = Date.now();
    playChime('start');
    runTick(key);
    st.intId = setInterval(() => runTick(key), 1000);
    setBtn(key, '⏸');
  } else {
    st.phase = 'idle';
    setBtn(key, '▶');
  }
}

function runTick(key) {
  const st = _iv.get(key); if (!st || st.phase === 'idle') return;
  st.remainingSec--;
  st.totalMs += 1000;
  if (st.remainingSec <= 0) {
    if (st.phase === 'work') {
      if (st.rest > 0 && st.currentRound < st.rounds) {
        st.phase = 'rest'; st.remainingSec = st.rest; haptic('light'); playChime('tick');
      } else if (st.currentRound < st.rounds) {
        st.currentRound++; st.phase = 'work'; st.remainingSec = st.work; haptic('medium'); playChime('start');
      } else {
        st.phase = 'done'; clearInterval(st.intId); st.intId = null;
        st.result = { rounds: st.rounds, totalMs: st.totalMs };
        playChime('end'); haptic('heavy'); setBtn(key, '▶');
      }
    } else if (st.phase === 'rest') {
      st.currentRound++; st.phase = 'work'; st.remainingSec = st.work; haptic('medium'); playChime('start');
    }
  }
  const el = document.getElementById(key + '-disp');
  if (el) el.textContent = fmtMs(st.remainingSec * 1000);
  const ph = document.getElementById(key + '-phase');
  if (ph) ph.textContent = `${st.phase.toUpperCase()}  ·  R${st.currentRound}/${st.rounds}`;
  const m = document.getElementById(key + '-meta');
  if (m && st.result) m.textContent = `Done · ${st.result.rounds} rounds · total ${fmtMs(st.result.totalMs)}`;
}

function setBtn(key, txt) { const b = document.getElementById(key + '-btn'); if (b) b.textContent = txt; }

export function ivReset(key) {
  const st = _iv.get(key); if (!st) return;
  if (st.intId) { clearInterval(st.intId); st.intId = null; }
  st.phase = 'idle'; st.remainingSec = st.work; st.currentRound = 0; st.result = null;
  const el = document.getElementById(key + '-disp'); if (el) el.textContent = fmtMs(st.work * 1000);
  setBtn(key, '▶');
  const m = document.getElementById(key + '-meta'); if (m) m.textContent = '';
}

export function ivGetResult(key) { return _iv.get(key)?.result || null; }
export function ivClear(key) { _iv.delete(key); }

if (typeof window !== 'undefined') {
  window.cardioSwToggle = swToggle;
  window.cardioSwReset = swReset;
  window.cardioSwLog = swLog;
  window.cardioIvToggle = ivToggle;
  window.cardioIvReset = ivReset;
  window.cardioIvCfg = ivCfg;
}
