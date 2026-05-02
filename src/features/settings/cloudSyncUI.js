// Cloud sync settings card.
import { S } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import {
  generateSyncCode, pushSync, pullSync, applyPulledPayload, checkRemoteInfo,
  rememberKey, forgetKey, hasCachedKey,
} from '../../core/cloudSync.js';

function cfg() {
  if (!S.settings) S.settings = {};
  if (!S.settings.sync) S.settings.sync = { url: '', code: '', lastSync: 0, autoSync: false, dirtySince: 0 };
  return S.settings.sync;
}

const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS blobs (sync_code TEXT PRIMARY KEY, ciphertext TEXT NOT NULL, last_updated INTEGER NOT NULL, size_bytes INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_blobs_updated ON blobs(last_updated);`;

// Step shape: { n, title, body, sub: [strings], cmd: '...' }
// "sub" = numbered (a/b/c…) sub-steps with very explicit click-by-click instructions
const DASHBOARD_STEPS = [
  {
    n: 1,
    title: 'Open Cloudflare in a new browser tab',
    body: `Click this link, then sign in. If you don't have an account yet, click <strong>Sign up</strong>, verify your email, and come back here.`,
    sub: [
      `Open <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">https://dash.cloudflare.com</a> in a new tab.`,
      `Sign in with your email + password.`,
    ],
  },
  {
    n: 2,
    title: 'Create the database',
    body: `You're making a small storage area for your encrypted backup. It's free.`,
    sub: [
      `On the left sidebar, click <strong>Workers &amp; Pages</strong>.`,
      `In the row of tabs near the top, click <strong>D1 SQL Database</strong>.`,
      `Click the blue <strong>Create</strong> button on the right.`,
      `In the "Database name" box, type exactly: <code>focusflow-sync</code>`,
      `Click <strong>Create</strong> at the bottom. Wait a few seconds — the page will change to show your new database.`,
    ],
  },
  {
    n: 3,
    title: 'Create the storage table',
    body: `Tells the database what shape your data will be. Copy the SQL command below and run it in Cloudflare.`,
    sub: [
      `On the database page, click the <strong>Console</strong> tab.`,
      `Click the 📋 button below to copy the SQL.`,
      `Click in the big SQL box on Cloudflare and paste (Ctrl+V).`,
      `Click <strong>Execute</strong> on the right.`,
      `Click the <strong>Tables</strong> tab. You should now see "blobs" listed. ✓`,
    ],
    cmd: SCHEMA_SQL,
  },
  {
    n: 4,
    title: 'Create the worker',
    body: `The worker is the little program that talks to the database.`,
    sub: [
      `Click <strong>Workers &amp; Pages</strong> on the left sidebar again.`,
      `Click the blue <strong>Create</strong> button in the top right.`,
      `Choose <strong>Hello World</strong> (the simplest template) and click <strong>Get started</strong>.`,
      `Leave the suggested name (or change it if you want) and click <strong>Deploy</strong>.`,
      `When it says "Success!" click <strong>Edit code</strong> in the top right.`,
    ],
  },
  {
    n: 5,
    title: 'Replace the worker code',
    body: `You'll paste in FocusFlow's worker code, replacing the default "Hello World" example.`,
    sub: [
      `In Cloudflare's editor, click anywhere in the code on the left, then press <strong>Ctrl+A</strong> (select all) and <strong>Delete</strong>. The code area should now be empty.`,
      `Open File Explorer and find this file: <code style="word-break:break-all">cloud-sync-worker/index.js</code> in the FocusFlow project folder.`,
      `Right-click the file → <strong>Open with</strong> → <strong>Notepad</strong>.`,
      `In Notepad, press <strong>Ctrl+A</strong> then <strong>Ctrl+C</strong> to copy.`,
      `Click in the empty Cloudflare code area, press <strong>Ctrl+V</strong> to paste.`,
      `Click <strong>Save and deploy</strong> in the top right. Confirm if asked.`,
    ],
  },
  {
    n: 6,
    title: 'Connect the worker to the database',
    body: `<strong style="color:var(--rose)">⚠ This is the step almost everyone forgets.</strong> Without it, the worker doesn't know about the database and pushes will fail.`,
    sub: [
      `Click the back arrow in the top left (or click the worker name) to leave the editor.`,
      `Click the <strong>Settings</strong> tab.`,
      `Look for <strong>Bindings</strong> in the left sub-menu (or scroll down to <strong>Variables and Secrets</strong> → <strong>D1 database bindings</strong>).`,
      `Click <strong>Add binding</strong> → choose <strong>D1 database</strong>.`,
      `In the "Variable name" box, type exactly: <code>DB</code> (uppercase D, uppercase B — only those two letters).`,
      `In the "D1 database" dropdown, pick <strong>focusflow-sync</strong>.`,
      `Click <strong>Deploy</strong> (or <strong>Save</strong>). Wait until it says it's deployed.`,
    ],
  },
  {
    n: 7,
    title: 'Copy the worker URL into FocusFlow',
    body: `The URL is the worker's address — that's where FocusFlow sends its encrypted backup.`,
    sub: [
      `On the worker overview page, find the URL near the top. It ends in <code>workers.dev</code>.`,
      `Click the URL, or right-click it and choose <strong>Copy link</strong>.`,
      `Come back to this FocusFlow tab.`,
      `Click the <strong>Worker URL</strong> box above and paste (Ctrl+V).`,
    ],
  },
  {
    n: 8,
    title: 'Test the connection',
    body: `Make sure everything is wired up correctly before we encrypt anything.`,
    sub: [
      `Click the <strong>🔧 Test connection</strong> button below.`,
      `Wait a few seconds. You should see <strong style="color:var(--mint)">"All green — safe to Push"</strong>.`,
      `If you see a red ✗, read the message — it tells you exactly which step needs fixing.`,
    ],
  },
  {
    n: 9,
    title: 'First push (and turn on auto-sync)',
    body: `From now on FocusFlow will keep itself backed up automatically. You only type the passphrase once on each device.`,
    sub: [
      `Click <strong>↻ New</strong> next to "Sync code" to generate a code.`,
      `Type a passphrase you'll remember. Long is good — a sentence works well. <strong style="color:var(--rose)">Write it down somewhere safe — if you lose it, the backup is unrecoverable.</strong>`,
      `Tick <strong>Remember on this device</strong>.`,
      `Tick <strong>Auto-sync changes</strong>.`,
      `Click <strong>⬆ Push</strong>. You should see "Pushed ✓".`,
      `That's it — you're done. Use FocusFlow normally; it will sync silently in the background.`,
    ],
  },
];

