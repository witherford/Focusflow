// Diet — meal database, daily target driven by weight + goal, today's log,
// optional habit integration.
import { S, today, uid, haptic } from '../../core/state.js';
import { save } from '../../core/persistence.js';
import { attachReorder, reorderArr } from '../../ui/dragReorder.js';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function diet()       { if (!S.diet) S.diet = { goal: 'maintain', calorieAdjust: 0, manualTDEEOverride: null, log: {} }; if (!S.diet.log) S.diet.log = {}; return S.diet; }
function meals()      { if (!Array.isArray(S.meals)) S.meals = []; return S.meals; }
function dietGroups() { if (!Array.isArray(S.dietGroups)) S.dietGroups = []; return S.dietGroups; }

function blockForTime(hhmm) {
  if (!hhmm) return 'allday';
  const [h] = hhmm.split(':').map(Number);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'allday';
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// ── Targets ─────────────────────────────────────────────────────────────────
const ACTIVITY = {
  sedentary: { mult: 1.2, label: 'Sedentary (little/no exercise)' },
  light:     { mult: 1.375, label: 'Lightly active (1–3 days/week)' },
  moderate:  { mult: 1.55, label: 'Moderately active (3–5 days/week)' },
  very:      { mult: 1.725, label: 'Very active (6–7 days/week)' },
  extra:     { mult: 1.9, label: 'Extra active (athlete / physical job)' },
};

const CALC_INFO = {
  'mifflin':  'Mifflin-St Jeor (1990) — most accurate for the general adult population. The default used by NHS and most modern apps.',
  'harris':   'Harris-Benedict (revised 1984) — older formula; tends to slightly over-estimate BMR vs. Mifflin.',
  'katch':    'Katch-McArdle — based on lean body mass; the most accurate if you know your body-fat percentage.',
  'simple':   'Simple multiplier — kg × 30. Quick rough estimate; ignores age/sex/activity.',
};

function bmrMifflin(w, h, age, sex) { return 10 * w + 6.25 * h - 5 * age + (sex === 'male' ? 5 : -161); }
function bmrHarris(w, h, age, sex)  { return sex === 'male'
  ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * age
  : 447.593 + 9.247 * w + 3.098 * h - 4.330 * age; }
function bmrKatch(w, bf)            { const lbm = w * (1 - (Number(bf) || 0) / 100); return 370 + 21.6 * lbm; }

function computeCalculatorTDEE() {
  const c = diet().calculator || {};
  const w = parseFloat(c.weight ?? S.profile?.weight) || 0;
  const h = parseFloat(c.height) || 0;
  const age = parseInt(c.age, 10) || 0;
  const sex = c.sex || 'male';
  const bf = parseFloat(c.bodyFat) || 0;
  const act = ACTIVITY[c.activity || 'moderate'] || ACTIVITY.moderate;
  const method = c.method || 'mifflin';
  let bmr = 0;
  if (method === 'mifflin' && w && h && age) bmr = bmrMifflin(w, h, age, sex);
  else if (method === 'harris' && w && h && age) bmr = bmrHarris(w, h, age, sex);
  else if (method === 'katch' && w && bf) bmr = bmrKatch(w, bf);
  else if (method === 'simple' && w) return Math.round(w * 30);
  if (!bmr) return 0;
  return Math.round(bmr * act.mult);
}

function tdee() {
  const d = diet();
  if (d.manualTDEEOverride) return Number(d.manualTDEEOverride);
  // Prefer calculator output when set
  const calc = computeCalculatorTDEE();
  if (calc) return calc;
  const wRaw = parseFloat(S.profile?.weight) || 0;
  if (!wRaw) return 0;
  return Math.round(wRaw * 30);
}
function dailyTarget() {
  const d = diet(); const base = tdee(); if (!base) return 0;
  const adj = Number(d.calorieAdjust) || 0;
  if (d.goal === 'lose')  return base - Math.abs(adj || 300);
  if (d.goal === 'gain')  return base + Math.abs(adj || 300);
  return base + adj;
}

// ── Meal totals ─────────────────────────────────────────────────────────────
function recomputeTotals(meal) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, micros: {} };
  (meal.foods || []).forEach(food => {
    t.kcal += Number(food.kcal) || 0;
    t.p += Number(food.macros?.p) || 0;
    t.c += Number(food.macros?.c) || 0;
    t.f += Number(food.macros?.f) || 0;
    Object.entries(food.micros || {}).forEach(([k, v]) => {
      const n = Number(v) || 0; if (!n) return;
      t.micros[k] = (t.micros[k] || 0) + n;
    });
  });
  meal.totals = t; return t;
}

