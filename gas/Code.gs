/**
 * 炙餃座 訂單接收（Google Apps Script）
 *
 * 使用方式：把這份程式貼到「炙餃座 訂單管理」試算表的 擴充功能 → Apps Script，
 * 再部署為網頁應用程式（執行身分：我；存取權：所有人）。步驟見 gas/README.md。
 *
 * 流程：網站送出 {客戶資料, 商品編號與數量} → 這裡以「商品」分頁的單價重新計算金額
 *      → 寫入「訂單」「明細」分頁 → （選用）寄通知信 → 回傳訂單編號與金額。
 * 網站傳來的金額一律不採信，只看商品編號與數量。
 */

var SHEET = { orders: '訂單', items: '明細', products: '商品', stores: '門市', settings: '設定' };
var METHOD_LABEL = { dine: '內用', takeout: '外帶', delivery: '宅配' };
var PHONE_RE = /^0\d{8,9}$/;
var CLIENT_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
var MAX_LINES = 30;
var RATE_WINDOW_SEC = 600;

/* ---------- Web app 入口 ---------- */

function doGet() {
  return json_({ ok: true, service: 'zjz-orders' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body;
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { fail_('bad_request', '資料格式不正確。'); }
    lock.waitLock(15000);                       // 同時多筆訂單時排隊，避免編號重複
    return json_(handleOrder_(SpreadsheetApp.getActive(), body, new Date()));
  } catch (err) {
    if (err && err.userError) return json_({ ok: false, error: err.code, message: err.message });
    console.error(err && err.stack || err);
    return json_({ ok: false, error: 'server_error', message: '系統暫時無法處理，請稍後再試。' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ---------- 主流程 ---------- */

function handleOrder_(ss, body, now) {
  if (!body || typeof body !== 'object') fail_('bad_request', '資料格式不正確。');
  if (body.website) return { ok: true, ignored: true };          // 隱藏欄位被填：機器人，直接略過

  var cfg = readSettings_(ss);
  var order = validateAndPrice_(body, readProducts_(ss), readStores_(ss), cfg);

  var ordersSh = ss.getSheetByName(SHEET.orders), itemsSh = ss.getSheetByName(SHEET.items);
  var dup = findByClientId_(ordersSh, order.clientId);            // 同一份訂單重送（網路重試、連點）：回傳原結果
  if (dup) return { ok: true, duplicate: true, orderNo: dup.orderNo, subtotal: dup.subtotal, shipping: dup.shipping, total: dup.total };

  checkRate_(order.tel, cfg.rateLimit);

  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Taipei';
  var orderNo = nextOrderNo_(now, tz);
  var summary = order.lines.map(function (l) { return l.name + '×' + l.qty; }).join('、');

  var row = [orderNo, now, '新訂單', METHOD_LABEL[order.method], order.name, order.tel, order.store, order.addr,
             order.subtotal, order.shipping, order.total, summary, order.clientId].map(safe_);
  var r0 = Math.max(ordersSh.getLastRow(), 1) + 1;
  ordersSh.getRange(r0, 1, 1, row.length).setValues([row]);

  var itemRows = order.lines.map(function (l) { return [orderNo, l.id, l.name, l.price, l.qty, l.price * l.qty].map(safe_); });
  var i0 = Math.max(itemsSh.getLastRow(), 1) + 1;
  itemsSh.getRange(i0, 1, itemRows.length, 6).setValues(itemRows);
  SpreadsheetApp.flush();

  notify_(cfg.notifyEmail, orderNo, order, summary);
  return { ok: true, orderNo: orderNo, subtotal: order.subtotal, shipping: order.shipping, total: order.total };
}

/* ---------- 驗證與計價（不碰試算表，方便單獨測試） ---------- */

function validateAndPrice_(body, products, stores, cfg) {
  var name = str_(body.name, 40), tel = str_(body.tel, 20).replace(/[\s-]/g, '');
  var method = String(body.method || '');
  if (!name) fail_('bad_name', '請填寫姓名。');
  if (!PHONE_RE.test(tel)) fail_('bad_tel', '請輸入 9–10 碼電話，例如 0912345678。');
  if (!METHOD_LABEL[method]) fail_('bad_method', '取餐方式不正確。');
  var clientId = String(body.clientId || '');
  if (!CLIENT_ID_RE.test(clientId)) fail_('bad_client', '訂單識別碼不正確，請重新整理頁面。');

  var store = '', addr = '';
  if (method === 'delivery') {
    addr = str_(body.addr, 120);
    if (addr.length < 6) fail_('bad_addr', '請填寫完整收件地址。');
  } else {
    store = str_(body.store, 40);
    if (stores.indexOf(store) < 0) fail_('bad_store', '請選擇取餐門市。');
  }

  if (!Array.isArray(body.items) || !body.items.length) fail_('empty_cart', '購物車是空的。');
  if (body.items.length > MAX_LINES) fail_('too_many', '商品品項過多。');
  var byId = {}, lines = [];
  body.items.forEach(function (it) {
    var id = String(it && it.id || ''), qty = it && it.qty;
    var p = products[id];
    if (!p || !p.active) fail_('bad_item', '有商品已下架或不存在，請重新整理後再試。');
    if (typeof qty !== 'number' || qty % 1 !== 0 || qty < 1 || qty > cfg.maxQty) fail_('bad_qty', '商品數量不正確。');
    if (byId[id]) { byId[id].qty += qty; if (byId[id].qty > cfg.maxQty) fail_('bad_qty', '商品數量不正確。'); return; }
    byId[id] = { id: id, name: p.name, price: p.price, qty: qty, frozen: p.frozen };
    lines.push(byId[id]);
  });

  var hasFrozen = lines.some(function (l) { return l.frozen; }), hasFresh = lines.some(function (l) { return !l.frozen; });
  if (hasFrozen && hasFresh && method !== 'takeout') fail_('bad_rule', '同時有現做餐點與冷凍商品時，僅提供外帶。');
  if (!hasFrozen && method === 'delivery') fail_('bad_rule', '現做餐點不提供宅配。');
  if (hasFrozen && !hasFresh && method === 'dine') fail_('bad_rule', '冷凍商品不提供內用。');

  var subtotal = lines.reduce(function (s, l) { return s + l.price * l.qty; }, 0);
  var shipping = method === 'delivery' && subtotal < cfg.freeShip ? cfg.shipFee : 0;
  return { clientId: clientId, name: name, tel: tel, method: method, store: store, addr: addr, lines: lines,
           subtotal: subtotal, shipping: shipping, total: subtotal + shipping };
}

/* ---------- 讀取設定資料 ---------- */

function readSettings_(ss) {
  var v = ss.getSheetByName(SHEET.settings).getDataRange().getValues(), m = {};
  for (var i = 1; i < v.length; i++) m[String(v[i][0]).trim()] = v[i][1];
  var num = function (k, d) { var n = Number(m[k]); return isFinite(n) && m[k] !== '' ? n : d; };
  return { shipFee: num('宅配運費', 120), freeShip: num('免運門檻', 1000), notifyEmail: String(m['通知信箱'] || '').trim(),
           rateLimit: num('同一電話筆數上限', 5), maxQty: num('單品數量上限', 99) };
}

function readProducts_(ss) {
  var v = ss.getSheetByName(SHEET.products).getDataRange().getValues(), out = {};
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][0]).trim(); if (!id) continue;
    out[id] = { name: String(v[i][1]), price: Number(v[i][3]), frozen: v[i][4] === true, active: v[i][5] === true };
  }
  return out;
}

function readStores_(ss) {
  var v = ss.getSheetByName(SHEET.stores).getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) if (v[i][1] === true && String(v[i][0]).trim()) out.push(String(v[i][0]).trim());
  return out;
}

/* ---------- 輔助 ---------- */

function findByClientId_(sh, clientId) {
  var last = sh.getLastRow(); if (last < 2) return null;
  var v = sh.getRange(2, 1, last - 1, 13).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    if (v[i][12] === clientId) return { orderNo: v[i][0], subtotal: v[i][8], shipping: v[i][9], total: v[i][10] };
  }
  return null;
}

