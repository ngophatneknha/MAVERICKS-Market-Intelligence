import { projectCashflow, validateCashWorkspace, type CashWorkspace, type InventoryScenario } from './cashflow';

export const CASH_STORAGE_KEY = 'mavericks.cash-workspace.v1';
export const FINANCE_EVENT = 'mavericks:finance-context';
export type FinanceContext = {
  version: 1; asOf: string; source: 'manual' | 'demo'; currency: 'VND';
  cash: null | {
    openingBalance: number; currentBalance: number; minimumReserve: number;
    expectedInflows: number; expectedOutflows: number; closingBalance: number;
    lowestBalance: number; additionalFunding: number; horizonDays: number; receiptDelayDays: number;
    lowestBalanceDate: string | null; overdueReceivables: number; overduePayables: number;
  };
  inventoryScenario: null | { source: 'manual' | 'demo'; orderCost: number; purchaseDate: string; expectedReceipts: number; cashTrough: number; additionalFunding: number };
};
export type CashEnvelope = { version: 1; demo: boolean; workspace: CashWorkspace };
export function todayIso() {
  const day = new Date();
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
export function readCashEnvelope(text: string): CashEnvelope {
  const value = JSON.parse(text);
  if (value?.version !== 1 || typeof value.demo !== 'boolean') throw new Error('Invalid cash workspace backup.');
  return { version: 1, demo: value.demo, workspace: validateCashWorkspace(value.workspace) };
}
export function financeContext(workspace: CashWorkspace, demo: boolean, horizonDays: 30 | 60 | 90 = 30, inventoryScenario?: InventoryScenario, incomingDelayDays = 0, inventoryDemo = false): FinanceContext {
  const asOf = todayIso();
  const base = projectCashflow(workspace, { asOfDate: asOf, horizonDays, incomingDelayDays });
  const scenario = inventoryScenario ? projectCashflow(workspace, { asOfDate: asOf, horizonDays, incomingDelayDays, inventoryScenario }) : null;
  return {
    version: 1, asOf, source: demo ? 'demo' : 'manual', currency: 'VND',
    cash: workspace.entries.length || workspace.openingCash !== 0 || workspace.minimumReserve !== 0 ? {
      openingBalance: workspace.openingCash, currentBalance: base.currentCash, minimumReserve: workspace.minimumReserve,
      expectedInflows: base.expectedIn, expectedOutflows: base.expectedOut, closingBalance: base.closingCash,
      lowestBalance: base.minimumCash, additionalFunding: base.additionalCapital, horizonDays, receiptDelayDays: incomingDelayDays,
      lowestBalanceDate: base.minimumCashDate,
      overdueReceivables: base.overdue.filter(e => e.direction === 'in').reduce((s, e) => s + e.amount, 0),
      overduePayables: base.overdue.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount, 0),
    } : null,
    inventoryScenario: inventoryScenario && scenario ? {
      source: inventoryDemo ? 'demo' : 'manual',
      orderCost: inventoryScenario.paymentAmount, purchaseDate: inventoryScenario.paymentDate,
      expectedReceipts: scenario.days.flatMap(day => day.events).filter(event => event.source === 'inventory' && event.direction === 'in').reduce((sum, event) => sum + event.amount, 0),
      cashTrough: scenario.minimumCash, additionalFunding: scenario.additionalCapital,
    } : null,
  };
}
export function savedFinanceContext(): FinanceContext {
  const empty: FinanceContext = { version: 1, asOf: todayIso(), source: 'manual', currency: 'VND', cash: null, inventoryScenario: null };
  try {
    const saved = localStorage.getItem(CASH_STORAGE_KEY);
    if (!saved) return empty;
    const envelope = readCashEnvelope(saved);
    return financeContext(envelope.workspace, envelope.demo);
  } catch { return empty; }
}
