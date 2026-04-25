// Lightweight drag-to-reorder. Pointer-based, works on touch + mouse.
// `attachReorder(container, { itemSelector, handleSelector, onReorder(oldIdx, newIdx) })`
export function attachReorder(container, { itemSelector, handleSelector, onReorder } = {}) {
  if (!container) return () => {};
  let dragEl = null, ghost = null, originY = 0, lastY = 0, dragIdx = -1;

  function getItems() { return Array.from(container.querySelectorAll(itemSelector)); }

  function onDown(e) {
    const handle = e.target.closest(handleSelector || itemSelector); if (!handle) return;
    const item = handle.closest(itemSelector); if (!item || !container.contains(item)) return;
    if (e.target.closest('button, input, select, textarea, a')) return;
    e.preventDefault();
    dragEl = item;
    dragIdx = getItems().indexOf(item);
    originY = e.clientY; lastY = e.clientY;
    item.classList.add('dragging-active');
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });
  }

  function onMove(e) {
    if (!dragEl) return;
    const dy = e.clientY - originY;
    dragEl.style.transform = `translateY(${dy}px)`;
    dragEl.style.zIndex = '50';
    dragEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
    // find target index based on pointer position
    const items = getItems();
    let newIdx = dragIdx;
    items.forEach((it, i) => {
      if (it === dragEl) return;
      const r = it.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (e.clientY > mid && i > newIdx) newIdx = i;
      else if (e.clientY < mid && i < newIdx) newIdx = i;
    });
    if (newIdx !== dragIdx) {
      // visually preview reordering by reorder pending
      dragEl._pendingNewIdx = newIdx;
    }
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    if (!dragEl) return;
    const newIdx = dragEl._pendingNewIdx ?? dragIdx;
    dragEl.style.transform = ''; dragEl.style.zIndex = ''; dragEl.style.boxShadow = '';
    dragEl.classList.remove('dragging-active');
    document.body.style.userSelect = '';
    delete dragEl._pendingNewIdx;
    if (newIdx !== dragIdx && typeof onReorder === 'function') onReorder(dragIdx, newIdx);
    dragEl = null; dragIdx = -1;
  }

  container.addEventListener('pointerdown', onDown);
  return () => container.removeEventListener('pointerdown', onDown);
}

// Reorder helper: move item at `from` to position `to` in array.
export function reorderArr(arr, from, to) {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const item = arr.splice(from, 1)[0];
  arr.splice(to, 0, item);
  return arr;
}
