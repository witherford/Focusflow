// Guided meditations — script selector that drives the main meditation timer.
// Selecting a script binds it to the current timer; cues fire at proportional
// offsets across whatever duration you've chosen, so a 10-min Body Scan still
// works as a 5-min compressed session or a 20-min slower one.
import { speak } from '../../core/audio.js';

export const GUIDED_LIBRARY = [
  {
    id: 'gm-bodyscan-10', name: 'Body Scan', icon: '🌿', mins: 10,
    desc: 'A full-body relaxation, head to toes',
    cues: [
      [2, 'Welcome. Find a comfortable position, sitting or lying down. Let your hands rest, and allow your eyes to gently close.'],
      [22, 'Begin by taking a slow, deep breath in through your nose. And a long, gentle exhale through your mouth. Two more like that.'],
      [55, 'Now bring your attention to the top of your head. Notice any sensations there. There’s nothing to fix — just notice.'],
      [90, 'Move your awareness down to your forehead and the muscles around your eyes. With each breath, soften them.'],
      [130, 'Let your jaw release. Your tongue rest. Your shoulders drop, just a little, on the next exhale.'],
      [180, 'Bring your attention to your chest. Feel the natural rise and fall of your breath. No need to change it.'],
      [230, 'Sense your stomach, soft, expanding gently with each inhale. Releasing on the exhale.'],
      [285, 'Travel down to your hips, your thighs. Notice the weight of your body, fully supported.'],
      [340, 'Through the knees, the calves, into the feet. Feel the contact with the floor or the surface beneath you.'],
      [410, 'Now expand awareness to the whole body, from head to toes, breathing as one.'],
      [490, 'Stay with this whole-body breath. There’s nowhere to go, nothing to do.'],
      [560, 'Slowly begin to bring movement back. Wiggle your fingers and toes.'],
      [580, 'When you’re ready, take one final deep breath. And open your eyes. Carry this stillness with you.'],
    ],
  },
  {
    id: 'gm-breath-5', name: 'Breath Awareness', icon: '🌬️', mins: 5,
    desc: 'A short anchor for the breath',
    cues: [
      [2, 'Settle in. Close your eyes if it feels right. Let your shoulders drop.'],
      [18, 'Bring your attention to the breath. Don’t change it — just notice it.'],
      [50, 'Feel the air move in… and out. Cool on the inhale. Warm on the exhale.'],
      [110, 'Mind wandering is normal. Each time you notice, gently return to the breath.'],
      [180, 'Just this breath. And the next. And the next.'],
      [240, 'No judgment. No grasping. Simply breathing.'],
      [280, 'When you’re ready, take a slightly deeper breath. Open your eyes. Return to the room.'],
    ],
  },
  {
    id: 'gm-loving-10', name: 'Loving-Kindness', icon: '💗', mins: 10,
    desc: 'Send goodwill to yourself and others',
    cues: [
      [2, 'Sit comfortably. Take three slow breaths to settle.'],
      [40, 'Bring to mind the image of yourself, just as you are. Silently say: "May I be safe. May I be well. May I be at ease."'],
      [110, 'Stay with the words. If feelings arise, let them. If nothing arises, that’s fine too.'],
      [170, 'Now picture someone you love easily. Family, a friend, even a pet. "May you be safe. May you be well. May you be at ease."'],
      [250, 'Hold them in your awareness. Repeat the phrases at your own pace.'],
      [330, 'Bring to mind someone neutral — a colleague, a stranger you saw today. The same wishes: "May you be safe. May you be well. May you be at ease."'],
      [410, 'Now, gently, someone you find difficult. Just enough to feel a flicker of resistance. Without forcing it: "May you be safe. May you be well."'],
      [490, 'Finally, expand outward to all beings, everywhere. "May all beings be safe. May all beings be well. May all beings be at ease."'],
      [560, 'Rest in this open-hearted awareness. The wishing has weight.'],
      [585, 'Take a deep breath. Open your eyes when you’re ready.'],
    ],
  },
  {
    id: 'gm-gratitude-5', name: 'Gratitude', icon: '🙏', mins: 5,
    desc: 'Three things you’re grateful for',
    cues: [
      [2, 'Find your seat. Take a long breath in. Out.'],
      [25, 'Bring to mind one thing from today that you’re grateful for. Something small is fine.'],
      [60, 'Hold it. Notice where you feel it in the body. A warmth, a softening.'],
      [120, 'Now a second thing. Something different. A person, a moment, a meal.'],
      [180, 'And one more. Something you usually take for granted. Your breath. A bed. A friend.'],
      [240, 'Sit with all three. Let the feeling settle.'],
      [275, 'When you’re ready, open your eyes. Carry one with you into the next hour.'],
    ],
  },
  {
    id: 'gm-evening-10', name: 'Evening Wind-Down', icon: '🌙', mins: 10,
    desc: 'Release the day, prepare for sleep',
    cues: [
      [2, 'Lie down or sit comfortably. Let your body be heavy.'],
      [20, 'Take a slow inhale… and a longer exhale. Lengthen the out-breath.'],
      [60, 'Mentally scan the day. What happened? Don’t judge — just acknowledge it.'],
      [140, 'Anything unfinished? Let it go for now. Tomorrow will hold it.'],
      [220, 'Now relax the face. The shoulders. The arms. The hands.'],
      [300, 'Soften the chest. The belly. Let it rise and fall on its own.'],
      [380, 'Hips heavy. Legs heavy. Feet heavy.'],
      [460, 'Each exhale, sink a little deeper.'],
      [530, 'There’s nothing left to do. The day is complete.'],
      [580, 'Stay here as long as you’d like. Let sleep arrive when it’s ready.'],
    ],
  },
  {
    id: 'gm-focus-5', name: 'Focus Reset', icon: '⚡', mins: 5,
    desc: 'Quick mental clearing before deep work',
    cues: [
      [2, 'Sit upright. Feet on the floor. Hands resting.'],
      [15, 'Take three sharp breaths in through the nose. Long exhales out the mouth.'],
      [50, 'Now natural breath. Notice five things you can hear, without naming them.'],
      [110, 'Notice the sensation of your hands resting. Just the feel.'],
      [170, 'Now bring to mind the one task you want to focus on next. See it clearly.'],
      [220, 'On the next exhale, commit to it for the next block of time.'],
      [260, 'Take one more deep breath. Open your eyes. Begin.'],
    ],
  },
];

