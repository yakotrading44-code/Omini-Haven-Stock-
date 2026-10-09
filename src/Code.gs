// Omni Haven Stock Book: server side.
// Lives inside the "Omni Haven Stock Book" Google Sheet (Extensions > Apps Script).
// Every entry is one row on the "Entries" tab. Each person's code (and optional email) is on the
// "Codes" tab; app settings are on the "Settings" tab (B2). Emails go out from the Gmail of whoever deployed it.

var COLS = ['id', 'kind', 'date', 'agent', 'product', 'cartons', 'customer', 'amount', 'omni',
            'orderNo', 'note', 'status', 'disputeNote', 'by', 'uid', 'createdAt', 'confirmedAt',
            'disputeCartons', 'resolution', 'resolvedBy', 'resolvedAt'];
var NUMERIC = { cartons: true, amount: true, omni: true, disputeCartons: true };
var ROLES = ['manager', 'warehouse', 'agent'];
// What each role may record. The manager may record anything.
// Agents only view their book and confirm or dispute deliveries; Frank and Nana record everything else.
var ROLE_KINDS = { agent: [], warehouse: ['issue', 'ret', 'receive', 'count'] };

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Omni Haven Stock Book')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function book_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function entriesSheet_() {
  var sh = book_().getSheetByName('Entries');
  if (!sh) {
    sh = book_().insertSheet('Entries');
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]);
  } else if (sh.getLastColumn() < COLS.length) {
    // Older books have fewer columns; the new ones are added on the right.
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]);
  }
  return sh;
}

function settingsSheet_() {
  var sh = book_().getSheetByName('Settings');
  if (!sh) {
    sh = book_().insertSheet('Settings');
    sh.getRange('A1:A2').setValues([['Access codes'], ['App settings (managed by the app)']]);
    sh.getRange('B1').setValue('See the Codes tab');
  }
  return sh;
}

function newCode_() { return String(Math.floor(100000 + Math.random() * 900000)); }

function codesSheet_() {
  var sh = book_().getSheetByName('Codes');
  if (!sh) {
    // First run on an older book: the old shared code in Settings B1 becomes Nana's code.
    var old = String(settingsSheet_().getRange('B1').getDisplayValue()).trim();
    if (!/^[A-Za-z0-9-]+$/.test(old)) old = newCode_();
    sh = book_().insertSheet('Codes');
    sh.getRange(1, 1, 2, 4).setNumberFormat('@').setValues([['Person', 'Code', 'Role', 'Email'], ['Nana (manager)', old, 'manager', '']]);
    ensureCodes_(config_() || {});
  }
  return sh;
}

function config_() {
  var text = String(settingsSheet_().getRange('B2').getValue() || '');
  try { return text ? JSON.parse(text) : null; } catch (err) { return null; }
}

// Turns a code into the person using it, or refuses.
function whoIs_(code) {
  code = String(code || '').trim();
  if (!code) throw new Error('ACCESS: enter your code.');
  var rows = codesSheet_().getDataRange().getDisplayValues().slice(1);
  for (var i = 0; i < rows.length; i++) {
    var name = String(rows[i][0]).trim();
    if (!name || String(rows[i][1]).trim() !== code) continue;
    var role = String(rows[i][2] || '').trim().toLowerCase();
    if (ROLES.indexOf(role) < 0) role = 'agent';
    if (role === 'agent') {
      var cfg = config_();
      name = canon_(name, cfg);
      var a = ((cfg && cfg.agents) || []).filter(function (x) { return x.name === name; })[0];
      if (a && a.active === false) throw new Error('ACCESS: ' + name + ' has been retired. Ask Nana.');
    }
    return { name: name, role: role };
  }
  throw new Error('ACCESS: wrong code.');
}

// Agent names typed in different places (Codes tab, Settings, imported rows) may differ in spacing or capitals.
// Every name is mapped to the spelling on the agent list, so "deborah " and "Deborah" are the same book.
function canon_(name, cfg) {
  var key = String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!key) return '';
  var a = (((cfg || config_()) || {}).agents || []).filter(function (x) { return String(x.name).replace(/\s+/g, ' ').trim().toLowerCase() === key; })[0];
  return a ? a.name : String(name).replace(/\s+/g, ' ').trim();
}

