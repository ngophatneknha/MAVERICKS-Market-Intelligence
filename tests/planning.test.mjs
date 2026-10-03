import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareScenarios, defaultPlanning, demoSalesCsv, evaluateScenario, forecastSales, nextDate, parseSalesCsv, validatePlanning, validateSales } from '../lib/planning.ts';
import { simulatePricingLocally } from '../lib/engines.ts';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const history = (n = 42) => Array.from({ length: n }, (_, i) => ({ date: nextDate('2026-01-01', i), sku: 'A', units: 10, price: 100, stockout: false }));
const forecast = forecastSales(history(), 'A');
const input = { ...defaultPlanning, currentPrice: 100, unitCost: 40, feePercent: 10, voucherPercent: 0, refundPercent: 0, adsPercent: 0, shippingCost: 0, packagingCost: 0, minimumMargin: 10, elasticity: 0, openingStock: 560, leadDays: 0, safetyDays: 0, openingCash: 1000, settlementDays: 0, supplierPaymentDays: 0, weeklyOverhead: 0 };

test('CSV accepts BOM, quoted SKUs and alternate separators', () => {
  const rows = parseSalesCsv('\uFEFFdate;sku;units;price;stockout\r\n2026-01-01;"SKU;A";0;100;1\r\n');
  assert.equal(rows[0].sku, 'SKU;A'); assert.equal(rows[0].stockout, true);
  assert.equal(parseSalesCsv('date,sku,units,price,stockout\n2026-01-01,"A,""B""",2,100,0')[0].sku, 'A,"B"');
});
test('CSV refuses missing, duplicate, fractional and impossible rows without silently dropping them', () => {
  for (const row of ['2026-02-30,A,1,100,0', '2026-01-01,A,1.5,100,0', '2026-01-01,A,,100,0', '2026-01-01,A,2,100,', '2026-01-01,A,-1,100,0', '2026-01-01,A,1,0,0']) {
    assert.throws(() => parseSalesCsv('date,sku,units,price,stockout\n' + row));
  }
  assert.throws(() => validateSales([...history(1), { ...history(1)[0], sku: ' A ' }]), /trùng/);
  assert.throws(() => parseSalesCsv('date,sku,units,price,stockout\n2026-01-01,"A,1,100,0'), /nháy/);
});
test('demand history needs consecutive days and enough in-stock observations', () => {
  assert.throws(() => forecastSales(history(13), 'A'), /14/);
  assert.throws(() => forecastSales(history().filter((_, i) => i !== 10), 'A'), /Thiếu ngày/);
  const stockedOut = history().map((row, i) => ({ ...row, stockout: i > 25, units: i > 25 ? 0 : 10 }));
  assert.throws(() => forecastSales(stockedOut, 'A'), /28 ngày/);
});
test('stockout days do not turn into zero demand', () => {
  const rows = history().map((row, i) => ({ ...row, stockout: i % 7 === 0, units: i % 7 === 0 ? 0 : 10 }));
  const result = forecastSales(rows, 'A');
  assert.equal(result.stockoutDays, 6); close(result.daily[0], 10);
});
test('stable demand backtest is perfect and does not use held-out future to predict the past', () => {
  assert.equal(forecast.wape, 0); assert.equal(forecast.backtestDays, 7);
  const rows = history(21).map((row, i) => ({ ...row, units: i === 20 ? 100 : 10 }));
  const result = forecastSales(rows, 'A');
  close(result.wape, 90 / 160 * 100);
});
test('zero actual holdout gives no WAPE instead of fabricated accuracy', () => {
  const rows = history(21).map((row, i) => ({ ...row, units: i >= 14 ? 0 : 10 }));
  assert.equal(forecastSales(rows, 'A').wape, null);
});
test('weekday seasonality requires four usable weeks', () => {
  assert.equal(forecastSales(history(14), 'A').method, 'level');
  assert.equal(forecast.method, 'weekday');
});
test('unit economics and cash are separate; opening inventory is not charged twice', () => {
  const result = evaluateScenario(forecast, input, 100);
  close(result.netRevenue, 56000); close(result.contribution, 28000); close(result.margin, 50);
  assert.equal(result.orderUnits, 0); close(result.weeks.at(-1).closingCash, 51400); close(result.endingInventory, 0);
  assert.equal(result.feasible, true);
});
test('procurement paid upfront and delayed settlement reconcile cash, receivables and profit', () => {
  const result = evaluateScenario(forecast, { ...input, openingStock: 0, openingCash: 25000, settlementDays: 7 }, 100);
  assert.equal(result.orderUnits, 560); close(result.orderCost, 22400); close(result.receivables, 6300);
  close(result.weeks.at(-1).closingCash, 25000 - 22400 + 50400 - 6300);
  close(result.contribution, 28000); assert.equal(result.additionalCapital, 0);
});
test('supplier payment after horizon remains payable', () => {
  const result = evaluateScenario(forecast, { ...input, openingStock: 0, supplierPaymentDays: 60 }, 100);
  close(result.payable, 22400); close(result.weeks.reduce((sum, week) => sum + week.procurement, 0), 0);
});
test('funding requirement catches the intraday trough even when end-week cash is positive', () => {
  const result = evaluateScenario(forecast, { ...input, openingStock: 0, openingCash: 20000 }, 100);
  close(result.additionalCapital, 2400); assert.ok(result.weeks[0].closingCash > 0);
  assert.ok(result.blockers.includes('Thiếu vốn trong kỳ')); assert.equal(result.feasible, false);
});
test('inventory lead time cannot sell goods that have not arrived', () => {
  const result = evaluateScenario(forecast, { ...input, openingStock: 0, leadDays: 7, openingCash: 50000 }, 100);
  close(result.lost, 70); close(result.sold, 490); close(result.endingInventory, 70);
  close(result.weeks[0].sold, 0); close(result.weeks[1].sold, 70);
});
test('margin, price policy and operating profit blockers are enforced', () => {
  const belowFloor = evaluateScenario(forecast, { ...input, unitCost: 95 }, 100);
  assert.ok(belowFloor.blockers.includes('Dưới margin tối thiểu')); assert.ok(belowFloor.blockers.includes('Lợi nhuận vận hành không dương'));
  assert.ok(evaluateScenario(forecast, input, 150).blockers.includes('Vượt policy thay đổi giá'));
});
test('price response uses historical price as anchor; cost remains fixed when price changes', () => {
  const result = evaluateScenario(forecast, { ...input, currentPrice: 120, elasticity: -1 }, 120);
  close(result.demand, 560 * 100 / 120);
  close(result.margin, (120 - 12 - 40) / 120 * 100);
});
test('voucher, refunds, platform commission, ads and fixed overhead reconcile', () => {
  const result = evaluateScenario(forecast, { ...input, voucherPercent: 10, refundPercent: 10, adsPercent: 5, weeklyOverhead: 70 }, 100);
  const net = 100 * .9 * .9; const unitContribution = net * .85 - 40;
  close(result.netRevenue, 560 * net); close(result.contribution, 560 * unitContribution);
  close(result.operatingProfit, 560 * unitContribution - 560);
  close(result.weeks.at(-1).closingCash, 1000 + 560 * net * .85 - 560);
});
test('scenario grid deduplicates prices and recomputes sensitivity cash needs', () => {
  const cases = compareScenarios(forecast, input, 100); assert.equal(cases.length, 5);
  const low = evaluateScenario(forecast, { ...input, openingStock: 0 }, 100, .8);
  const high = evaluateScenario(forecast, { ...input, openingStock: 0 }, 100, 1.2);
  assert.ok(high.orderCost > low.orderCost); assert.ok(high.additionalCapital > low.additionalCapital);
});
test('financial inputs reject impossible delays, elasticity and nonfinite values but allow valid zeros', () => {
  for (const changed of [{ unitCost: 0 }, { leadDays: 57 }, { leadDays: .5 }, { openingCash: NaN }, { elasticity: 1 }, { feePercent: 60, adsPercent: 60 }]) {
    assert.throws(() => validatePlanning({ ...input, ...changed }));
  }
  assert.doesNotThrow(() => validatePlanning({ ...input, minimumMargin: 0, settlementDays: 0, openingStock: 0, supplierPaymentDays: 0 }));
});
test('demo is reproducible and is valid history, not a fetched market result', () => {
  assert.equal(demoSalesCsv(), demoSalesCsv()); const rows = parseSalesCsv(demoSalesCsv());
  assert.equal(rows.length, 42); assert.equal(forecastSales(rows, rows[0].sku).historyDays, 42);
});
const pricing = { ourPrice: 100, competitorPrice: 70, competitorChangePercent: 0, cogsPercent: 20, targetMarginPercent: 0, competitorVoucherPercent: 0, platformFeePercent: 0, voucherPercent: 10, shippingPercent: 0, returnRatePercent: 0, adsSpendPercent: 0, campaignSpendPercent: 0, packagingCost: 0, undercutPercent: 0, gapThresholdPercent: 0, skuRole: 'core' };
test('Pricing Lab accepts zero margin, cost and threshold without substituting demo defaults', () => {
  const result = simulatePricingLocally({ ...pricing, cogsPercent: 0 });
  assert.equal(result.unitCost, 0); assert.equal(result.marginFloor, 0);
});
test('Pricing Lab converts competitor effective price to our listing price before applying own voucher', () => {
  const result = simulatePricingLocally(pricing);
  assert.ok(Math.abs(result.competitiveTarget * .9 - 70) <= .5, 'Effective target respects rounding to whole currency units'); assert.equal(result.action, 'MATCH_UNDERCUT');
  assert.throws(() => simulatePricingLocally({ ...pricing, ourPrice: NaN }), /hữu hạn/);
});
test('all legacy pricing guardrail branches remain intact and never auto-increase price', () => {
  const base = { ...pricing, voucherPercent: 0, targetMarginPercent: 15, gapThresholdPercent: 12 };
  const scenarios = [
    [{ competitorPrice: 110 }, 'NO_ACTION'],
    [{ competitorPrice: 95 }, 'MONITOR'],
    [{ competitorPrice: 70 }, 'MATCH_UNDERCUT'],
    [{ competitorPrice: 50, cogsPercent: 70 }, 'DEFEND_MARGIN'],
    [{ competitorPrice: 90, cogsPercent: 90 }, 'HUMAN_REVIEW'],
  ];
  for (const [changes, action] of scenarios) {
    const result = simulatePricingLocally({ ...base, ...changes });
    assert.equal(result.action, action); assert.ok(result.recommendedPrice <= base.ourPrice);
  }
  assert.equal(simulatePricingLocally({ ...base, competitorPrice: 110, cogsPercent: 90 }).reviewRequired, true);
});
test('inventory ordered outside the horizon stays inbound instead of being sold or counted as received', () => {
  const result = evaluateScenario(forecast, { ...input, openingStock: 0, leadDays: 56, openingCash: 50000 }, 100);
  close(result.sold, 0); close(result.lost, 560); close(result.endingInventory, 0); close(result.inboundInventory, 560);
});