const SETUP_STEPS = [
  {
    n: 1,
    title: 'Install Wrangler (Cloudflare CLI)',
    body: `Need <a href="https://nodejs.org" target="_blank" rel="noopener">Node.js</a> first. Then:`,
    cmd: 'npm i -g wrangler && wrangler login',
  },
  {
    n: 2,
    title: 'Open a terminal in <code>cloud-sync-worker/</code>',
    body: `Inside the FocusFlow project folder.`,
    cmd: 'cd cloud-sync-worker',
  },
  {
    n: 3,
    title: 'Create the D1 database',
    body: `Copy the <code>database_id</code> printed in the output.`,
    cmd: 'wrangler d1 create focusflow-sync',
  },
  {
    n: 4,
    title: 'Paste the ID into <code>wrangler.toml</code>',
    body: `Replace <code>REPLACE_WITH_DB_ID_FROM_WRANGLER_D1_CREATE</code> in <code>cloud-sync-worker/wrangler.toml</code>.`,
  },
  {
    n: 5,
    title: 'Apply the schema',
    body: `<code>--remote</code> is essential — without it the table is only created locally.`,
    cmd: 'wrangler d1 execute focusflow-sync --remote --file=./schema.sql',
  },
  {
    n: 6,
    title: 'Deploy',
    body: `Copy the printed <code>https://&lt;name&gt;.workers.dev</code> URL into the field above.`,
    cmd: 'wrangler deploy',
  },
  {
    n: 7,
    title: 'Test, remember, auto-sync',
    body: `Click 🔧 Test connection. Then ↻ New, type passphrase, tick Remember + Auto-sync, click ⬆ Push.`,
  },
];

const TROUBLESHOOTING = [
  { sym: '<code>Failed to fetch</code>', cause: 'Worker URL is wrong, worker isn\'t deployed, or the deployed worker is the empty Cloudflare-dashboard stub. Re-do steps 4–6 of the dashboard guide.' },
  { sym: '<code>HTTP 500</code> on Push', cause: 'D1 binding missing or the <code>blobs</code> table doesn\'t exist. Most likely cause: you skipped step 6 (the <code>DB</code> binding). Worker → Settings → Bindings — make sure there\'s a binding named exactly <code>DB</code> pointing to <code>focusflow-sync</code>.' },
  { sym: '<code>HTTP 404 not_found</code> on Pull', cause: 'No data has been pushed for this sync code yet. Push from one device first, then pull from another.' },
  { sym: '<code>HTTP 400 bad_code</code>', cause: 'Sync code is too short or has invalid characters. Click ↻ New to regenerate.' },
  { sym: 'Pull says wrong passphrase', cause: 'Passphrase or sync code doesn\'t match what was used when pushing. Both must be identical.' },
  { sym: 'Auto-sync isn\'t firing', cause: 'Need all of: Worker URL set, sync code set, "Remember on this device" ticked (and a successful push since), and "Auto-sync changes" ticked. Auto-sync waits 30 seconds after the last edit before pushing.' },
];

