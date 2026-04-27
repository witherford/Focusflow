// Shared icon snippets — keep visual style consistent across the app.
// Inline trash SVG (Feather-style). Picks up colour from currentColor.
export const TRASH_SVG = `<span class="icon-trash" aria-hidden="true"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg></span>`;

const DELETE_GLYPHS = ['🗑', '🗑️', '✕', '×', '🗑️'];

function shouldNormalize(btn) {
  if (!btn) return false;
  if (btn.dataset.iconNormalized === '1') return false;
  // Treat any .btn-icon.danger or button with a "delete"-y handler as a delete control.
  const txt = (btn.textContent || '').trim();
  if (!txt) return false;
  // If the visible text is exactly one of our delete glyphs, swap it.
  if (DELETE_GLYPHS.includes(txt)) return true;
  // Or .btn-icon.danger with single-char emoji content
  if (btn.classList.contains('danger') && btn.classList.contains('btn-icon') && txt.length <= 2) return true;
  return false;
}

function normalizeButton(btn) {
  btn.innerHTML = TRASH_SVG;
  btn.dataset.iconNormalized = '1';
  if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', 'Delete');
  if (!btn.classList.contains('danger')) btn.classList.add('danger');
}

function normalizeAll(root) {
  root.querySelectorAll?.('button, .btn-icon, .btn').forEach(b => {
    if (shouldNormalize(b)) normalizeButton(b);
  });
}

let _observer = null;

export function startIconNormalizer() {
  if (typeof document === 'undefined') return;
  // Initial pass.
  normalizeAll(document);
  // Watch future renders.
  if (_observer) return;
  _observer = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes?.forEach(n => {
        if (n.nodeType !== 1) return;
        if (shouldNormalize(n)) normalizeButton(n);
        normalizeAll(n);
      });
      // characterData changes on text-only updates won't trigger childList; we
      // also re-check the target itself if it's a button.
      if (m.type === 'childList' && m.target?.nodeType === 1) {
        if (shouldNormalize(m.target)) normalizeButton(m.target);
      }
    }
  });
  _observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof window !== 'undefined') {
  window.TRASH_SVG = TRASH_SVG;
  window.startIconNormalizer = startIconNormalizer;
}
