// Sleep log — bedtime, wake, quality (1-5), notes. Stored on S.sleepLog[].
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';

function ensure() { if (!Array.isArray(S.sleepLog)) S.sleepLog = []; return S.sleepLog; }

function hoursBetween(bed, wake) {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 24 * 60; // crossed midnight
  return Math.round(mins / 6) / 10;  // .1 hr precision
}

export function logSleep({ date, bedtime, wake, quality, notes }) {
  const arr = ensure();
  const k = date || today();
  const idx = arr.findIndex(s => s.date === k);
  const hours = hoursBetween(bedtime, wake);
  const entry = { id: uid(), date: k, bedtime, wake, hours, quality: parseInt(quality) || null, notes: notes || '', ts: Date.now() };
  if (idx >= 0) arr[idx] = entry; else arr.push(entry);
  arr.sort((a, b) => a.date.localeCompare(b.date));
  haptic('light'); save();
  renderSleep();
  window.toast?.('Sleep logged ✓');
}

export function deleteSleepEntry(id) {
  const arr = ensure();
  const idx = arr.findIndex(s => s.id === id); if (idx < 0) return;
  const removed = arr.splice(idx, 1)[0];
  save(); renderSleep();
  window.toastUndo?.(`Removed sleep entry ${removed.date}`, () => { arr.splice(idx, 0, removed); save(); renderSleep(); });
}

function renderChart(entries) {
  if (!entries.length) return '<div class="empty-state"><div class="es-icon">😴</div><div class="es-sub">No sleep entries yet</div></div>';
  const last = entries.slice(-30);
  const max = Math.max(10, ...last.map(e => e.hours || 0));
  const w = 600, h = 120;
  const xScale = i => (i / Math.max(1, last.length - 1)) * w;
  const yScale = v => h - (v / max) * h;
  const pts = last.map((e, i) => `${xScale(i).toFixed(1)},${yScale(e.hours || 0).toFixed(1)}`).join(' ');
  const dots = last.map((e, i) => {
    const q = e.quality || 0;
    const color = q >= 4 ? 'var(--green)' : q >= 3 ? 'var(--gold)' : q >= 1 ? 'var(--rose)' : 'var(--text3)';
    return `<circle cx="${xScale(i).toFixed(1)}" cy="${yScale(e.hours || 0).toFixed(1)}" r="3" fill="${color}"/>`;
  }).join('');
  // 8h reference line
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
    <line x1="0" x2="${w}" y1="${yScale(8).toFixed(1)}" y2="${yScale(8).toFixed(1)}" stroke="var(--teal)" stroke-dasharray="4 4" stroke-width="1"/>
    <polyline points="${pts}" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
  </svg>`;
}

export function renderSleep() {
  const el = document.getElementById('sleep-content'); if (!el) return;
  const arr = ensure();
  const last7 = arr.slice(-7);
  const avg = last7.length ? (last7.reduce((a, e) => a + (e.hours || 0), 0) / last7.length).toFixed(1) : '—';
  const avgQ = last7.length ? (last7.reduce((a, e) => a + (e.quality || 0), 0) / last7.length).toFixed(1) : '—';
  const last = arr[arr.length - 1];
  el.innerHTML = `
    <div class="stat-grid" style="margin-bottom:14px">
      <div class="stat-card" style="--accent:var(--violet)"><div class="stat-num">${last ? (last.hours || '—') : '—'}h</div><div class="stat-label">Last night</div></div>
      <div class="stat-card" style="--accent:var(--teal)"><div class="stat-num">${avg}h</div><div class="stat-label">Avg · 7d</div></div>
      <div class="stat-card" style="--accent:var(--gold)"><div class="stat-num">${avgQ}</div><div class="stat-label">Quality · 7d</div></div>
      <div class="stat-card" style="--accent:var(--green)"><div class="stat-num">${arr.length}</div><div class="stat-label">Entries</div></div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-header"><div class="card-title">Log a night</div></div>
      <div class="form-grid">
        <div class="form-row"><label>Date</label><input type="date" id="sl-date" value="${today()}"></div>
        <div class="form-row"><label>Bedtime</label><input type="time" id="sl-bed" value="22:30"></div>
        <div class="form-row"><label>Wake</label><input type="time" id="sl-wake" value="06:30"></div>
        <div class="form-row"><label>Quality (1-5)</label><select id="sl-quality"><option value="">—</option><option value="1">1 · Poor</option><option value="2">2</option><option value="3" selected>3 · OK</option><option value="4">4</option><option value="5">5 · Great</option></select></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="sl-notes" rows="2" placeholder="Dreams, woke ups, caffeine, etc."></textarea></div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-primary btn-sm" onclick="saveSleepEntry()">+ Log</button></div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-header"><div class="card-title">Trend · 30 nights</div><div style="font-size:11px;color:var(--text3)">teal line = 8h target</div></div>
      ${renderChart(arr)}
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Log</div></div>
      ${arr.length ? arr.slice().reverse().slice(0, 30).map(e => `<div class="weight-row"><span class="w-date">${e.date}</span><span class="w-val">${e.hours || '—'}h${e.quality ? ' · Q' + e.quality : ''}${e.bedtime && e.wake ? ` <span style="font-size:11px;color:var(--text3)">(${e.bedtime}→${e.wake})</span>` : ''}</span><button class="btn-icon btn-xs danger" onclick="deleteSleepEntry('${e.id}')">✕</button></div>`).join('') : '<div class="caption">No entries yet</div>'}
    </div>
  `;
}

export function saveSleepEntry() {
  const date = document.getElementById('sl-date')?.value || today();
  const bedtime = document.getElementById('sl-bed')?.value || '';
  const wake = document.getElementById('sl-wake')?.value || '';
  const quality = document.getElementById('sl-quality')?.value || '';
  const notes = document.getElementById('sl-notes')?.value || '';
  if (!bedtime || !wake) { window.toast?.('Set bedtime and wake'); return; }
  logSleep({ date, bedtime, wake, quality, notes });
}

window.renderSleep = renderSleep;
window.saveSleepEntry = saveSleepEntry;
window.deleteSleepEntry = deleteSleepEntry;
window.logSleep = logSleep;
