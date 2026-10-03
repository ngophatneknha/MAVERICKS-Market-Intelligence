import type { PriceScenario, PlanningInput } from './planning.ts';

/** Manual post-decision observations, never used as causal proof or model training. */
export type Outcome = {
  id: string; createdAt: string; weeks: number; units: number; netRevenue: number;
  operatingProfit: number; owner: string; source: string; note: string;
};
export type OutcomeDecision = {
  id: string; sku: string; historyEnd: string; basis: 'illustrative-demo' | 'imported-sales';
  result: PriceScenario; input: PlanningInput; outcomes?: Outcome[];
};

export function validateOutcome(value: unknown): Outcome {
  const row = value as Outcome;
  if (!row || !Number.isInteger(row.weeks) || row.weeks < 1 || row.weeks > 8) throw new Error('Chọn kỳ đối chiếu từ 1 đến 8 tuần.');
  if (!Number.isSafeInteger(row.units) || row.units < 0 || row.units > 1e9) throw new Error('Lượng bán thực tế phải là số nguyên không âm.');
  if (!Number.isFinite(row.netRevenue) || row.netRevenue < 0 || row.netRevenue > 1e15 || !Number.isFinite(row.operatingProfit) || Math.abs(row.operatingProfit) > 1e15) throw new Error('Doanh thu và lợi nhuận thực tế không hợp lệ.');
  if (row.operatingProfit > row.netRevenue) throw new Error('Lợi nhuận vận hành không được lớn hơn doanh thu sau giảm giá và hoàn tiền.');
  for (const key of ['id', 'createdAt', 'owner', 'source', 'note'] as const) {
    if (typeof row[key] !== 'string' || row[key].length > 2000) throw new Error('Hồ sơ kết quả không đúng định dạng.');
  }
  if (!row.id.trim() || !row.owner.trim() || !row.source.trim() || !Number.isFinite(Date.parse(row.createdAt))) throw new Error('Cần người ghi nhận, nguồn và thời điểm hợp lệ.');
  return { ...row, owner: row.owner.trim(), source: row.source.trim(), note: row.note.trim() };
}

export function compareOutcome(decision: OutcomeDecision, observation: Outcome) {
  const actual = validateOutcome(observation);
  const weeks = decision.result.weeks.slice(0, actual.weeks);
  if (weeks.length !== actual.weeks || weeks.some(week => ![week.sold, week.revenue, week.contribution].every(Number.isFinite)) || !Number.isFinite(decision.input.weeklyOverhead)) throw new Error('Bản kế hoạch không đủ số liệu để đối chiếu kỳ này.');
  const expected = {
    units: weeks.reduce((sum, week) => sum + week.sold, 0),
    netRevenue: weeks.reduce((sum, week) => sum + week.revenue, 0),
    operatingProfit: weeks.reduce((sum, week) => sum + week.contribution, 0) - actual.weeks * decision.input.weeklyOverhead,
  };
  const delta = { units: actual.units - expected.units, netRevenue: actual.netRevenue - expected.netRevenue, operatingProfit: actual.operatingProfit - expected.operatingProfit };
  // A percentage against a zero/negative profit baseline is not meaningful.
  const relative = {
    units: expected.units > 0 ? delta.units / expected.units * 100 : null,
    netRevenue: expected.netRevenue > 0 ? delta.netRevenue / expected.netRevenue * 100 : null,
    operatingProfit: expected.operatingProfit > 0 ? delta.operatingProfit / expected.operatingProfit * 100 : null,
  };
  return { expected, delta, relative };
}