// Agents see only their own book. Frank sees stock movements but not customers' credit.
function visible_(me, e) {
  if (me.role === 'manager') return true;
  if (me.role === 'warehouse') return e.kind !== 'credit' && e.kind !== 'payment';
  return e.agent === me.name;
}

function asDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, book_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return String(v || '');
}

function toEntry_(r, idx) {
  var e = {};
  COLS.forEach(function (c) {
    var v = idx[c] == null ? '' : r[idx[c]];
    if (c === 'date') v = asDate_(v);
    else if (NUMERIC[c]) v = (v === '' || v === null) ? null : Number(v);
    else if (v instanceof Date) v = v.toISOString();
    else v = v === null ? '' : String(v);
    e[c] = v;
  });
  return e;
}

function headIndex_(head) {
  var idx = {};
  head.forEach(function (h, i) { idx[h] = i; });
  return idx;
}

function readAll_(me) {
  var values = entriesSheet_().getDataRange().getValues();
  var idx = headIndex_(values.shift() || COLS);
  var cfg = config_();
  var entries = values.filter(function (r) { return r[idx.id] !== ''; })
    .map(function (r) { var e = toEntry_(r, idx); if (e.agent) e.agent = canon_(e.agent, cfg); return e; })
    .filter(function (e) { return visible_(me, e); });
  var out = { entries: entries, config: config_(), me: me };
  if (me.role === 'manager') out.book = { name: book_().getName(), url: book_().getUrl() };
  if (me.role === 'manager' || me.role === 'warehouse') { out.phones = phones_(cfg); out.appUrl = appUrl_(); }
  return out;
}

function entryAt_(sh, row) {
  var idx = headIndex_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
  return toEntry_(sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0], idx);
}

