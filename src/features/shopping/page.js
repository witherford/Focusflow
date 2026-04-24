// Shopping — extracted from focusflow_v10.html lines 2331-2353
import { S, uid } from '../../core/state.js';
import { save, shopCats, CAT_ICONS } from '../../core/persistence.js';
import { callAI, extractJSON } from '../../core/ai.js';

export function renderShop() {
  const el = document.getElementById('shop-list'); if (!el) return;
  const total = S.shopping.length, done = S.shopping.filter(i => i.checked).length;
  const tEl = document.getElementById('shop-total'), dEl = document.getElementById('shop-done');
  if (tEl) tEl.textContent = total; if (dEl) dEl.textContent = done;
  if (!total) { el.innerHTML = '<div style="color:var(--text3);text-align:center;padding:40px">Your list is empty</div>'; return; }
  const sortBy = document.getElementById('shop-sort')?.value || 'category';
  const filterBy = document.getElementById('shop-filter')?.value || 'all';
  let items = [...S.shopping];
  if (filterBy === 'unchecked') items = items.filter(i => !i.checked); else if (filterBy === 'checked') items = items.filter(i => i.checked);
  if (sortBy === 'category') items.sort((a, b) => (a.category || '').localeCompare(b.category || '')); else items.sort((a, b) => a.name.localeCompare(b.name));
  const groups = {}; items.forEach(i => { const k = i.category || 'Other'; if (!groups[k]) groups[k] = []; groups[k].push(i); });
  const totalCost = S.shopping.filter(i => i.price).reduce((a, i) => a + (parseFloat(i.price) || 0), 0);
  el.innerHTML = (totalCost > 0 ? `<div style="text-align:right;font-size:13px;color:var(--text3);margin-bottom:10px">Est. total: <strong style="color:var(--text)">£${totalCost.toFixed(2)}</strong></div>` : '') +
    Object.entries(groups).map(([grp, grpI]) => `<div class="card" style="margin-bottom:10px"><div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">${CAT_ICONS[grp] || '🏪'} ${grp} <span style="font-weight:400;color:var(--border3)">(${grpI.filter(i => i.checked).length}/${grpI.length})</span></div>${grpI.map(i => `<div class="shop-item ${i.checked ? 'is-checked' : ''}"><div class="shop-check ${i.checked ? 'checked' : ''}" onclick="toggleShop('${i.id}')">✓</div><div style="flex:1;min-width:0"><div class="shop-name">${i.name}</div>${i.qty || i.supermarket || i.price ? `<div class="shop-meta">${[i.qty, i.supermarket, i.price ? '£' + parseFloat(i.price).toFixed(2) : ''].filter(Boolean).join(' · ')}</div>` : ''}</div><button class="btn-icon" onclick="openEditShop('${i.id}')">✏️</button><button class="btn-icon danger" onclick="delShop('${i.id}')">✕</button></div>`).join('')}</div>`).join('');
}

export function toggleShop(id) { const i = S.shopping.find(x => x.id === id); if (!i) return; i.checked = !i.checked; save(); renderShop(); }
export function delShop(id) { S.shopping = S.shopping.filter(i => i.id !== id); save(); renderShop(); }
export function clearChecked() { S.shopping = S.shopping.filter(i => !i.checked); save(); renderShop(); window.toast('Cleared ✓'); }
export function clearAllShop() { S.shopping = []; save(); renderShop(); }
export function openAddShop() { document.getElementById('m-shop-title').textContent = 'Add Item'; document.getElementById('shop-edit-id').value = ''; ['shop-name', 'shop-qty', 'shop-price', 'shop-super'].forEach(id => document.getElementById(id).value = ''); window.populateSel('shop-cat', shopCats(), 'Other'); document.getElementById('m-shop').style.display = 'flex'; }
export function openEditShop(id) { const i = S.shopping.find(x => x.id === id); if (!i) return; document.getElementById('m-shop-title').textContent = 'Edit Item'; document.getElementById('shop-edit-id').value = id; document.getElementById('shop-name').value = i.name; document.getElementById('shop-qty').value = i.qty || ''; document.getElementById('shop-price').value = i.price || ''; document.getElementById('shop-super').value = i.supermarket || ''; window.populateSel('shop-cat', shopCats(), i.category || 'Other'); document.getElementById('m-shop').style.display = 'flex'; }
export function saveShop() { const name = document.getElementById('shop-name').value.trim(); if (!name) return; const editId = document.getElementById('shop-edit-id').value, data = { name, qty: document.getElementById('shop-qty').value, price: document.getElementById('shop-price').value, category: document.getElementById('shop-cat').value, supermarket: document.getElementById('shop-super').value, checked: false }; if (editId) { const i = S.shopping.find(x => x.id === editId); if (i) Object.assign(i, { ...data, checked: i.checked }); } else S.shopping.push({ id: uid(), ...data }); save(); window.closeModal('m-shop'); renderShop(); }

export async function genShoppingList() {
  const btn = document.getElementById('shop-gen-btn'), status = document.getElementById('shop-status');
  btn.disabled = true; btn.textContent = '⏳…'; status.textContent = 'Generating…';
  const p = S.profile;
  const prompt = `Create a weekly healthy shopping list. Return ONLY a raw JSON array, no markdown.\nProfile: Weight ${p.weight || 'unknown'}kg, Diet: ${p.diet}, Meals/day: ${p.meals}, Allergies: ${p.allergies || 'none'}, Goals: ${p.goals || 'general health'}\nFormat: [{"name":"","qty":"","category":"Protein|Vegetables|Fruit|Grains & Carbs|Dairy & Eggs|Healthy Fats|Snacks|Drinks|Supplements|Other","supermarket":""}]\nCreate 30-35 specific items.`;
  try {
    const raw = await callAI(prompt); const items = extractJSON(raw, true);
    S.shopping = [...S.shopping, ...items.map(i => ({ id: uid(), name: i.name, qty: i.qty || '', price: '', category: i.category || 'Other', supermarket: i.supermarket || '', checked: false }))];
    save(); renderShop(); btn.disabled = false; btn.textContent = '🤖 Regenerate'; status.textContent = `Added ${items.length} items ✓`; window.toast(`${items.length} items added!`);
  } catch (e) { btn.disabled = false; btn.textContent = '🤖 Generate List'; status.textContent = 'Failed — try again'; }
}

window.renderShop = renderShop;
window.toggleShop = toggleShop;
window.delShop = delShop;
window.clearChecked = clearChecked;
window.clearAllShop = clearAllShop;
window.openAddShop = openAddShop;
window.openEditShop = openEditShop;
window.saveShop = saveShop;
window.genShoppingList = genShoppingList;
