// Navigation + sidebar + scroll header — extracted from focusflow_v10.html lines 1461-1519
import { haptic } from '../core/state.js';

export function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item,.mob-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('active');
  document.querySelectorAll(`[data-page="${id}"]`).forEach(n => n.classList.add('active'));
  closeSidebar();
  const main = document.getElementById('main'); if (main) main.scrollTop = 0;
  window.renderPage(id);
}

export function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('active');
  haptic('light');
}

export function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

export function initRouter() {
  document.getElementById('sidenav').addEventListener('click', e => {
    const i = e.target.closest('[data-page]'); if (i) goPage(i.dataset.page);
  });
  document.getElementById('mobnav').addEventListener('click', e => {
    const i = e.target.closest('[data-page]'); if (i) goPage(i.dataset.page);
  });

  // Tab switching
  document.querySelectorAll('.tabs').forEach(tb => {
    tb.addEventListener('click', e => {
      const tab = e.target.closest('.tab'); if (!tab?.dataset.tab) return;
      const tid = tab.dataset.tab;
      tb.querySelectorAll('.tab').forEach(x => x.classList.remove('active')); tab.classList.add('active');
      const parent = tab.closest('.page') || tab.closest('.card') || document;
      parent.querySelectorAll('.tab-content').forEach(x => x.style.display = 'none');
      const target = document.getElementById(tid); if (target) target.style.display = 'block';
      if (tid === 'h-heatmap') window.renderHabitHeatmap();
      if (tid === 'pv-all') window.renderAllFlat();
      if (tid === 'pv-today') window.renderDueToday();
      if (tid === 'pv-overdue') window.renderOverdue();
      if (tid === 'pv-breakdown') window.renderBreakdown();
    });
  });

  // Hamburger buttons
  document.querySelectorAll('.nav-menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const open = document.getElementById('sidebar').classList.contains('open');
      open ? closeSidebar() : openSidebar();
    });
  });

  // Swipe edge → open sidebar
  (function () {
    let _sx = 0, _sy = 0;
    document.addEventListener('touchstart', e => { _sx = e.touches[0].clientX; _sy = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - _sx;
      const dy = e.changedTouches[0].clientY - _sy;
      if (Math.abs(dy) > Math.abs(dx) * 1.5) return;
      const sidebar = document.getElementById('sidebar');
      if (dx > 60 && _sx < 30 && !sidebar.classList.contains('open')) { openSidebar(); }
      else if (dx < -60 && sidebar.classList.contains('open')) { closeSidebar(); }
    }, { passive: true });
  })();

  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // Scroll header effect
  document.getElementById('main').addEventListener('scroll', function () {
    const scrolled = this.scrollTop > 10;
    document.querySelectorAll('.page-header').forEach(h => h.classList.toggle('scrolled', scrolled));
  });

  // A11y: make nav divs keyboard-reachable + act as buttons
  document.querySelectorAll('.nav-item[data-page],.mob-nav-item[data-page]').forEach(el => {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goPage(el.dataset.page); }
    });
  });
}

export function goProjView(tab) {
  goPage('projects');
  setTimeout(() => { const t = document.querySelector(`[data-tab="pv-${tab}"]`); if (t) t.click(); }, 50);
}

// Expose to window for inline onclick handlers
window.goPage = goPage;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.goProjView = goProjView;
