/* ===== 導覽 ===== */
const toggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('#site-nav');
const mobileLayout = window.matchMedia('(max-width: 767px)');
const $ = (id) => document.getElementById(id);

document.documentElement.classList.add('has-js');
toggle.hidden = false;

function closeMenu() { toggle.setAttribute('aria-expanded', 'false'); }

toggle.addEventListener('click', () => {
  toggle.setAttribute('aria-expanded', String(toggle.getAttribute('aria-expanded') === 'false'));
});

siteNav.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || !mobileLayout.matches) return;
  const target = $(link.hash.slice(1));
  closeMenu();
  if (target) {
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    toggle.focus();
  }
});
mobileLayout.addEventListener('change', closeMenu);

/* ===== 捲動效果：進度條、標頭、目前區塊、顯現動畫 ===== */
const header = document.querySelector('.header');
const bar = document.querySelector('.progress i');
const navLinks = [...siteNav.querySelectorAll('a:not(.button)')];

function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  header.classList.toggle('scrolled', scrollY > 8);
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  reveals.forEach((el) => io.observe(el));

  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('active', a.hash === `#${e.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['menu', 'story', 'visit'].forEach((id) => spy.observe($(id)));
} else {
  reveals.forEach((el) => el.classList.add('in'));
}

/* 3D 傾斜：滑鼠移動時依位置旋轉，並帶出光澤與內層視差 */
const canTilt = matchMedia('(hover: hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
function bindTilt(el) {
  if (!canTilt || el.dataset.tiltBound) return;
  el.dataset.tiltBound = '1';
  const max = parseFloat(el.dataset.tilt) || 8;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
    el.style.setProperty('--px', x.toFixed(3));
    el.style.setProperty('--py', y.toFixed(3));
    el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
    el.classList.add('tilting');
  });
  el.addEventListener('pointerleave', () => {
    ['--rx', '--ry', '--px', '--py'].forEach((p) => el.style.setProperty(p, 0));
    el.classList.remove('tilting');
  });
}
document.querySelectorAll('[data-tilt]').forEach(bindTilt);

/* 首屏大字隨捲動產生景深 */
const kanji = document.querySelector('.hero-kanji');
if (canTilt) {
  addEventListener('scroll', () => {
    kanji.style.transform = `translateY(${scrollY * 0.18}px) rotateY(${Math.min(scrollY / 20, 25)}deg)`;
  }, { passive: true });
}

/* ===== 菜單資料（價格為暫定，正式價格請在此修改） ===== */
const SPICE = ['不辣', '微辣', '中辣'];
const DISHES = [
  { id: 'pork', cat: '鍋貼', name: '豬肉高麗菜鍋貼', price: 120, portion: '8 顆', img: 'assets/pork.jpg', pos: 'center 56%', glyph: '豬', spice: true,
    tag: '招牌・經典', desc: '鍋貼底煎到酥脆，裡頭是多汁豬肉和帶清甜的高麗菜。' },
  { id: 'shrimp', cat: '鍋貼', name: '鮮蝦青蔥鍋貼', price: 160, portion: '8 顆', img: 'assets/shrimp.jpg', pos: 'center', glyph: '蝦', spice: true,
    tag: '招牌・海味', desc: '蝦肉彈嫩，青蔥帶出香氣，配上薄脆的煎底。' },
  { id: 'mushroom', cat: '鍋貼', name: '香菇高麗菜鍋貼', price: 110, portion: '8 顆', img: 'assets/mushroom.jpg', pos: 'center', glyph: '菇', spice: true,
    tag: '招牌・蔬食', desc: '香菇帶著厚實香氣，高麗菜保留清脆的口感。' },
  { id: 'soup', cat: '小菜湯品', name: '酸辣湯', price: 60, portion: '1 碗', glyph: '湯', spice: true,
    tag: '暖胃湯品', desc: '酸得開胃、辣得溫和，配鍋貼剛剛好。' },
  { id: 'cucumber', cat: '小菜湯品', name: '涼拌小黃瓜', price: 50, portion: '1 份', glyph: '瓜', spice: true,
    tag: '清爽小菜', desc: '拍碎的小黃瓜拌上蒜香醬汁，解膩爽口。' },
  { id: 'tea', cat: '飲品', name: '冰鎮麥茶', price: 40, portion: '1 杯', glyph: '茶', spice: false,
    tag: '解膩飲品', desc: '烘焙香氣的冰麥茶，吃完煎餃來一杯。' },
  { id: 'beer', cat: '飲品', name: '生啤酒', price: 120, portion: '1 杯', glyph: '酒', spice: false,
    tag: '居酒屋必點', desc: '冰涼生啤配熱騰騰鍋貼。未成年請勿飲酒。' },
];
const byId = Object.fromEntries(DISHES.map((d) => [d.id, d]));
const CATS = ['全部', ...new Set(DISHES.map((d) => d.cat))];
const money = (n) => `NT$${n}`;

/* ===== 點餐單狀態 ===== */
const STORE = 'zhijiaozuo-order-v1';
let order = [];
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || '[]');
  order = saved.filter((o) => byId[o.id] && Number.isInteger(o.qty) && o.qty > 0 && o.qty <= 20);
} catch { order = []; }
const saveOrder = () => { try { localStorage.setItem(STORE, JSON.stringify(order)); } catch { /* 略過 */ } };

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
}

/* ===== 菜單展示 ===== */
let currentId = DISHES[0].id;
let activeCat = '全部';
let qty = 1;
let spice = SPICE[0];

function setBadge(text) {
  const b = $('stage-price');
  b.textContent = text;
  b.classList.remove('pop');
  void b.offsetWidth;
  b.classList.add('pop');
}

function chip(label, pressed, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.textContent = label;
  b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', onClick);
  return b;
}

function renderSpice() {
  const d = byId[currentId];
  $('d-spice-box').hidden = !d.spice;
  const wrap = $('d-spice');
  wrap.replaceChildren(...SPICE.map((s) => chip(s, s === spice, () => { spice = s; renderSpice(); })));
}

function updateSub() { $('d-sub').textContent = `· ${money(byId[currentId].price * qty)}`; }

function showDish(id, animate = true) {
  const d = byId[id];
  currentId = id;
  qty = 1;
  spice = SPICE[0];

  const photo = $('stage-photo');
  let node;
  if (d.img) {
    node = document.createElement('img');
    node.src = d.img;
    node.alt = `${d.name}示意照`;
    node.style.objectPosition = d.pos || 'center';
  } else {
    node = document.createElement('div');
    node.className = 'glyph-tile';
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', `${d.name}，暫無照片`);
    node.textContent = d.glyph;
  }
  photo.replaceChildren(node);

  // 重新觸發右側詳情動畫
  const detail = $('detail');
  if (animate) {
    detail.style.animation = 'none';
    [...detail.children].forEach((c) => { c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; });
    detail.style.animation = '';
  }

  $('d-tag').textContent = d.tag;
  $('d-name').textContent = d.name;
  $('d-desc').textContent = d.desc;
  $('d-portion').textContent = d.portion;
  $('d-price').textContent = `${money(d.price)}（暫定）`;
  $('d-qty').textContent = qty;
  updateSub();
  setBadge(money(d.price));
  renderSpice();

  document.querySelectorAll('.dish-card').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.id === id)));
}

function renderTabs() {
  $('cat-tabs').replaceChildren(...CATS.map((c) => {
    const b = chip(c, c === activeCat, () => { activeCat = c; renderTabs(); renderCards(); });
    return b;
  }));
}

function renderCards() {
  const list = DISHES.filter((d) => activeCat === '全部' || d.cat === activeCat);
  $('dish-cards').replaceChildren(...list.map((d, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dish-card';
    b.dataset.id = d.id;
    b.style.animationDelay = `${i * 50}ms`;
    b.setAttribute('aria-pressed', String(d.id === currentId));
    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    if (d.img) {
      const im = document.createElement('img');
      im.src = d.img; im.alt = ''; im.loading = 'lazy';
      thumb.append(im);
    } else {
      thumb.textContent = d.glyph;
    }
    const txt = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = d.name;
    const price = document.createElement('small');
    price.textContent = `${money(d.price)}・${d.portion}`;
    txt.append(name, price);
    b.append(thumb, txt);
    b.addEventListener('click', () => showDish(d.id));
    b.dataset.tilt = '12';
    bindTilt(b);
    li.append(b);
    return li;
  }));
}

$('d-minus').addEventListener('click', () => { qty = Math.max(1, qty - 1); $('d-qty').textContent = qty; updateSub(); });
$('d-plus').addEventListener('click', () => { qty = Math.min(20, qty + 1); $('d-qty').textContent = qty; updateSub(); });

$('d-add').addEventListener('click', () => {
  const d = byId[currentId];
  const sp = d.spice ? spice : '';
  const found = order.find((o) => o.id === d.id && o.spice === sp);
  if (found) found.qty = Math.min(20, found.qty + qty);
  else order.push({ id: d.id, spice: sp, qty });
  saveOrder();
  renderOrder(true);
  toast(`已加入：${d.name} ×${qty}`);
  const btn = $('d-add');
  btn.classList.add('done');
  setTimeout(() => btn.classList.remove('done'), 900);
  qty = 1; $('d-qty').textContent = 1; updateSub();
});

/* ===== 點餐單顯示 ===== */
function orderTotal() { return order.reduce((s, o) => s + byId[o.id].price * o.qty, 0); }
function orderCount() { return order.reduce((s, o) => s + o.qty, 0); }

function renderOrder(bump = false) {
  const list = $('order-list');
  list.replaceChildren(...order.map((o, idx) => {
    const d = byId[o.id];
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'o-name';
    name.textContent = d.name;
    if (o.spice) { const s = document.createElement('small'); s.textContent = `${o.spice}・${d.portion}`; name.append(s); }
    else { const s = document.createElement('small'); s.textContent = d.portion; name.append(s); }

    const step = document.createElement('div');
    step.className = 'stepper';
    step.setAttribute('role', 'group');
    step.setAttribute('aria-label', `${d.name}數量`);
    const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', `減少${d.name}`);
    const out = document.createElement('output'); out.textContent = o.qty;
    const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', `增加${d.name}`);
    minus.addEventListener('click', () => { o.qty -= 1; if (o.qty <= 0) order.splice(idx, 1); saveOrder(); renderOrder(); });
    plus.addEventListener('click', () => { o.qty = Math.min(20, o.qty + 1); saveOrder(); renderOrder(); });
    step.append(minus, out, plus);

    const price = document.createElement('span');
    price.className = 'o-price';
    price.textContent = money(d.price * o.qty);
    li.append(name, step, price);
    return li;
  }));

  const has = order.length > 0;
  $('order-empty').hidden = has;
  $('order-total').hidden = !has;
  $('order-clear').hidden = !has;
  $('order-sum').textContent = money(orderTotal());

  const pill = $('cart-pill');
  pill.hidden = !has;
  $('cart-count').textContent = orderCount();
  $('cart-sum').textContent = money(orderTotal());
  if (bump && has) { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
  $('ticket').hidden = true;
  $('res-form').hidden = false;
}

$('order-clear').addEventListener('click', () => { order = []; saveOrder(); renderOrder(); toast('已清空點餐單'); });

/* ===== 預約表單 ===== */
const TIMES = ['17:30', '18:00', '18:30', '19:00', '19:30', '20:00'];
let time = '';
let people = 2;

function renderTimes() {
  $('r-times').replaceChildren(...TIMES.map((t) => chip(t, t === time, () => { time = t; renderTimes(); })));
}

const dateInput = $('r-date');
function localISO(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
dateInput.min = localISO(new Date());

$('r-minus').addEventListener('click', () => { people = Math.max(1, people - 1); $('r-people').textContent = people; });
$('r-plus').addEventListener('click', () => { people = Math.min(8, people + 1); $('r-people').textContent = people; });

function showError(msg) { const e = $('form-error'); e.textContent = msg; e.hidden = !msg; }

$('res-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (!dateInput.value) return showError('請選擇用餐日期。');
  if (dateInput.value < dateInput.min) return showError('日期不能早於今天。');
  if (!time) return showError('請選擇用餐時段。');
  showError('');

  const name = $('r-name').value.trim() || '（未填）';
  const lines = [
    `【炙餃座 預約單】`,
    `稱呼：${name}`,
    `日期：${dateInput.value}　時段：${time}`,
    `人數：${people} 位`,
  ];
  if (order.length) {
    lines.push('預先點餐（暫定價格）：');
    order.forEach((o) => {
      const d = byId[o.id];
      lines.push(`・${d.name}${o.spice ? `（${o.spice}）` : ''} ×${o.qty}　${money(d.price * o.qty)}`);
    });
    lines.push(`預估小計：${money(orderTotal())}`);
  } else {
    lines.push('預先點餐：無');
  }
  $('ticket-text').textContent = lines.join('\n');
  $('res-form').hidden = true;
  $('ticket').hidden = false;
  $('ticket').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

$('ticket-back').addEventListener('click', () => { $('ticket').hidden = true; $('res-form').hidden = false; });

$('ticket-copy').addEventListener('click', async () => {
  const text = $('ticket-text').textContent;
  try {
    await navigator.clipboard.writeText(text);
    toast('已複製預約單');
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('ticket-text'));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    toast('請按 Ctrl+C 複製選取的內容');
  }
});

/* ===== 初始化 ===== */
renderTabs();
renderCards();
renderTimes();
showDish(currentId, false);
renderOrder();
$('showcase').hidden = false;
$('menu-controls').hidden = false;
$('dish-cards').hidden = false;

/* ===== 地圖／預約連結 ===== */
function activateLink(linkId, statusId, value) {
  if (!value.trim()) return;
  let url;
  try { url = new URL(value.trim()); } catch { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  const link = $(linkId);
  link.href = url.href;
  link.hidden = false;
  $(statusId).hidden = true;
}
activateLink('map-link', 'map-status', $('map-link').dataset.mapUrl);
activateLink('booking-link', 'booking-status', $('booking-link').dataset.bookingUrl);
