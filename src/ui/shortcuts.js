// Keyboard shortcuts — global, unobtrusive. `?` shows help.
const BINDINGS = [
  { keys: ['d'], desc: 'Dashboard', fn: () => window.goPage?.('dashboard') },
  { keys: ['h'], desc: 'Habits', fn: () => window.goPage?.('habits') },
  { keys: ['p'], desc: 'Projects / Tasks', fn: () => window.goPage?.('projects') },
  { keys: ['g'], desc: 'Goals', fn: () => window.goPage?.('goals') },
  { keys: ['i'], desc: 'Insights', fn: () => window.goPage?.('insights') },
  { keys: ['f'], desc: 'Focus / Deep Work', fn: () => window.goPage?.('deepwork') },
  { keys: ['m'], desc: 'Meditation', fn: () => window.goPage?.('meditation') },
  { keys: ['j'], desc: 'Journal', fn: () => window.goPage?.('journal') },
  { keys: ['w'], desc: 'Weight', fn: () => window.goPage?.('weight') },
  { keys: ['s'], desc: 'Shopping', fn: () => window.goPage?.('shopping') },
  { keys: ['n'], desc: 'New task (Quick Capture)', fn: () => window.openQuickCapture?.() },
  { keys: ['/'], desc: 'Search palette', fn: () => window.openPalette?.() },
  { keys: ['?'], desc: 'This help', fn: () => showHelp() },
];

export function renderHelpModalHTML() {
  return `<div class="modal-overlay" id="m-keyhelp" style="display:none"><div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title">⌨ Keyboard shortcuts</div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px">
      ${BINDINGS.map(b => `<kbd style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-family:'DM Mono',monospace;font-size:12px;text-align:center">${b.keys[0]}</kbd><span>${b.desc}</span>`).join('')}
      <kbd style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-family:'DM Mono',monospace;font-size:12px;text-align:center">⌘K</kbd><span>Search palette</span>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" style="flex:1" onclick="closeModal('m-keyhelp')">Got it</button>
    </div>
  </div></div>`;
}

function showHelp() {
  const el = document.getElementById('m-keyhelp');
  if (el) el.style.display = 'flex';
}

export function initShortcuts() {
  // Inject help modal once
  if (!document.getElementById('m-keyhelp')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = renderHelpModalHTML();
    document.body.appendChild(wrap.firstChild);
  }
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.getElementById('paletteOverlay')?.classList.contains('open')) return;
    // Any open modal? skip single-letter shortcuts to avoid conflict
    const openModal = document.querySelector('.modal-overlay[style*="display: flex"], .modal-overlay[style*="display:flex"]');
    if (openModal && e.key !== '?') return;
    const match = BINDINGS.find(b => b.keys.includes(e.key));
    if (match) { e.preventDefault(); match.fn(); }
  });

  window.showKeyHelp = showHelp;
}
