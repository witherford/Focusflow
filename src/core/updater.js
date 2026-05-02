// Updater — Settings UI for the manual "Update app" flow plus a sidebar
// "latest version" indicator. Underlying calls (`window.ffUpdateApp`,
// `window.ffCheckForUpdate`) are wired in main.js where the SW registration
// happens. Latest version is read from /version.json which is emitted by the
// vite plugin on every build.
import { APP_VERSION } from './version.js';

let _latestVersion = null;
let _checkPending = false;

// Fetch /version.json from the network (cache:no-store) so we never read a
// stale cached copy. Returns the version string, or null if anything fails.
export async function fetchLatestVersion() {
  if (_checkPending) return _latestVersion;
  _checkPending = true;
  try {
    // Cache-bust query param + no-store so service workers / HTTP caches
    // can't serve us yesterday's manifest.
    const url = (typeof window !== 'undefined' && window.location?.origin) ? './version.json?ts=' + Date.now() : './version.json';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.version === 'string') {
      _latestVersion = data.version;
      return _latestVersion;
    }
    return null;
  } catch (e) {
    console.warn('[updater] version.json fetch failed', e);
    return null;
  } finally {
    _checkPending = false;
  }
}

function compareVersions(a, b) {
  const pa = String(a || '0.0.0').split('.').map(n => parseInt(n) || 0);
  const pb = String(b || '0.0.0').split('.').map(n => parseInt(n) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

export function isUpdateAvailable(latest = _latestVersion) {
  if (!latest) return !!window._ffUpdateAvailable;
  return compareVersions(latest, APP_VERSION) > 0;
}

// Render the small status block + Check / Update buttons that sits under the
// logo version pill in the sidebar.
export function renderSidebarUpdateStatus() {
  const el = document.getElementById('sidebar-update'); if (!el) return;
  const latest = _latestVersion || APP_VERSION;
  const updateAvail = isUpdateAvailable(latest);
  const status = !_latestVersion
    ? `Checking for updates…`
    : updateAvail
      ? `<span style="color:var(--gold)">Update available: V${latest}</span>`
      : `<span>The latest version of the app is V${latest}.</span>`;
  el.innerHTML = `
    <div class="sb-update-text">${status}</div>
    <div class="sb-update-actions">
      <button class="btn btn-xs" onclick="checkForUpdatesNow()" id="sb-check-btn">↻ Check</button>
      ${updateAvail ? '<button class="btn btn-xs btn-primary" onclick="updaterApplyNow()">⬇ Update</button>' : ''}
    </div>
  `;
}

function setStatus(text, kind) {
  const el = document.getElementById('updater-status'); if (!el) return;
  el.textContent = text;
  el.style.color = kind === 'err' ? 'var(--rose)' : kind === 'ok' ? 'var(--green)' : 'var(--text3)';
}

export function renderUpdaterSection() {
  const el = document.getElementById('updater-section'); if (!el) return;
  const latest = _latestVersion;
  const available = isUpdateAvailable(latest);
  const latestLine = latest
    ? (available
        ? `<span style="color:var(--gold)">Latest version: V${latest} — you're on V${APP_VERSION}.</span>`
        : `<span>The latest version of the app is V${latest}. You're up to date.</span>`)
    : `Checking for the latest version…`;
  el.innerHTML = `
    <div class="card-header"><div class="card-title">⬆️ App updates</div><div style="font-size:11px;color:var(--text3)">v${APP_VERSION}</div></div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5">${latestLine}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="updaterApplyNow()">⬇ Update now</button>
      <button class="btn" onclick="checkForUpdatesNow()">🔍 Check for updates</button>
    </div>
    <div id="updater-status" style="font-size:12px;color:${available ? 'var(--gold)' : 'var(--text3)'};margin-top:10px;min-height:16px">${available ? 'A new version is ready — tap Update now.' : (latest ? 'Up to date.' : '')}</div>
  `;
}

// Combined check: pings the SW for new content AND fetches /version.json
// to learn the actual latest version number. Refreshes both UI surfaces
// (Settings card and sidebar status block).
export async function checkForUpdatesNow({ silent = false } = {}) {
  if (!silent) setStatus('Checking…');
  try {
    // Run both in parallel — version.json gives the human-readable number,
    // ffCheckForUpdate flips _ffUpdateAvailable when a SW is waiting.
    const [latest] = await Promise.all([
      fetchLatestVersion(),
      window.ffCheckForUpdate?.()?.catch?.(() => null),
    ]);
    renderSidebarUpdateStatus();
    const avail = isUpdateAvailable(latest);
    if (latest) {
      if (avail) {
        if (!silent) setStatus(`A new version (V${latest}) is ready — tap Update now.`, 'ok');
        if (silent) window.toast?.(`New version V${latest} is available`);
      } else {
        if (!silent) setStatus(`You're on the latest (V${latest}).`, 'ok');
      }
    } else {
      if (!silent) setStatus(window._ffUpdateAvailable ? 'A new version is ready — tap Update now.' : 'No update found.', 'ok');
    }
    // Re-render the Settings card if visible.
    if (document.getElementById('updater-section')?.offsetParent) renderUpdaterSection();
  } catch (e) {
    if (!silent) setStatus('Check failed: ' + (e?.message || 'unknown'), 'err');
  }
}

// Auto-check on app boot. Silent — toasts if an update is available, then
// silently applies the new service worker the next time the app goes to the
// background. iOS PWAs can stay running for days, so without this, "update
// available" notifications pile up but never actually take effect.
let _autoApplyArmed = false;
let _autoApplyDone = false;
function armAutoApplyOnHide() {
  if (_autoApplyArmed) return;
  _autoApplyArmed = true;
  const handler = () => {
    if (document.visibilityState !== 'hidden' || _autoApplyDone) return;
    if (!(isUpdateAvailable() || window._ffUpdateAvailable)) return;
    _autoApplyDone = true;
    // skipWaiting without immediate reload — next launch picks up new precache.
    try { window.ffUpdateApp?.(false); } catch (e) { console.warn('[updater] auto-apply failed', e); }
  };
  document.addEventListener('visibilitychange', handler);
  // Also run periodic background checks every 15 minutes while the app is
  // open — covers the case where the user keeps the PWA open for a long
  // session and a new build ships mid-session.
  setInterval(() => { checkForUpdatesNow({ silent: true }).catch(() => {}); }, 15 * 60 * 1000);
}
export function autoCheckOnStartup({ delayMs = 1500 } = {}) {
  setTimeout(() => {
    checkForUpdatesNow({ silent: true })
      .then(() => armAutoApplyOnHide())
      .catch(() => armAutoApplyOnHide());
  }, delayMs);
}

window.checkForUpdatesNow = (opts) => checkForUpdatesNow(opts);
window.updaterCheck = () => checkForUpdatesNow();    // legacy alias

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
  // Re-fetch the version number so the sidebar status reflects it.
  fetchLatestVersion().then(() => { renderSidebarUpdateStatus(); renderUpdaterSection(); });
});

if (typeof window !== 'undefined') {
  window.renderUpdaterSection = renderUpdaterSection;
  window.renderSidebarUpdateStatus = renderSidebarUpdateStatus;
  window.fetchLatestVersion = fetchLatestVersion;
  window.autoCheckOnStartup = autoCheckOnStartup;
}
