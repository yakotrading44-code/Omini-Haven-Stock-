// Checks the server rules in src/Code.gs against an in-memory copy of the Sheet.
// Run with: node tests/server.test.js
const assert = require('assert');
const { makeBook, load, sent } = require('./mock');

const config = {
  products: ['OC', 'SPO'], startDate: '2026-09-30', warehouse: 'Frank',
  agents: [{ name: 'Peter Boakye', active: true }, { name: 'Deborah', active: true }, { name: 'Sarah Ofori', active: false }]
};
const book = makeBook({
  Entries: [['id', 'kind', 'date', 'agent', 'product', 'cartons']],
  Settings: [['Access codes', 'See the Codes tab'], ['App settings', JSON.stringify(config)]],
  Codes: [['Person', 'Code', 'Role', 'Email'],
    ['Nana (manager)', 'M1', 'manager', 'nana@example.com'], ['Frank', 'W1', 'warehouse', ''],
    ['Peter Boakye', 'P1', 'agent', 'peter@example.com'], ['Deborah', 'D1', 'agent', ''], ['Sarah Ofori', 'S1', 'agent', '']]
});
const G = load(book);
const denied = (f, re) => assert.throws(f, re);
let passed = 0;
const test = (name, f) => { f(); passed++; console.log('ok -', name); };

test('codes: wrong and retired codes are refused', () => {
  denied(() => G.getData('nope'), /ACCESS: wrong code/);
  denied(() => G.getData('S1'), /retired/);
  assert.strictEqual(G.getData('P1').me.role, 'agent');
});

G.addEntries('W1', [
  { kind: 'issue', agent: 'Peter Boakye', product: 'OC', cartons: 30, date: '2026-10-05', status: 'pending' },
  { kind: 'issue', agent: 'Deborah', product: 'SPO', cartons: 10, date: '2026-10-05', status: 'pending' }]);

test('deliveries are saved as confirmed, with no confirm step for the agent', () => {
  assert.ok(G.getData('M1').entries.filter(e => e.kind === 'issue').every(e => e.status === 'confirmed'));
});

test('privacy: agents see only their own entries, Frank sees no credit', () => {
  G.addEntries('M1', [{ kind: 'credit', agent: 'Peter Boakye', customer: 'Ama', product: 'OC', cartons: 5, date: '2026-10-06' }]);
  assert.ok(G.getData('P1').entries.every(e => e.agent === 'Peter Boakye'));
  assert.ok(G.getData('W1').entries.every(e => e.kind !== 'credit'));
  assert.strictEqual(G.getData('D1').entries.length, 1);
});

test('roles: agents only view; Frank records stock, not credit or raises', () => {
  denied(() => G.addEntries('P1', [{ kind: 'credit', customer: 'X', product: 'OC', cartons: 1, date: '2026-10-06' }]), /viewing only/);
  denied(() => G.addEntries('P1', [{ kind: 'raise', product: 'OC', cartons: 1, date: '2026-10-06' }]), /viewing only/);
  const id = G.getData('P1').entries[0].id;
  denied(() => G.updateEntry('P1', id, { status: 'disputed' }), /viewing only/);
  denied(() => G.deleteEntry('P1', id), /viewing only/);
  denied(() => G.addEntries('W1', [{ kind: 'credit', agent: 'Peter Boakye', customer: 'X', product: 'OC', cartons: 1 }]), /DENIED/);
  denied(() => G.addEntries('W1', [{ kind: 'raise', agent: 'Peter Boakye', product: 'OC', cartons: 1 }]), /DENIED/);
  denied(() => G.saveConfig('P1', config), /only Nana/);
});

test('stock: no credit, cash sale, return or raise beyond what the agent holds', () => {
  denied(() => G.addEntries('M1', [{ kind: 'credit', agent: 'Peter Boakye', customer: 'Kofi', product: 'OC', cartons: 26, date: '2026-10-06' }]), /only has 25/);
  denied(() => G.addEntries('M1', [{ kind: 'payment', status: 'cash', agent: 'Peter Boakye', customer: 'Kofi', product: 'OC', cartons: 26, date: '2026-10-06' }]), /only has 25/);
  denied(() => G.addEntries('W1', [{ kind: 'ret', agent: 'Peter Boakye', product: 'OC', cartons: 26, date: '2026-10-06' }]), /only has 25/);
  denied(() => G.addEntries('M1', [{ kind: 'raise', agent: 'Peter Boakye', product: 'OC', cartons: 26, date: '2026-10-06' }]), /only has 25/);
});

