// Heatmap renderer — extracted from focusflow_v10.html line 1324+
export function renderHM(gridId, days, fn) {
  const grid = document.getElementById(gridId); if (!grid) return;
  grid.innerHTML = '';
  for (let i = days - 1; i >= 0; i--) {
    const k = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
    const { l, title } = fn(k);
    const c = document.createElement('div');
    c.className = 'hm-cell'; c.dataset.l = l; c.title = title;
    grid.appendChild(c);
  }
}

window.renderHM = renderHM;
