// Bottom mobile-nav renderer. Six slots, Dashboard locked into slot 1.
// User picks the other five from the available pages via Settings.
import { S } from '../core/state.js';
import { save } from '../core/persistence.js';

// All pages that can appear in the bottom nav. Order here is the default
// preference order (we'll fill empty user-config slots from this list).
export const BOTTOM_NAV_PAGES = [
  { id: 'dashboard',  label: 'Dashboard', icon: '📊', locked: true },
  { id: 'habits',     label: 'Habits',    icon: '✅' },
  { id: 'deepwork',   label: 'Focus',     icon: '🧠' },
  { id: 'meditation', label: 'Meditate',  icon: '🧘' },
  { id: 'projects',   label: 'Projects',  icon: '📁' },
  { id: 'insights',   label: 'Insights',  icon: '📈' },
  { id: 'goals',      label: 'Goals',     icon: '🎯' },
  { id: 'chores',     label: 'Chores',    icon: '🧹' },
  { id: 'fitness',    label: 'Training',  icon: '🏋️' },
  { id: 'weight',     label: 'Weight',    icon: '⚖️' },
  { id: 'sleep',      label: 'Sleep',     icon: '😴' },
  { id: 'shopping',   label: 'Shopping',  icon: '🛒' },
  { id: 'journal',    label: 'Journal',   icon: '📓' },
  { id: 'profile',    label: 'Profile',   icon: '👤' },
  { id: 'settings',   label: 'Settings',  icon: '⚙️' },
];

const DEFAULT_SHORTCUTS = ['dashboard', 'habits', 'deepwork', 'meditation', 'projects', 'insights'];
const SLOT_COUNT = 6;

export function getBottomShortcuts() {
  if (!S.settings) S.settings = {};
  let list = S.settings.bottomShortcuts;
  if (!Array.isArray(list) || !list.length) {
    list = [...DEFAULT_SHORTCUTS];
    S.settings.bottomShortcuts = list;
  }
  // Always force Dashboard into the first slot.
  list = list.filter(id => id !== 'dashboard');
  list.unshift('dashboard');
  // Trim / pad to SLOT_COUNT
  list = list.slice(0, SLOT_COUNT);
  while (list.length < SLOT_COUNT) {
    const next = DEFAULT_SHORTCUTS.find(id => !list.includes(id));
    if (next) list.push(next); else break;
  }
  return list;
}

export function setBottomShortcuts(ids) {
  if (!Array.isArray(ids)) return;
  if (!S.settings) S.settings = {};
  // Always lock dashboard at position 0 even if the caller forgot.
  const cleaned = ids.filter(id => id && id !== 'dashboard');
  S.settings.bottomShortcuts = ['dashboard', ...cleaned].slice(0, SLOT_COUNT);
  save();
  renderBottomNav();
  renderShortcutChooser();
}

export function renderBottomNav() {
  const wrap = document.getElementById('mobnav'); if (!wrap) return;
  const list = getBottomShortcuts();
  // Determine the currently active page so the "active" class survives a re-render.
  const activePage = document.querySelector('.page.active')?.id?.replace('page-', '') || 'dashboard';
  wrap.innerHTML = list.map(id => {
    const meta = BOTTOM_NAV_PAGES.find(p => p.id === id) || { id, label: id, icon: '·' };
    const isActive = id === activePage;
    return `<div class="mob-nav-item${isActive ? ' active' : ''}" data-page="${meta.id}"><div class="mob-icon">${meta.icon}</div>${meta.label}</div>`;
  }).join('');
}

export function renderShortcutChooser() {
  const el = document.getElementById('shortcut-chooser'); if (!el) return;
  const current = getBottomShortcuts();
  // Show 5 picker slots (skip the locked Dashboard slot 0).
  const otherSlots = current.slice(1);
  el.innerHTML = `
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.5">
      Pick the 5 pages to put on the bottom bar alongside Dashboard. Tap a row to swap it for any other page.
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r-sm);background:var(--surface2);margin-bottom:6px;opacity:0.85">
      <span style="font-size:18px;width:24px;text-align:center">📊</span>
      <span style="flex:1;font-size:13px;font-weight:600">Dashboard</span>
      <span style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px">locked</span>
    </div>
    ${otherSlots.map((id, i) => {
      const meta = BOTTOM_NAV_PAGES.find(p => p.id === id) || { label: id, icon: '·' };
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r-sm);background:var(--surface2);margin-bottom:6px">
        <span style="font-size:18px;width:24px;text-align:center">${meta.icon}</span>
        <select style="flex:1;font-size:13px" onchange="setShortcutSlot(${i + 1}, this.value)">
          ${BOTTOM_NAV_PAGES.filter(p => !p.locked).map(p => `<option value="${p.id}"${p.id === id ? ' selected' : ''}${current.includes(p.id) && p.id !== id ? ' disabled' : ''}>${p.icon} ${p.label}${current.includes(p.id) && p.id !== id ? ' (in use)' : ''}</option>`).join('')}
        </select>
      </div>`;
    }).join('')}
  `;
}

window.setShortcutSlot = (slotIdx, pageId) => {
  const list = getBottomShortcuts().slice();
  list[slotIdx] = pageId;
  setBottomShortcuts(list);
};

window.renderBottomNav = renderBottomNav;
window.renderShortcutChooser = renderShortcutChooser;
