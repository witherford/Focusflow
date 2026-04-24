// FocusFlow — bootstrap
// Self-hosted fonts (replaces Google Fonts CDN for full offline support)
import '@fontsource/dm-sans/300.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/playfair-display/700.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';

// Register service worker (vite-plugin-pwa)
import { registerSW } from 'virtual:pwa-register';
const updateSW = registerSW({
  onNeedRefresh() { console.log('[pwa] new content available — will auto-update'); },
  onOfflineReady() { console.log('[pwa] app ready for offline use'); },
});

// Core
import { S } from './core/state.js';
import { load, save, renderCustomCats, populateSel } from './core/persistence.js';
import './core/audio.js';
import './core/ai.js';

// UI
import { toast } from './ui/toast.js';
import { initRouter, goPage } from './ui/router.js';
import { initModals } from './ui/modal.js';
import './ui/wakeLock.js';
// Platform layer (web/native branches) — must import after ui/wakeLock.js so these win the window.* override.
import './platform/wakeLock.js';
import './platform/vibrate.js';
import './platform/notifications.js';
import './platform/fs.js';
import { setTheme, initTheme } from './ui/theme.js';
import './ui/heatmap.js';

// Features
import { renderDash, renderSchedule, renderBadHabits } from './features/dashboard/page.js';
import { renderHabitsToday, renderHabitsAll } from './features/habits/page.js';
import { renderChores } from './features/chores/page.js';
import { renderProjTree, renderAllFlat, renderDueToday, renderOverdue, renderBreakdown, initProjSwatches } from './features/projects/page.js';
import { renderGoals } from './features/goals/page.js';
import { renderDwLog, renderPresets } from './features/deepwork/page.js';
import { renderMedStats, renderSavedTimers, renderBreathPresets, renderHeatmaps } from './features/meditation/page.js';
import { renderShop } from './features/shopping/page.js';
import { renderFitness } from './features/fitness/page.js';
import './ui/fullscreenTimer.js';
import { renderJournal } from './features/journal/page.js';
import { renderProfile, attachAutoSave, applyAIVis, initRoutineDays } from './features/profile/page.js';
import { renderPasscodeSection } from './features/settings/page.js';

// ── renderPage ──────────────────────────────────────────────────────────────

export function renderPage(id) {
  switch (id) {
    case 'dashboard':   renderDash(); break;
    case 'habits':      renderHabitsToday(); renderHabitsAll(); break;
    case 'chores':      renderChores(); break;
    case 'projects':    renderProjTree(); renderAllFlat(); renderDueToday(); renderOverdue(); renderBreakdown(); break;
    case 'goals':       renderGoals(); break;
    case 'deepwork':    renderPresets(); renderDwLog(); break;
    case 'meditation':  renderMedStats(); renderSavedTimers(); renderBreathPresets(); renderHeatmaps(); break;
    case 'shopping':    renderShop(); break;
    case 'fitness':     renderFitness(); break;
    case 'journal':     renderJournal(); break;
    case 'profile':     renderProfile(); renderCustomCats(); break;
    case 'settings':    renderPasscodeSection(); break;
  }
}

function safe(fn, label) {
  try { fn(); } catch (e) { console.error(`[render:${label}]`, e); }
}

export function renderAll() {
  safe(renderDash, 'dash');
  safe(renderHabitsToday, 'habits.today'); safe(renderHabitsAll, 'habits.all');
  safe(renderChores, 'chores');
  safe(renderProjTree, 'proj.tree'); safe(renderAllFlat, 'proj.flat'); safe(renderDueToday, 'proj.due'); safe(renderOverdue, 'proj.over'); safe(renderBreakdown, 'proj.bd');
  safe(renderGoals, 'goals');
  safe(renderPresets, 'dw.presets'); safe(renderDwLog, 'dw.log');
  safe(renderMedStats, 'med.stats'); safe(renderSavedTimers, 'med.saved'); safe(renderBreathPresets, 'med.breath'); safe(renderHeatmaps, 'med.heat');
  safe(renderShop, 'shop');
  safe(renderFitness, 'fitness');
  safe(renderJournal, 'journal');
  safe(renderProfile, 'profile'); safe(renderCustomCats, 'profile.cats');
  safe(renderPasscodeSection, 'settings.passcode');
}

// Global error listeners so uncaught errors don't silently blank features.
window.addEventListener('error', e => console.error('[uncaught]', e.error || e.message));
window.addEventListener('unhandledrejection', e => console.error('[unhandled promise]', e.reason));

window.renderPage = renderPage;
window.renderAll = renderAll;
window.renderSchedule = renderSchedule;
window.renderBadHabits = renderBadHabits;

// ── Init ────────────────────────────────────────────────────────────────────

await load();
setTheme(S.settings.theme !== 'light');
initRouter();
initModals();
initTheme();
initProjSwatches();
initRoutineDays();
attachAutoSave();
renderAll();
renderProfile();
applyAIVis();

// Nav haptic patch
document.querySelectorAll('.mob-nav-item,.nav-item').forEach(el => {
  el.addEventListener('click', () => window.haptic('light'));
});

// Keyboard: scroll focused input into view on iOS
document.addEventListener('focusin', e => {
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
  }
});

// Swipe page navigation
(function () {
  const pages = ['dashboard','habits','deepwork','meditation','projects','journal','profile'];
  let _tx = 0, _ty = 0, _swiping = false;
  document.addEventListener('touchstart', e => { const t = e.touches[0]; _tx = t.clientX; _ty = t.clientY; _swiping = true; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!_swiping) return; _swiping = false;
    const dx = e.changedTouches[0].clientX - _tx, dy = e.changedTouches[0].clientY - _ty;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (document.getElementById('sidebar').classList.contains('open')) return;
    const cur = document.querySelector('.page.active'); if (!cur) return;
    const cid = cur.id.replace('page-', ''), idx = pages.indexOf(cid); if (idx === -1) return;
    if (dx < 0 && idx < pages.length - 1) { window.haptic(); goPage(pages[idx + 1]); }
    else if (dx > 0 && idx > 0) { window.haptic(); goPage(pages[idx - 1]); }
  }, { passive: true });
})();

console.log('%cFocusFlow v10 ✓', 'color:#3ecfb0;font-weight:bold;font-size:14px');