// Active selection (only ID is "state"; everything else is derived)
let _activeScriptId = null;
let _firedCueIdx = new Set();

export function getActiveScript() {
  return GUIDED_LIBRARY.find(g => g.id === _activeScriptId) || null;
}

export function selectGuided(id) {
  if (_activeScriptId === id) {
    // Tap an already-active guide to clear it (silent meditation)
    clearGuided(); return;
  }
  _activeScriptId = id;
  resetCueFiringState();
  const lib = GUIDED_LIBRARY.find(g => g.id === id);
  if (lib) {
    const dur = document.getElementById('med-dur');
    if (dur) { dur.value = lib.mins; window.medReset?.(); }
  }
  renderGuidedTab();
  highlightClearButton();
  window.toast?.(`🌿 ${lib?.name || 'Guided'} selected`);
}

export function clearGuided() {
  _activeScriptId = null;
  resetCueFiringState();
  renderGuidedTab();
  highlightClearButton();
}

export function resetCueFiringState() {
  _firedCueIdx = new Set();
}

// Called from medToggle's tick. Fires cues whose scaled offset has been reached.
// `elapsedSec` is total elapsed seconds; `totalSec` is the chosen total.
export function tickGuidedCues(elapsedSec, totalSec) {
  const lib = getActiveScript(); if (!lib) return;
  const baseTotal = lib.mins * 60;
  const scale = baseTotal > 0 ? (totalSec / baseTotal) : 1;
  lib.cues.forEach((cue, i) => {
    if (_firedCueIdx.has(i)) return;
    const scaledAt = cue[0] * scale;
    if (elapsedSec >= scaledAt) {
      _firedCueIdx.add(i);
      // Default rate/pitch — non-default values can silence iOS voices.
      speak(cue[1]);
      // Always also display the cue on screen — speech may be silent (iOS
      // ringer routing, missing voice asset, quiet environment).
      window.showGuidedCue?.(cue[1]);
    }
  });
}

// ── UI ──────────────────────────────────────────────────────────────────────
function highlightClearButton() {
  const el = document.getElementById('gm-clear');
  if (el) el.style.display = _activeScriptId ? '' : 'none';
}

export function renderGuidedTab() {
  const list = document.getElementById('gm-list'); if (!list) return;
  list.innerHTML = GUIDED_LIBRARY.map(g => {
    const active = g.id === _activeScriptId;
    return `<button class="guided-card${active ? ' active' : ''}" onclick="selectGuided('${g.id}')" data-id="${g.id}">
      <span class="gc-icon">${g.icon}</span>
      <div class="gc-info">
        <div class="gc-name">${g.name}${active ? ' <span style="color:var(--teal);font-size:11px">· active</span>' : ''}</div>
        <div class="gc-meta">${g.mins} min default</div>
        <div class="gc-desc">${g.desc}</div>
      </div>
      <span class="gc-play">${active ? '✓' : '▶'}</span>
    </button>`;
  }).join('');
  highlightClearButton();
  // Show iOS-standalone voice notice if applicable.
  window.maybeShowIosVoiceNotice?.();
}

if (typeof window !== 'undefined') {
  window.GUIDED_LIBRARY = GUIDED_LIBRARY;
  window.selectGuided = selectGuided;
  window.clearGuided = clearGuided;
  window.renderGuidedTab = renderGuidedTab;
  window.tickGuidedCues = tickGuidedCues;
  window.resetCueFiringState = resetCueFiringState;
  window.getActiveScript = getActiveScript;
}
