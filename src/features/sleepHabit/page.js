// Wake/Bed habit tracking — first-class daily habit with on-time/late check-in,
// streak (resets on miss), per-week completion ring, and journal entry on miss.
import { S, today, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { progressRing } from '../../ui/progressRing.js';
import { closeModal } from '../../ui/modal.js';

const GRACE_MIN = 5; // ≤5 min late still counts as on-time

const KIND_META = {
  wake: { icon: '☀️', label: 'Wake up', verbs: { onTime: 'Woke up on time', late: 'Woke up late' }, targetField: 'wake' },
  bed:  { icon: '🌙', label: 'Bed time', verbs: { onTime: 'Gone to bed on time', late: 'Gone to bed late' }, targetField: 'bed' },
};

function ensureLog() { if (!S.sleepHabitLog) S.sleepHabitLog = {}; return S.sleepHabitLog; }

function targetTime(kind) {
  return S.profile?.[KIND_META[kind].targetField] || (kind === 'wake' ? '06:30' : '22:30');
}

function fmtT(t) { if (!t) return '—'; const [h, m] = t.split(':'); const hr = +h; return (hr === 0 ? 12 : hr > 12 ? hr - 12 : hr) + ':' + m + (hr >= 12 ? 'pm' : 'am'); }

// Minutes "now" is past target. For wake, late = current later than target.
// For bed, late = current later than target (treating after-midnight times as
// next-day "late" too, capped at 12h late so a morning open doesn't say
// "late by 18h" when the user simply hasn't checked in yet).
function lateMinsBetween(kind, target, actual) {
  if (!target || !actual) return 0;
  const [th, tm] = target.split(':').map(Number);
  const [ah, am] = actual.split(':').map(Number);
  let d = (ah * 60 + am) - (th * 60 + tm);
  if (kind === 'bed' && d < -12 * 60) d += 24 * 60; // crossed midnight
  return Math.max(0, d);
}

function nowHHMM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// ── Logging ─────────────────────────────────────────────────────────────────
export function logSleepHabit(kind, { onTime, actualTime, note, date } = {}) {
  if (!KIND_META[kind]) return;
  const log = ensureLog();
  const k = date || today();
  if (!log[k]) log[k] = {};
  const target = targetTime(kind);
  const at = actualTime || nowHHMM();
  const lateMins = onTime ? 0 : lateMinsBetween(kind, target, at);
  log[k][kind] = {
    onTime: !!onTime,
    actualTime: onTime ? target : at,
    lateMins,
    note: note || '',
    ts: Date.now(),
  };
  haptic(onTime ? 'light' : 'medium');
  save();
  window.toast?.(KIND_META[kind].icon + ' ' + (onTime ? 'On time ✓' : 'Logged'));
  rerender();
}

function rerender() {
  // Re-render dashboard cards + insights if mounted.
  renderWakeCard();
  renderBedCard();
  window.renderInsightsSleepLog?.();
  window.renderInsightsSleepHabit?.();
}

// ── Streak / completion ─────────────────────────────────────────────────────
// Streak walks back day-by-day:
//   onTime:true  → streak++
//   onTime:false → break
//   no entry     → skip (doesn't break, doesn't add)
// Cap 365.
export function calcSleepStreak(kind) {
  const log = ensureLog();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    const entry = log[k]?.[kind];
    if (!entry) continue;
    if (entry.onTime) streak++; else break;
  }
  return streak;
}

// done count this week (Mon-Sun) where onTime:true. Target = 7.
export function weeklyCompletion(kind) {
  const log = ensureLog();
  // Mon→Sun aligned with the app's UTC-ISO date keys. Walk back from today
  // (UTC) and count entries whose key falls in the current Mon→Sun window.
  const todayK = new Date().toISOString().split('T')[0];
  const todayDow = new Date(todayK + 'T00:00:00Z').getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMon = todayDow === 0 ? 6 : todayDow - 1;
  let done = 0;
  for (let i = 0; i <= daysSinceMon; i++) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    if (log[k]?.[kind]?.onTime) done++;
  }
  return { done, target: 7 };
}

export function todayEntry(kind) {
  return ensureLog()[today()]?.[kind] || null;
}

