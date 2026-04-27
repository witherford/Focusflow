// Ambient audio — extracted from focusflow_v10.html lines 1438-1453
let _ac = null, _nn = null, _gn = null, _lfo = null;

export function stopAmbient() {
  if (_nn) { try { _nn.stop(); } catch (e) {} } _nn = null;
  if (_lfo) { try { _lfo.stop(); } catch (e) {} } _lfo = null;
  if (_gn) { _gn.disconnect(); } _gn = null;
}

function buildAmbient(type) {
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

export function playAmbient(type) {
  try {
    if (!_ac) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      _ac = new Ctx();
    }
    stopAmbient();
    if (!type) return;
    const proceed = () => buildAmbient(type);
    if (_ac.state === 'suspended') _ac.resume().then(proceed).catch(() => {});
    else proceed();
  } catch (e) { /* silent */ }
}

// ─── Chimes / Speech ─────────────────────────────────────────────────────────
// Short start/end tones for timers. Three flavours so the brain learns the
// meaning: 'start' = ascending pair, 'end' = descending triad, 'tick' = single.
let _chimeCtx = null;

function chimeCtx() {
  if (!_chimeCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _chimeCtx = new Ctx();
  }
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

function scheduleChime(ctx, kind) {
  const t = ctx.currentTime + 0.02;  // tiny lead so events aren't in the past
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
}

export function playChime(kind = 'end') {
  try {
    const ctx = chimeCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      // resume() is async — wait for it before scheduling, otherwise events
      // get queued at currentTime=0 and fire all at once when the context
      // wakes up (often heard as a single click or nothing at all).
      ctx.resume().then(() => scheduleChime(ctx, kind)).catch(() => {});
    } else {
      scheduleChime(ctx, kind);
    }
  } catch (e) { /* silent */ }
}

// Speech synthesis. Picks the most "human" voice available on the device.
// Many platforms ship higher-quality "neural" voices alongside the legacy
// robotic ones — we prefer those.
let _voicesCache = null;
let _bestVoiceCache = null;

function loadVoices() {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  const v = synth.getVoices() || [];
  if (v.length) _voicesCache = v;
  return _voicesCache || [];
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  // Some browsers fire voiceschanged after first call to getVoices.
  window.speechSynthesis.onvoiceschanged = () => { _voicesCache = window.speechSynthesis.getVoices(); _bestVoiceCache = null; };
  // Prime the cache.
  loadVoices();
}

// Priority lists — earlier patterns win. These cover the most pleasant voices
// available across iOS, macOS, Android, Windows, and Chrome cloud voices.
const VOICE_PRIORITIES = [
  /Samantha/i,                                    // iOS / macOS
  /Microsoft (Aria|Jenny|Sonia|Libby) (Online|Neural)/i, // Windows neural
  /Google UK English Female/i,                    // Chrome
  /Google US English/i,                           // Chrome (decent)
  /en-(GB|US|AU|IE)-(Wavenet|Neural)/i,           // GCP TTS
  /Karen|Moira|Tessa|Fiona|Veena|Daniel/i,        // macOS premium
  /Microsoft Zira/i,                              // Windows fallback
];

function pickBestVoice(preferLang = 'en') {
  if (_bestVoiceCache) return _bestVoiceCache;
  const voices = loadVoices();
  if (!voices.length) return null;
  for (const re of VOICE_PRIORITIES) {
    const v = voices.find(x => re.test(x.name));
    if (v) { _bestVoiceCache = v; return v; }
  }
  // Otherwise: prefer non-default English voice that mentions "natural" / "enhanced".
  let v = voices.find(x => /natural|neural|enhanced|premium/i.test(x.name) && x.lang?.startsWith(preferLang));
  if (!v) v = voices.find(x => x.lang?.startsWith(preferLang) && !x.localService); // cloud voices
  if (!v) v = voices.find(x => x.lang?.startsWith(preferLang));
  _bestVoiceCache = v || null;
  return _bestVoiceCache;
}

export function speak(text, opts = {}) {
  try {
    const synth = window.speechSynthesis; if (!synth || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // Slightly slower + warmer pitch reads more "human" for guided content.
    u.rate = opts.rate ?? 0.92;
    u.pitch = opts.pitch ?? 1.02;
    u.volume = opts.volume ?? 1.0;
    const v = pickBestVoice(opts.lang || 'en');
    if (v) { u.voice = v; u.lang = v.lang; }
    synth.speak(u);
  } catch (e) {}
}

export function listVoices() { return loadVoices().map(v => ({ name: v.name, lang: v.lang, localService: v.localService })); }
if (typeof window !== 'undefined') window.listVoices = listVoices;

// ─── Audio unlock on first user gesture ──────────────────────────────────────
// Desktop browsers (Chrome, Firefox, Safari, Edge) keep AudioContexts in a
// "suspended" state until a user interacts with the page. We attach a one-shot
// listener that warms up the chime + ambient contexts on the first pointer or
// keyboard event. By the time the user hits ▶ on a meditation timer, the
// contexts are already running and the chime can schedule cleanly.
function unlockAudio() {
  try {
    const ctx = chimeCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (_ac && _ac.state === 'suspended') _ac.resume().catch(() => {});
    // Some Safari builds also need the speech synthesizer to be touched once
    // before voices populate — a no-op cancel does the trick.
    try { window.speechSynthesis?.cancel(); } catch {}
  } catch {}
}

if (typeof document !== 'undefined') {
  const opts = { once: true, passive: true, capture: true };
  document.addEventListener('pointerdown', unlockAudio, opts);
  document.addEventListener('touchend', unlockAudio, opts);
  document.addEventListener('keydown', unlockAudio, opts);
  document.addEventListener('click', unlockAudio, opts);
}

window.stopAmbient = stopAmbient;
window.playAmbient = playAmbient;
window.playChime = playChime;
window.speak = speak;
window.unlockAudio = unlockAudio;
