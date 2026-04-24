// Ambient audio — extracted from focusflow_v10.html lines 1438-1453
let _ac = null, _nn = null, _gn = null, _lfo = null;

export function stopAmbient() {
  if (_nn) { try { _nn.stop(); } catch (e) {} } _nn = null;
  if (_lfo) { try { _lfo.stop(); } catch (e) {} } _lfo = null;
  if (_gn) { _gn.disconnect(); } _gn = null;
}

export function playAmbient(type) {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  stopAmbient(); if (!type) return;
  if (_ac.state === 'suspended') _ac.resume();
  const sr = _ac.sampleRate, buf = _ac.createBuffer(1, sr * 2, sr), data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    data[i] = (last + (0.02 * w)) / 1.02; last = data[i]; data[i] *= 3.5;
  }
  _nn = _ac.createBufferSource(); _nn.buffer = buf; _nn.loop = true;
  const filt = _ac.createBiquadFilter(); _gn = _ac.createGain();
  if (type === 'brown') { filt.type = 'lowpass'; filt.frequency.value = 600; _gn.gain.value = 0.8; }
  else if (type === 'rain') { filt.type = 'lowpass'; filt.frequency.value = 1400; _gn.gain.value = 0.4; }
  else if (type === 'waves') {
    filt.type = 'lowpass'; filt.frequency.value = 500; _gn.gain.value = 0;
    _lfo = _ac.createOscillator(); _lfo.type = 'sine'; _lfo.frequency.value = 0.12;
    const lg = _ac.createGain(); lg.gain.value = 0.8;
    _lfo.connect(lg); lg.connect(_gn.gain); _lfo.start();
  }
  _nn.connect(filt); filt.connect(_gn); _gn.connect(_ac.destination); _nn.start();
}

// ─── Chimes / Speech ─────────────────────────────────────────────────────────
// Short start/end tones for timers. Three flavours so the brain learns the
// meaning: 'start' = ascending pair, 'end' = descending triad, 'tick' = single.
let _chimeCtx = null;
function chimeCtx() {
  if (!_chimeCtx) _chimeCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_chimeCtx.state === 'suspended') _chimeCtx.resume();
  return _chimeCtx;
}

function tone(ctx, freq, startAt, dur = 0.35, gain = 0.18, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(gain, startAt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(startAt); o.stop(startAt + dur + 0.05);
}

export function playChime(kind = 'end') {
  try {
    const ctx = chimeCtx(), t = ctx.currentTime;
    if (kind === 'start') {
      tone(ctx, 660, t,        0.18, 0.15);
      tone(ctx, 880, t + 0.16, 0.30, 0.18);
    } else if (kind === 'tick') {
      tone(ctx, 1000, t, 0.08, 0.10, 'triangle');
    } else { // 'end'
      tone(ctx, 880, t,        0.20, 0.18);
      tone(ctx, 660, t + 0.20, 0.20, 0.18);
      tone(ctx, 440, t + 0.40, 0.45, 0.20);
    }
  } catch (e) { /* user-gesture not yet given — silent */ }
}

// Speech synthesis. Cheaper than recording audio; respects device voice.
// Cancels any pending utterance so two announcements never overlap.
export function speak(text, opts = {}) {
  try {
    const synth = window.speechSynthesis; if (!synth || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? 1.0;
    u.pitch = opts.pitch ?? 1.0;
    u.volume = opts.volume ?? 1.0;
    synth.speak(u);
  } catch (e) {}
}

window.stopAmbient = stopAmbient;
window.playAmbient = playAmbient;
window.playChime = playChime;
window.speak = speak;
