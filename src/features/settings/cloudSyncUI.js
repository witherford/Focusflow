// Cloud sync settings card.
import { S } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { generateSyncCode, pushSync, pullSync, applyPulledPayload, checkRemoteInfo } from '../../core/cloudSync.js';

function cfg() { if (!S.settings) S.settings = {}; if (!S.settings.sync) S.settings.sync = { url: '', code: '', lastSync: 0 }; return S.settings.sync; }

const DASHBOARD_STEPS = [
  {
    n: 1,
    title: 'Create the D1 database',
    body: `In the Cloudflare dashboard: <strong>Workers &amp; Pages</strong> → <strong>D1</strong> (left sidebar) → <strong>Create database</strong>. Name it <code>focusflow-sync</code> and click Create.`,
  },
  {
    n: 2,
    title: 'Create the <code>blobs</code> table',
    body: `Open the database you just created → <strong>Console</strong> tab. Paste the SQL below and click Execute. Confirm <code>blobs</code> appears in the <strong>Tables</strong> tab.`,
    cmd: `CREATE TABLE IF NOT EXISTS blobs (sync_code TEXT PRIMARY KEY, ciphertext TEXT NOT NULL, last_updated INTEGER NOT NULL, size_bytes INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_blobs_updated ON blobs(last_updated);`,
  },
  {
    n: 3,
    title: 'Replace the Worker code',
    body: `Open your existing Worker (or create one: <strong>Workers &amp; Pages</strong> → <strong>Create</strong> → <strong>Hello World</strong> template) → <strong>Edit code</strong>. Delete the default code, paste the contents of <code>cloud-sync-worker/index.js</code> from this project, and click <strong>Save and deploy</strong>.`,
  },
  {
    n: 4,
    title: 'Bind the D1 database to the Worker',
    body: `<strong style="color:var(--rose)">This is the step most people miss.</strong> Without it, <code>env.DB</code> is undefined and pushes return HTTP 500. Worker → <strong>Settings</strong> → <strong>Bindings</strong> (or <strong>Variables</strong> → <strong>D1 database bindings</strong>) → <strong>Add binding</strong>. Variable name must be exactly <code>DB</code> (uppercase). Database: <code>focusflow-sync</code>. Save — the worker redeploys automatically.`,
  },
  {
    n: 5,
    title: 'Copy the Worker URL',
    body: `At the top of the Worker page, copy the URL (looks like <code>https://&lt;name&gt;.&lt;you&gt;.workers.dev</code>) and paste it into the <strong>Worker URL</strong> field above.`,
  },
  {
    n: 6,
    title: 'Test it',
    body: `Click <strong>🔧 Test connection</strong> below. If everything is green, generate a sync code, type a passphrase you'll remember, and click <strong>⬆ Push</strong>.`,
  },
];

