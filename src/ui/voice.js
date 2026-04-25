// Voice input — Web Speech API. Records speech into a given target input.
export function isVoiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

let _rec = null;

export function startVoice(targetInputId, { onEnd } = {}) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) { window.toast?.('Voice input not supported here'); return false; }
  const target = document.getElementById(targetInputId);
  if (!target) return false;
  stopVoice();
  try {
    _rec = new Rec();
    _rec.lang = navigator.language || 'en-US';
    _rec.interimResults = true;
    _rec.continuous = false;
    let finalText = target.value || '';
    _rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = (finalText ? finalText + ' ' : '') + text.trim();
      }
      target.value = (finalText + ' ' + text).trim();
      target.dispatchEvent(new Event('input'));
    };
    _rec.onerror = () => { window.toast?.('Voice error'); };
    _rec.onend = () => { _rec = null; onEnd?.(); };
    _rec.start();
    window.toast?.('🎙 Listening…');
    return true;
  } catch (e) {
    console.warn('voice failed', e); return false;
  }
}

export function stopVoice() {
  if (_rec) { try { _rec.stop(); } catch {} _rec = null; }
}

window.startVoice = startVoice;
window.stopVoice = stopVoice;
window.isVoiceSupported = isVoiceSupported;