function renderSteps(steps) {
  return steps.map(s => {
    const sub = (s.sub && s.sub.length)
      ? `<ol style="margin:6px 0 0 0;padding-left:20px;font-size:12px;color:var(--text2);line-height:1.6">${s.sub.map(x => `<li style="margin-bottom:3px">${x}</li>`).join('')}</ol>`
      : '';
    const cmd = s.cmd
      ? `<div style="display:flex;gap:6px;align-items:center;margin-top:6px">
          <code style="flex:1;padding:6px 8px;background:var(--bg2);border-radius:4px;font-size:11px;font-family:'DM Mono',monospace;overflow-x:auto;white-space:nowrap">${s.cmd}</code>
          <button class="btn btn-sm" onclick="csCopy(this, ${JSON.stringify(s.cmd).replace(/"/g, '&quot;')})" title="Copy">📋</button>
        </div>`
      : '';
    return `
      <div style="margin-bottom:14px;padding-left:32px;position:relative">
        <div style="position:absolute;left:0;top:0;width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center">${s.n}</div>
        <div style="font-weight:600;font-size:13px;margin-bottom:3px">${s.title}</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.5">${s.body}</div>
        ${sub}
        ${cmd}
      </div>
    `;
  }).join('');
}

function renderTroubleshooting() {
  return TROUBLESHOOTING.map(t => `
    <div style="margin-bottom:8px;font-size:12px;line-height:1.5">
      <div style="color:var(--rose)">${t.sym}</div>
      <div style="color:var(--text2);padding-left:8px">${t.cause}</div>
    </div>
  `).join('');
}

let _cachedKeyState = false;

export async function renderCloudSyncSection() {
  const el = document.getElementById('cloud-sync-section'); if (!el) return;
  const c = cfg();
  _cachedKeyState = await hasCachedKey();
  const remembered = _cachedKeyState;
  const passField = remembered
    ? `<div style="display:flex;gap:6px;align-items:center">
         <div style="flex:1;font-size:12px;color:var(--mint);padding:8px;background:var(--bg2);border-radius:4px">🔑 Passphrase remembered on this device</div>
         <button class="btn btn-sm" onclick="csForget()" title="Stop remembering passphrase on this device">Forget</button>
       </div>`
    : `<div style="display:flex;gap:6px;align-items:flex-start;flex-direction:column">
         <input type="password" id="cs-pass" placeholder="Long, memorable phrase" style="width:100%">
         <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);cursor:pointer">
           <input type="checkbox" id="cs-remember" checked style="margin:0">
           <span>Remember on this device (skip passphrase prompt next time)</span>
         </label>
       </div>`;

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
    <div class="form-row"><label>Passphrase ${remembered ? '' : '<span style="font-weight:400;color:var(--text3)">(not stored unless you tick Remember)</span>'}</label>${passField}</div>

    <div class="form-row" style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
        <input type="checkbox" id="cs-autosync" ${c.autoSync ? 'checked' : ''} style="margin:0">
        <span>🔄 Auto-sync changes <span style="color:var(--text3)">(silently push 30s after each edit)</span></span>
      </label>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn btn-primary" onclick="csPush()">⬆ Push</button>
      <button class="btn" onclick="csPull()">⬇ Pull</button>
      <button class="btn" onclick="csDiagnose()">🔧 Test connection</button>
      <button class="btn" onclick="csCheck()">🔍 Check remote</button>
      <button class="btn" onclick="csSaveCfg()">💾 Save settings</button>
    </div>
    <div id="cs-status" style="font-size:12px;color:var(--text3);margin-top:8px;min-height:16px;line-height:1.6">${c.lastSync ? 'Last sync: ' + new Date(c.lastSync).toLocaleString() : 'Never synced'}</div>

    <details style="margin-top:14px;padding:10px;background:var(--bg2);border-radius:6px" ${remembered ? '' : 'open'}>
      <summary style="cursor:pointer;font-weight:600;font-size:13px">📖 First-time setup — click-by-click <span style="font-weight:400;color:var(--text3);font-size:11px">(no CLI install, ≈10 min)</span></summary>
      <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">
        <div style="font-size:12px;color:var(--text3);margin-bottom:14px;line-height:1.5">
          Follow these 9 steps in order. Every click is spelled out — you don't need any technical background.
        </div>
        ${renderSteps(DASHBOARD_STEPS)}
      </div>
    </details>

    <details style="margin-top:8px;padding:10px;background:var(--bg2);border-radius:6px">
      <summary style="cursor:pointer;font-weight:600;font-size:13px">⌨️ Setup with Wrangler CLI <span style="font-weight:400;color:var(--text3);font-size:11px">(faster if you have Node)</span></summary>
      <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">
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
  c.autoSync = !!document.getElementById('cs-autosync')?.checked;
  save();
  setStatus('Saved.');
};

