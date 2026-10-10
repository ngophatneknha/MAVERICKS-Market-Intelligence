import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cashDateOffset, cashflowCsv, demoCashWorkspace, emptyCashWorkspace,
  inventoryScenarioFromPlanning, projectCashflow, validateCashWorkspace,
} from '../lib/cashflow.ts';

const date = '2026-10-05';
const workspace = (entries = [], changed = {}) => ({ ...emptyCashWorkspace(date), openingCash: 100, minimumReserve: 10, entries, ...changed });
const entry = (changed = {}) => ({ id: 'E1', title: 'Scheduled payment', direction: 'out', amount: 60, dueDate: date, status: 'planned', ...changed });
const options = { horizonDays: 30 };

test('empty workspace has no invented business cash or transactions', () => {
  const initial = emptyCashWorkspace(date);
  assert.equal(initial.openingCash, 0); assert.equal(initial.minimumReserve, 0); assert.deepEqual(initial.entries, []);
  const projection = projectCashflow(initial, options);
  assert.equal(projection.closingCash, 0); assert.equal(projection.expectedIn, 0); assert.equal(projection.expectedOut, 0);
});

test('genuine UTC dates, leap years and month transitions are validated', () => {
  assert.equal(cashDateOffset('2024-02-28', 1), '2024-02-29');
  assert.equal(cashDateOffset('2026-12-31', 1), '2027-01-01');
  for (const invalid of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-10-5', '2026-10-05T00:00:00Z']) assert.throws(() => emptyCashWorkspace(invalid));
  assert.throws(() => cashDateOffset(date, .5));
});

test('financial validation never accepts negative/signed amount, NaN or numeric strings', () => {
  for (const amount of [-1, 0, NaN, Infinity, '60', 1e12 + 1]) assert.throws(() => validateCashWorkspace(workspace([entry({ amount })])));
  assert.throws(() => validateCashWorkspace(workspace([], { minimumReserve: -1 })));
  assert.throws(() => validateCashWorkspace(workspace([], { openingCash: '100' })));
  assert.equal(projectCashflow(workspace([], { openingCash: -20 }), options).cashShortfall, 20);
});

test('identities, status and actual settlement date are strict; validation returns clean copy', () => {
  assert.throws(() => validateCashWorkspace(workspace([entry(), entry()])), /Trùng/);
  assert.throws(() => validateCashWorkspace(workspace([entry({ id: '  ' })])));
  assert.throws(() => validateCashWorkspace(workspace([entry({ status: 'unknown' })])));
  assert.throws(() => validateCashWorkspace(workspace([entry({ status: 'settled' })])));
  assert.throws(() => validateCashWorkspace(workspace([entry({ status: 'planned', settledDate: date })])));
  assert.throws(() => validateCashWorkspace(workspace([entry({ status: 'cancelled', settledDate: date })])));
  const source = workspace([entry({ otherProperty: 'not preserved' })]);
  const clean = validateCashWorkspace(source);
  assert.equal(clean.entries[0].otherProperty, undefined); assert.notEqual(clean.entries, source.entries);
  assert.throws(() => validateCashWorkspace({ ...source, version: 2 }));
});

test('30/60/90-day horizons are inclusive and have UTC daily points', () => {
  for (const horizonDays of [30, 60, 90]) {
    const result = projectCashflow(workspace(), { horizonDays });
    assert.equal(result.days.length, horizonDays);
    assert.equal(result.endDate, cashDateOffset(date, horizonDays - 1));
    assert.equal(result.days.at(-1).date, result.endDate);
  }
  for (const horizonDays of [1, 31, 0, '30']) assert.throws(() => projectCashflow(workspace(), { horizonDays }));
});

test('intraday cash trough occurs before receipts even when closing cash is positive', () => {
  const result = projectCashflow(workspace([
    entry({ amount: 120 }), entry({ id: 'receipt', direction: 'in', amount: 200 }),
  ]), options);
  assert.equal(result.days[0].cashBeforeReceipts, -20);
  assert.equal(result.days[0].closingCash, 180);
  assert.equal(result.minimumCash, -20); assert.equal(result.cashShortfall, 20);
  assert.equal(result.additionalCapital, 30); assert.equal(result.firstReserveBreachDate, date);
  assert.equal(result.belowReserveDays, 1);
});

test('planned events do not change actual cash balance and cancellation eliminates future flow', () => {
  const result = projectCashflow(workspace([entry(), entry({ id: 'cancelled', amount: 90, status: 'cancelled' })]), options);
  assert.equal(result.currentCash, 100); assert.equal(result.expectedOut, 60); assert.equal(result.closingCash, 40);
  assert.equal(result.cancelledEntries.length, 1);
});

test('settlement counts by actual date once without changing opening balance', () => {
  const data = workspace([
    entry({ id: 'before-anchor', amount: 500, status: 'settled', settledDate: '2026-10-04' }),
    entry({ id: 'received', direction: 'in', amount: 40, dueDate: '2026-10-01', status: 'settled', settledDate: date }),
    entry({ id: 'paid', amount: 20, dueDate: '2026-10-08', status: 'settled', settledDate: '2026-10-06' }),
    entry({ id: 'pending', amount: 30, dueDate: '2026-10-09' }),
  ]);
  const result = projectCashflow(data, { ...options, asOfDate: '2026-10-07' });
  assert.equal(data.openingCash, 100); assert.equal(result.currentCash, 120);
  assert.equal(result.startingCash, 120); assert.equal(result.expectedOut, 30); assert.equal(result.closingCash, 90);
  assert.equal(result.includedInOpeningBalance.length, 1);
  assert.equal(result.history.length, 3); assert.equal(result.history[0].closingCash, 140); assert.equal(result.history[1].closingCash, 120);
  assert.equal(result.days[0].outflows, 0); assert.equal(result.days[0].inflows, 0);
});

test('marking pending entry as paid updates only reconciliation, never repeats forecast payment', () => {
  const before = projectCashflow(workspace([entry()]), options);
  const after = projectCashflow(workspace([entry({ status: 'settled', settledDate: date })]), options);
  assert.equal(before.currentCash, 100); assert.equal(after.currentCash, 40);
  assert.equal(before.closingCash, after.closingCash); assert.equal(after.expectedOut, 0);
});

test('future settled date and forecasting before opening balance are rejected', () => {
  assert.throws(() => projectCashflow(workspace([entry({ status: 'settled', settledDate: '2026-10-06' })]), options), /sau ngày/);
  assert.throws(() => projectCashflow(workspace(), { ...options, asOfDate: '2026-10-04' }));
});

test('overdue payments are projected immediately; overdue receipts need explicit collection assumption', () => {
  const data = workspace([
    entry({ dueDate: '2026-10-01', amount: 30 }),
    entry({ id: 'overdue-in', direction: 'in', dueDate: '2026-10-01', amount: 200 }),
  ]);
  const conservative = projectCashflow(data, options);
  assert.equal(conservative.overdue.length, 2); assert.equal(conservative.excludedOverdueReceipts.length, 1);
  assert.equal(conservative.expectedIn, 0); assert.equal(conservative.days[0].outflows, 30); assert.equal(conservative.closingCash, 70);
  const collected = projectCashflow(data, { ...options, includeOverdueReceipts: true, incomingDelayDays: 2 });
  assert.equal(collected.excludedOverdueReceipts.length, 0); assert.equal(collected.days[2].inflows, 200); assert.equal(collected.closingCash, 270);
});

test('incoming delay never delays outgoing payments and may move receipt out of horizon', () => {
  const data = workspace([entry({ amount: 70 }), entry({ id: 'R', direction: 'in', amount: 80, dueDate: cashDateOffset(date, 28) })]);
  const result = projectCashflow(data, { ...options, incomingDelayDays: 3 });
  assert.equal(result.days[0].outflows, 70); assert.equal(result.expectedIn, 0);
  assert.equal(result.outsideHorizon.length, 1); assert.equal(result.outsideHorizon[0].date, cashDateOffset(date, 31));
  assert.equal(result.closingCash, 30);
  for (const incomingDelayDays of [-1, .5, 91, NaN]) assert.throws(() => projectCashflow(data, { ...options, incomingDelayDays }));
});

test('horizon boundary transactions are explicit, not silently lost', () => {
  const data = workspace([
    entry({ amount: 20, dueDate: cashDateOffset(date, 29) }),
    entry({ id: 'next-period', amount: 40, dueDate: cashDateOffset(date, 30) }),
  ]);
  const result = projectCashflow(data, options);
  assert.equal(result.expectedOut, 20); assert.equal(result.closingCash, 80); assert.equal(result.outsideHorizon.length, 1);
  assert.match(result.warnings.join(' '), /ngoài kỳ/);
});

test('inventory what-if has a single purchase, optional net receipts and operating costs', () => {
  const result = projectCashflow(workspace([entry({ amount: 10 })]), {
    ...options,
    inventoryScenario: {
      id: 'order-1', title: 'New batch', paymentDate: cashDateOffset(date, 2), paymentAmount: 80,
      receipts: [{ date: cashDateOffset(date, 5), amount: 120 }],
      expenses: [{ date: cashDateOffset(date, 3), amount: 15 }],
    },
  });
  assert.equal(result.expectedOut, 105); assert.equal(result.expectedIn, 120); assert.equal(result.closingCash, 115);
  assert.equal(result.minimumCash, -5); assert.equal(result.cashShortfall, 5);
  assert.equal(result.days.flatMap((day) => day.events).filter((event) => event.id.endsWith(':payment')).length, 1);
  assert.match(result.warnings.join(' '), /giả định/);
});

test('inventory what-if replaces only explicit planned IDs and cannot erase actual cash', () => {
  const data = workspace([entry({ id: 'existing-order', amount: 50, sourceRef: 'order-1' }), entry({ id: 'rent', amount: 10 })]);
  const scenario = { id: 'order-1', title: 'Revised batch', paymentDate: date, paymentAmount: 80 };
  assert.throws(() => projectCashflow(data, { ...options, inventoryScenario: scenario }), /hai lần/);
  const result = projectCashflow(data, { ...options, inventoryScenario: { ...scenario, replacesEntryIds: ['existing-order'] } });
  assert.equal(result.expectedOut, 90); assert.equal(result.closingCash, 10);
  assert.throws(() => projectCashflow(data, { ...options, inventoryScenario: { ...scenario, replacesEntryIds: ['missing'] } }));
  assert.throws(() => projectCashflow(workspace([entry({ status: 'settled', settledDate: date })]), { ...options, inventoryScenario: { ...scenario, replacesEntryIds: ['E1'] } }), /đã thực hiện/);
  assert.throws(() => projectCashflow(workspace([entry({ sourceRef: 'order-1', status: 'settled', settledDate: date })]), { ...options, inventoryScenario: scenario }), /tính lại/);
});

test('already-paid inventory scenario is rejected by matching sourceRef or entry ID, even before balance anchor', () => {
  const scenario = { id: 'approved-plan-1', title: 'Approved order', paymentDate: date, paymentAmount: 80 };
  for (const linked of [{ id: 'payment-1', sourceRef: 'approved-plan-1' }, { id: 'approved-plan-1' }]) {
    for (const settledDate of [date, cashDateOffset(date, -1)]) {
      const settled = entry({ ...linked, status: 'settled', settledDate });
      assert.throws(() => projectCashflow(workspace([settled]), { ...options, inventoryScenario: scenario }), /Không tính lại/);
      assert.throws(() => projectCashflow(workspace([settled]), { ...options, inventoryScenario: { ...scenario, replacesEntryIds: [settled.id] } }), /đã thực hiện/);
    }
  }
});

test('scenario validates dates/amounts and preserves base workspace', () => {
  const data = workspace(); const original = JSON.stringify(data);
  const valid = { id: 'O', title: 'Order', paymentDate: date, paymentAmount: 80 };
  for (const changed of [{ paymentDate: '2026-10-04' }, { paymentAmount: 0 }, { paymentAmount: -1 }, { receipts: [{ date: date, amount: -1 }] }]) {
    assert.throws(() => projectCashflow(data, { ...options, inventoryScenario: { ...valid, ...changed } }));
  }
  projectCashflow(data, { ...options, inventoryScenario: valid }); assert.equal(JSON.stringify(data), original);
});

test('planning bridge uses true supplier due date, not weekly cash aggregates; zero-order plan stays empty', () => {
  const result = inventoryScenarioFromPlanning({ orderCost: 1200 }, { supplierPaymentDays: 7 }, { lastDate: '2026-10-04' }, 'P', 'Order from plan');
  assert.deepEqual(result, { id: 'P', title: 'Order from plan', paymentDate: '2026-10-12', paymentAmount: 1200 });
  assert.equal(inventoryScenarioFromPlanning({ orderCost: 0 }, { supplierPaymentDays: 0 }, { lastDate: date }, 'P', 'No order'), null);
  assert.throws(() => inventoryScenarioFromPlanning({ orderCost: 1200 }, { supplierPaymentDays: .5 }, { lastDate: date }, 'P', 'Order'));
});

test('demo is deterministic, separate, labeled and shows a genuine reserve issue', () => {
  assert.deepEqual(demoCashWorkspace(date), demoCashWorkspace(date));
  assert.ok(demoCashWorkspace(date).entries.every((row) => row.title.includes('Minh họa')));
  const demo = projectCashflow(demoCashWorkspace(date), options);
  assert.equal(demo.currentCash, 39_000_000); assert.equal(demo.minimumCash, 6_000_000);
  assert.equal(demo.additionalCapital, 2_000_000); assert.equal(demo.cashShortfall, 0);
});

test('CSV contains a full reproducible daily ledger and reconciled numeric balances', () => {
  const result = projectCashflow(workspace([entry()]), options);
  const csv = cashflowCsv(result);
  assert.ok(csv.startsWith('\uFEFF')); assert.equal(csv.split('\r\n').length, 31);
  assert.ok(csv.includes('"cash_before_receipts"')); assert.ok(csv.includes('"2026-10-05","100","0","60","40","40","10","0"'));
});