// ── Habit integration ───────────────────────────────────────────────────────
function clearMealHabits(mealId) {
  const tag = 'meal:' + mealId;
  S.habits = (S.habits || []).filter(h => h.managedBy !== tag);
}
function syncMealHabits(meal) {
  clearMealHabits(meal.id);
  if (!meal.asHabit) return;
  const tag = 'meal:' + meal.id;
  S.habits.push({
    id: 'mealh-' + meal.id,
    name: meal.time ? `${meal.name} @ ${meal.time}` : meal.name,
    kind: 'good',
    block: blockForTime(meal.time),
    icon: meal.type === 'drink' ? '🥤' : meal.type === 'shake' ? '🥛' : meal.type === 'snack' ? '🍎' : '🍽',
    mode: 'binary',
    activeDays: (meal.schedule?.activeDays && meal.schedule.activeDays.length) ? meal.schedule.activeDays.slice() : null,
    linkedType: 'diet',
    linkedRefId: meal.id,
    managedBy: tag,
    journalPrompt: false,
  });
}

// Called when a diet-linked habit is ticked — log the meal for today.
export function logMealFromHabitTick(mealId) {
  const meal = meals().find(m => m.id === mealId); if (!meal) return;
  const d = diet(); const k = today();
  if (!d.log[k]) d.log[k] = [];
  if (!d.log[k].some(e => e.mealId === mealId)) {
    d.log[k].push({ mealId, time: meal.time || '', servings: 1 });
    save(); renderDiet();
  }
}

// ── Weekday picker helpers ──────────────────────────────────────────────────
function setWeekdayPicker(containerId, days) {
  const set = new Set(days || DAYS);
  document.querySelectorAll(`#${containerId} input[type=checkbox]`).forEach(cb => {
    cb.checked = !days || days.length === 0 ? true : set.has(cb.dataset.day);
  });
}
function readWeekdayPicker(containerId) {
  const all = [...document.querySelectorAll(`#${containerId} input[type=checkbox]`)];
  const on = all.filter(cb => cb.checked).map(cb => cb.dataset.day);
  return on.length === 7 ? null : on;
}

