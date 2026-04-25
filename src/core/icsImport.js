// Minimal .ics parser — extracts VEVENTs → tasks with due dates.
import { S, uid, today } from './state.js';
import { save } from './persistence.js';

function unfold(text) {
  // ICS folded lines: CR LF + space/tab continues the previous line.
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function parseDate(v) {
  if (!v) return '';
  // 20260415T090000Z or 20260415
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return '';
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseIcs(raw) {
  const text = unfold(raw);
  const events = [];
  const blocks = text.split(/BEGIN:VEVENT/).slice(1);
  for (const blk of blocks) {
    const endIdx = blk.indexOf('END:VEVENT'); if (endIdx < 0) continue;
    const body = blk.slice(0, endIdx);
    const lines = body.split(/\r?\n/);
    const ev = {};
    for (const line of lines) {
      if (!line.includes(':')) continue;
      const idx = line.indexOf(':');
      const key = line.slice(0, idx).split(';')[0].toUpperCase();
      const val = line.slice(idx + 1);
      if (key === 'SUMMARY') ev.summary = val;
      else if (key === 'DESCRIPTION') ev.desc = val.replace(/\\n/g, '\n').replace(/\\,/g, ',');
      else if (key === 'DTSTART') ev.start = parseDate(val);
      else if (key === 'DTEND') ev.end = parseDate(val);
      else if (key === 'UID') ev.uid = val;
    }
    if (ev.summary) events.push(ev);
  }
  return events;
}

export function importIcsFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    const text = e.target.result;
    const events = parseIcs(text);
    if (!events.length) { window.toast?.('No events in .ics'); return; }
    let added = 0;
    for (const ev of events) {
      S.tasks.push({
        id: uid(), name: ev.summary, notes: ev.desc || '', priority: 'medium',
        due: ev.start || '', projectId: null, parentId: null, done: false, doneAt: null,
        createdAt: today(), icsUid: ev.uid || null,
      });
      added++;
    }
    save(); window.renderAll?.();
    window.toast?.(`Imported ${added} event${added === 1 ? '' : 's'} as tasks`);
  };
  r.readAsText(file);
}

window.handleIcsImport = ev => {
  const f = ev?.target?.files?.[0]; if (!f) return;
  importIcsFile(f);
  try { ev.target.value = ''; } catch {}
};
