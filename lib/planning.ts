/** Brand-owned planning. Market snapshots are deliberately not sales history. */
export type SalesDay = { date: string; sku: string; units: number; price: number; stockout: boolean };
export type Forecast = {
  sku: string; lastDate: string; historyDays: number; usableDays: number; stockoutDays: number;
  referencePrice: number; method: 'weekday' | 'level'; daily: number[];
  lowFactor: number; highFactor: number; wape: number | null; backtestDays: number;
};
export type PlanningInput = {
  currentPrice: number; unitCost: number; voucherPercent: number; feePercent: number;
  refundPercent: number; adsPercent: number; shippingCost: number; packagingCost: number;
  minimumMargin: number; maxPriceChange: number; elasticity: number;
  openingStock: number; leadDays: number; safetyDays: number;
  openingCash: number; settlementDays: number; supplierPaymentDays: number; weeklyOverhead: number;
};
export type PlanWeek = {
  week: number; date: string; demand: number; sold: number; lost: number; inventory: number;
  revenue: number; contribution: number; receipts: number; procurement: number;
  operatingCash: number; closingCash: number;
};
export type PriceScenario = {
  price: number; demand: number; sold: number; lost: number; netRevenue: number;
  contribution: number; operatingProfit: number; margin: number; orderUnits: number;
  orderCost: number; additionalCapital: number; receivables: number; payable: number;
  endingInventory: number; inboundInventory: number; feasible: boolean; blockers: string[]; weeks: PlanWeek[];
};

const iso = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = 86_400_000;
function timestamp(date: string) {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!iso.test(date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) {
    throw new Error(`Ngày không hợp lệ: ${date}. Dùng YYYY-MM-DD.`);
  }
  return time;
}
function mean(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
export function nextDate(date: string, offset: number) { return new Date(timestamp(date) + offset * dayMs).toISOString().slice(0, 10); }

/** RFC-style quoted fields, UTF-8 BOM, comma/semicolon/tab; no silent row drops. */
function csvRecords(text: string): string[][] {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/)[0];
  const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const records: string[][] = []; let record: string[] = []; let field = ''; let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; }
      else if (!quoted && field.length) throw new Error('CSV có dấu nháy không hợp lệ.');
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) { record.push(field.trim()); field = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      record.push(field.trim()); if (record.some(Boolean)) records.push(record); record = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('CSV có ô chưa đóng dấu nháy.');
  record.push(field.trim()); if (record.some(Boolean)) records.push(record);
  return records;
}

