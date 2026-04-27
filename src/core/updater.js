// Updater — Settings UI for the manual "Update app" flow.
// Underlying calls (`window.ffUpdateApp`, `window.ffCheckForUpdate`) are wired
// in main.js where the SW registration happens.
import { APP_VERSION } from './version.js';

function setStatus(text, kind) {
  const el = document.getElementById('updater-status'); if (!el) return;
  el.textContent = text;
  el.style.color = kind === 'err' ? 'var(--rose)' : kind === 'ok' ? 'var(--green)' : 'var(--text3)';
}

export function renderUpdaterSection() {
  const el = document.getElementById('updater-section'); if (!el) return;
  const available = !!window._ffUpdateAvailable;
  el.innerHTML = `
    <div class="card-header"><div class="card-title">⬆️ App updates</div><div style="font-size:11px;color:var(--text3)">v${APP_VERSION}</div></div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5">
      Force a check for the latest service-worker bundle, or apply a pending update right now (the page reloads).
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="updaterApplyNow()">⬇ Update now</button>
      <button class="btn" onclick="updaterCheck()">🔍 Check for updates</button>
    </div>
    <div id="updater-status" style="font-size:12px;color:${available ? 'var(--gold)' : 'var(--text3)'};margin-top:10px;min-height:16px">${available ? 'A new version is ready — tap Update now.' : 'Up to date'}</div>
  `;
}

window.updaterCheck = async () => {
  setStatus('Checking…');
  try {
    await window.ffCheckForUpdate?.();
    if (window._ffUpdateAvailable) setStatus('A new version is ready — tap Update now.', 'ok');
    else setStatus('No update found. You\'re on the latest.', 'ok');
  } catch (e) {
    setStatus('Check failed: ' + (e?.message || 'unknown'), 'err');
  }
};

window.updaterApplyNow = () => {
  setStatus('Applying… page will reload.');
  try {
    if (typeof window.ffUpdateApp === 'function') {
      window.ffUpdateApp(true);
    } else {
      // Fallback: hard reload bypassing cache.
      setTimeout(() => location.reload(), 200);
    }
  } catch (e) {
    setStatus('Update failed: ' + (e?.message || 'unknown'), 'err');
  }
};

window.addEventListener('ff:update-available', () => {
  const el = document.getElementById('updater-status');
  if (el) { el.textContent = 'A new version is ready — tap Update now.'; el.style.color = 'var(--gold)'; }
});

if (typeof window !== 'undefined') {
  window.renderUpdaterSection = renderUpdaterSection;
}
