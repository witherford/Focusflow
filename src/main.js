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

// Page markup is split into src/pages/*.html partials and injected into
// <main id="main"> here, before any feature module queries the DOM.
import { injectPages } from './pages/index.js';
injectPages();

// App version (visible in sidebar logo)
import { APP_VERSION } from './core/version.js';

// Register service worker (vite-plugin-pwa)
import { registerSW } from 'virtual:pwa-register';
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('[pwa] new content available');
    window._ffUpdateAvailable = true;
    try { window.toast?.('New version ready — Update from Settings'); } catch {}
    window.dispatchEvent(new CustomEvent('ff:update-available'));
  },
  onOfflineReady() { console.log('[pwa] app ready for offline use'); },
});
// Expose updater so the Settings button can trigger a skip-waiting reload.
window.ffUpdateApp = (reload = true) => { try { return updateSW(reload); } catch (e) { console.warn(e); } };
window.ffCheckForUpdate = () => {
  try { return navigator.serviceWorker?.getRegistration?.().then(r => r?.update?.()); } catch (e) { console.warn(e); }
};

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
import { renderTraining as renderFitness } from './features/fitness/page.js';
import './features/fitness/workout.js';
import './features/fitness/calendar.js';
import './features/fitness/routineEdit.js';
import './features/fitness/cardio.js';
import './ui/fullscreenTimer.js';
import { renderJournal } from './features/journal/page.js';
import { renderProfile, attachAutoSave, applyAIVis, initRoutineDays } from './features/profile/page.js';
import { renderPasscodeSection } from './features/settings/page.js';
import { renderInsights } from './features/insights/page.js';
import { renderDocs } from './features/docs/page.js';
import { initPalette } from './ui/palette.js';
import { initReminders } from './core/reminders.js';
import { initBackup } from './core/backup.js';
import { HABIT_TEMPLATES, applyHabitTemplate } from './core/templates.js';
import { renderWeight } from './features/weight/page.js';
import { renderCalendar } from './features/projects/calendar.js';
import { checkBadges } from './core/gamification.js';
import { initShortcuts } from './ui/shortcuts.js';
import './features/dashboard/allDay.js';
import './features/dashboard/checkin.js';
import './features/sleepHabit/page.js';
import './core/importers.js';
import './core/icsImport.js';
import './core/csvExport.js';
import './ui/voice.js';
import { renderGuidedTab } from './features/meditation/guided.js';
import { renderSleep } from './features/sleep/page.js';
import { startOnboarding } from './ui/onboarding.js';
import './core/cloudSync.js';
import './features/settings/cloudSyncUI.js';
import { applyFeatureVisibility } from './features/settings/featureToggles.js';
import { startIconNormalizer } from './ui/icons.js';
import { renderBottomNav } from './ui/bottomNav.js';
window._habitTemplates = HABIT_TEMPLATES;
window._applyHabitTemplateByIdx = i => applyHabitTemplate(HABIT_TEMPLATES[i]);

// ── renderPage ──────────────────────────────────────────────────────────────

export function renderPage(id) {
  switch (id) {
    case 'dashboard':   renderDash(); break;
    case 'habits':      renderHabitsToday(); renderHabitsAll(); break;
    case 'chores':      renderChores(); break;
    case 'projects':    renderProjTree(); renderAllFlat(); renderDueToday(); renderOverdue(); renderBreakdown(); break;
    case 'goals':       renderGoals(); break;
    case 'deepwork':    renderPresets(); renderDwLog(); break;
    case 'meditation':  renderMedStats(); renderSavedTimers(); renderBreathPresets(); renderHeatmaps(); renderGuidedTab(); break;
    case 'shopping':    renderShop(); break;
    case 'fitness':     renderFitness(); break;
    case 'journal':     renderJournal(); break;
    case 'profile':     renderProfile(); renderCustomCats(); break;
    case 'settings':    renderPasscodeSection(); break;
    case 'insights':    renderInsights(); break;
    case 'weight':      renderWeight(); break;
    case 'sleep':       renderSleep(); break;
    case 'docs':        renderDocs(); break;
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
  safe(renderMedStats, 'med.stats'); safe(renderSavedTimers, 'med.saved'); safe(renderBreathPresets, 'med.breath'); safe(renderHeatmaps, 'med.heat'); safe(renderGuidedTab, 'med.guided');
  safe(renderShop, 'shop');
  safe(renderFitness, 'fitness');
  safe(renderWeight, 'weight');
  safe(renderSleep, 'sleep');
  safe(renderJournal, 'journal');
  safe(renderProfile, 'profile'); safe(renderCustomCats, 'profile.cats');
  safe(renderPasscodeSection, 'settings.passcode');
  safe(renderDocs, 'docs');
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

// V1.1.3 — one-shot migration: convert legacy profile.negHabits / negCustom
// into actual habits with kind:'bad' so they show up alongside good habits in
// the time-blocks. Stamp a flag so it never runs twice.
(function migrateBadHabitsV113() {
  try {
    if (!S.settings) S.settings = {};
    if (S.settings.badHabitsMigratedV113) return;
    const negList = [
      ...(S.profile?.negHabits || []),
      ...((S.profile?.negCustom || '').split('\n').map(s => s.trim()).filter(Boolean)),
    ];
    if (!S.badHabitLog) S.badHabitLog = {};
    const existing = new Set(S.habits.filter(h => h.kind === 'bad').map(h => h.name.toLowerCase()));
    const created = [];
    for (const name of negList) {
      if (existing.has(name.toLowerCase())) continue;
      const id = 'bad-' + Math.random().toString(36).slice(2, 9);
      S.habits.push({ id, name, kind: 'bad', block: 'allday', icon: '🚫', mode: 'binary' });
      // Carry across legacy journal indulged/avoided history into badHabitLog.
      (S.journal || []).filter(j => j.habitId === name && (j.type === 'avoided' || j.type === 'indulged')).forEach(j => {
        const day = (j.datetime || '').slice(0, 10); if (!day) return;
        if (!S.badHabitLog[day]) S.badHabitLog[day] = {};
        // Last write wins per day.
        S.badHabitLog[day][id] = j.type;
      });
      created.push(name);
    }
    S.settings.badHabitsMigratedV113 = true;
    if (created.length) {
      try { save(); } catch {}
      console.log('[ff] migrated bad habits →', created);
    } else {
      try { save(); } catch {}
    }
  } catch (e) { console.warn('bad-habit migration failed', e); }
})();

initRouter();
initModals();
initTheme();
initProjSwatches();
initRoutineDays();
attachAutoSave();
initPalette();
initShortcuts();
initReminders();
initBackup();
renderAll();
renderProfile();
applyAIVis();
checkBadges();
applyFeatureVisibility();
renderBottomNav();
startIconNormalizer();
startOnboarding();

// Show app version in sidebar header + the About card + "latest version"
// status block, then kick off a one-shot background check.
const _verEl = document.getElementById('logoVersion');
if (_verEl) _verEl.textContent = 'V' + APP_VERSION;
const _aboutEl = document.getElementById('about-version');
if (_aboutEl) _aboutEl.textContent = 'V' + APP_VERSION;
import('./core/updater.js').then(({ renderSidebarUpdateStatus, autoCheckOnStartup }) => {
  renderSidebarUpdateStatus();
  autoCheckOnStartup();
});

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