// ── Foods within meal modal ─────────────────────────────────────────────────
function renderFoodRow(food = {}) {
  const wrap = document.getElementById('meal-foods-list'); if (!wrap) return;
  const row = document.createElement('div');
  row.className = 'meal-food-row';
  row.style.cssText = 'border:1px solid var(--border);border-radius:var(--r-sm);padding:8px;margin-bottom:6px;background:var(--surface)';
  row.innerHTML = `
    <div class="form-grid">
      <div class="form-row"><label>Food name</label><input type="text" data-fk="name" value="${escapeHtml(food.name || '')}"></div>
      <div class="form-row"><label>Type</label><input type="text" data-fk="foodType" value="${escapeHtml(food.foodType || '')}" placeholder="meat, veg, fruit…"></div>
      <div class="form-row"><label>Qty</label><input type="number" data-fk="qtyAmount" value="${food.quantity?.amount ?? ''}" step="0.01"></div>
      <div class="form-row"><label>Unit</label><select data-fk="qtyUnit">
        ${['g','kg','lb','ml','l','bag','sack','piece'].map(u => `<option ${food.quantity?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
      </select></div>
      <div class="form-row"><label>kcal</label><input type="number" data-fk="kcal" value="${food.kcal ?? ''}" step="1"></div>
      <div class="form-row"><label>P (g)</label><input type="number" data-fk="p" value="${food.macros?.p ?? ''}" step="0.1"></div>
      <div class="form-row"><label>C (g)</label><input type="number" data-fk="c" value="${food.macros?.c ?? ''}" step="0.1"></div>
      <div class="form-row"><label>F (g)</label><input type="number" data-fk="f" value="${food.macros?.f ?? ''}" step="0.1"></div>
    </div>
    <div class="form-row"><label>Micros (free text, e.g. "Iron 2mg, Vit C 30mg")</label><input type="text" data-fk="micros" value="${escapeHtml(food.microsRaw || '')}"></div>
    <div style="text-align:right"><button type="button" class="btn btn-xs">Remove</button></div>
  `;
  row.querySelector('button').onclick = () => { row.remove(); refreshMealTotals(); };
  row.addEventListener('input', refreshMealTotals);
  wrap.appendChild(row);
}

export function addMealFood() { renderFoodRow(); refreshMealTotals(); }

function readFoods() {
  return [...document.querySelectorAll('#meal-foods-list .meal-food-row')].map(row => {
    const get = k => row.querySelector(`[data-fk="${k}"]`)?.value || '';
    const microsRaw = get('micros');
    const micros = {};
    microsRaw.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
      const m = part.match(/^(.+?)\s*([\d.]+)\s*([a-zA-Z]+)?$/);
      if (m) micros[m[1].trim()] = parseFloat(m[2]) || 0;
    });
    return {
      name: get('name'),
      foodType: get('foodType'),
      quantity: { amount: parseFloat(get('qtyAmount')) || 0, unit: get('qtyUnit') },
      kcal: parseFloat(get('kcal')) || 0,
      macros: { p: parseFloat(get('p')) || 0, c: parseFloat(get('c')) || 0, f: parseFloat(get('f')) || 0 },
      microsRaw, micros,
    };
  });
}

function refreshMealTotals() {
  const foods = readFoods();
  const tmp = { foods }; recomputeTotals(tmp);
  const t = tmp.totals;
  const el = document.getElementById('meal-totals');
  if (el) el.innerHTML = `<strong>Totals:</strong> ${Math.round(t.kcal)} kcal · P ${t.p.toFixed(1)}g · C ${t.c.toFixed(1)}g · F ${t.f.toFixed(1)}g`;
}

// ── Modals ──────────────────────────────────────────────────────────────────
function populateGroupSelect(selId, current = '') {
  const sel = document.getElementById(selId); if (!sel) return;
  sel.innerHTML = '<option value="">— Ungrouped —</option>' + dietGroups().map(g => `<option value="${g.id}"${current === g.id ? ' selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
}

export function openMealModal(id) {
  const editing = id ? meals().find(m => m.id === id) : null;
  document.getElementById('m-meal-title').textContent = editing ? 'Edit meal' : 'Add meal';
  document.getElementById('meal-edit-id').value = editing?.id || '';
  document.getElementById('meal-name').value = editing?.name || '';
  document.getElementById('meal-type').value = editing?.type || 'meal';
  document.getElementById('meal-time').value = editing?.time || '';
  document.getElementById('meal-as-habit').checked = !!editing?.asHabit;
  setWeekdayPicker('meal-weekday-picker', editing?.schedule?.activeDays || null);
  populateGroupSelect('meal-group', editing?.groupId || '');
  const list = document.getElementById('meal-foods-list'); if (list) list.innerHTML = '';
  const foods = editing?.foods || [{}];
  foods.forEach(f => renderFoodRow(f));
  refreshMealTotals();
  document.getElementById('m-meal').style.display = 'flex';
}

export function saveMeal() {
  const name = document.getElementById('meal-name').value.trim();
  if (!name) { window.toast?.('Name required'); return; }
  const id = document.getElementById('meal-edit-id').value || uid();
  const existing = meals().find(m => m.id === id);
  const meal = existing || { id };
  meal.name = name;
  meal.type = document.getElementById('meal-type').value;
  meal.time = document.getElementById('meal-time').value || '';
  meal.asHabit = !!document.getElementById('meal-as-habit').checked;
  meal.schedule = { activeDays: readWeekdayPicker('meal-weekday-picker') };
  meal.groupId = document.getElementById('meal-group').value || null;
  meal.foods = readFoods();
  recomputeTotals(meal);
  if (!existing) meals().push(meal);
  syncMealHabits(meal);
  haptic('medium'); save();
  window.closeModal?.('m-meal');
  renderDiet();
  window.renderHabitsToday?.(); window.renderHabitsAll?.(); window.renderDash?.();
}

export function deleteMeal(id) {
  if (!confirm('Delete this meal?')) return;
  S.meals = meals().filter(m => m.id !== id);
  clearMealHabits(id);
  save(); renderDiet();
  window.renderHabitsToday?.(); window.renderHabitsAll?.(); window.renderDash?.();
}

// ── Diet groups ─────────────────────────────────────────────────────────────
export function openDietGroupModal(id) {
  const editing = id ? dietGroups().find(g => g.id === id) : null;
  document.getElementById('m-diet-group-title').textContent = editing ? 'Edit group' : 'New group';
  document.getElementById('diet-group-edit-id').value = editing?.id || '';
  document.getElementById('diet-group-name').value = editing?.name || '';
  document.getElementById('m-diet-group').style.display = 'flex';
}
export function saveDietGroup() {
  const name = document.getElementById('diet-group-name').value.trim();
  if (!name) return;
  const id = document.getElementById('diet-group-edit-id').value || uid();
  const existing = dietGroups().find(g => g.id === id);
  if (existing) existing.name = name;
  else dietGroups().push({ id, name, order: dietGroups().length });
  save(); window.closeModal?.('m-diet-group'); renderDiet();
}
export function deleteDietGroup(id) {
  if (!confirm('Delete group? Members move to Ungrouped.')) return;
  S.dietGroups = dietGroups().filter(g => g.id !== id);
  meals().forEach(m => { if (m.groupId === id) m.groupId = null; });
  save(); renderDiet();
}
export function moveMealToGroup(mealId, groupId) {
  const m = meals().find(x => x.id === mealId); if (!m) return;
  m.groupId = groupId || null; save(); renderDiet();
}

// ── Today log ───────────────────────────────────────────────────────────────
export function openMealPick() {
  const sel = document.getElementById('meal-pick-id'); if (!sel) return;
  if (!meals().length) { window.toast?.('Create a meal first'); return; }
  sel.innerHTML = meals().map(m => `<option value="${m.id}">${escapeHtml(m.name)} — ${Math.round(m.totals?.kcal || 0)} kcal</option>`).join('');
  document.getElementById('meal-pick-servings').value = '1';
  document.getElementById('m-meal-pick').style.display = 'flex';
}
export function logMealToday() {
  const id = document.getElementById('meal-pick-id').value;
  const servings = parseFloat(document.getElementById('meal-pick-servings').value) || 1;
  if (!id) return;
  const d = diet(); const k = today();
  if (!d.log[k]) d.log[k] = [];
  d.log[k].push({ mealId: id, time: new Date().toTimeString().slice(0, 5), servings });
  save(); window.closeModal?.('m-meal-pick'); renderDiet();
}
export function unlogMeal(idx) {
  const d = diet(); const k = today();
  (d.log[k] || []).splice(idx, 1); save(); renderDiet();
}

// ── Settings updaters ───────────────────────────────────────────────────────
export function updateDietGoal(v) { diet().goal = v; save(); renderDiet(); }
export function updateDietAdjust(v) { diet().calorieAdjust = parseInt(v, 10) || 0; save(); renderDiet(); }
export function updateDietTDEE(v)   { const n = parseInt(v, 10); diet().manualTDEEOverride = n > 0 ? n : null; save(); renderDiet(); }
export function updateCalcField(k, v) {
  const d = diet(); if (!d.calculator) d.calculator = {};
  d.calculator[k] = v; save(); renderDiet();
}
export function showCalcInfo(method) {
  const txt = CALC_INFO[method] || '';
  if (txt) window.toast?.(txt);
}


// ── Render ──────────────────────────────────────────────────────────────────
function renderSummary() {
  const el = document.getElementById('diet-summary'); if (!el) return;
  const d = diet(); const k = today();
  const target = dailyTarget();
  const w = parseFloat(S.profile?.weight) || 0;
  const consumed = (d.log[k] || []).reduce((acc, e) => {
    const m = meals().find(x => x.id === e.mealId);
    if (!m?.totals) return acc;
    const s = e.servings || 1;
    return {
      kcal: acc.kcal + (m.totals.kcal || 0) * s,
      p:    acc.p    + (m.totals.p || 0)    * s,
      c:    acc.c    + (m.totals.c || 0)    * s,
      f:    acc.f    + (m.totals.f || 0)    * s,
    };
  }, { kcal: 0, p: 0, c: 0, f: 0 });
  const remaining = target ? target - consumed.kcal : 0;
  if (!w && !d.manualTDEEOverride) {
    el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">Daily target</div></div>
      <div style="font-size:13px;color:var(--text2)">Set your weight on the <a href="#" onclick="goPage('profile');return false">Profile page</a> (or override TDEE below) to compute a target.</div></div>`;
    return;
  }
  el.innerHTML = `<div class="card">
    <div class="card-header"><div class="card-title">Today</div><div style="font-size:11px;color:var(--text3)">target ${target} kcal</div></div>
    <div class="stat-grid">
      <div class="stat-card" style="--accent:var(--violet)"><div class="stat-num">${Math.round(consumed.kcal)}</div><div class="stat-label">Consumed</div></div>
      <div class="stat-card" style="--accent:var(--teal)"><div class="stat-num">${Math.round(remaining)}</div><div class="stat-label">Remaining</div></div>
      <div class="stat-card" style="--accent:var(--gold)"><div class="stat-num">${consumed.p.toFixed(0)}g</div><div class="stat-label">Protein</div></div>
      <div class="stat-card" style="--accent:var(--green)"><div class="stat-num">${consumed.c.toFixed(0)}g</div><div class="stat-label">Carbs</div></div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Fat ${consumed.f.toFixed(0)}g · TDEE ${tdee()} kcal · weight ${w || '—'}kg</div>
  </div>`;
}

function renderCalculator() {
  const el = document.getElementById('diet-calculator'); if (!el) return;
  const c = diet().calculator || {};
  const method = c.method || 'mifflin';
  const result = computeCalculatorTDEE();
  const showHeight = method !== 'simple' && method !== 'katch';
  const showAge    = method !== 'simple' && method !== 'katch';
  const showSex    = method === 'mifflin' || method === 'harris';
  const showBF     = method === 'katch';
  el.innerHTML = `<div class="card">
    <div class="card-header"><div class="card-title">🧮 Calorie calculator</div>${result ? `<div style="font-size:13px;color:var(--teal);font-weight:600">${result} kcal/day TDEE</div>` : ''}</div>
    <div class="form-row"><label style="display:flex;align-items:center;gap:6px">Method <button type="button" class="btn btn-xs" title="What does this mean?" onclick="showCalcInfo('${method}')" style="padding:1px 6px;font-size:11px">i</button></label>
      <select onchange="updateCalcField('method', this.value); showCalcInfo(this.value)">
        <option value="mifflin"${method==='mifflin'?' selected':''}>Mifflin-St Jeor (recommended)</option>
        <option value="harris"${method==='harris'?' selected':''}>Harris-Benedict (revised)</option>
        <option value="katch"${method==='katch'?' selected':''}>Katch-McArdle (needs body-fat %)</option>
        <option value="simple"${method==='simple'?' selected':''}>Simple (weight × 30)</option>
      </select>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Weight (kg)</label><input type="number" step="0.1" value="${c.weight ?? S.profile?.weight ?? ''}" onchange="updateCalcField('weight', this.value)"></div>
      ${showHeight ? `<div class="form-row"><label>Height (cm)</label><input type="number" step="1" value="${c.height ?? ''}" onchange="updateCalcField('height', this.value)"></div>` : ''}
      ${showAge    ? `<div class="form-row"><label>Age</label><input type="number" step="1" value="${c.age ?? ''}" onchange="updateCalcField('age', this.value)"></div>` : ''}
      ${showSex    ? `<div class="form-row"><label>Sex</label><select onchange="updateCalcField('sex', this.value)">
        <option value="male"${(c.sex||'male')==='male'?' selected':''}>Male</option>
        <option value="female"${c.sex==='female'?' selected':''}>Female</option>
      </select></div>` : ''}
      ${showBF     ? `<div class="form-row"><label>Body fat %</label><input type="number" step="0.1" value="${c.bodyFat ?? ''}" onchange="updateCalcField('bodyFat', this.value)"></div>` : ''}
      <div class="form-row"><label>Activity</label><select onchange="updateCalcField('activity', this.value)">
        ${Object.entries(ACTIVITY).map(([k, a]) => `<option value="${k}"${(c.activity||'moderate')===k?' selected':''}>${a.label}</option>`).join('')}
      </select></div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">TDEE feeds the daily target above — the goal/adjust setting then adds or subtracts kcal.</div>
  </div>`;
}

function renderSettings() {
  const el = document.getElementById('diet-settings'); if (!el) return;
  const d = diet();
  el.innerHTML = `<div class="card">
    <div class="card-header"><div class="card-title">Goal & target</div></div>
    <div class="form-grid">
      <div class="form-row"><label>Goal</label><select onchange="updateDietGoal(this.value)">
        <option value="maintain"${d.goal === 'maintain' ? ' selected' : ''}>Maintain</option>
        <option value="lose"${d.goal === 'lose' ? ' selected' : ''}>Lose weight</option>
        <option value="gain"${d.goal === 'gain' ? ' selected' : ''}>Gain weight</option>
      </select></div>
      <div class="form-row"><label>± kcal/day</label><input type="number" value="${d.calorieAdjust || 0}" onchange="updateDietAdjust(this.value)"></div>
      <div class="form-row"><label>TDEE override (optional)</label><input type="number" value="${d.manualTDEEOverride || ''}" placeholder="${tdee() || 'auto'}" onchange="updateDietTDEE(this.value)"></div>
    </div>
  </div>`;
}

function renderToday() {
  const root = document.getElementById('diet-today'); if (!root) return;
  const d = diet(); const k = today();
  const entries = d.log[k] || [];
  const rows = entries.map((e, i) => {
    const m = meals().find(x => x.id === e.mealId);
    if (!m) return '';
    const t = m.totals || {};
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1"><div style="font-weight:600;font-size:13px">${escapeHtml(m.name)} <span style="color:var(--text3);font-weight:400;font-size:11px">× ${e.servings}</span></div>
      <div style="font-size:11px;color:var(--text3)">${Math.round((t.kcal || 0) * e.servings)} kcal · P ${((t.p || 0) * e.servings).toFixed(0)} · C ${((t.c || 0) * e.servings).toFixed(0)} · F ${((t.f || 0) * e.servings).toFixed(0)}</div></div>
      <button class="btn btn-xs" onclick="unlogMeal(${i})">×</button>
    </div>`;
  }).join('');
  root.innerHTML = `<div class="card">
    <div class="card-header"><div class="card-title">Today's meals</div>
      <button class="btn btn-sm btn-primary" onclick="openMealPick()">+ Add from database</button>
    </div>
    ${rows || '<div class="caption">No meals logged today.</div>'}
  </div>`;
}

const reorderDetach = {};

function renderMealCard(m) {
  const groupOpts = '<option value="">— Ungrouped —</option>' + dietGroups().map(g => `<option value="${g.id}"${m.groupId === g.id ? ' selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
  const t = m.totals || {};
  return `<div class="meal-row" data-meal-id="${m.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:6px;background:var(--surface)">
    <span class="meal-drag-handle" style="cursor:grab;color:var(--text3);user-select:none;touch-action:none;font-size:14px" title="Drag">≡</span>
    <span style="font-size:18px">${m.type === 'drink' ? '🥤' : m.type === 'shake' ? '🥛' : m.type === 'snack' ? '🍎' : '🍽'}</span>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:14px">${escapeHtml(m.name)}${m.asHabit ? ' <span class="badge" style="font-size:10px">habit</span>' : ''}</div>
      <div style="font-size:11px;color:var(--text3)">${Math.round(t.kcal || 0)} kcal · P ${(t.p || 0).toFixed(0)} · C ${(t.c || 0).toFixed(0)} · F ${(t.f || 0).toFixed(0)}${m.time ? ' · ' + m.time : ''}</div>
    </div>
    <select onchange="moveMealToGroup('${m.id}', this.value)" style="font-size:11px;padding:2px 4px">${groupOpts}</select>
    <button class="btn btn-xs" onclick="openMealModal('${m.id}')" title="Edit">✎</button>
    <button class="btn btn-xs" onclick="deleteMeal('${m.id}')" title="Delete">×</button>
  </div>`;
}

function renderDB() {
  const root = document.getElementById('diet-db'); if (!root) return;
  const all = meals();
  if (!all.length && !dietGroups().length) {
    root.innerHTML = '<div class="empty-state"><div class="es-icon">🍽</div><div class="es-sub">No meals yet — tap + Meal to start.</div></div>';
    return;
  }
  Object.values(reorderDetach).forEach(fn => { try { fn?.(); } catch {} });
  Object.keys(reorderDetach).forEach(k => delete reorderDetach[k]);
  const sections = [];
  dietGroups().forEach(g => {
    const members = all.filter(m => m.groupId === g.id);
    sections.push(`<div class="card" style="margin-bottom:14px">
      <div class="card-header"><div class="card-title">${escapeHtml(g.name)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-xs" onclick="openDietGroupModal('${g.id}')">Edit</button>
          <button class="btn btn-xs" onclick="deleteDietGroup('${g.id}')">×</button>
        </div>
      </div>
      <div class="meal-group-list" data-group-id="${g.id}">${members.map(renderMealCard).join('') || '<div class="caption">Empty group.</div>'}</div>
    </div>`);
  });
  const ungrouped = all.filter(m => !m.groupId || !dietGroups().find(g => g.id === m.groupId));
  if (ungrouped.length || dietGroups().length === 0) {
    sections.push(`<div class="card" style="margin-bottom:14px"><div class="card-header"><div class="card-title">Ungrouped</div></div><div class="meal-group-list" data-group-id="">${ungrouped.map(renderMealCard).join('') || '<div class="caption">No items.</div>'}</div></div>`);
  }
  root.innerHTML = sections.join('');
  document.querySelectorAll('.meal-group-list').forEach(list => {
    const gid = list.dataset.groupId || '';
    reorderDetach[gid || '_un'] = attachReorder(list, {
      itemSelector: '.meal-row',
      handleSelector: '.meal-drag-handle',
      onReorder: (from, to) => {
        const inGroup = meals().filter(m => (m.groupId || '') === gid);
        const moved = inGroup[from]; const target = inGroup[to];
        if (!moved || !target) return;
        const fromIdx = meals().indexOf(moved);
        const toIdx = meals().indexOf(target);
        reorderArr(meals(), fromIdx, toIdx);
        save(); renderDB();
      },
    });
  });
}

function bindTabs() {
  document.querySelectorAll('#page-diet [data-diet-tab]').forEach(t => {
    if (t._bound) return; t._bound = true;
    t.onclick = () => {
      document.querySelectorAll('#page-diet [data-diet-tab]').forEach(x => x.classList.toggle('active', x === t));
      const which = t.dataset.dietTab;
      document.getElementById('diet-today').style.display = which === 'today' ? '' : 'none';
      document.getElementById('diet-db').style.display    = which === 'db'    ? '' : 'none';
    };
  });
}

export function renderDiet() {
  bindTabs();
  renderSummary();
  renderCalculator();
  renderSettings();
  renderToday();
  renderDB();
}

export function listMealsForPicker() {
  return meals().map(m => ({ id: m.id, name: m.name, type: m.type }));
}

window.openMealModal = openMealModal;
window.saveMeal = saveMeal;
window.deleteMeal = deleteMeal;
window.addMealFood = addMealFood;
window.openDietGroupModal = openDietGroupModal;
window.saveDietGroup = saveDietGroup;
window.deleteDietGroup = deleteDietGroup;
window.moveMealToGroup = moveMealToGroup;
window.openMealPick = openMealPick;
window.logMealToday = logMealToday;
window.unlogMeal = unlogMeal;
window.updateDietGoal = updateDietGoal;
window.updateDietAdjust = updateDietAdjust;
window.updateDietTDEE = updateDietTDEE;
window.updateCalcField = updateCalcField;
window.showCalcInfo = showCalcInfo;
window.renderDiet = renderDiet;
window.listMealsForPicker = listMealsForPicker;
window.logMealFromHabitTick = logMealFromHabitTick;