function rowOf_(e) {
  return COLS.map(function (c) {
    var v = e[c];
    if (v === undefined || v === null) return '';
    return v;
  });
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function findRow_(sh, id) {
  var ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

// Changes several cells of one row in a single write (much faster than one write per cell).
function writeFields_(sh, r, fields) {
  var cols = Object.keys(fields).map(function (k) { return COLS.indexOf(k); }).filter(function (c) { return c >= 0; });
  if (!cols.length) return;
  var lo = Math.min.apply(null, cols), hi = Math.max.apply(null, cols);
  var range = sh.getRange(r, lo + 1, 1, hi - lo + 1), row = range.getValues()[0];
  Object.keys(fields).forEach(function (k) { var c = COLS.indexOf(k); if (c >= 0) row[c - lo] = fields[k] == null ? '' : fields[k]; });
  range.setValues([row]);
}

function deny_(msg) { throw new Error('DENIED: ' + msg); }

// Makes sure Frank and every active agent has a code, so Nana only has to read them off the Codes tab.
function ensureCodes_(config) {
  var sh = codesSheet_();
  var have = sh.getDataRange().getDisplayValues().slice(1).map(function (r) { return String(r[0]).trim(); });
  var add = [];
  if (config.warehouse && have.indexOf(config.warehouse) < 0) add.push([config.warehouse, newCode_(), 'warehouse']);
  (config.agents || []).forEach(function (a) {
    if (a.active !== false && have.indexOf(a.name) < 0) add.push([a.name, newCode_(), 'agent']);
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 3).setNumberFormat('@').setValues(add);
}

// ---- email (Gmail) ----
// Column D of the Codes tab holds each person's email. A blank email means no emails for that person.

// A column headed "WhatsApp" (anywhere on the Codes tab) holds each person's WhatsApp number.
function people_() {
  var rows = codesSheet_().getDataRange().getDisplayValues();
  var wa = (rows[0] || []).map(function (h) { return String(h).trim().toLowerCase(); }).indexOf('whatsapp');
  return rows.slice(1)
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) { return { name: String(r[0]).trim(), role: String(r[2] || '').trim().toLowerCase(), email: String(r[3] || '').trim(), phone: wa >= 0 ? String(r[wa] || '').trim() : '' }; });
}

// Adds the WhatsApp column next to Email the first time Nana opens the app.
function ensureWhatsAppColumn_() {
  var sh = codesSheet_();
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  if (head.indexOf('whatsapp') >= 0) return;
  sh.insertColumnBefore(5);
  sh.getRange(1, 5).setValue('WhatsApp');
  sh.getRange(2, 5, Math.max(sh.getLastRow() - 1, 1), 1).setNumberFormat('@');
}

// Numbers Nana sent on 9 Oct 2026. Each is written once into an empty WhatsApp cell;
// after that the Codes tab is the place to change them.
var STARTING_NUMBERS = [
  { role: 'manager', number: '+233 54 351 4336' },
  { role: 'warehouse', number: '+233 54 983 2920' },
  { first: 'deborah', number: '+233 54 971 6363' },
  { first: 'peter', number: '+233 59 400 3407' }
];

function fillStartingNumbers_() {
  var sh = codesSheet_(), rows = sh.getDataRange().getDisplayValues();
  var col = (rows[0] || []).map(function (h) { return String(h).trim().toLowerCase(); }).indexOf('whatsapp');
  if (col < 0) return;
  STARTING_NUMBERS.forEach(function (n) {
    for (var i = 1; i < rows.length; i++) {
      var name = String(rows[i][0]).trim(), role = String(rows[i][2] || '').trim().toLowerCase();
      if (!name || String(rows[i][col]).trim()) continue;
      if (n.role ? role === n.role : (role === 'agent' && first_(name).toLowerCase() === n.first)) {
        sh.getRange(i + 1, col + 1).setNumberFormat('@').setValue(n.number);
        rows[i][col] = n.number;
      }
    }
  });
}

// Agents' WhatsApp numbers, for the "Send on WhatsApp" button on Frank's and Nana's pages.
function phones_(cfg) {
  var out = {};
  people_().forEach(function (p) { if (p.phone && p.role === 'agent') out[canon_(p.name, cfg)] = p.phone; });
  return out;
}

function emailsFor_(test) {
  return people_().filter(function (p) { return p.email && test(p); }).map(function (p) { return p.email; });
}

function appUrl_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (err) { return ''; }
}

// Sending never blocks saving: if Gmail fails, the entry is still saved.
function mail_(to, subject, lines) {
  to = (to || []).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  if (!to.length) return;
  var url = appUrl_();
  var body = lines.filter(function (l) { return l !== null; }).join('\n') + (url ? '\n\nOpen the stock book: ' + url : '') + '\n\nOmni Haven Stock Book';
  try { MailApp.sendEmail(to.join(','), 'Omni Haven: ' + subject, body); } catch (err) { console.warn('Email not sent: ' + err); }
}

function first_(name) { return String(name || '').split(' ')[0]; }
function nameFor_(role) { var p = people_().filter(function (x) { return x.role === role; })[0]; return p ? p.name : ''; }

// ---- called from the app ----

function getData(code) {
  var me = whoIs_(code);
  try { ensureWhatsAppColumn_(); fillStartingNumbers_(); } catch (err) { console.warn(err); }
  return readAll_(me);
}

function addEntries(code, list) {
  var me = whoIs_(code);
  return withLock_(function () {
    var sh = entriesSheet_();
    list = list || [];
    list.forEach(function (e) {
      if (me.role !== 'manager') {
        if (me.role === 'agent') deny_('your page is for viewing only. Frank and Nana record everything.');
        if (ROLE_KINDS[me.role].indexOf(e.kind) < 0) deny_('you can\'t record that from your book.');
        if (me.role === 'agent') e.agent = me.name;
      }
      if (e.agent) e.agent = canon_(e.agent);
      // Every delivery waits for the agent to confirm it, or to dispute the number.
      if (e.kind === 'issue' && me.role !== 'manager') e.status = 'pending';
    });
    checkStock_(list);
    checkRaises_(list);
    var rows = list.map(function (e) {
      e.by = me.name;
      e.id = Utilities.getUuid();
      return rowOf_(e);
    });
    if (rows.length) {
      var start = sh.getLastRow() + 1;
      sh.getRange(start, 1, rows.length, COLS.length).setNumberFormat('@');
      // keep number columns numeric
      ['cartons', 'amount', 'omni'].forEach(function (c) {
        sh.getRange(start, COLS.indexOf(c) + 1, rows.length, 1).setNumberFormat('0.##');
      });
      sh.getRange(start, 1, rows.length, COLS.length).setValues(rows);
    }
    notifyIssues_(me, list || []);
    return readAll_(me);
  });
}

