// Habit-stack child-row UI. Used by both the full Add/Edit Habit modal and
// the minimal Quick Capture habit form. Pass a prefix (`'habit-'` or `'qc-'`)
// so the same helpers can drive both forms.
import { uid } from '../../core/state.js';

// Per-prefix list of in-progress children while the form is open.
const editing = { 'habit-': [], 'qc-': [] };

function containerId(prefix) { return prefix + 'habit-stack-children'; }
function blank() { return { id: uid(), name: '', icon: '', kind: 'good', mode: 'binary', target: '', unit: '' }; }

function rowHtml(prefix, child, idx) {
  const minimal = prefix === 'qc-';
  const counterRow = !minimal && child.mode === 'counter'
    ? `<div style="display:flex;gap:6px;margin-top:6px">
         <input type="number" data-stack-field="target" data-stack-idx="${idx}" placeholder="Target" value="${child.target ?? ''}" style="flex:1;min-width:0">
         <input type="text"   data-stack-field="unit"   data-stack-idx="${idx}" placeholder="Unit (e.g. ml)" value="${child.unit ?? ''}" style="flex:1;min-width:0">
       </div>`
    : '';
  return `<div class="stack-child-row" data-stack-row="${idx}" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px;margin-bottom:6px">
    <div style="display:flex;gap:6px;align-items:center">
      <input type="text" data-stack-field="icon" data-stack-idx="${idx}" maxlength="2" placeholder="●" value="${child.icon ?? ''}" style="width:42px;text-align:center">
      <input type="text" data-stack-field="name" data-stack-idx="${idx}" placeholder="Child habit name" value="${child.name ?? ''}" style="flex:1;min-width:0">
      <button type="button" class="btn btn-xs" onclick="removeHabitStackChild('${prefix}', ${idx})" title="Remove" style="padding:4px 8px">×</button>
    </div>
    <div style="display:flex;gap:6px;margin-top:6px">
      <select data-stack-field="kind" data-stack-idx="${idx}" style="flex:1;min-width:0">
        <option value="good"${child.kind !== 'bad' ? ' selected' : ''}>✅ Good</option>
        <option value="bad"${child.kind === 'bad' ? ' selected' : ''}>🚫 Bad</option>
      </select>
      <select data-stack-field="mode" data-stack-idx="${idx}" style="flex:1;min-width:0">
        <option value="binary"${child.mode !== 'counter' ? ' selected' : ''}>Binary</option>
        <option value="counter"${child.mode === 'counter' ? ' selected' : ''}>Counter</option>
      </select>
    </div>
    ${counterRow}
  </div>`;
}

function render(prefix) {
  const wrap = document.getElementById(containerId(prefix)); if (!wrap) return;
  const list = editing[prefix];
  wrap.innerHTML = list.length
    ? list.map((c, i) => rowHtml(prefix, c, i)).join('')
    : '<div style="font-size:12px;color:var(--text3);padding:8px 0">No nested habits yet — add at least one.</div>';
  wrap.querySelectorAll('[data-stack-field]').forEach(el => {
    el.oninput = el.onchange = () => {
      const idx = parseInt(el.dataset.stackIdx);
      const field = el.dataset.stackField;
      if (!list[idx]) return;
      list[idx][field] = el.value;
      // Re-render only when toggling mode (counter row appears/disappears).
      if (field === 'mode' && prefix === 'habit-') render(prefix);
    };
  });
}

export function resetStackChildren(prefix = 'habit-') {
  editing[prefix] = [];
  render(prefix);
}

export function addHabitStackChild(prefix = 'habit-', child) {
  editing[prefix].push(child ? { ...blank(), ...child } : blank());
  render(prefix);
}

export function removeHabitStackChild(prefix = 'habit-', idx) {
  editing[prefix].splice(idx, 1);
  render(prefix);
}

export function readStackChildren(prefix = 'habit-') {
  return editing[prefix]
    .map(c => {
      const out = { id: c.id || uid(), name: (c.name || '').trim(), icon: c.icon || '', kind: c.kind === 'bad' ? 'bad' : 'good', mode: c.mode === 'counter' ? 'counter' : 'binary' };
      if (out.mode === 'counter') {
        const t = parseFloat(c.target); if (isFinite(t) && t > 0) out.target = t;
        const u = (c.unit || '').trim(); if (u) out.unit = u;
      }
      return out;
    })
    .filter(c => c.name);
}

export function populateStackChildren(prefix = 'habit-', children) {
  editing[prefix] = (children || []).map(c => ({
    id: c.id || uid(),
    name: c.name || '',
    icon: c.icon || '',
    kind: c.kind === 'bad' ? 'bad' : 'good',
    mode: c.mode === 'counter' ? 'counter' : 'binary',
    target: c.target ?? '',
    unit: c.unit ?? '',
  }));
  render(prefix);
}

export function toggleHabitStackFields(prefix = 'habit-') {
  const cb = document.getElementById(prefix + 'habit-is-stack');
  const wrap = document.getElementById(prefix + 'habit-stack-fields');
  if (!cb || !wrap) return;
  const on = cb.checked;
  wrap.style.display = on ? '' : 'none';
  // When turning on for the full Add Habit modal, also hide the now-irrelevant
  // mode/all-day/linked-type/streak-goal rows (a stack is a wrapper).
  if (prefix === 'habit-') {
    const rowsToHide = [
      document.getElementById('habit-link-type')?.closest('.form-row'),
      document.getElementById('habit-mode')?.closest('.form-row'),
      document.getElementById('habit-allday')?.closest('.form-row'),
      document.getElementById('habit-counter-fields'),
      document.getElementById('habit-goal-mode')?.closest('.form-row'),
      document.getElementById('habit-goal-num-wrap'),
    ];
    rowsToHide.forEach(el => { if (el) el.style.display = on ? 'none' : ''; });
  }
  if (on && editing[prefix].length === 0) addHabitStackChild(prefix);
}

// Expose on window so inline onclick handlers in the HTML can find them.
window.toggleHabitStackFields = toggleHabitStackFields;
window.addHabitStackChild = addHabitStackChild;
window.removeHabitStackChild = removeHabitStackChild;