async function getOrPromptKey() {
  if (_cachedKeyState) return null; // cached — pushSync/pullSync will use it
  const pass = document.getElementById('cs-pass')?.value || '';
  if (!pass) { setStatus('Enter a passphrase', true); return undefined; }
  const remember = !!document.getElementById('cs-remember')?.checked;
  if (remember) {
    try { await rememberKey(pass); _cachedKeyState = true; } catch (e) { console.warn('rememberKey failed:', e); }
  }
  return pass;
}

window.csPush = async () => {
  const pass = await getOrPromptKey();
  if (pass === undefined) return;
  window.csSaveCfg();
  try {
    setStatus('Pushing…');
    const ts = await pushSync(pass);
    setStatus('Pushed ✓ at ' + new Date(ts).toLocaleString());
    if (_cachedKeyState) renderCloudSyncSection();
  } catch (e) { setStatus(diagnoseError(e) || e.message, true); }
};

window.csPull = async () => {
  const pass = await getOrPromptKey();
  if (pass === undefined) return;
  window.csSaveCfg();
  if (!confirm('Pull will overwrite local data with the remote snapshot. Continue?')) return;
  try {
    setStatus('Pulling…');
    const payload = await pullSync(pass);
    await applyPulledPayload(payload);
    setStatus('Pulled ✓ at ' + new Date().toLocaleString());
    if (_cachedKeyState) renderCloudSyncSection();
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

window.csForget = async () => {
  if (!confirm('Forget the remembered passphrase on this device? You\'ll need to type it again next time.')) return;
  await forgetKey();
  _cachedKeyState = false;
  await renderCloudSyncSection();
  setStatus('Passphrase forgotten on this device.');
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

  if (!c.url) { out(['✗ Worker URL is empty. Paste the URL from your worker\'s overview page.']); return; }
  let parsedUrl;
  try { parsedUrl = new URL(c.url); } catch { out(['✗ Worker URL isn\'t a valid URL.']); return; }
  if (parsedUrl.protocol !== 'https:') { out(['✗ Worker URL must start with <code>https://</code>.']); return; }
  lines.push('✓ URL looks valid.'); out(lines);

  const base = c.url.replace(/\/$/, '');

  let rootRes;
  try {
    rootRes = await fetch(base + '/');
  } catch (e) {
    lines.push('✗ Network/CORS error reaching worker root. Most likely causes:');
    lines.push('&nbsp;&nbsp;• The URL is wrong (typo or copied from somewhere odd).');
    lines.push('&nbsp;&nbsp;• The worker isn\'t deployed yet.');
    lines.push('&nbsp;&nbsp;• The deployed worker is the default "Hello World" — you need to paste in FocusFlow\'s code (step 5 of the setup guide).');
    out(lines); return;
  }
  if (!rootRes.ok) { lines.push('✗ Worker root returned HTTP ' + rootRes.status + '. Worker may not be deployed.'); out(lines); return; }
  const rootText = await rootRes.text().catch(() => '');
  if (!/FocusFlow sync worker/i.test(rootText)) {
    lines.push('✗ Worker is reachable but doesn\'t look like FocusFlow\'s sync worker.');
    lines.push('&nbsp;&nbsp;Response: <code>' + (rootText.slice(0, 80) || '(empty)').replace(/</g, '&lt;') + '…</code>');
    lines.push('&nbsp;&nbsp;Re-do step 5 of the setup guide — paste in the contents of <code>cloud-sync-worker/index.js</code>.');
    out(lines); return;
  }
  lines.push('✓ Worker reachable and identifies as FocusFlow sync.'); out(lines);

  const probeCode = c.code && c.code.length >= 12 ? c.code : 'diagnose_probe_code';
  let infoRes;
  try {
    infoRes = await fetch(base + '/sync/info?code=' + encodeURIComponent(probeCode));
  } catch (e) {
    lines.push('✗ <code>/sync/info</code> threw a network/CORS error. Re-deploy the worker.');
    out(lines); return;
  }

  if (infoRes.status === 500) {
    const body = await infoRes.text().catch(() => '');
    lines.push('✗ <code>/sync/info</code> returned HTTP 500.');
    if (/no such table/i.test(body)) {
      lines.push('&nbsp;&nbsp;The <code>blobs</code> table doesn\'t exist. Re-do step 3 of the dashboard guide (paste the SQL into D1 → Console → Execute).');
    } else {
      lines.push('&nbsp;&nbsp;Most likely the D1 binding is missing. Worker → Settings → Bindings — add a binding named <code>DB</code> pointing to <code>focusflow-sync</code> (step 6 of the dashboard guide).');
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
