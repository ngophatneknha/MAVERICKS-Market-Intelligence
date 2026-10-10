/**
 * SME cash ledger and deterministic what-if projection. This is not a bank feed,
 * an accounting ledger, a demand model, or an autonomous payment instruction.
 * openingCash is the balance at the START of openingDate. Settled movements
 * before that anchor are already reflected; never apply them a second time.
 */
export type CashDirection = 'in' | 'out';
export type CashStatus = 'planned' | 'settled' | 'cancelled';
export type CashEntry = {
  id: string; title: string; direction: CashDirection; amount: number; dueDate: string;
  status: CashStatus; settledDate?: string; category?: string; sourceRef?: string; notes?: string;
};
export type CashWorkspace = {
  version: 1; openingDate: string; openingCash: number; minimumReserve: number; entries: CashEntry[];
};
export type CashScenarioAmount = { date: string; amount: number; title?: string };
export type InventoryCashScenario = {
  id: string; title: string; paymentDate: string; paymentAmount: number;
  receipts?: CashScenarioAmount[]; expenses?: CashScenarioAmount[]; replacesEntryIds?: string[];
};
export type InventoryScenario = InventoryCashScenario;
export type CashProjectionOptions = {
  horizonDays: 30 | 60 | 90; asOfDate?: string; incomingDelayDays?: number;
  includeOverdueReceipts?: boolean; inventoryScenario?: InventoryCashScenario;
};
export type CashEvent = {
  id: string; title: string; direction: CashDirection; amount: number; date: string;
  source: 'ledger' | 'inventory'; entryId?: string; status: 'planned' | 'settled';
};
export type CashDay = {
  date: string; openingCash: number; inflows: number; outflows: number; cashBeforeReceipts: number;
  closingCash: number; minimumCash: number; belowReserve: boolean; events: CashEvent[];
};
export type CashProjection = {
  asOfDate: string; endDate: string; horizonDays: 30 | 60 | 90; currentCash: number; startingCash: number;
  minimumReserve: number; minimumCash: number; minimumCashDate: string; additionalCapital: number;
  cashShortfall: number; firstReserveBreachDate: string | null; belowReserveDays: number;
  expectedIn: number; expectedOut: number; closingCash: number; days: CashDay[]; history: CashDay[];
  overdue: CashEntry[]; excludedOverdueReceipts: CashEntry[]; outsideHorizon: CashEvent[];
  includedInOpeningBalance: CashEntry[]; cancelledEntries: CashEntry[]; warnings: string[];
};

const dayMilliseconds = 86_400_000;
const moneyLimit = 1e12;
const maximumEntries = 5_000;

function dateTime(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Ngày cần có định dạng YYYY-MM-DD.');
  const result = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(result) || new Date(result).toISOString().slice(0, 10) !== value) throw new Error(`Ngày không hợp lệ: ${value}.`);
  return result;
}

