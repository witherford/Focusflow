// Cloud sync settings card.
import { S } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { generateSyncCode, pushSync, pullSync, applyPulledPayload, checkRemoteInfo } from '../../core/cloudSync.js';

function cfg() { if (!S.settings) S.settings = {}; if (!S.settings.sync) S.settings.sync = { url: '', code: '', lastSync: 0 }; return S.settings.sync; }

export function renderCloudSyncSection() {
  const el = document.getElementById('cloud-sync-section'); if (!el) return;
  const c = cfg();
  el.innerHTML = `
    <div class="card-header"><div class="card-title">☁️ Cloud sync</div><div style="font-size:11px;color:var(--text3)">end-to-end encrypted</div></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.5">
      Encrypted backup to your own Cloudflare Worker. Free forever. See <code>docs/cloud-sync.md</code> for the 10-minute setup. The server only sees ciphertext; lose the passphrase and the data is unrecoverable.
    </div>
    <div class="form-row"><label>Worker URL</label><input type="url" id="cs-url" value="${c.url || ''}" placeholder="https://focusflow-sync.you.workers.dev"></div>
    <div class="form-row"><label>Sync code</label>
      <div style="display:flex;gap:6px"><input type="text" id="cs-code" value="${c.code || ''}" placeholder="(generate one to start)" style="flex:1;font-family:'DM Mono',monospace">
      <button class="btn btn-sm" onclick="csGenerate()">↻ New</button></div>
    </div>
    <div class="form-row"><label>Passphrase (not stored — type each time)</label><input type="password" id="cs-pass" placeholder="Long, memorable phrase"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      <button class="btn btn-primary" onclick="csPush()">⬆ Push</button>
      <button class="btn" onclick="csPull()">⬇ Pull</button>
      <button class="btn" onclick="csCheck()">🔍 Check remote</button>
      <button class="btn" onclick="csSaveCfg()">💾 Save settings</button>
    </div>
    <div id="cs-status" style="font-size:12px;color:var(--text3);margin-top:8px;min-height:16px">${c.lastSync ? 'Last sync: ' + new Date(c.lastSync).toLocaleString() : 'Never synced'}</div>
  `;
}

function setStatus(s, isErr) {
  const el = document.getElementById('cs-status');
  if (el) { el.textContent = s; el.style.color = isErr ? 'var(--rose)' : 'var(--text3)'; }
}

window.csGenerate = () => {
  const code = generateSyncCode();
  const inp = document.getElementById('cs-code'); if (inp) inp.value = code;
  setStatus('New sync code generated — save settings to persist.');
};

window.csSaveCfg = () => {
  const c = cfg();
  c.url = document.getElementById('cs-url')?.value.trim() || '';
  c.code = document.getElementById('cs-code')?.value.trim() || '';
  save();
  setStatus('Saved.');
};

window.csPush = async () => {
  const pass = document.getElementById('cs-pass')?.value || '';
  if (!pass) { setStatus('Enter a passphrase', true); return; }
  window.csSaveCfg();
  try {
    setStatus('Pushing…');
    const ts = await pushSync(pass);
    setStatus('Pushed ✓ at ' + new Date(ts).toLocaleString());
  } catch (e) { setStatus(e.message, true); }
};

window.csPull = async () => {
  const pass = document.getElementById('cs-pass')?.value || '';
  if (!pass) { setStatus('Enter a passphrase', true); return; }
  window.csSaveCfg();
  if (!confirm('Pull will overwrite local data with the remote snapshot. Continue?')) return;
  try {
    setStatus('Pulling…');
    const payload = await pullSync(pass);
    await applyPulledPayload(payload);
    setStatus('Pulled ✓ at ' + new Date().toLocaleString());
  } catch (e) { setStatus(e.message, true); }
};

window.csCheck = async () => {
  window.csSaveCfg();
  try {
    const info = await checkRemoteInfo();
    if (!info) setStatus('No remote backup found.', true);
    else setStatus('Remote: ' + new Date(info.lastUpdated).toLocaleString());
  } catch (e) { setStatus(e.message, true); }
};

window.renderCloudSyncSection = renderCloudSyncSection;