// An agent may only raise an order for cartons a customer has already paid for.
function bookEntries_() {
  var cfg = config_() || {}, start = cfg.startDate || '';
  return readAll_({ name: 'check', role: 'manager' }).entries.filter(function (e) { return !start || e.date >= start; });
}

// Cartons can't leave an agent's hands (credit, cash sale, return) if the agent doesn't hold them.
function checkStock_(list) {
  var out = function (e) { return e.kind === 'ret' || e.kind === 'credit' || (e.kind === 'payment' && e.status === 'cash') || (e.kind === 'raise' && !e.customer); };
  if (!list.some(out)) return;
  var hand = {}, key = function (e) { return e.agent + '|' + e.product; };
  var move = function (e) {
    var q = Number(e.cartons) || 0, k = key(e);
    if (e.kind === 'issue') hand[k] = (hand[k] || 0) + q;
    else if (out(e)) hand[k] = (hand[k] || 0) - q;
  };
  bookEntries_().forEach(move);
  list.forEach(function (e) {
    if (out(e)) {
      var have = hand[key(e)] || 0;
      if ((Number(e.cartons) || 0) > have) deny_(first_(e.agent) + ' only has ' + Math.max(have, 0) + ' x ' + e.product + ' in hand, not ' + e.cartons + '.');
    }
    move(e);
  });
}

function checkRaises_(list) {
  var raises = list.filter(function (e) { return e.kind === 'raise'; });
  if (!raises.length) return;
  var key = function (c, p, a) { return a + '|' + String(c || '').toLowerCase() + '|' + p; };
  var left = {};
  bookEntries_().forEach(function (e) {
    if (!e.customer) return;
    var k = key(e.customer, e.product, e.agent);
    if (e.kind === 'payment') left[k] = (left[k] || 0) + (Number(e.cartons) || 0);
    if (e.kind === 'raise') left[k] = (left[k] || 0) - (Number(e.cartons) || 0);
  });
  // payments in this same save count too
  list.forEach(function (e) { if (e.kind === 'payment' && e.customer) { var k = key(e.customer, e.product, e.agent); left[k] = (left[k] || 0) + (Number(e.cartons) || 0); } });
  raises.forEach(function (e) {
    if (!e.customer) return; // a direct raise by Nana; checkStock_ makes sure the agent holds the cartons
    var k = key(e.customer, e.product, e.agent);
    if (!e.customer || (Number(e.cartons) || 0) > (left[k] || 0)) deny_('record "Customer paid" before raising the order for ' + (e.customer || 'this customer') + '.');
    left[k] -= Number(e.cartons) || 0;
  });
}

function notifyIssues_(me, list) {
  var byAgent = {};
  list.forEach(function (e) { if (e.kind === 'issue') (byAgent[e.agent] = byAgent[e.agent] || []).push(e); });
  Object.keys(byAgent).forEach(function (a) {
    var items = byAgent[a];
    var lines = ['Hi ' + first_(a) + ',', '', first_(me.name) + ' recorded these cartons as given to you on ' + items[0].date + ':', ''];
    items.forEach(function (e) { lines.push('  ' + e.cartons + ' x ' + e.product); });
    lines.push('', 'Please open the stock book and tap "That\'s right", or "That\'s wrong" if the numbers are not what you took.');
    mail_(emailsFor_(function (p) { return p.name === a; }), 'cartons recorded for you', lines);
  });
}

