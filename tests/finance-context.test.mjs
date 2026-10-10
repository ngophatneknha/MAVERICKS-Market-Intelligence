import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { cashDateOffset, emptyCashWorkspace } from '../lib/cashflow.ts';
import { validateAssistantPayload } from '../lib/assistant-contract.mjs';

// Transpile the actual browser context module in memory. No output files, keys or network.
const code = ts.transpileModule(fs.readFileSync(new URL('../lib/finance-context.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("'./cashflow'", JSON.stringify(new URL('../lib/cashflow.ts', import.meta.url).href));
const { financeContext, readCashEnvelope, todayIso } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const date = todayIso();
const request = context => ({ locale: 'en', question: 'Explain the cash trough.', history: [], context });

test('empty ledger gives the assistant no invented zero balance or demonstration facts', () => {
  const context = financeContext(emptyCashWorkspace(date), false);
  assert.equal(context.cash, null); assert.equal(context.inventoryScenario, null);
  assert.equal(validateAssistantPayload(request(context)).ok, true);
});
test('cash summary matches the deployed strict assistant contract for every horizon and delay', () => {
  const workspace = { ...emptyCashWorkspace(date), openingCash: 20_000_000, minimumReserve: 5_000_000,
    entries: [{ id: 'private-invoice', title: 'PRIVATE CUSTOMER NAME', direction: 'in', status: 'planned', amount: 10_000_000, dueDate: cashDateOffset(date, 10) }] };
  for (const horizon of [30, 60, 90]) for (const delay of [0, 7, 14]) {
    const context = financeContext(workspace, false, horizon, undefined, delay);
    assert.equal(validateAssistantPayload(request(context)).ok, true);
    assert.equal(context.cash.horizonDays, horizon); assert.equal(context.cash.receiptDelayDays, delay);
    assert.equal(context.cash.currentBalance, 20_000_000);
    assert.ok(!JSON.stringify(context).includes('PRIVATE CUSTOMER NAME'));
    assert.ok(!JSON.stringify(context).includes('private-invoice'));
  }
});
test('scenario receipts exclude dates shifted outside the selected horizon', () => {
  const workspace = { ...emptyCashWorkspace(date), openingCash: 20_000_000 };
  const scenario = { id: 'preview', title: 'PRIVATE INVENTORY DESCRIPTION', paymentDate: date, paymentAmount: 5_000_000,
    receipts: [{ date: cashDateOffset(date, 29), amount: 15_000_000 }] };
  const context = financeContext(workspace, false, 30, scenario, 7);
  assert.equal(context.inventoryScenario.expectedReceipts, 0);
  assert.equal(context.inventoryScenario.source, 'manual');
  assert.ok(!JSON.stringify(context).includes('PRIVATE INVENTORY DESCRIPTION'));
  assert.equal(validateAssistantPayload(request(context)).ok, true);
});
test('an illustrative order never relabels a manual cash ledger as demonstration data', () => {
  const workspace = { ...emptyCashWorkspace(date), openingCash: 20_000_000 };
  const scenario = { id: 'preview', title: 'Illustrative cost', paymentDate: date, paymentAmount: 5_000_000 };
  const context = financeContext(workspace, false, 30, scenario, 0, true);
  assert.equal(context.source, 'manual'); assert.equal(context.inventoryScenario.source, 'demo');
  assert.equal(validateAssistantPayload(request(context)).ok, true);
});
test('cash backup rejects corrupt envelopes and strips unknown workspace fields', () => {
  assert.throws(() => readCashEnvelope('{bad'));
  assert.throws(() => readCashEnvelope(JSON.stringify({ version: 1, demo: 'yes', workspace: emptyCashWorkspace(date) })));
  const imported = readCashEnvelope(JSON.stringify({ version: 1, demo: false, workspace: { ...emptyCashWorkspace(date), privateField: 'must not survive' } }));
  assert.equal(imported.workspace.privateField, undefined);
});
