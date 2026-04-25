// Command palette — Cmd/Ctrl-K global search across tasks, projects, goals, habits, journal, shopping, chores.
import { S } from '../core/state.js';

let overlay, input, list, items = [], active = 0;

function buildIndex() {
  const out = [];
  (S.tasks || []).forEach(t => out.push({ kind: 'task', id: t.id, label: t.name, sub: (S.projects.find(p => p.id === t.projectId)?.name || 'No project'), action: () => { window.goPage?.('projects'); } }));
  (S.projects || []).forEach(p => out.push({ kind: 'project', id: p.id, label: p.name, sub: p.description || '', action: () => { window.goPage?.('projects'); } }));
  (S.goals || []).forEach(g => out.push({ kind: 'goal', id: g.id, label: g.name, sub: g.cat || '', action: () => window.goPage?.('goals') }));
  (S.habits || []).forEach(h => out.push({ kind: 'habit', id: h.id, label: h.name, sub: h.block || '', action: () => window.goPage?.('habits') }));
  (S.chores || []).forEach(c => out.push({ kind: 'chore', id: c.id, label: c.name, sub: c.day || '', action: () => window.goPage?.('chores') }));
  (S.shopping || []).forEach(s => out.push({ kind: 'shop', id: s.id, label: s.name, sub: s.cat || '', action: () => window.goPage?.('shopping') }));
  (S.journal || []).forEach(j => out.push({ kind: 'journal', id: j.id, label: (j.text || '').slice(0, 60) || '(entry)', sub: j.datetime || '', action: () => window.goPage?.('journal') }));
  // Page commands
  const pages = ['dashboard','habits','chores','projects','goals','insights','deepwork','meditation','fitness','shopping','journal','profile','settings'];
  pages.forEach(p => out.push({ kind: 'page', id: p, label: 'Go to ' + p, sub: 'page', action: () => window.goPage?.(p) }));
  return out;
}

// Fuzzy: subsequence match scoring. Higher = better.
// Scores reward consecutive runs and matches at word starts.
function fuzzyScore(needle, hay) {
  needle = needle.toLowerCase(); hay = hay.toLowerCase();
  if (!needle) return 1;
  let ni = 0, hi = 0, score = 0, run = 0, prevWordStart = false;
  while (ni < needle.length && hi < hay.length) {
    if (needle[ni] === hay[hi]) {
      const isWordStart = hi === 0 || /[\s\-_/.]/.test(hay[hi - 1]);
      score += 2 + run + (isWordStart ? 4 : 0);
      run++;
      ni++;
    } else { run = 0; }
    hi++;
  }
  if (ni < needle.length) return 0; // didn't match all chars
  // Bonus for shorter haystack
  score += Math.max(0, 12 - hay.length / 4);
  return score;
}

function match(q, idx) {
  q = q.trim();
  if (!q) return idx.slice(0, 30);
  const scored = idx.map(i => ({ ...i, _s: fuzzyScore(q, (i.label + ' ' + (i.sub || ''))) }))
    .filter(i => i._s > 0)
    .sort((a, b) => b._s - a._s)
    .slice(0, 40);
  return scored;
}

function render() {
  if (!list) return;
  if (!items.length) { list.innerHTML = '<div class="palette-empty">No matches</div>'; return; }
  list.innerHTML = items.map((it, i) => `<div class="palette-item${i === active ? ' active' : ''}" data-idx="${i}"><span class="pi-kind">${it.kind}</span><span style="flex:1">${it.label}</span>${it.sub ? `<span style="font-size:11px;color:var(--text3)">${it.sub}</span>` : ''}</div>`).join('');
}

function refresh() {
  const idx = buildIndex();
  items = match(input.value, idx);
  active = 0;
  render();
}

function open() {
  if (!overlay) return;
  overlay.classList.add('open');
  input.value = '';
  refresh();
  setTimeout(() => input.focus(), 40);
}

function close() {
  overlay?.classList.remove('open');
}

function choose(i) {
  const it = items[i]; if (!it) return;
  close();
  it.action?.();
}

export function initPalette() {
  // Build DOM
  overlay = document.createElement('div');
  overlay.className = 'palette-overlay';
  overlay.id = 'paletteOverlay';
  overlay.innerHTML = `<div class="palette"><input type="text" placeholder="Search tasks, goals, habits, pages…" autocomplete="off" spellcheck="false" id="paletteInput"><div class="palette-list" id="paletteList"></div></div>`;
  document.body.appendChild(overlay);
  input = overlay.querySelector('#paletteInput');
  list = overlay.querySelector('#paletteList');

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  list.addEventListener('click', e => {
    const row = e.target.closest('.palette-item'); if (!row) return;
    choose(parseInt(row.dataset.idx, 10));
  });
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); render(); e.preventDefault(); return; }
    if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); return; }
    if (e.key === 'Enter') { choose(active); e.preventDefault(); }
  });
  window.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') { e.preventDefault(); open(); }
  });

  window.openPalette = open;
  window.closePalette = close;
}