function updateEntry(code, id, patch) {
  var me = whoIs_(code);
  return withLock_(function () {
    var sh = entriesSheet_();
    var r = findRow_(sh, id);
    if (r > 0) {
      patch = patch || {};
      if (me.role !== 'manager') {
        // Agents may only confirm or dispute cartons Frank gave them.
        var e = entryAt_(sh, r);
        if (me.role !== 'agent' || e.agent !== me.name || e.kind !== 'issue') deny_('you can\'t change that entry.');
        var p = {};
        // Once a delivery is confirmed or disputed, only Nana or Frank can settle it.
        if (e.status && e.status !== 'pending') deny_('this delivery is already ' + e.status + '.');
        ['status', 'confirmedAt', 'disputeNote', 'disputeCartons'].forEach(function (k) { if (k in patch) p[k] = patch[k]; });
        if (p.status !== 'confirmed' && p.status !== 'disputed') deny_('you can\'t change that entry.');
        patch = p;
      }
      writeFields_(sh, r, patch);
      if (patch.status === 'disputed') {
        var d = entryAt_(sh, r);
        mail_(emailsFor_(function (p) { return p.role === 'manager' || p.role === 'warehouse'; }), first_(d.agent) + ' disputes a delivery', [
          first_(d.agent) + ' says the delivery recorded on ' + d.date + ' is wrong.', '',
          '  Frank recorded: ' + d.cartons + ' x ' + d.product,
          '  ' + first_(d.agent) + ' says: ' + (d.disputeCartons != null ? d.disputeCartons + ' x ' + d.product : 'no number given'),
          d.disputeNote ? '  Note: ' + d.disputeNote : null, '',
          'Frank can accept ' + first_(d.agent) + '\'s number in the app. Otherwise Nana decides on her page.']);
      }
    }
    return readAll_(me);
  });
}

// Settles a disputed delivery. Nana can set any number. Frank can only accept the agent's number.
function resolveDispute(code, id, cartons, note) {
  var me = whoIs_(code);
  if (me.role === 'agent') deny_('only Nana or Frank can settle a dispute.');
  return withLock_(function () {
    var sh = entriesSheet_();
    var r = findRow_(sh, id);
    if (r < 0) deny_('that delivery no longer exists.');
    var e = entryAt_(sh, r);
    if (e.kind !== 'issue' || e.status !== 'disputed') deny_('that delivery is not disputed.');
    cartons = Number(cartons);
    if (!(cartons >= 0)) deny_('enter the number of cartons.');
    if (me.role === 'warehouse' && cartons !== e.disputeCartons) deny_('you can only accept ' + first_(e.agent) + '\'s number. Otherwise Nana decides.');
    var was = e.cartons;
    var text = (cartons === was ? 'Kept at ' + was : 'Changed from ' + was + ' to ' + cartons) + ' by ' + first_(me.name) +
      (cartons === e.disputeCartons && cartons !== was ? ' (agreed with ' + first_(e.agent) + ')' : '') + (note ? ': ' + note : '');
    var set = { cartons: cartons, status: 'confirmed', resolution: text, resolvedBy: me.name, resolvedAt: new Date().toISOString() };
    writeFields_(sh, r, set);
    mail_(emailsFor_(function (p) { return p.name === e.agent || p.role === 'manager' || p.role === 'warehouse'; }), 'delivery dispute settled', [
      'The delivery to ' + first_(e.agent) + ' on ' + e.date + ' (' + e.product + ') is settled.', '', '  ' + text]);
    return readAll_(me);
  });
}

function deleteEntry(code, id) {
  var me = whoIs_(code);
  return withLock_(function () {
    var sh = entriesSheet_();
    var r = findRow_(sh, id);
    if (r > 0) {
      if (me.role === 'agent') deny_('your page is for viewing only. Ask Nana to delete it.');
      if (me.role !== 'manager') {
        var e = entryAt_(sh, r);
        if (e.by !== me.name || !visible_(me, e)) deny_('only Nana or the person who entered it can delete it.');
      }
      sh.deleteRow(r);
    }
    return readAll_(me);
  });
}

