// Page partials — injected into <main id="main"> at boot.
// Splitting these out of index.html keeps each page editable in isolation
// without touching a 1.4k-line monolith.
import dashboard  from './dashboard.html?raw';
import habits     from './habits.html?raw';
import chores     from './chores.html?raw';
import projects   from './projects.html?raw';
import goals      from './goals.html?raw';
import insights   from './insights.html?raw';
import deepwork   from './deepwork.html?raw';
import meditation from './meditation.html?raw';
import fitness    from './fitness.html?raw';
import weight     from './weight.html?raw';
import sleep      from './sleep.html?raw';
import shopping   from './shopping.html?raw';
import journal    from './journal.html?raw';
import profile    from './profile.html?raw';
import docs       from './docs.html?raw';
import settings   from './settings.html?raw';

// Order matches the original index.html so any DOM-order-sensitive
// styling or sibling-selectors keep working.
const PARTIALS = [
  dashboard, habits, chores, projects, goals, insights, deepwork,
  meditation, fitness, weight, sleep, shopping, journal, profile,
  docs, settings,
];

export function injectPages() {
  const main = document.getElementById('main');
  if (!main) { console.error('[pages] #main not found'); return; }
  // Replace any existing children (none expected — index.html ships an empty <main>).
  main.innerHTML = PARTIALS.join('\n');
}