const SETUP_STEPS = [
  {
    n: 1,
    title: 'Install Wrangler (Cloudflare CLI)',
    body: `A Worker created from the Cloudflare dashboard is just an empty "Hello World" — it has no <code>/sync/push</code> route and no D1 database, which is why pushes fail with <em>Failed to fetch</em>. You need to deploy <em>this project's</em> worker code with the <code>wrangler</code> CLI.`,
    cmd: 'npm i -g wrangler && wrangler login',
  },
  {
    n: 2,
    title: 'Open a terminal in <code>cloud-sync-worker/</code>',
    body: `Inside the FocusFlow project folder. Wrangler reads <code>wrangler.toml</code> from the current directory.`,
    cmd: 'cd cloud-sync-worker',
  },
  {
    n: 3,
    title: 'Create the D1 database',
    body: `Run the command below. The output ends with a block like:<br><code style="display:block;margin-top:4px;padding:6px;background:var(--bg2);border-radius:4px;font-size:11px">[[d1_databases]]<br>binding = "DB"<br>database_name = "focusflow-sync"<br>database_id = "abc123-..."</code>Copy the <code>database_id</code> value.`,
    cmd: 'wrangler d1 create focusflow-sync',
  },
  {
    n: 4,
    title: 'Paste the ID into <code>wrangler.toml</code>',
    body: `Open <code>cloud-sync-worker/wrangler.toml</code> and replace <code>REPLACE_WITH_DB_ID_FROM_WRANGLER_D1_CREATE</code> with the ID you just copied. Save the file.`,
  },
  {
    n: 5,
    title: 'Apply the database schema',
    body: `Creates the <code>blobs</code> table on Cloudflare's servers. The <code>--remote</code> flag is essential — without it the table is only created locally and pushes will return HTTP 500 ("no such table: blobs").`,
    cmd: 'wrangler d1 execute focusflow-sync --remote --file=./schema.sql',
  },
  {
    n: 6,
    title: 'Deploy the worker',
    body: `Publishes the code. The output prints a URL like <code>https://focusflow-sync.&lt;you&gt;.workers.dev</code> — copy it into the <strong>Worker URL</strong> field above.`,
    cmd: 'wrangler deploy',
  },
  {
    n: 7,
    title: 'Test it',
    body: `Click <strong>🔧 Test connection</strong> below. If everything is green, generate a sync code, type a passphrase you'll remember, and click <strong>⬆ Push</strong>.`,
  },
];

const TROUBLESHOOTING = [
  { sym: '<code>Failed to fetch</code>', cause: 'Worker URL is wrong, worker isn\'t deployed, or the deployed worker is the empty Cloudflare-dashboard stub (no CORS, no <code>/sync/*</code> routes). Run <code>wrangler deploy</code> from <code>cloud-sync-worker/</code>.' },
  { sym: '<code>HTTP 500</code> on Push', cause: 'D1 binding missing or the <code>blobs</code> table doesn\'t exist. Dashboard path: check the Worker → Settings → Bindings has a <code>DB</code> binding pointing to <code>focusflow-sync</code>. CLI path: re-run the schema step with <code>--remote</code>.' },
  { sym: '<code>HTTP 404 not_found</code> on Pull', cause: 'No data has been pushed for this sync code yet. Push from one device first.' },
  { sym: '<code>HTTP 400 bad_code</code>', cause: 'Sync code must be 12–64 chars, letters/digits/<code>_</code>/<code>-</code> only. Click ↻ New to regenerate.' },
  { sym: 'Pull throws <code>OperationError</code>', cause: 'Wrong passphrase, or the blob was encrypted with a different sync code. Both must match exactly.' },
];

function renderSteps(steps = SETUP_STEPS) {
  return steps.map(s => `
    <div style="margin-bottom:12px;padding-left:28px;position:relative">
      <div style="position:absolute;left:0;top:0;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center">${s.n}</div>
      <div style="font-weight:600;font-size:13px;margin-bottom:3px">${s.title}</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.5">${s.body}</div>
      ${s.cmd ? `<div style="display:flex;gap:6px;align-items:center;margin-top:6px">
        <code style="flex:1;padding:6px 8px;background:var(--bg2);border-radius:4px;font-size:11px;font-family:'DM Mono',monospace;overflow-x:auto;white-space:nowrap">${s.cmd}</code>
        <button class="btn btn-sm" onclick="csCopy(this, ${JSON.stringify(s.cmd).replace(/"/g, '&quot;')})" title="Copy">📋</button>
      </div>` : ''}
    </div>
  `).join('');
}

function renderTroubleshooting() {
  return TROUBLESHOOTING.map(t => `
    <div style="margin-bottom:8px;font-size:12px;line-height:1.5">
      <div style="color:var(--rose)">${t.sym}</div>
      <div style="color:var(--text2);padding-left:8px">${t.cause}</div>
    </div>
  `).join('');
}