// Empties the Entries tab for a fresh start. A copy of every entry is kept on a new Backup tab first,
// so nothing is lost if this was a mistake. Products, agents and codes are not touched.
function clearAllEntries(code, confirmWord) {
  var me = whoIs_(code);
  if (me.role !== 'manager') deny_('only Nana can clear the book.');
  if (String(confirmWord || '').trim().toUpperCase() !== 'CLEAR') deny_('type CLEAR to confirm.');
  return withLock_(function () {
    var sh = entriesSheet_();
    var last = sh.getLastRow(), width = sh.getLastColumn();
    if (last > 1) {
      var base = 'Backup ' + Utilities.formatDate(new Date(), book_().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm');
      var name = base;
      for (var i = 2; book_().getSheetByName(name); i++) name = base + ' (' + i + ')';
      var values = sh.getRange(1, 1, last, width).getValues();
      book_().insertSheet(name).getRange(1, 1, last, width).setValues(values);
      sh.getRange(2, 1, last - 1, width).clearContent();
    }
    return readAll_(me);
  });
}

function saveConfig(code, config) {
  var me = whoIs_(code);
  if (me.role !== 'manager') deny_('only Nana can change products and agents.');
  return withLock_(function () {
    settingsSheet_().getRange('B2').setValue(JSON.stringify(config));
    ensureCodes_(config);
    return readAll_(me);
  });
}

// ---- weekly email to Nana ----
// Run setupWeeklyEmail once from the Apps Script editor. Nana then gets a summary every Monday morning.

function setupWeeklyEmail() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'weeklySummary') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  weeklySummary();
}

function weeklySummary() {
  var me = { name: 'weekly', role: 'manager' };
  var d = readAll_(me), cfg = d.config || {}, start = cfg.startDate || '';
  var E = d.entries.filter(function (e) { return !start || e.date >= start; });
  var tot = function (f) { return E.reduce(function (t, e) { return t + (f(e) ? Number(e.cartons) || 0 : 0); }, 0); };
  var lines = ['Weekly stock book summary', ''];
  lines.push('Agents (cartons):');
  (cfg.agents || []).filter(function (a) { return a.active !== false; }).forEach(function (a) {
    var mine = function (k) { return function (e) { return e.agent === a.name && e.kind === k; }; };
    var taken = tot(mine('issue')), raised = tot(mine('raise')), ret = tot(mine('ret'));
    var credit = tot(mine('credit')) - tot(function (e) { return e.agent === a.name && e.kind === 'payment' && e.status !== 'cash'; });
    lines.push('  ' + a.name + ': taken ' + taken + ', raised ' + raised + ', returned ' + ret +
      ', NOT RAISED ' + (taken - raised - ret) + ' (on credit ' + credit + ')');
  });
  lines.push('', 'Warehouse available now:');
  (cfg.products || []).forEach(function (p) {
    var counts = E.filter(function (e) { return e.kind === 'count' && e.product === p; })
      .sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : (x.createdAt < y.createdAt ? -1 : 1); });
    var c = counts[counts.length - 1];
    if (!c) return;
    var after = function (k) { return tot(function (e) { return e.product === p && e.kind === k && e.date > c.date; }); };
    lines.push('  ' + p + ': ' + (Number(c.cartons) + after('receive') - after('issue') + after('ret')) + ' (counted ' + c.cartons + ' on ' + c.date + ')');
  });
  var pend = E.filter(function (e) { return e.kind === 'issue' && e.status === 'pending'; }).length;
  var disp = E.filter(function (e) { return e.kind === 'issue' && e.status === 'disputed'; });
  lines.push('', 'Deliveries not yet confirmed by agents: ' + pend);
  lines.push('Open disputes: ' + disp.length);
  disp.forEach(function (e) { lines.push('  ' + first_(e.agent) + ', ' + e.date + ': Frank ' + e.cartons + ' x ' + e.product + ', agent says ' + (e.disputeCartons != null ? e.disputeCartons : '?')); });
  mail_(emailsFor_(function (p) { return p.role === 'manager'; }), 'weekly summary', lines);
}
