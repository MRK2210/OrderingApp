// --- Config ---
const CURRENCY = '₹';
// Update this with your Function URL later
const ORDER_API = '/api/place-order';
// Optional: local placeholder image (data URL) if product image is missing
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
  <rect width="160" height="120" fill="#0b162b"/>
  <g fill="#9ca3af" font-family="Segoe UI, Roboto" font-size="12">
    <text x="50%" y="50%" text-anchor="middle">No image</text>
  </g>
</svg>`);

// --- State ---
let products = [];
let cart = new Map();

const fmt = (n) => `${CURRENCY}${Number(n).toFixed(2)}`;

function getQueryParam(name){
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function imgEl(src, alt){
  const box = document.createElement('div');
  box.className = 'imgbox';
  if(src){
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = alt || '';
    img.src = src;
    img.onerror = () => { img.src = PLACEHOLDER; };
    box.appendChild(img);
  }else{
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = 'No image';
    box.appendChild(ph);
  }
  return box;
}

function renderProducts(){
  const list = document.getElementById('productList');
  list.innerHTML = '';
  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product';

    // Image box
    card.appendChild(imgEl(p.imageUrl, p.name));

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.name;

    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = `${fmt(p.price)} / ${p.unit || 'unit'}`;

    const qty = document.createElement('div');
    qty.className = 'qty';
    qty.innerHTML = `
      <button aria-label="Decrease" data-id="${p.id}" data-act="dec">−</button>
      <input type="number" min="0" value="0" data-id="${p.id}" aria-label="Quantity"/>
      <button aria-label="Increase" data-id="${p.id}" data-act="inc">+</button>`;

    qty.querySelectorAll('button').forEach(btn => btn.addEventListener('click', onQtyButton));
    qty.querySelector('input').addEventListener('input', onQtyInput);

    card.appendChild(name);
    card.appendChild(price);
    card.appendChild(qty);

    list.appendChild(card);
  });
}

function onQtyButton(e){
  const id = e.currentTarget.getAttribute('data-id');
  const act = e.currentTarget.getAttribute('data-act');
  const input = document.querySelector(`input[data-id="${id}"]`);
  let v = Number(input.value || 0);
  v = act === 'inc' ? v + 1 : Math.max(0, v - 1);
  input.value = v;
  updateCartFromInput(id, v);
}

function onQtyInput(e){
  const id = e.currentTarget.getAttribute('data-id');
  const v = Math.max(0, Number(e.currentTarget.value || 0));
  e.currentTarget.value = v;
  updateCartFromInput(id, v);
}

function updateCartFromInput(id, qty){
  const p = products.find(x => String(x.id) === String(id));
  if(!p) return;
  if(qty > 0){ cart.set(id, { product: p, qty }); }
  else { cart.delete(id); }
  renderCart();
}

function renderCart(){
  const cont = document.getElementById('cartItems');
  cont.innerHTML = '';
  if(cart.size === 0){
    cont.classList.add('empty');
    cont.textContent = 'No items yet.';
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('grandTotal').textContent = fmt(0);
    return;
  }
  cont.classList.remove('empty');

  let total = 0;
  cart.forEach(({product, qty}, id) => {
    const line = qty * product.price;
    total += line;
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <div>${product.name} × ${qty}</div>
      <div class="line-total">${fmt(line)}</div>
      <button class="mini-remove" data-id="${id}">Remove</button>`;
    row.querySelector('button').addEventListener('click', () => removeItem(id));
    cont.appendChild(row);
  });

  document.getElementById('grandTotal').textContent = fmt(total);
  document.getElementById('submitBtn').disabled = false;
}

function removeItem(id){
  cart.delete(id);
  const input = document.querySelector(`input[data-id="${id}"]`);
  if(input) input.value = 0;
  renderCart();
}

async function loadProducts(){
  try{
    const res = await fetch('products.sample.json',{cache:'no-cache'});
    products = await res.json();
  }catch(err){
    // Fallback sample with images omitted
    products = [
      { id: 1, name: 'Atta (10kg)', price: 450, unit: 'bag', imageUrl: '' },
      { id: 2, name: 'Rice (25kg)', price: 1300, unit: 'bag', imageUrl: '' },
      { id: 3, name: 'Sugar (5kg)', price: 260, unit: 'bag', imageUrl: '' },
      { id: 4, name: 'Cooking Oil (1L)', price: 140, unit: 'bottle', imageUrl: '' }
    ];
  }
  renderProducts();
}

async function submitOrder(){
  const retailerName = document.getElementById('retailerName').value.trim();
  const status = document.getElementById('status');
  if(!retailerName){ status.textContent = 'Please enter retailer/shop name.'; return; }
  if(cart.size === 0){ status.textContent = 'Please add at least one product.'; return; }

  const items = Array.from(cart.values()).map(({product, qty}) => ({ id: product.id, name: product.name, qty, price: product.price }));
  const payload = { retailerName, items, placedAt: new Date().toISOString() };

  status.textContent = 'Submitting order…';
  try{
    const res = await fetch(ORDER_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if(!res.ok){ throw new Error(`API error ${res.status}`); }
    const data = await res.json().catch(()=>({message:'Order placed'}));
    status.textContent = data.message || 'Order placed successfully!';

    cart.clear();
    document.querySelectorAll('.products input[type="number"]').forEach(i=> i.value = 0);
    renderCart();
  }catch(err){ console.error(err); status.textContent = 'Failed to submit. Please try again.'; }
}

function initRetailerPrefill(){
  const q = getQueryParam('retailer');
  if(q){ const input = document.getElementById('retailerName'); input.value = decodeURIComponent(q.replace(/\+/g,' ')); }
}

function init(){
  document.getElementById('year').textContent = new Date().getFullYear();
  document.getElementById('submitBtn').addEventListener('click', submitOrder);
  initRetailerPrefill();
  loadProducts();
}

document.addEventListener('DOMContentLoaded', init);
