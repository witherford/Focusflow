// Import tasks from common apps — autodetects TickTick / Todoist / MS To-Do / generic CSV / JSON.
import { S, uid, today } from './state.js';
import { save } from './persistence.js';

// Parse CSV with quoted fields + escaped quotes.
function parseCSV(text) {
  const rows = []; let row = []; let field = ''; let i = 0; let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = ''; i++; continue;
    }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v && v.length));
}

function headerMap(headers, aliases) {
  // For each target field, pick the first header that matches in the alias priority order.
  const out = {};
  for (const key in aliases) {
    for (const alias of aliases[key]) {
      const idx = headers.findIndex(h => h.trim().toLowerCase() === alias);
      if (idx >= 0) { out[key] = idx; break; }
    }
  }
  return out;
}

function normalizePriority(p) {
  if (!p) return 'medium';
  const s = String(p).toLowerCase();
  if (['0', '1', 'high', 'h', 'urgent', '!!!', '!!!!'].includes(s)) return 'high';
  if (['2', 'medium', 'med', 'm', 'normal', '!!'].includes(s)) return 'medium';
  if (['3', '4', 'low', 'l', '!'].includes(s)) return 'low';
  return 'medium';
}

function normalizeDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  // Already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

// Detect source by headers. Returns { source, tasks: [...] }.
export function importCSV(text) {
  const rows = parseCSV(text); if (!rows.length) return { source: 'empty', tasks: [] };
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const body = rows.slice(1);

  // Aliases per field, covers TickTick, Todoist, MS To-Do, Any.do, Things, generic.
  const aliases = {
    name: ['task name', 'title', 'content', 'subject', 'name', 'task'],
    notes: ['content', 'description', 'notes', 'body'],
    due: ['due date', 'due', 'due_date', 'date', 'start date', 'deadline'],
    priority: ['priority'],
    project: ['list name', 'list', 'project', 'category'],
    done: ['status', 'is_completed', 'completed', 'checked'],
  };
  const map = headerMap(headers, aliases);
  let source = 'generic';
  if (headers.includes('is checklist')) source = 'ticktick';
  else if (headers.includes('content') && headers.includes('priority')) source = 'todoist';
  else if (headers.includes('list name') || headers.includes('subject')) source = 'mstodo';

  const tasks = [];
  for (const row of body) {
    const name = (row[map.name] ?? '').trim();
    if (!name) continue;
    // TickTick "content" can duplicate title; prefer description column if separate
    const notes = map.notes != null && map.notes !== map.name ? (row[map.notes] ?? '').trim() : '';
    const due = normalizeDate(row[map.due]);
    const priority = normalizePriority(row[map.priority]);
    const projectName = (row[map.project] ?? '').trim();
    const doneRaw = (row[map.done] ?? '').trim().toLowerCase();
    const done = ['1', 'completed', 'true', 'yes', 'done', 'x'].includes(doneRaw);
    tasks.push({ name, notes, due, priority, projectName, done });
  }
  return { source, tasks };
}

// JSON import — covers Todoist JSON export, generic arrays.
export function importJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { source: 'invalid', tasks: [] }; }
  let arr = [];
  if (Array.isArray(data)) arr = data;
  else if (Array.isArray(data.items)) arr = data.items;
  else if (Array.isArray(data.tasks)) arr = data.tasks;
  else if (data.projects && typeof data.projects === 'object') {
    // Todoist-like
    arr = [];
    for (const pname in data.projects) for (const t of (data.projects[pname].items || data.projects[pname].tasks || [])) {
      arr.push({ ...t, projectName: pname });
    }
  }
  const tasks = arr.map(t => {
    const dueRaw = (t.due && typeof t.due === 'object' && t.due.date) ? t.due.date : (t.due || t.due_date || t.dueDate || '');
    return {
      name: (t.content || t.title || t.name || '').trim(),
      notes: (t.description || t.notes || '').trim(),
      due: normalizeDate(dueRaw),
      priority: normalizePriority(t.priority),
      projectName: (t.project || t.projectName || t.list || '').trim(),
      done: !!(t.completed || t.done || t.isCompleted || t.checked),
    };
  }).filter(t => t.name);
  return { source: 'json', tasks };
}

export function applyImport(parsed) {
  const { tasks, source } = parsed;
  if (!tasks?.length) return { added: 0, projects: 0, source };
  // Bucket into/attach to projects by name; create missing.
  const projByName = {};
  (S.projects || []).forEach(p => { projByName[p.name.toLowerCase()] = p.id; });
  let addedProjects = 0;
  for (const t of tasks) {
    let pid = null;
    if (t.projectName) {
      const key = t.projectName.toLowerCase();
      if (projByName[key]) pid = projByName[key];
      else {
        const np = { id: uid(), name: t.projectName, description: '', color: '#7c6ef7', cat: 'personal', due: '' };
        S.projects.push(np); projByName[key] = np.id; pid = np.id; addedProjects++;
      }
    }
    S.tasks.push({
      id: uid(), name: t.name, notes: t.notes || '', due: t.due || '', priority: t.priority || 'medium',
      projectId: pid, parentId: null, done: !!t.done, doneAt: t.done ? today() : null,
      createdAt: today(),
    });
  }
  save();
  window.renderAll?.();
  return { added: tasks.length, projects: addedProjects, source };
}

export function handleImportFile(file) {
  if (!file) return;
  const name = (file.name || '').toLowerCase();
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    let parsed;
    if (name.endsWith('.json')) parsed = importJSON(text);
    else parsed = importCSV(text);
    if (!parsed.tasks.length) { window.toast?.('No tasks found in file'); return; }
    const res = applyImport(parsed);
    window.toast?.(`Imported ${res.added} task${res.added === 1 ? '' : 's'}${res.projects ? ` · ${res.projects} new list${res.projects === 1 ? '' : 's'}` : ''} (${res.source})`);
  };
  reader.onerror = () => window.toast?.('Could not read file');
  reader.readAsText(file);
}

if (typeof window !== 'undefined') {
  window.handleTaskImport = ev => {
    const file = ev?.target?.files?.[0]; if (!file) return;
    handleImportFile(file);
    try { ev.target.value = ''; } catch {}
  };
}
