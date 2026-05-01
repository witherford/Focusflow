// Docs page — in-app documentation for FocusFlow features.
import { APP_VERSION } from '../../core/version.js';

const SECTIONS = [
  {
    id: 'welcome',
    title: '👋 Welcome',
    body: `<p>FocusFlow is a private, offline-first PWA for habits, deep work, training, sleep, journalling, and weekly reflection. All data lives on your device by default; cloud sync is optional and end-to-end encrypted.</p>
    <ul>
      <li><b>Dashboard</b> — your at-a-glance home.</li>
      <li><b>Habits</b> — daily / time-blocked / all-day tracking with streaks.</li>
      <li><b>Insights</b> — heatmaps, sleep log, AI weekly review.</li>
      <li><b>Settings → Backup</b> — export, import, encrypted backup, cloud sync.</li>
    </ul>
    <p>The bottom nav (mobile) is configurable in Settings. Side nav (desktop) shows everything.</p>`
  },
  {
    id: 'dashboard',
    title: '📊 Dashboard',
    body: `<p>Greeting + streak chip up top. Below that:</p>
    <ul>
      <li><b>All-day habits</b> — big rings. Tap to add count, double-tap to complete, hold to reset.</li>
      <li><b>Up next / Time-blocks</b> — habits scheduled for the morning / midday / evening.</li>
      <li><b>Bad-habit tracker</b> — tap to log an indulgence; the chip shows your clean-streak.</li>
      <li><b>Quick actions</b> — start a focus session, meditate, log weight.</li>
    </ul>
    <p>Hide / re-order widgets from <i>Settings → Dashboard widgets</i>.</p>`
  },
  {
    id: 'habits',
    title: '✅ Habits',
    body: `<p>Three habit shapes:</p>
    <ul>
      <li><b>Plain</b> — done / not done.</li>
      <li><b>Counter</b> — increment to a target (8 cups water, 30 min reading).</li>
      <li><b>Cumulative</b> — adds without a cap (steps).</li>
    </ul>
    <p><b>Active days</b> — pick which weekdays a habit applies to. Off-days don't break the streak.</p>
    <p><b>Linked habits</b> — tie a habit to a built-in tool (Meditate / Train / Deep Work / Sleep / Journal / Weight). Completing a session there ticks the habit automatically.</p>
    <p><b>Streak goals</b> — set a target streak length. <b>Streak freezes</b> — earn one every 14 days; auto-spent on a missed day, max 3 stored.</p>
    <p>Drag-and-drop to re-order. Tap-and-hold an item for edit / delete.</p>`
  },
  {
    id: 'goals',
    title: '🎯 Goals',
    body: `<p>Long-form goals with milestones, target date, progress bar, and category. Goals appear on the dashboard and on Insights.</p>`
  },
  {
    id: 'projects',
    title: '📁 Projects & Tasks',
    body: `<p>Hierarchical projects → tasks. Each task supports priority, due date, recurrence (daily/weekly/monthly), snooze, and notes. The "Due today" / "Overdue" lanes pull from across all projects.</p>
    <p>Use <i>Import tasks</i> in Settings to bulk-load from a Notion / CSV export — header aliases auto-map.</p>`
  },
  {
    id: 'training',
    title: '🏋️ Training',
    body: `<p>Routine-based training with progressive overload baked in.</p>
    <ul>
      <li>Build routines with sections (Warm-up, Main, Accessories, Cardio).</li>
      <li>Pick movement, set count, target reps + RPE / weight.</li>
      <li>"Today" view shows the active routine for the current weekday.</li>
      <li>Workout fullscreen: rest timer, set logger, plate maths.</li>
      <li>Compound starting weights + automatic +2.5 kg suggestions when last session went well.</li>
    </ul>`
  },
  {
    id: 'deepwork',
    title: '🧠 Deep Work',
    body: `<p>Pomodoro-style focus timer with named presets, ambient sound, and a fullscreen mode (Start / Pause / Reset). Sessions log to history; Insights aggregates total focus minutes.</p>
    <p>Toggle "log incremental" to count partial sessions when you stop early.</p>`
  },
  {
    id: 'meditation',
    title: '🧘 Meditation',
    body: `<p>Timer + breath presets (box / 4-7-8 / coherent) + guided scripts (TTS). Soft singing-bowl chimes start and end the session. Heatmaps show monthly consistency.</p>`
  },
  {
    id: 'sleep',
    title: '😴 Sleep',
    body: `<p>Log bed-time, wake-time, and quality. Insights → Sleep log shows a bar chart with an 8 h reference line and selectable range (7 d / 14 d / 1 m / 3 m / 6 m / 12 m / all).</p>`
  },
  {
    id: 'weight',
    title: '⚖️ Weight & Body',
    body: `<p>Daily weight log + body measurement fields (waist, chest, arms, etc.). Insights overlays trend line + 7-day moving average.</p>`
  },
  {
    id: 'journal',
    title: '📓 Journal',
    body: `<p>Free-form daily entries with mood + tags. Use the "Gratitude" template for a quick three-line entry.</p>`
  },
  {
    id: 'insights',
    title: '📈 Insights',
    body: `<p>Top of page: <b>Level / XP card</b> + <b>AI weekly review</b>. Below: heatmaps, streak overview, sleep log, weight chart, badge cabinet, and stats moved out of the dashboard.</p>
    <p>The AI review uses your profile preferences (tone, focus areas) and the week's logs. Requires an API key in Profile → AI.</p>`
  },
  {
    id: 'gamification',
    title: '🏅 XP, Levels & Badges',
    body: `<p>Each completion awards XP (chip shown beside every habit / task). Level <code>L</code> needs <code>L × 100</code> XP. Badges unlock at milestones — 7 / 30 / 100-day streaks, 50 / 100 tasks, level 5 / 10 / 20 / 25 / 50, etc.</p>`
  },
  {
    id: 'reminders',
    title: '🔔 Reminders',
    body: `<p>Schedule local notifications per habit. On iOS / Android (via Capacitor wrap) reminders fire even when the app is closed; on web PWA they fire while the tab is alive or installed as standalone.</p>`
  },
  {
    id: 'backup',
    title: '💾 Backups & data',
    body: `<p>Settings → Backup:</p>
    <ul>
      <li><b>Export JSON</b> — plain-text dump of all data.</li>
      <li><b>Export encrypted</b> — AES-GCM-256 with PBKDF2-SHA-256 (200 k iterations) from a passphrase.</li>
      <li><b>Import</b> — auto-detects encrypted vs plain.</li>
      <li><b>Wipe</b> — full reset.</li>
    </ul>`
  },
  {
    id: 'cloud-sync',
    title: '☁️ Cloud sync — Cloudflare Worker setup',
    body: `<p>FocusFlow uses an end-to-end-encrypted blob store on a free Cloudflare Worker + D1 database. The server only sees ciphertext.</p>
    <h4>1. Create a Cloudflare account</h4>
    <p>Sign up free at <code>dash.cloudflare.com</code>. Install Wrangler:</p>
    <pre><code>npm install -g wrangler
wrangler login</code></pre>
    <h4>2. Create the D1 database</h4>
    <pre><code>cd cloud-sync-worker
wrangler d1 create focusflow-sync</code></pre>
    <p>Copy the printed <code>database_id</code> into <code>wrangler.toml</code>.</p>
    <h4>3. Initialise the schema</h4>
    <pre><code>wrangler d1 execute focusflow-sync --file=./schema.sql</code></pre>
    <h4>4. Deploy the worker</h4>
    <pre><code>wrangler deploy</code></pre>
    <p>Wrangler prints the worker URL, e.g. <code>https://focusflow-sync.your-name.workers.dev</code>.</p>
    <h4>5. Wire FocusFlow</h4>
    <p>Open <i>Settings → Cloud sync</i>. Paste the worker URL, set a long passphrase, and tap <b>Enable</b>. The device generates a sync ID; use the same passphrase + ID on every device.</p>
    <h4>6. Sync</h4>
    <p>Pull / push from the same panel. Auto-sync runs every 15 minutes when the app is foregrounded. Conflicts use last-writer-wins by default.</p>
    <p><b>Privacy:</b> the worker stores only an opaque blob; even Cloudflare staff can't read it without your passphrase.</p>`
  },
  {
    id: 'updates',
    title: '🔄 Updates',
    body: `<p>The PWA service-worker auto-checks for new versions. Settings → About shows current vs latest. Tap <b>Update</b> to reload into the new build. Capacitor wraps update via the App Store / Play Store.</p>`
  },
];

export function renderDocs() {
  const el = document.getElementById('docs-body'); if (!el) return;
  const toc = `<div class="card"><div class="card-title">Sections</div>
    <div class="docs-toc">${SECTIONS.map(s => `<a href="#docs-${s.id}">${s.title}</a>`).join('')}</div>
    <div style="font-size:11px;color:var(--text3);margin-top:10px">FocusFlow V${APP_VERSION}</div>
  </div>`;
  const sections = SECTIONS.map(s => `<div class="card docs-section" id="docs-${s.id}">
    <div class="card-title">${s.title}</div>
    <div class="docs-body">${s.body}</div>
  </div>`).join('');
  el.innerHTML = toc + sections;
}

window.renderDocs = renderDocs;