function checkRate_(tel, limit) {
  var cache = CacheService.getScriptCache(), key = 'tel:' + tel, n = Number(cache.get(key) || 0);
  if (n >= limit) fail_('rate_limited', '送出太頻繁，請稍後再試。');
  cache.put(key, String(n + 1), RATE_WINDOW_SEC);
}

function nextOrderNo_(now, tz) {
  var day = Utilities.formatDate(now, tz, 'yyMMdd'), props = PropertiesService.getScriptProperties(), key = 'seq-' + day;
  var n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  return 'ZJZ-' + day + '-' + ('000' + n).slice(-3);
}

function notify_(to, orderNo, o, summary) {
  if (!to) return;
  try {
    var lines = ['訂單編號：' + orderNo, '取餐方式：' + METHOD_LABEL[o.method] + (o.store ? '（' + o.store + '）' : ''),
      '姓名：' + o.name, '電話：' + o.tel, o.addr ? '地址：' + o.addr : '', '品項：' + summary,
      '小計：' + o.subtotal + '　運費：' + o.shipping + '　總金額：' + o.total];
    MailApp.sendEmail(to, '【新訂單】' + orderNo + '　NT$' + o.total, lines.filter(Boolean).join('\n'));
  } catch (err) { console.error('notify failed', err); }                // 通知失敗不影響訂單
}

// 避免使用者輸入被試算表當成公式執行
function safe_(v) { return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
function str_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function fail_(code, message) { var e = new Error(message); e.userError = true; e.code = code; throw e; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