export function renderCloudSyncSection() {
  const el = document.getElementById('cloud-sync-section'); if (!el) return;
  const c = cfg();
  el.innerHTML = `
    <div class="card-header"><div class="card-title">☁️ Cloud sync</div><div style="font-size:11px;color:var(--text3)">end-to-end encrypted</div></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.5">
      Encrypted backup to your own Cloudflare Worker. Free forever. The server only sees ciphertext; lose the passphrase and the data is unrecoverable.
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
      <button class="btn" onclick="csDiagnose()">🔧 Test connection</button>
      <button class="btn" onclick="csCheck()">🔍 Check remote</button>
      <button class="btn" onclick="csSaveCfg()">💾 Save settings</button>
    </div>
    <div id="cs-status" style="font-size:12px;color:var(--text3);margin-top:8px;min-height:16px;line-height:1.6">${c.lastSync ? 'Last sync: ' + new Date(c.lastSync).toLocaleString() : 'Never synced'}</div>

    <details style="margin-top:14px;padding:10px;background:var(--bg2);border-radius:6px" open>
      <summary style="cursor:pointer;font-weight:600;font-size:13px">📖 First-time setup — Dashboard only <span style="font-weight:400;color:var(--text3);font-size:11px">(no CLI install, ≈5 min, recommended)</span></summary>
      <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">
        <div style="font-size:12px;color:var(--text3);margin-bottom:12px;line-height:1.5">
          Do everything in your browser via the Cloudflare dashboard. No Node, no terminal.
        </div>
        ${renderSteps(DASHBOARD_STEPS)}
      </div>
    </details>

    <details style="margin-top:8px;padding:10px;background:var(--bg2);border-radius:6px">
      <summary style="cursor:pointer;font-weight:600;font-size:13px">⌨️ First-time setup — Wrangler CLI <span style="font-weight:400;color:var(--text3);font-size:11px">(alternative, requires Node)</span></summary>
      <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">
        <div style="font-size:12px;color:var(--text3);margin-bottom:12px;line-height:1.5">
          Faster if you have Node installed and prefer terminal commands. Run these in PowerShell, Command Prompt, Git Bash, or VS Code's terminal.
        </div>
        ${renderSteps(SETUP_STEPS)}
      </div>
    </details>

    <details style="margin-top:8px;padding:10px;background:var(--bg2);border-radius:6px">
      <summary style="cursor:pointer;font-weight:600;font-size:13px">🩺 Troubleshooting</summary>
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
        ${renderTroubleshooting()}
      </div>
    </details>
  `;
}

function setStatus(s, isErr) {
  const el = document.getElementById('cs-status');
  if (el) { el.innerHTML = s; el.style.color = isErr ? 'var(--rose)' : 'var(--text3)'; }
}

window.csCopy = async (btn, text) => {
  try {
    await navigator.clipboard.writeText(text);
    const old = btn.textContent; btn.textContent = '✓';
    setTimeout(() => { btn.textContent = old; }, 1200);
  } catch { btn.textContent = '✗'; }
};

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
  } catch (e) { setStatus(diagnoseError(e) || e.message, true); }
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
  } catch (e) {
    const msg = e?.name === 'OperationError'
      ? 'Wrong passphrase or corrupted blob (decryption failed).'
      : (diagnoseError(e) || e.message);
    setStatus(msg, true);
  }
};

window.csCheck = async () => {
  window.csSaveCfg();
  try {
    const info = await checkRemoteInfo();
    if (!info) setStatus('No remote backup found.', true);
    else setStatus('Remote: ' + new Date(info.lastUpdated).toLocaleString() + ' (' + info.sizeBytes + ' bytes)');
  } catch (e) { setStatus(diagnoseError(e) || e.message, true); }
};

function diagnoseError(e) {
  if (e instanceof TypeError && /fetch/i.test(e.message || '')) {
    return '✗ Failed to fetch — worker isn\'t reachable. Open <strong>🔧 Test connection</strong> for details, or <strong>📖 First-time setup</strong> if you haven\'t deployed the worker yet.';
  }
  return null;
}

