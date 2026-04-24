// Shared SVG progress ring — Phase 5
// Usage: progressRing({ pct, size, stroke, color }) → HTML string
export function progressRing({ pct = 0, size = 56, stroke = 5, color = 'var(--teal)', label } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const cx = size / 2;
  return `<svg class="pr-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${stroke}" />
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
            stroke-linecap="round"
            stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"
            style="transform:rotate(-90deg);transform-origin:${cx}px ${cx}px;transition:stroke-dashoffset .3s" />
    <text x="${cx}" y="${cx + 4}" text-anchor="middle" font-size="${Math.round(size * 0.28)}" font-weight="600" fill="var(--text1)" font-family="'DM Mono',monospace">${label ?? Math.round(pct) + '%'}</text>
  </svg>`;
}