// ── Card rendering ──────────────────────────────────────────────────────────
function statusPill(kind) {
  const e = todayEntry(kind);
  if (!e) return '<span class="badge" style="background:var(--bg3);color:var(--text3)">⬜ Not checked in</span>';
  if (e.onTime) return '<span class="badge badge-green">✅ On time</span>';
  return `<span class="badge badge-rose">❌ Late by ${e.lateMins}m</span>`;
}

function cardHTML(kind) {
  const meta = KIND_META[kind];
  const t = targetTime(kind);
  const streak = calcSleepStreak(kind);
  const wk = weeklyCompletion(kind);
  const pct = wk.target ? (wk.done / wk.target) * 100 : 0;
  const ringColor = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--teal)' : 'var(--violet)';
  const ring = progressRing({ pct, size: 56, stroke: 5, color: ringColor, label: `${wk.done}/${wk.target}` });
  const streakChip = streak > 0
    ? `<span class="streak-status" title="Current streak"><span class="ss-num">${streak}</span><span class="ss-flame">🔥</span></span>`
    : `<span class="streak-status" title="No streak yet"><span class="ss-num ss-num-empty">—</span></span>`;
  return `<div class="card" style="cursor:pointer" onclick="openSleepCheckin('${kind}')">
    <div style="display:flex;align-items:center;gap:14px">
      ${ring}
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:15px">${meta.icon} ${meta.label}</div>
        <div style="font-size:12px;color:var(--text3);margin:2px 0 6px">Target ${fmtT(t)}</div>
        ${statusPill(kind)}
      </div>
      ${streakChip}
    </div>
  </div>`;
}

export function renderWakeCard() {
  const el = document.getElementById('dash-wake'); if (!el) return;
  el.innerHTML = cardHTML('wake');
}
export function renderBedCard() {
  const el = document.getElementById('dash-bed'); if (!el) return;
  el.innerHTML = cardHTML('bed');
}

// ── Modal flow ──────────────────────────────────────────────────────────────
export function openSleepCheckin(kind) {
  if (!KIND_META[kind]) return;
  const meta = KIND_META[kind];
  const target = targetTime(kind);
  const existing = todayEntry(kind);
  const m = document.getElementById('m-sleep-checkin'); if (!m) return;
  m.dataset.kind = kind;
  document.getElementById('msc-title').textContent = meta.icon + ' ' + meta.label + ' check-in';
  document.getElementById('msc-target').textContent = 'Target ' + fmtT(target);
  document.getElementById('msc-on-time-label').textContent = meta.verbs.onTime;
  document.getElementById('msc-late-label').textContent = meta.verbs.late;
  // Reset
  document.getElementById('msc-late-fields').style.display = 'none';
  document.querySelectorAll('input[name="msc-outcome"]').forEach(r => { r.checked = false; });
  const note = document.getElementById('msc-note'); if (note) note.value = existing?.note || '';
  const time = document.getElementById('msc-time');
  if (time) time.value = existing?.actualTime && !existing.onTime ? existing.actualTime : nowHHMM();
  m.style.display = 'flex';
  haptic('light');
}

export function mscOutcomeChange() {
  const v = document.querySelector('input[name="msc-outcome"]:checked')?.value;
  document.getElementById('msc-late-fields').style.display = v === 'late' ? '' : 'none';
}

export function mscConfirm() {
  const m = document.getElementById('m-sleep-checkin'); if (!m) return;
  const kind = m.dataset.kind;
  const v = document.querySelector('input[name="msc-outcome"]:checked')?.value;
  if (!v) { window.toast?.('Pick on-time or late'); return; }
  if (v === 'on-time') {
    logSleepHabit(kind, { onTime: true });
  } else {
    const at = document.getElementById('msc-time')?.value || nowHHMM();
    const note = document.getElementById('msc-note')?.value || '';
    logSleepHabit(kind, { onTime: false, actualTime: at, note });
  }
  closeModal('m-sleep-checkin');
}

// Expose to window for inline onclick.
if (typeof window !== 'undefined') {
  window.openSleepCheckin = openSleepCheckin;
  window.mscOutcomeChange = mscOutcomeChange;
  window.mscConfirm = mscConfirm;
  window.logSleepHabit = logSleepHabit;
  window.renderWakeCard = renderWakeCard;
  window.renderBedCard = renderBedCard;
}
