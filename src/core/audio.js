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

window.stopAmbient = stopAmbient;
window.playAmbient = playAmbient;