export function cashDateOffset(date: string, days: number): string {
  if (!Number.isSafeInteger(days)) throw new Error('Số ngày phải là số nguyên.');
  const result = new Date(dateTime(date) + days * dayMilliseconds);
  if (!Number.isFinite(result.getTime())) throw new Error('Ngày nằm ngoài phạm vi hỗ trợ.');
  const formatted = result.toISOString().slice(0, 10);
  dateTime(formatted);
  return formatted;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} không hợp lệ.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maximum: number, optional = false): string | undefined {
  if (value === undefined && optional) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${field} cần từ 1 đến ${maximum} ký tự.`);
  return value.trim();
}

function money(value: unknown, field: string, positive = false, negativeAllowed = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > moneyLimit || (!negativeAllowed && value < 0) || (positive && value <= 0)) {
    throw new Error(`${field} phải là số hữu hạn ${positive ? 'lớn hơn 0' : negativeAllowed ? 'trong phạm vi hỗ trợ' : 'không âm'}, tối đa ${moneyLimit}.`);
  }
  return value;
}

/** Strict validation also creates a clean copy; no hidden fields survive import. */
export function validateCashWorkspace(value: unknown): CashWorkspace {
  const source = record(value, 'Workspace dòng tiền');
  if (source.version !== 1) throw new Error('Phiên bản workspace dòng tiền chưa được hỗ trợ.');
  dateTime(source.openingDate);
  const openingCash = money(source.openingCash, 'Số dư đầu kỳ', false, true);
  const minimumReserve = money(source.minimumReserve, 'Mức dự phòng tối thiểu');
  if (!Array.isArray(source.entries) || source.entries.length > maximumEntries) throw new Error(`Sổ thu–chi tối đa ${maximumEntries} khoản.`);
  const ids = new Set<string>();
  const entries = source.entries.map((item, index): CashEntry => {
    const row = record(item, `Khoản ${index + 1}`);
    const id = text(row.id, 'Mã khoản thu–chi', 200)!;
    if (ids.has(id)) throw new Error(`Trùng mã khoản thu–chi: ${id}.`);
    ids.add(id);
    if (row.direction !== 'in' && row.direction !== 'out') throw new Error('Chiều giao dịch phải là in hoặc out.');
    if (row.status !== 'planned' && row.status !== 'settled' && row.status !== 'cancelled') throw new Error('Trạng thái giao dịch không hợp lệ.');
    dateTime(row.dueDate);
    if (row.status === 'settled') dateTime(row.settledDate);
    else if (row.settledDate !== undefined) throw new Error('Chỉ khoản đã thực thu/chi mới có ngày thực hiện.');
    return {
      id, title: text(row.title, 'Tên khoản thu–chi', 200)!, direction: row.direction,
      amount: money(row.amount, 'Số tiền giao dịch', true), dueDate: row.dueDate as string, status: row.status,
      ...(row.status === 'settled' ? { settledDate: row.settledDate as string } : {}),
      ...(row.category !== undefined ? { category: text(row.category, 'Nhóm giao dịch', 100)! } : {}),
      ...(row.sourceRef !== undefined ? { sourceRef: text(row.sourceRef, 'Tham chiếu nguồn', 200)! } : {}),
      ...(row.notes !== undefined ? { notes: text(row.notes, 'Ghi chú', 1_000)! } : {}),
    };
  });
  return { version: 1, openingDate: source.openingDate as string, openingCash, minimumReserve, entries };
}

/** No fabricated balances or transactions on first use. */
export function emptyCashWorkspace(date: string): CashWorkspace {
  dateTime(date);
  return { version: 1, openingDate: date, openingCash: 0, minimumReserve: 0, entries: [] };
}

/** Opt-in, synthetic example. The caller must label it as demonstration data. */
export function demoCashWorkspace(date: string): CashWorkspace {
  return validateCashWorkspace({
    version: 1, openingDate: date, openingCash: 35_000_000, minimumReserve: 8_000_000,
    entries: [
      { id: 'demo-collected', title: 'Minh họa · Thu công nợ đã nhận', direction: 'in', amount: 4_000_000, dueDate: date, status: 'settled', settledDate: date, category: 'Công nợ' },
      { id: 'demo-rent', title: 'Minh họa · Chi thuê kho', direction: 'out', amount: 8_000_000, dueDate: cashDateOffset(date, 3), status: 'planned', category: 'Vận hành' },
      { id: 'demo-supplier', title: 'Minh họa · Thanh toán nhà cung cấp', direction: 'out', amount: 25_000_000, dueDate: cashDateOffset(date, 7), status: 'planned', category: 'Nhập hàng' },
      { id: 'demo-settlement', title: 'Minh họa · Tiền sàn dự kiến về', direction: 'in', amount: 32_000_000, dueDate: cashDateOffset(date, 10), status: 'planned', category: 'Tiền sàn' },
      { id: 'demo-marketing', title: 'Minh họa · Ngân sách quảng cáo', direction: 'out', amount: 6_000_000, dueDate: cashDateOffset(date, 15), status: 'planned', category: 'Marketing' },
    ],
  });
}

function scenarioEvents(scenario: InventoryCashScenario, workspace: CashWorkspace, asOfDate: string): { events: CashEvent[]; replacedIds: Set<string> } {
  const item = record(scenario, 'Kịch bản nhập hàng');
  const id = text(item.id, 'Mã kịch bản', 200)!;
  const title = text(item.title, 'Tên kịch bản', 200)!;
  dateTime(item.paymentDate);
  if ((item.paymentDate as string) < asOfDate) throw new Error('Ngày thanh toán kịch bản không được trước ngày dự báo.');
  const paymentAmount = money(item.paymentAmount, 'Tiền thanh toán nhập hàng', true);
  const replacement = item.replacesEntryIds ?? [];
  if (!Array.isArray(replacement) || replacement.length > maximumEntries) throw new Error('Danh sách khoản được thay thế không hợp lệ.');
  const replacedIds = new Set<string>();
  for (const replacementId of replacement) {
    const candidate = text(replacementId, 'Mã khoản được thay thế', 200)!;
    if (replacedIds.has(candidate)) throw new Error('Khoản được thay thế bị lặp.');
    const entry = workspace.entries.find((entry) => entry.id === candidate);
    if (!entry || entry.status !== 'planned') throw new Error('Kịch bản chỉ được thay thế khoản dự kiến còn tồn tại; không thay thế giao dịch đã thực hiện.');
    replacedIds.add(candidate);
  }
  const linkedEntries = workspace.entries.filter((entry) => entry.sourceRef === id || entry.id === id);
  if (linkedEntries.some((entry) => entry.status === 'settled')) throw new Error('Kịch bản này đã có giao dịch thực hiện. Không tính lại khoản đã thu/chi; tạo kịch bản mới cho giao dịch bổ sung.');
  const linked = linkedEntries.filter((entry) => entry.status === 'planned');
  if (linked.some((entry) => !replacedIds.has(entry.id))) throw new Error('Kịch bản này đã được ghi vào sổ. Chọn rõ khoản dự kiến cần thay thế để không tính hai lần.');
  const events: CashEvent[] = [{ id: `inventory:${id}:payment`, title, direction: 'out', amount: paymentAmount, date: item.paymentDate as string, source: 'inventory', status: 'planned' }];
  for (const [field, direction] of [['receipts', 'in'], ['expenses', 'out']] as const) {
    const scheduled = item[field] ?? [];
    if (!Array.isArray(scheduled) || scheduled.length > maximumEntries) throw new Error('Số khoản trong kịch bản không hợp lệ.');
    scheduled.forEach((raw, index) => {
      const row = record(raw, 'Khoản của kịch bản');
      dateTime(row.date);
      if ((row.date as string) < asOfDate) throw new Error('Thu–chi kịch bản không được trước ngày dự báo.');
      events.push({
        id: `inventory:${id}:${field}:${index}`, title: row.title === undefined ? title : text(row.title, 'Tên khoản kịch bản', 200)!,
        direction, amount: money(row.amount, 'Số tiền kịch bản', true), date: row.date as string, source: 'inventory', status: 'planned',
      });
    });
  }
  return { events, replacedIds };
}

function dailyCash(startDate: string, numberOfDays: number, openingCash: number, events: CashEvent[], minimumReserve: number): CashDay[] {
  const byDate = new Map<string, CashEvent[]>();
  for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  let cash = openingCash;
  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = cashDateOffset(startDate, index);
    const dayEvents = byDate.get(date) ?? [];
    const inflows = dayEvents.filter((event) => event.direction === 'in').reduce((sum, event) => sum + event.amount, 0);
    const outflows = dayEvents.filter((event) => event.direction === 'out').reduce((sum, event) => sum + event.amount, 0);
    const cashBeforeReceipts = cash - outflows;
    const minimumCash = Math.min(cash, cashBeforeReceipts);
    const row: CashDay = { date, openingCash: cash, inflows, outflows, cashBeforeReceipts, closingCash: cashBeforeReceipts + inflows, minimumCash, belowReserve: minimumCash < minimumReserve, events: dayEvents };
    cash = row.closingCash;
    return row;
  });
}

/**
 * Confirmed movements alone reconcile the cash balance; planned entries never
 * alter it. Forecasts start from that confirmed balance. Overdue payments are
 * due immediately; overdue receipts are excluded until explicitly assumed.
 * Within each projected day all outflows precede receipts, so a positive daily
 * closing balance cannot conceal a temporary funding shortfall.
 */
export function projectCashflow(value: CashWorkspace, options: CashProjectionOptions): CashProjection {
  const workspace = validateCashWorkspace(value);
  if (!options || ![30, 60, 90].includes(options.horizonDays)) throw new Error('Kỳ dự báo cần là 30, 60 hoặc 90 ngày.');
  const asOfDate = options.asOfDate ?? workspace.openingDate;
  const elapsed = (dateTime(asOfDate) - dateTime(workspace.openingDate)) / dayMilliseconds;
  if (elapsed < 0 || elapsed > 3_660) throw new Error('Ngày dự báo cần từ ngày số dư đầu kỳ đến tối đa 10 năm sau.');
  const delay = options.incomingDelayDays ?? 0;
  if (!Number.isSafeInteger(delay) || delay < 0 || delay > 90) throw new Error('Độ trễ tiền thu cần là số nguyên từ 0 đến 90 ngày.');
  if (options.includeOverdueReceipts !== undefined && typeof options.includeOverdueReceipts !== 'boolean') throw new Error('Giả định thu công nợ quá hạn cần là boolean.');
  const endDate = cashDateOffset(asOfDate, options.horizonDays - 1);
  const cancelledEntries = workspace.entries.filter((entry) => entry.status === 'cancelled');
  const confirmed = workspace.entries.filter((entry) => entry.status === 'settled');
  if (confirmed.some((entry) => entry.settledDate! > asOfDate)) throw new Error('Giao dịch đã thực hiện không thể có ngày thực hiện sau ngày đối soát. Dùng trạng thái dự kiến cho khoản tương lai.');
  const includedInOpeningBalance = confirmed.filter((entry) => entry.settledDate! < workspace.openingDate);
  const actualEvents: CashEvent[] = confirmed.filter((entry) => entry.settledDate! >= workspace.openingDate).map((entry) => ({
    id: `ledger:${entry.id}:actual`, title: entry.title, direction: entry.direction, amount: entry.amount,
    date: entry.settledDate!, source: 'ledger', entryId: entry.id, status: 'settled',
  }));
  const history = dailyCash(workspace.openingDate, elapsed + 1, workspace.openingCash, actualEvents, workspace.minimumReserve);
  const currentCash = history.at(-1)!.closingCash;
  const inventory = options.inventoryScenario ? scenarioEvents(options.inventoryScenario, workspace, asOfDate) : { events: [] as CashEvent[], replacedIds: new Set<string>() };
  const planned = workspace.entries.filter((entry) => entry.status === 'planned' && !inventory.replacedIds.has(entry.id));
  const overdue = planned.filter((entry) => entry.dueDate < asOfDate);
  const excludedOverdueReceipts = overdue.filter((entry) => entry.direction === 'in' && !options.includeOverdueReceipts);
  const excludedIds = new Set(excludedOverdueReceipts.map((entry) => entry.id));
  const forecastEvents: CashEvent[] = planned.filter((entry) => !excludedIds.has(entry.id)).map((entry) => ({
    id: `ledger:${entry.id}:planned`, title: entry.title, direction: entry.direction, amount: entry.amount,
    date: cashDateOffset(entry.dueDate < asOfDate ? asOfDate : entry.dueDate, entry.direction === 'in' ? delay : 0),
    source: 'ledger', entryId: entry.id, status: 'planned',
  }));
  forecastEvents.push(...inventory.events.map((event) => ({ ...event, date: cashDateOffset(event.date, event.direction === 'in' ? delay : 0) })));
  const outsideHorizon = forecastEvents.filter((event) => event.date > endDate).sort((a, b) => a.date.localeCompare(b.date));
  const withinHorizon = forecastEvents.filter((event) => event.date <= endDate);
  const days = dailyCash(asOfDate, options.horizonDays, currentCash, withinHorizon, workspace.minimumReserve);
  const minimumDay = days.reduce((lowest, day) => day.minimumCash < lowest.minimumCash ? day : lowest, days[0]);
  const warnings: string[] = [];
  if (overdue.length) warnings.push('Khoản chi quá hạn được xếp vào ngày đầu dự báo; khoản thu quá hạn cần xác nhận khả năng thu.');
  if (excludedOverdueReceipts.length) warnings.push(`${excludedOverdueReceipts.length} khoản thu quá hạn chưa được cộng vào dự báo.`);
  if (includedInOpeningBalance.length) warnings.push('Giao dịch trước ngày số dư đầu kỳ được xem là đã nằm trong số dư; không cộng/trừ lần nữa.');
  if (outsideHorizon.length) warnings.push(`${outsideHorizon.length} khoản nằm ngoài kỳ dự báo và chưa được tính vào số dư cuối kỳ.`);
  if (options.inventoryScenario?.receipts?.length) warnings.push('Thu từ kịch bản nhập hàng là giả định do người dùng cung cấp; hãy bổ sung các chi phí bán hàng liên quan, không dùng doanh thu gộp như tiền thực nhận.');
  return {
    asOfDate, endDate, horizonDays: options.horizonDays, currentCash, startingCash: currentCash,
    minimumReserve: workspace.minimumReserve, minimumCash: minimumDay.minimumCash, minimumCashDate: minimumDay.date,
    additionalCapital: Math.max(0, workspace.minimumReserve - minimumDay.minimumCash), cashShortfall: Math.max(0, -minimumDay.minimumCash),
    firstReserveBreachDate: days.find((day) => day.belowReserve)?.date ?? null, belowReserveDays: days.filter((day) => day.belowReserve).length,
    expectedIn: withinHorizon.filter((event) => event.direction === 'in').reduce((sum, event) => sum + event.amount, 0),
    expectedOut: withinHorizon.filter((event) => event.direction === 'out').reduce((sum, event) => sum + event.amount, 0),
    closingCash: days.at(-1)!.closingCash, days, history, overdue, excludedOverdueReceipts, outsideHorizon, includedInOpeningBalance, cancelledEntries, warnings,
  };
}

/** Purchase-only bridge; receipts/operating costs must not be silently invented. */
export function inventoryScenarioFromPlanning(
  plan: { orderCost: number }, planning: { supplierPaymentDays: number }, forecast: { lastDate: string }, id: string, title: string,
): InventoryCashScenario | null {
  money(plan.orderCost, 'Tiền nhập hàng');
  if (!Number.isSafeInteger(planning.supplierPaymentDays) || planning.supplierPaymentDays < 0 || planning.supplierPaymentDays > 90) throw new Error('Kỳ thanh toán nhập hàng không hợp lệ.');
  if (plan.orderCost === 0) return null;
  return { id: text(id, 'Mã kịch bản', 200)!, title: text(title, 'Tên kịch bản', 200)!, paymentDate: cashDateOffset(forecast.lastDate, 1 + planning.supplierPaymentDays), paymentAmount: plan.orderCost };
}

/** Formula-safe CSV for user-entered titles, compatible with spreadsheet tools. */
export function cashflowCsv(projection: CashProjection): string {
  const cell = (value: unknown) => {
    let formatted = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(formatted)) formatted = `'${formatted}`;
    return `"${formatted.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [
    ['date', 'opening_cash', 'expected_in', 'expected_out', 'cash_before_receipts', 'closing_cash', 'minimum_reserve', 'below_reserve'],
    ...projection.days.map((day) => [day.date, day.openingCash, day.inflows, day.outflows, day.cashBeforeReceipts, day.closingCash, projection.minimumReserve, day.belowReserve ? 1 : 0]),
  ].map((row) => row.map(cell).join(',')).join('\r\n');
}
