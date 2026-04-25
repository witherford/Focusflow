// Onboarding tour — first-launch coachmark sequence anchored to UI elements.
// Skipped if S.settings.onboardingDone is true.
import { S } from '../core/state.js';
import { save } from '../core/persistence.js';

const STEPS = [
  { sel: '#dash-greeting', title: 'Welcome to FocusFlow', body: 'Your home shows today at a glance — habits, tasks, mood, and quick-start timers. Swipe between pages or use the menu.' },
  { sel: '#quickCaptureFab', title: 'Quick capture', body: 'Tap the + button anywhere to add a task, tick a habit, jot a journal note, or add a shopping item — without leaving where you are.' },
  { sel: '[data-page="habits"]', title: 'Build habits', body: '<strong>Single tap</strong> = toggle / increment.<br><strong>Double-tap</strong> = mark complete.<br><strong>Triple-tap</strong> = complete <em>and</em> open a quick reflection note.<br><strong>Long-press</strong> = reset (counter habits only).' },
  { sel: '[data-page="insights"]', title: 'See your trends', body: 'Insights shows weekly habit %, focus hours, badges, and a guided 5-question Sunday review.' },
  { sel: '#themeBtn', title: 'Cycle theme', body: 'Dark / light / auto — and pick an accent color in Settings.' },
  { sel: null, title: '⌨ Shortcuts', body: 'Press <kbd>?</kbd> for keyboard shortcuts, or <kbd>⌘K</kbd> to search anything.' },
];

let _idx = 0;

function ensureNodes() {
  if (document.getElementById('ob-overlay')) return;
  const html = `<div id="ob-overlay" style="position:fixed;inset:0;z-index:200;display:none;pointer-events:auto">
    <div id="ob-mask" style="position:absolute;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px)"></div>
    <div id="ob-card" style="position:absolute;background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:16px 18px;max-width:320px;box-shadow:0 12px 32px rgba(0,0,0,0.5);font-family:'DM Sans',sans-serif">
      <div id="ob-title" style="font-size:15px;font-weight:600;margin-bottom:6px">Title</div>
      <div id="ob-body" style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;align-items:center">
        <span id="ob-step" style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">1/6</span>
        <span style="flex:1"></span>
        <button class="btn btn-sm" id="ob-skip">Skip tour</button>
        <button class="btn btn-sm btn-primary" id="ob-next">Next →</button>
      </div>
    </div>
  </div>`;
  const wrap = document.createElement('div'); wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
  document.getElementById('ob-skip').addEventListener('click', skipTour);
  document.getElementById('ob-next').addEventListener('click', nextStep);
}

function positionCard(targetEl) {
  const card = document.getElementById('ob-card'); if (!card) return;
  if (!targetEl) {
    // centered
    card.style.left = '50%'; card.style.top = '50%';
    card.style.transform = 'translate(-50%, -50%)';
    return;
  }
  const r = targetEl.getBoundingClientRect();
  const cardW = 320; const margin = 14;
  let top = r.bottom + margin; let left = Math.max(margin, Math.min(window.innerWidth - cardW - margin, r.left));
  if (top + 200 > window.innerHeight) top = Math.max(margin, r.top - 220);
  card.style.left = left + 'px'; card.style.top = top + 'px';
  card.style.transform = '';
}

function showStep() {
  ensureNodes();
  const step = STEPS[_idx];
  if (!step) { finishTour(); return; }
  document.getElementById('ob-overlay').style.display = 'block';
  document.getElementById('ob-title').textContent = step.title;
  document.getElementById('ob-body').innerHTML = step.body;
  document.getElementById('ob-step').textContent = `${_idx + 1}/${STEPS.length}`;
  document.getElementById('ob-next').textContent = _idx === STEPS.length - 1 ? 'Finish' : 'Next →';
  const target = step.sel ? document.querySelector(step.sel) : null;
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => positionCard(target), 80);
}

function nextStep() {
  _idx++;
  if (_idx >= STEPS.length) finishTour();
  else showStep();
}

function skipTour() { finishTour(); }

function finishTour() {
  const ov = document.getElementById('ob-overlay'); if (ov) ov.style.display = 'none';
  if (!S.settings) S.settings = {};
  S.settings.onboardingDone = true;
  save();
}

export function startOnboarding(force = false) {
  if (!force && S.settings?.onboardingDone) return;
  _idx = 0;
  // Defer briefly so DOM is rendered
  setTimeout(showStep, 250);
}

window.startOnboarding = startOnboarding;