test('raise: Nana records raises straight from Omni; customer raises still need a payment first', () => {
  G.addEntries('M1', [{ kind: 'raise', agent: 'Peter Boakye', product: 'OC', cartons: 4, orderNo: 'OM-1', date: '2026-10-06' }]);
  denied(() => G.addEntries('M1', [{ kind: 'raise', agent: 'Peter Boakye', product: 'OC', cartons: 22, date: '2026-10-06' }]), /only has 21/);
  denied(() => G.addEntries('M1', [{ kind: 'raise', agent: 'Peter Boakye', customer: 'Ama', product: 'OC', cartons: 1, date: '2026-10-06' }]), /Customer paid/);
  G.addEntries('M1', [{ kind: 'payment', agent: 'Peter Boakye', customer: 'Ama', product: 'OC', cartons: 5, date: '2026-10-06' }]);
  G.addEntries('M1', [{ kind: 'raise', agent: 'Peter Boakye', customer: 'Ama', product: 'OC', cartons: 5, date: '2026-10-06' }]);
});

test('disputes: Frank may only accept the agent number, Nana decides', () => {
  const id = G.getData('M1').entries.find(e => e.kind === 'issue' && e.agent === 'Peter Boakye').id;
  G.updateEntry('M1', id, { status: 'disputed', disputeCartons: 28, disputeNote: '2 left behind' });
  denied(() => G.resolveDispute('P1', id, 28, ''), /only Nana or Frank/);
  denied(() => G.resolveDispute('W1', id, 29, ''), /only accept/);
  const e = G.resolveDispute('M1', id, 28, 'checked waybill').entries.find(x => x.id === id);
  assert.strictEqual(e.cartons, 28);
  assert.strictEqual(e.status, 'confirmed');
  assert.ok(sent.some(m => /settled/.test(m.sub)));
});

test('delete: only Nana or whoever entered it', () => {
  const frankEntry = G.getData('W1').entries.find(e => e.kind === 'issue' && e.agent === 'Deborah');
  denied(() => G.deleteEntry('D1', frankEntry.id), /viewing only/);
  G.deleteEntry('W1', frankEntry.id);
});

test('clear all: only Nana, needs CLEAR, keeps a backup tab', () => {
  const before = G.getData('M1').entries.length;
  assert.ok(before > 0);
  denied(() => G.clearAllEntries('W1', 'CLEAR'), /only Nana/);
  denied(() => G.clearAllEntries('M1', 'yes'), /CLEAR/);
  assert.strictEqual(G.clearAllEntries('M1', 'clear').entries.length, 0);
  const backup = Object.keys(book.sheets).find(n => /^Backup /.test(n));
  assert.strictEqual(book.sheets[backup].lastRow(), before + 1);
  assert.strictEqual(G.getData('P1').entries.length, 0);
  G.addEntries('W1', [{ kind: 'receive', product: 'OC', cartons: 10, date: '2026-10-07' }]);
  assert.strictEqual(G.getData('M1').entries.length, 1);
  G.clearAllEntries('M1', 'CLEAR');
  assert.strictEqual(Object.keys(book.sheets).filter(n => /^Backup /.test(n)).length, 2);
});

test('names: spacing and capitals in the Codes tab or rows still reach the right book', () => {
  book.sheets.Codes.rows.push(['deborah ', 'D2', 'agent', '']);
  G.addEntries('W1', [{ kind: 'issue', agent: 'DEBORAH', product: 'OC', cartons: 3, date: '2026-10-08', status: 'pending' }]);
  const mine = G.getData('D2');
  assert.strictEqual(mine.me.name, 'Deborah');
  assert.ok(mine.entries.some(e => e.kind === 'issue' && e.status === 'confirmed' && e.agent === 'Deborah' && e.cartons === 3));
});

console.log(`\n${passed} tests passed`);
