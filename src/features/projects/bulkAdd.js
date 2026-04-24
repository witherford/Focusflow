// Bulk-add tasks/steps — paste line-by-line OR import CSV.
// CSV header (case-insensitive, optional): name,priority,due,notes
// Without CSV header: each line = task name (other fields default).
import { S, uid, today } from '../../core/state.js';
import { save } from '../../core/persistence.js';

let _ctx = { projectId: null, parentId: null };

export function openBulkAdd(projectId, parentId = null) {
  _ctx = { projectId, parentId };
  const m = document.getElementById('m-bulk-tasks'); if (!m) return;
  const ta = document.getElementById('bulk-tasks-text'); if (ta) ta.value = '';
  const fi = document.getElementById('bulk-tasks-file'); if (fi) fi.value = '';
  const titleEl = document.getElementById('m-bulk-tasks-title');
  if (titleEl) {
    if (parentId) {
      const par = S.tasks.find(t => t.id === parentId);
      titleEl.textContent = `Bulk add steps to: ${par?.name || ''}`;
    } else {
      const p = S.projects.find(x => x.id === projectId);
      titleEl.textContent = `Bulk add tasks to: ${p?.name || ''}`;
    }
  }
  m.style.display = 'flex';
}

// Parse a single CSV line, respecting quoted commas. Lightweight — handles the common cases.
function splitCsvLine(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"' && cur === '') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseInput(text) {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!rawLines.length) return [];

  // Detect CSV header.
  const first = rawLines[0].toLowerCase();
  const hasHeader = /(^|,)\s*name\s*(,|$)/.test(first) && first.includes(',');
  let headers = null;
  let dataLines = rawLines;
  if (hasHeader) {
    headers = splitCsvLine(rawLines[0]).map(h => h.toLowerCase());
    dataLines = rawLines.slice(1);
  }

  return dataLines.map(line => {
    if (headers) {
      const cells = splitCsvLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ''; });
      return {
        name: row.name || cells[0] || '',
        priority: ['high','medium','low'].includes((row.priority||'').toLowerCase()) ? row.priority.toLowerCase() : 'medium',
        due: row.due || '',
        notes: row.notes || '',
      };
    }
    // Plain line — but allow inline `name | priority | due` as a convenience.
    if (line.includes('|')) {
      const parts = line.split('|').map(s => s.trim());
      return {
        name: parts[0],
        priority: ['high','medium','low'].includes((parts[1]||'').toLowerCase()) ? parts[1].toLowerCase() : 'medium',
        due: parts[2] || '',
        notes: parts[3] || '',
      };
    }
    return { name: line, priority: 'medium', due: '', notes: '' };
  }).filter(r => r.name);
}

export function bulkAddImportFile(e) {
  const f = e.target.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    const ta = document.getElementById('bulk-tasks-text');
    if (ta) ta.value = String(ev.target.result || '');
    window.toast?.(`Loaded ${f.name}`);
  };
  r.onerror = () => window.toast?.('Could not read file', 'error');
  r.readAsText(f);
}

export function bulkAddSubmit() {
  const ta = document.getElementById('bulk-tasks-text');
  const text = (ta?.value || '').trim();
  if (!text) { window.toast?.('Paste some lines or import a CSV first', 'error'); return; }
  const rows = parseInput(text);
  if (!rows.length) { window.toast?.('No valid lines found', 'error'); return; }

  const { projectId, parentId } = _ctx;
  const newTasks = rows.map(r => ({
    id: uid(),
    name: r.name,
    notes: r.notes || '',
    priority: r.priority || 'medium',
    due: r.due || '',
    projectId,
    parentId: parentId || null,
    goalId: null,
    done: false,
    doneAt: null,
    expanded: false,
    createdAt: Date.now(),
    accruedMinutes: 0,
  }));
  S.tasks.push(...newTasks);
  if (parentId) {
    const par = S.tasks.find(t => t.id === parentId);
    if (par) par.expanded = true;
  }
  save();
  window.closeModal?.('m-bulk-tasks');
  window.renderProjTree?.();
  window.renderDash?.();
  window.toast?.(`Added ${newTasks.length} ${parentId ? 'step' : 'task'}${newTasks.length === 1 ? '' : 's'} ✓`);
}

if (typeof window !== 'undefined') {
  window.openBulkAdd = openBulkAdd;
  window.bulkAddImportFile = bulkAddImportFile;
  window.bulkAddSubmit = bulkAddSubmit;
}