export function validateSales(value: unknown): SalesDay[] {
  if (!Array.isArray(value) || !value.length || value.length > 20_000) throw new Error('Cần từ 1 đến 20.000 dòng bán hàng.');
  const seen = new Set<string>();
  return value.map((item, index) => {
    const row = item as SalesDay;
    if (!row || typeof row.date !== 'string' || typeof row.sku !== 'string' || !row.sku.trim() || row.sku.length > 200 || typeof row.stockout !== 'boolean') {
      throw new Error(`Dòng ${index + 2}: thiếu ngày, SKU hoặc stockout (0/1).`);
    }
    timestamp(row.date);
    if (!Number.isSafeInteger(row.units) || row.units < 0 || row.units > 10_000_000 || !Number.isFinite(row.price) || row.price <= 0 || row.price > 1e12) {
      throw new Error(`Dòng ${index + 2}: units phải là số nguyên không âm; price phải lớn hơn 0.`);
    }
    const key = JSON.stringify([row.date, row.sku.trim()]);
    if (seen.has(key)) throw new Error(`Dòng ${index + 2}: trùng ngày và SKU. Hãy tổng hợp các đơn trước khi import.`);
    seen.add(key);
    return { date: row.date, sku: row.sku.trim(), units: row.units, price: row.price, stockout: row.stockout };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function parseSalesCsv(text: string): SalesDay[] {
  const [header, ...records] = csvRecords(text);
  const columns = ['date', 'sku', 'units', 'price', 'stockout'];
  if (!header || columns.some((name) => !header.includes(name))) throw new Error('CSV cần các cột: date,sku,units,price,stockout.');
  return validateSales(records.map((record, index) => {
    if (record.length !== header.length) throw new Error(`Dòng ${index + 2}: số cột không đúng.`);
    const cell = (name: string) => record[header.indexOf(name)];
    if (!cell('units') || !cell('price') || !['0', '1'].includes(cell('stockout'))) throw new Error(`Dòng ${index + 2}: thiếu số hoặc stockout phải là 0/1.`);
    return { date: cell('date'), sku: cell('sku'), units: Number(cell('units')), price: Number(cell('price')), stockout: cell('stockout') === '1' };
  }));
}

function predict(rows: SalesDay[], date: string) {
  const clean = rows.filter((row) => !row.stockout).slice(-28);
  const weekday = new Date(timestamp(date)).getUTCDay();
  const sameDay = clean.filter((row) => new Date(timestamp(row.date)).getUTCDay() === weekday);
  return mean(clean.length >= 28 && sameDay.length >= 4 ? sameDay.map((row) => row.units) : clean.map((row) => row.units));
}

export function forecastSales(history: SalesDay[], sku: string): Forecast {
  const rows = history.filter((row) => row.sku === sku).sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) throw new Error('Chọn SKU có lịch sử bán hàng.');
  for (let i = 1; i < rows.length; i++) {
    if (nextDate(rows[i - 1].date, 1) !== rows[i].date) throw new Error(`Thiếu ngày giữa ${rows[i - 1].date} và ${rows[i].date}. Bổ sung cả ngày bán 0; không tự điền ngày thiếu.`);
  }
  const clean = rows.filter((row) => !row.stockout);
  if (clean.length < 14) throw new Error('Cần ít nhất 14 ngày có hàng để tạo baseline. Ngày hết hàng không được xem là nhu cầu bằng 0.');
  if (rows.slice(-28).filter((row) => !row.stockout).length < 14) throw new Error('28 ngày gần nhất cần ít nhất 14 ngày có hàng.');
  const recent = clean.slice(-28); const level = mean(recent.map((row) => row.units));
  if (!level) throw new Error('Chưa có lượt bán trong baseline gần nhất; chưa thể so sánh độ nhạy giá.');
  const lastDate = rows.at(-1)!.date;
  const errors: number[] = []; const actuals: number[] = [];
  for (let i = Math.max(14, rows.length - 7); i < rows.length; i++) {
    if (rows[i].stockout || rows.slice(0, i).filter((row) => !row.stockout).length < 14) continue;
    errors.push(Math.abs(predict(rows.slice(0, i), rows[i].date) - rows[i].units)); actuals.push(rows[i].units);
  }
  const deviation = Math.sqrt(mean(recent.map((row) => (row.units - level) ** 2)));
  const spread = Math.min(1, deviation / level);
  const units = recent.reduce((sum, row) => sum + row.units, 0);
  return {
    sku, lastDate, historyDays: rows.length, usableDays: recent.length, stockoutDays: rows.filter((row) => row.stockout).length,
    referencePrice: recent.reduce((sum, row) => sum + row.price * row.units, 0) / units,
    method: recent.length >= 28 ? 'weekday' : 'level',
    daily: Array.from({ length: 56 }, (_, i) => predict(rows, nextDate(lastDate, i + 1))),
    lowFactor: Math.max(.2, 1 - spread), highFactor: 1 + spread,
    wape: actuals.reduce((a, b) => a + b, 0) > 0 ? errors.reduce((a, b) => a + b, 0) / actuals.reduce((a, b) => a + b, 0) * 100 : null,
    backtestDays: actuals.length,
  };
}

export const defaultPlanning: PlanningInput = {
  currentPrice: 62000, unitCost: 34100, voucherPercent: 0, feePercent: 8, refundPercent: 1.5,
  adsPercent: 3, shippingCost: 0, packagingCost: 1000, minimumMargin: 15, maxPriceChange: 10,
  elasticity: -1, openingStock: 100, leadDays: 7, safetyDays: 7,
  openingCash: 70_000_000, settlementDays: 7, supplierPaymentDays: 0, weeklyOverhead: 500_000,
};

export function validatePlanning(input: PlanningInput): void {
  for (const key of Object.keys(defaultPlanning) as Array<keyof PlanningInput>) {
    const value = input?.[key];
    if (!Number.isFinite(value) || (key !== 'elasticity' && value < 0) || Math.abs(value) > 1e12) throw new Error(`Giá trị không hợp lệ: ${key}.`);
  }
  if (input.currentPrice <= 0 || input.unitCost <= 0) throw new Error('Giá bán và giá vốn phải lớn hơn 0.');
  for (const key of ['voucherPercent', 'feePercent', 'refundPercent', 'adsPercent', 'minimumMargin'] as const) {
    if (input[key] > 80) throw new Error('Tỷ lệ chi phí và margin phải nằm trong khoảng 0–80%.');
  }
  if (input.feePercent + input.adsPercent >= 100) throw new Error('Tổng phí sàn và quảng cáo phải dưới 100%.');
  if (input.maxPriceChange > 30 || input.elasticity < -5 || input.elasticity > 0) throw new Error('Policy giá tối đa 30%; độ nhạy giá phải từ -5 đến 0.');
  for (const key of ['leadDays', 'safetyDays', 'settlementDays', 'supplierPaymentDays', 'openingStock'] as const) {
    if (!Number.isSafeInteger(input[key])) throw new Error('Tồn kho và số ngày phải là số nguyên.');
  }
  if (input.leadDays > 56 || input.safetyDays > 28 || input.settlementDays > 90 || input.supplierPaymentDays > 90) throw new Error('Lead time tối đa 56 ngày, safety tối đa 28 ngày, kỳ thanh toán tối đa 90 ngày.');
}

export function evaluateScenario(forecast: Forecast, input: PlanningInput, price: number, demandFactor = 1): PriceScenario {
  validatePlanning(input);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(demandFactor) || demandFactor <= 0) throw new Error('Giá/kịch bản nhu cầu không hợp lệ.');
  const response = (price / forecast.referencePrice) ** input.elasticity * demandFactor;
  const demand = forecast.daily.map((units) => units * response);
  const netUnitRevenue = price * (1 - input.voucherPercent / 100) * (1 - input.refundPercent / 100);
  const fee = netUnitRevenue * input.feePercent / 100;
  const unitSellingCost = netUnitRevenue * input.adsPercent / 100 + input.shippingCost + input.packagingCost;
  const unitContribution = netUnitRevenue - fee - unitSellingCost - input.unitCost;
  const margin = unitContribution / netUnitRevenue * 100;
  const orderUnits = Math.max(0, Math.ceil(demand.reduce((a, b) => a + b, 0) + mean(demand) * input.safetyDays - input.openingStock));
  const orderCost = orderUnits * input.unitCost;
  const receipts = Array<number>(56 + input.settlementDays).fill(0);
  let stock = input.openingStock; let cash = input.openingCash; let minCash = cash;
  let totalSold = 0; let revenue = 0; let contribution = 0;
  const weeks: PlanWeek[] = [];
  for (let day = 0; day < 56; day++) {
    if (day === input.leadDays) stock += orderUnits;
    const sold = Math.min(stock, demand[day]); stock -= sold;
    receipts[day + input.settlementDays] += sold * (netUnitRevenue - fee);
    const procurement = day === input.supplierPaymentDays ? orderCost : 0;
    const operatingCash = sold * unitSellingCost + input.weeklyOverhead / 7;
    // Payment and operating outflows may precede today's settlement: preserve the intraday cash trough.
    minCash = Math.min(minCash, cash - procurement - operatingCash);
    cash += receipts[day] - procurement - operatingCash;
    totalSold += sold; revenue += sold * netUnitRevenue; contribution += sold * unitContribution;
    const week = Math.floor(day / 7);
    if (!weeks[week]) weeks.push({ week: week + 1, date: nextDate(forecast.lastDate, day + 1), demand: 0, sold: 0, lost: 0, inventory: 0, revenue: 0, contribution: 0, receipts: 0, procurement: 0, operatingCash: 0, closingCash: 0 });
    const row = weeks[week];
    row.demand += demand[day]; row.sold += sold; row.lost += demand[day] - sold; row.inventory = stock;
    row.revenue += sold * netUnitRevenue; row.contribution += sold * unitContribution;
    row.receipts += receipts[day]; row.procurement += procurement; row.operatingCash += operatingCash; row.closingCash = cash;
  }
  const additionalCapital = Math.max(0, -minCash);
  const blockers: string[] = [];
  if (margin + 1e-8 < input.minimumMargin) blockers.push('Dưới margin tối thiểu');
  if (Math.abs(price / input.currentPrice - 1) * 100 > input.maxPriceChange + 1e-8) blockers.push('Vượt policy thay đổi giá');
  if (additionalCapital > .01) blockers.push('Thiếu vốn trong kỳ');
  if (contribution - input.weeklyOverhead * 8 <= 0) blockers.push('Lợi nhuận vận hành không dương');
  return {
    price, demand: demand.reduce((a, b) => a + b, 0), sold: totalSold, lost: demand.reduce((a, b) => a + b, 0) - totalSold,
    netRevenue: revenue, contribution, operatingProfit: contribution - input.weeklyOverhead * 8, margin,
    orderUnits, orderCost, additionalCapital, receivables: receipts.slice(56).reduce((a, b) => a + b, 0),
    payable: input.supplierPaymentDays >= 56 ? orderCost : 0, endingInventory: stock,
    inboundInventory: input.leadDays >= 56 ? orderUnits : 0,
    feasible: blockers.length === 0, blockers, weeks,
  };
}

export function compareScenarios(forecast: Forecast, input: PlanningInput, proposedPrice?: number) {
  const prices = [.9, .95, 1, 1.05, 1.1].map((factor) => Math.round(input.currentPrice * factor));
  if (proposedPrice && Number.isFinite(proposedPrice) && proposedPrice > 0) prices.push(Math.round(proposedPrice));
  return [...new Set(prices)].sort((a, b) => a - b).map((price) => evaluateScenario(forecast, input, price));
}

export function demoSalesCsv() {
  const header = 'date,sku,units,price,stockout';
  // Deterministic, clearly synthetic onboarding data. Never portrayed as real brand sales.
  const rows = Array.from({ length: 42 }, (_, i) => `${nextDate('2026-01-01', i)},DEMO-SNACK-01,${18 + (i * 7 % 11) + (i % 7 > 4 ? 8 : 0)},62000,0`);
  return [header, ...rows].join('\n');
}
