// Chore-period helpers — compute the bucket key and reset semantics for any
// chore based on its repeat / timeframe / customDays / resetOverride fields.
//
// Schema additions on each chore (all optional, additive):
//   repeat:        'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'custom'
//   timeframe:     'specific-day' | 'any-time'
//   customDays:    integer (used when repeat === 'custom')
//   resetOverride: 'YYYY-MM-DD' (manual override of the next reset date)
//   lastDoneAt:    'YYYY-MM-DD'

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

// ISO Mon-first week key (matches existing weekKey() in state.js).
function weekStartMon(d) {
  const x = new Date(d); const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x;
}

// Anchor for fortnightly + custom: epoch Monday 1970-01-05.
const EPOCH_MON = new Date(1970, 0, 5);

export function chorePeriodKey(chore, dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike || Date.now());
  const repeat = chore?.repeat || 'weekly';
  if (repeat === 'daily') return ymd(date);
  if (repeat === 'weekly') return ymd(weekStartMon(date));
  if (repeat === 'fortnightly') {
    const ms = weekStartMon(date).getTime() - EPOCH_MON.getTime();
    const wk = Math.floor(ms / (7 * 864e5));
    const fortnightStart = new Date(EPOCH_MON.getTime() + (wk - (wk % 2)) * 7 * 864e5);
    return 'fn-' + ymd(fortnightStart);
  }
  if (repeat === 'monthly') return date.getFullYear() + '-' + pad(date.getMonth() + 1);
  if (repeat === 'custom') {
    const days = Math.max(1, parseInt(chore.customDays) || 7);
    const ms = weekStartMon(date).getTime() - EPOCH_MON.getTime();
    const dayBlock = Math.floor((date - EPOCH_MON) / 864e5);
    const blockStart = new Date(EPOCH_MON.getTime() + (dayBlock - (dayBlock % days)) * 864e5);
    return 'c' + days + '-' + ymd(blockStart);
  }
  return ymd(weekStartMon(date));
}

// Human-readable description of when this chore's progress resets.
export function resetCaption(chore, today = new Date()) {
  if (chore?.resetOverride) return `resets ${chore.resetOverride} (override)`;
  const repeat = chore?.repeat || 'weekly';
  if (repeat === 'daily') return 'resets every day';
  if (repeat === 'weekly') return 'resets Monday';
  if (repeat === 'fortnightly') return 'resets every 2 weeks';
  if (repeat === 'monthly') return 'resets 1st of each month';
  if (repeat === 'custom') {
    const n = Math.max(1, parseInt(chore.customDays) || 7);
    return `resets every ${n} day${n === 1 ? '' : 's'}`;
  }
  return 'resets weekly';
}

// True if the chore is "due" today: its current period contains today and
// (for any-time) the period hasn't been completed yet.
export function isInCurrentPeriod(chore, log, today = new Date()) {
  const key = chorePeriodKey(chore, today);
  return !!(log?.[key]?.[chore.id]);
}

// Override the period key with manual reset date, if the override hasn't passed.
export function effectivePeriodKey(chore, today = new Date()) {
  if (chore?.resetOverride) {
    const t = today instanceof Date ? today : new Date(today);
    const reset = new Date(chore.resetOverride + 'T00:00:00');
    if (!isNaN(reset.getTime()) && t < reset) {
      return 'override-pre-' + chore.resetOverride;
    }
  }
  return chorePeriodKey(chore, today);
}
