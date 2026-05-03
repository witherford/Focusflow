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

// Structured version report. Used by the sidebar "Check for updates" button
// and the Settings card to show current vs latest in an unambiguous way.
export async function getVersionReport() {
  const latest = await fetchLatestVersion();
  const cmp = latest ? compareVersions(latest, APP_VERSION) : null;
  return {
    current: APP_VERSION,
    latest: latest || null,
    upToDate: latest != null && cmp <= 0,
    updateAvailable: latest != null ? cmp > 0 : !!window._ffUpdateAvailable,
    fetchFailed: latest == null,
    fetchedAt: new Date().toISOString(),
  };
}

function formatReportLines(rep) {
  const cur = `Current version: V${rep.current}`;
  const lat = rep.fetchFailed
    ? 'Latest version: unavailable (network)'
    : `Latest version: V${rep.latest}`;
  let status;
  if (rep.fetchFailed) status = 'Status: Could not check for updates.';
  else if (rep.updateAvailable) status = 'Status: Update available — tap "Update now".';
  else status = 'Status: You are on the latest version.';
  return { cur, lat, status };
}

function reportToHtml(rep) {
  const { cur, lat, status } = formatReportLines(rep);
  const statusColor = rep.fetchFailed ? 'var(--rose)' : rep.updateAvailable ? 'var(--gold)' : 'var(--green)';
  return `<div style="font-family:'DM Mono',monospace;font-size:12px;line-height:1.6">
    <div>${cur}</div>
    <div>${lat}</div>
    <div style="color:${statusColor}">${status}</div>
  </div>`;
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
    <div id="sb-update-report" class="sb-update-report"></div>
    <div class="sb-update-actions">
      <button class="btn btn-xs" onclick="checkForUpdatesNow()" id="sb-check-btn">↻ Check for updates</button>
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
    <div id="updater-report" style="margin-top:10px"></div>
    <div id="updater-status" style="font-size:12px;color:${available ? 'var(--gold)' : 'var(--text3)'};margin-top:8px;min-height:16px">${available ? 'A new version is ready — tap Update now.' : (latest ? 'Up to date.' : '')}</div>
  `;
}

// Combined check: pings the SW for new content AND fetches /version.json
// to learn the actual latest version number. Refreshes both UI surfaces
// (Settings card and sidebar status block) and renders a structured report
// (current vs latest) into any element with id="updater-report" or
// id="sb-update-report".
export async function checkForUpdatesNow({ silent = false } = {}) {
  if (!silent) setStatus('Checking…');
  try {
    // Run both in parallel — version.json gives the human-readable number,
    // ffCheckForUpdate flips _ffUpdateAvailable when a SW is waiting.
    const [, swPing] = await Promise.all([
      fetchLatestVersion(),
      window.ffCheckForUpdate?.()?.catch?.(() => null),
    ]);
    void swPing;
    const rep = await getVersionReport();
    renderSidebarUpdateStatus();
    // Re-render the Settings card if visible (so the report HTML lands).
    if (document.getElementById('updater-section')?.offsetParent) renderUpdaterSection();
    // Inject the structured report into both surfaces if present.
    const html = reportToHtml(rep);
    const repEl = document.getElementById('updater-report');
    if (repEl) repEl.innerHTML = html;
    const sbRepEl = document.getElementById('sb-update-report');
    if (sbRepEl) sbRepEl.innerHTML = html;
    // Status text + toast summary.
    const { status } = formatReportLines(rep);
    if (!silent) setStatus(status.replace(/^Status:\s*/, ''), rep.fetchFailed ? 'err' : 'ok');
    if (!silent) {
      if (rep.fetchFailed) window.toast?.('Could not check for updates');
      else if (rep.updateAvailable) window.toast?.(`Update available: V${rep.latest} (you're on V${rep.current})`);
      else window.toast?.(`You're on the latest version (V${rep.current})`);
    } else if (rep.updateAvailable) {
      window.toast?.(`New version V${rep.latest} is available`);
    }
    return rep;
  } catch (e) {
    if (!silent) setStatus('Check failed: ' + (e?.message || 'unknown'), 'err');
    return null;
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

async function clearAllCachesAndReload() {
  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      const ks = await caches.keys();
      await Promise.all(ks.map(k => caches.delete(k)));
    }
  } catch (e) { console.warn('[updater] cache clear failed', e); }
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) await reg.unregister().catch(() => {});
  } catch {}
  // Cache-busting reload — append a query param so the HTML shell isn't
  // served from any HTTP cache layer the browser still has.
  const u = new URL(window.location.href);
  u.searchParams.set('_v', Date.now().toString());
  window.location.replace(u.toString());
}

window.updaterApplyNow = async () => {
  setStatus('Checking for updates…');
  try {
    // Force the SW to poll the server and fetch the freshest version.json.
    const [latest] = await Promise.all([
      fetchLatestVersion(),
      window.ffCheckForUpdate?.()?.catch?.(() => null),
    ]);
    const swReady = !!window._ffUpdateAvailable;
    const versionAvail = latest && isUpdateAvailable(latest);

    if (!swReady && !versionAvail) {
      setStatus(latest ? `You're already on the latest version (V${latest}).` : 'No update found.', 'ok');
      return;
    }

    setStatus('Applying update… page will reload.');
    if (swReady && typeof window.ffUpdateApp === 'function') {
      window.ffUpdateApp(true);
      // If the SW reload doesn't kick in within 2s, force a cache-clear reload
      // so the user actually moves to the new build.
      setTimeout(() => clearAllCachesAndReload(), 2000);
      return;
    }
    // version.json says a newer build exists but the SW didn't pick it up
    // (e.g. precache mismatch, no waiting worker). Hard-reload past caches.
    await clearAllCachesAndReload();
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