window.csDiagnose = async () => {
  window.csSaveCfg();
  const c = cfg();
  const out = (lines) => setStatus(lines.join('<br>'));
  const lines = [];

  // Step 1: URL syntax
  if (!c.url) { out(['✗ Worker URL is empty. Paste the URL printed by <code>wrangler deploy</code>.']); return; }
  let parsedUrl;
  try { parsedUrl = new URL(c.url); } catch { out(['✗ Worker URL isn\'t a valid URL.']); return; }
  if (parsedUrl.protocol !== 'https:') { out(['✗ Worker URL must start with <code>https://</code>.']); return; }
  lines.push('✓ URL looks valid.'); out(lines);

  const base = c.url.replace(/\/$/, '');

  // Step 2: root reachable?
  let rootRes;
  try {
    rootRes = await fetch(base + '/');
  } catch (e) {
    lines.push('✗ Network/CORS error reaching worker root. Most likely causes:');
    lines.push('&nbsp;&nbsp;• The URL is wrong (typo, or you copied a dashboard preview URL).');
    lines.push('&nbsp;&nbsp;• The worker isn\'t deployed yet (run <code>wrangler deploy</code>).');
    lines.push('&nbsp;&nbsp;• The deployed worker is the Cloudflare-dashboard "Hello World" stub, which has no CORS headers.');
    out(lines); return;
  }
  if (!rootRes.ok) { lines.push('✗ Worker root returned HTTP ' + rootRes.status + '. Worker may not be deployed.'); out(lines); return; }
  const rootText = await rootRes.text().catch(() => '');
  if (!/FocusFlow sync worker/i.test(rootText)) {
    lines.push('✗ Worker is reachable but doesn\'t look like FocusFlow\'s sync worker.');
    lines.push('&nbsp;&nbsp;Response: <code>' + (rootText.slice(0, 80) || '(empty)').replace(/</g, '&lt;') + '…</code>');
    lines.push('&nbsp;&nbsp;Run <code>wrangler deploy</code> from <code>cloud-sync-worker/</code> to deploy the right code.');
    out(lines); return;
  }
  lines.push('✓ Worker reachable and identifies as FocusFlow sync.'); out(lines);

  // Step 3: D1 reachable?
  const probeCode = c.code && c.code.length >= 12 ? c.code : 'diagnose_probe_code';
  let infoRes;
  try {
    infoRes = await fetch(base + '/sync/info?code=' + encodeURIComponent(probeCode));
  } catch (e) {
    lines.push('✗ <code>/sync/info</code> threw a network/CORS error. The deployed worker is missing CORS or the route. Re-deploy.');
    out(lines); return;
  }

  if (infoRes.status === 500) {
    const body = await infoRes.text().catch(() => '');
    lines.push('✗ <code>/sync/info</code> returned HTTP 500.');
    if (/no such table/i.test(body)) {
      lines.push('&nbsp;&nbsp;The <code>blobs</code> table doesn\'t exist. Re-run step 5 with <code>--remote</code>:');
      lines.push('&nbsp;&nbsp;<code>wrangler d1 execute focusflow-sync --remote --file=./schema.sql</code>');
    } else {
      lines.push('&nbsp;&nbsp;D1 binding likely missing or table not created. Check <code>wrangler.toml</code> has the right <code>database_id</code> and that step 5 was run with <code>--remote</code>.');
      if (body) lines.push('&nbsp;&nbsp;Server said: <code>' + body.slice(0, 120).replace(/</g, '&lt;') + '</code>');
    }
    out(lines); return;
  }

  if (infoRes.status === 404 || infoRes.status === 400 || infoRes.ok) {
    lines.push('✓ D1 reachable (HTTP ' + infoRes.status + ' on probe — expected without prior push).');
    lines.push('<strong style="color:var(--mint)">All green — safe to Push.</strong>');
    out(lines); return;
  }

  lines.push('? <code>/sync/info</code> returned an unexpected HTTP ' + infoRes.status + '. Worker may be partially deployed.');
  out(lines);
};

window.renderCloudSyncSection = renderCloudSyncSection;
