'use client';
import { useLanguage } from '@/lib/i18n';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Check, CheckCheck, CircleDollarSign, FileSpreadsheet, History, Info, Package, ShieldCheck, Upload, Wallet } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { compareScenarios, defaultPlanning, demoSalesCsv, evaluateScenario, forecastSales, nextDate, parseSalesCsv, validatePlanning, validateSales, type PlanningInput, type PriceScenario, type SalesDay } from '@/lib/planning';
import type { PricingInput } from '@/lib/types';
import OutcomeReview from './OutcomeReview';
import { compareOutcome, validateOutcome, type Outcome } from '@/lib/outcomes';

export type PlanningSeed = { id: number; input: PricingInput; proposedPrice: number; label: string; approvedMatch: boolean };
type Decision = {
  id: string; createdAt: string; owner: string; sku: string; source: string; note: string;
  input: PlanningInput; result: PriceScenario; historyEnd: string; historyDays: number;
  market: { label: string; price: number } | null; basis: 'illustrative-demo' | 'imported-sales';
  outcomes?: Outcome[];
};
type Workspace = {
  version: 1; sales: SalesDay[]; source: string; demo: boolean; sku: string;
  input: PlanningInput; decisions: Decision[]; market: { label: string; price: number } | null;
};
const storageKey = 'mavericks.profit-workspace.v1';

function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function NumberInput({ label, field, input, update, unit = '' }: { label: string; field: keyof PlanningInput; input: PlanningInput; update: (key: keyof PlanningInput, value: number) => void; unit?: string }) {
  const { t } = useLanguage();
  return <label className="ps-field"><span>{t(label)} {unit && <small>{t(unit)}</small>}</span><input type="number" min={field === 'elasticity' ? -5 : 0} step={field === 'elasticity' ? .1 : 'any'} value={input[field]} onChange={(event) => update(field, event.target.value === '' ? 0 : Number(event.target.value))} /></label>;
}

function readWorkspace(text: string): Workspace {
  const value = JSON.parse(text) as Workspace;
  if (value.version !== 1 || typeof value.source !== 'string' || typeof value.demo !== 'boolean' || typeof value.sku !== 'string' || !Array.isArray(value.decisions)) throw new Error('Backup workspace không đúng định dạng.');
  value.sales = value.sales.length ? validateSales(value.sales) : [];
  validatePlanning(value.input);
  if (value.market && (typeof value.market.label !== 'string' || !Number.isFinite(value.market.price) || value.market.price <= 0)) throw new Error('Tín hiệu giá trong backup không hợp lệ.');
  if (value.decisions.length > 50) throw new Error('Backup có quá nhiều decision.');
  for (const row of value.decisions) {
    if (!row || [row.id, row.owner, row.sku, row.createdAt, row.note, row.source, row.historyEnd].some((item) => typeof item !== 'string') || !Number.isFinite(Date.parse(row.createdAt)) || !Number.isSafeInteger(row.historyDays) || !['illustrative-demo', 'imported-sales'].includes(row.basis) || !row.result || !Array.isArray(row.result.weeks) || row.result.weeks.length !== 8 || !Number.isFinite(row.result.price) || !Number.isFinite(row.result.operatingProfit) || !Number.isFinite(row.result.orderUnits) || !Number.isFinite(row.result.additionalCapital)) throw new Error('Decision log trong backup không hợp lệ.');
    validatePlanning(row.input);
    if (row.outcomes !== undefined) {
      if (!Array.isArray(row.outcomes) || row.outcomes.length > 20) throw new Error('Lịch sử kết quả không hợp lệ hoặc quá 20 bản.');
      row.outcomes = row.outcomes.map(validateOutcome);
      const ids = new Set(row.outcomes.map(outcome => outcome.id));
      if (ids.size !== row.outcomes.length) throw new Error('Lịch sử kết quả bị trùng mã bản ghi.');
      for (const outcome of row.outcomes) compareOutcome(row, outcome);
    }
  }
  return value;
}

export default function ProfitPlanner({ seed }: { seed: PlanningSeed | null }) {
  const { t, money, count, percent, date, compact } = useLanguage();
  const [workspace, setWorkspace] = useState<Workspace>({ version: 1, sales: [], source: '', demo: false, sku: '', input: defaultPlanning, decisions: [], market: null });
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [owner, setOwner] = useState('');
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'plan' | 'log' | 'actual'>('plan');
  const [helpOpen, setHelpOpen] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const { input, sales, sku } = workspace;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only workspace hydration after SSR.
      if (saved) setWorkspace(readWorkspace(saved));
    } catch { setError('Không đọc được workspace đã lưu. Bạn có thể khôi phục từ backup hoặc nhập CSV mới.'); }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(storageKey, JSON.stringify(workspace)); }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- report browser persistence failure instead of silent data loss.
    catch { setError('Trình duyệt không lưu được workspace. Hãy tải backup trước khi đóng trang.'); }
  }, [workspace, hydrated]);

  const skus = useMemo(() => [...new Set(sales.map((row) => row.sku))].sort(), [sales]);
  const model = useMemo(() => {
    if (!sales.length) return { forecast: null, scenarios: [], message: '' };
    try {
      const forecast = forecastSales(sales, sku);
      return { forecast, scenarios: compareScenarios(forecast, input, workspace.market?.price), message: '' };
    } catch (cause) { return { forecast: null, scenarios: [], message: cause instanceof Error ? cause.message : 'Không tính được phương án.' }; }
  }, [sales, sku, input, workspace.market]);
  const best = [...model.scenarios].filter((scenario) => scenario.feasible).sort((a, b) => b.operatingProfit - a.operatingProfit)[0];
  const baseline = model.scenarios.find((scenario) => scenario.price === Math.round(input.currentPrice));
  const chosen = model.scenarios.find((scenario) => scenario.price === selectedPrice) || best || baseline;
  const sensitivities = useMemo(() => {
    if (!model.forecast || !chosen) return [];
    return [
      { label: 'Nhu cầu thấp', factor: model.forecast.lowFactor },
      { label: 'Baseline', factor: 1 },
      { label: 'Nhu cầu cao', factor: model.forecast.highFactor },
    ].map((scenario) => ({ label: scenario.label, result: evaluateScenario(model.forecast!, input, chosen.price, scenario.factor) }));
  }, [model.forecast, chosen, input]);
  const netPerUnit = chosen ? chosen.price * (1 - input.voucherPercent / 100) * (1 - input.refundPercent / 100) : 0;
  const sellingPerUnit = netPerUnit * input.adsPercent / 100 + input.shippingCost + input.packagingCost;
  const feePerUnit = netPerUnit * input.feePercent / 100;
  const profitPerUnit = netPerUnit - input.unitCost - feePerUnit - sellingPerUnit;
  const costParts = [
    { label: 'Giá vốn', value: input.unitCost, color: '#9babb8' },
    { label: 'Phí sàn', value: feePerUnit, color: '#c8ae7e' },
    { label: 'Chi phí bán hàng', value: sellingPerUnit, color: '#7096a8' },
    { label: 'Lợi nhuận đóng góp', value: profitPerUnit, color: '#2c6858' },
  ];
  const costScale = Math.max(netPerUnit, input.unitCost + feePerUnit + sellingPerUnit, 1);
  const maxProfit = Math.max(1, ...model.scenarios.map((scenario) => scenario.operatingProfit));
  const cashSeries = chosen?.weeks.map((week) => ({ ...week, outflow: -(week.procurement + week.operatingCash) })) || [];

  function update(key: keyof PlanningInput, value: number) {
    setWorkspace((current) => ({ ...current, input: { ...current.input, [key]: value } }));
    setSelectedPrice(null); setNotice('');
  }
  function importSales(text: string, source: string, demo = false) {
    try {
      const imported = parseSalesCsv(text); const nextSku = imported[0].sku;
      let referencePrice = imported.find((row) => row.sku === nextSku)!.price;
      try { referencePrice = forecastSales(imported, nextSku).referencePrice; } catch { /* Validation is visible in the model panel. */ }
      setWorkspace((current) => ({ ...current, sales: imported, sku: nextSku, source, demo, market: null, input: { ...current.input, currentPrice: Math.round(referencePrice) } }));
      setSelectedPrice(null); setError(''); setNotice(`Đã nhập ${count(imported.length)} dòng từ ${source}. Kiểm tra giá vốn và tồn kho của bạn trước khi duyệt.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đọc được CSV.'); }
  }
  async function loadFile(file: File | undefined, backup = false) {
    if (!file) return;
    if (file.size > 5_000_000) { setError('File tối đa 5 MB.'); return; }
    try {
      const text = await file.text();
      if (backup) { setWorkspace(readWorkspace(text)); setSelectedPrice(null); setNotice('Đã khôi phục workspace từ backup.'); setError(''); }
      else importSales(text, file.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đọc được file.'); }
  }
  function selectSku(value: string) {
    let price = input.currentPrice;
    try { price = Math.round(forecastSales(sales, value).referencePrice); } catch { /* Show completeness error in model panel. */ }
    setWorkspace((current) => ({ ...current, sku: value, market: null, input: { ...current.input, currentPrice: price } }));
    setSelectedPrice(null); setNotice('Đã đổi SKU. Hãy cập nhật giá vốn, tồn kho và các chi phí riêng của SKU này.');
  }
  function applySeed() {
    if (!seed || !sku) return;
    const source = seed.input;
    setWorkspace((current) => ({ ...current, market: { label: seed.label, price: seed.proposedPrice }, input: {
      ...current.input, currentPrice: source.ourPrice, unitCost: Math.round(source.ourPrice * source.cogsPercent / 100),
      voucherPercent: source.voucherPercent, feePercent: source.platformFeePercent,
      refundPercent: source.returnRatePercent, adsPercent: source.adsSpendPercent + source.campaignSpendPercent,
      shippingCost: source.ourPrice * source.shippingPercent / 100, packagingCost: source.packagingCost,
      minimumMargin: source.targetMarginPercent,
    } }));
    setSelectedPrice(null); setNotice('Đã liên kết phương án Pricing Lab. Giá vốn chuyển từ giả định COGS%; hãy thay bằng giá vốn thực.');
  }
  function approve() {
    if (!chosen?.feasible || !model.forecast || !owner.trim()) return;
    const decision: Decision = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), owner: owner.trim(), sku, source: workspace.source,
      note: note.trim(), input: { ...input }, result: structuredClone(chosen), historyEnd: model.forecast.lastDate,
      historyDays: model.forecast.historyDays, market: workspace.market,
      basis: workspace.demo ? 'illustrative-demo' : 'imported-sales',
    };
    setWorkspace((current) => ({ ...current, decisions: [decision, ...current.decisions].slice(0, 50) }));
    setNotice(workspace.demo ? 'Đã lưu bản duyệt thử nghiệm. Đây là dữ liệu minh họa, không phải quyết định vận hành thực.' : 'Đã ghi nhận phê duyệt và lưu toàn bộ giả định. Chưa thực thi thay đổi giá hoặc đặt hàng.');
    setNote(''); setTab('log');
  }
  function exportPlan() {
    if (!chosen || !model.forecast) return;
    download(`mavericks-plan-${model.forecast.lastDate}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), sku, source: workspace.source, demo: workspace.demo, forecast: model.forecast, input, market: workspace.market, result: chosen, scenarios: model.scenarios, sensitivities, limitations: ['Độ nhạy giá do người dùng giả định; chưa xác định tác động nhân quả.', 'Lợi nhuận vận hành mô phỏng trước thuế và chi phí tài chính.', 'Tiền hàng tồn đầu kỳ được giả định đã thanh toán.', 'Một lô đặt đầu kỳ, chưa tối ưu nhiều lần nhập hàng.'] }, null, 2));
  }

  return <div className={sales.length ? 'profit-studio has-sales' : 'profit-studio'}>
    <section className="ps-hero">
      <div><span className="ps-eyebrow">{t("KẾ HOẠCH KINH DOANH · 8 TUẦN")}</span><h2>{t("Bán ở giá nào, nhập bao nhiêu?")}</h2><p>{t("So sánh phương án trước khi chốt giá và đặt hàng. Mỗi kết quả đi kèm dữ liệu nguồn, chi phí và giả định bạn có thể kiểm tra.")}</p><div className="ps-hero-tags"><span><FileSpreadsheet size={14} />{t(" Dữ liệu của brand")}</span><span><CheckCheck size={14} />{t(" Người phụ trách duyệt")}</span><span><History size={14} />{t(" Có lịch sử tính toán")}</span></div></div>
      <div className="ps-data-card"><span>{t("HỒ SƠ BÁN HÀNG")}</span><strong>{sales.length ? t("{v0} dòng", { v0: count(sales.length) }) : t("Chưa có dữ liệu")}</strong><p>{sales.length ? `${skus.length} SKU · ${workspace.source}` : t("Nhập file bán hàng hoặc mở ví dụ để xem cách làm.")}</p><Badge variant={workspace.demo ? 'warning' : sales.length ? 'secondary' : 'secondary'}>{workspace.demo ? t("Ví dụ minh họa · không phải kết quả thực") : sales.length ? t("File do bạn cung cấp") : t("Chưa có lịch sử")}</Badge></div>
    </section>
    <div className="ps-toolbar">
      <div className="ps-tabs" role="tablist" aria-label={t("Kế hoạch kinh doanh")}><button role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>{t("Kế hoạch")}</button><button role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>{t("Lịch sử phê duyệt ")}<span>{workspace.decisions.length}</span></button><button role="tab" aria-selected={tab === 'actual'} className={tab === 'actual' ? 'active' : ''} onClick={() => setTab('actual')}>{t("Kết quả thực tế")}</button></div>
      <div className="ps-actions"><Button size="sm" variant="ghost" aria-expanded={helpOpen && tab !== 'actual'} onClick={() => { if (tab === 'actual') { setTab('plan'); setHelpOpen(true); } else setHelpOpen(!helpOpen); }}><Info size={14}/>{t(" Hướng dẫn dữ liệu")}</Button><Button size="sm" variant="outline" disabled={!hydrated} onClick={() => csvRef.current?.click()}><Upload size={14} />{t(" Nhập CSV")}</Button><Button size="sm" variant="outline" onClick={() => download('mavericks-workspace.json', JSON.stringify(workspace, null, 2))} disabled={!hydrated}><ArrowDownToLine size={14} />{t(" Sao lưu")}</Button><Button size="sm" variant="ghost" onClick={() => backupRef.current?.click()} disabled={!hydrated}>{t("Khôi phục")}</Button></div>
      <input ref={csvRef} hidden type="file" accept=".csv,.tsv,text/csv" aria-label={t("Nhập lịch sử bán hàng CSV")} onChange={(event) => { void loadFile(event.target.files?.[0]); event.target.value = ''; }} />
      <input ref={backupRef} hidden type="file" accept=".json,application/json" aria-label={t("Khôi phục workspace JSON")} onChange={(event) => { void loadFile(event.target.files?.[0], true); event.target.value = ''; }} />
    </div>
    {error && <div className="ps-message error" role="alert">{t(error)}<button onClick={() => setError('')} aria-label={t("Đóng thông báo lỗi")}>×</button></div>}
    {notice && <div className="ps-message" role="status">{t(notice)}</div>}
    {tab === 'actual' && <OutcomeReview decisions={workspace.decisions} onStart={() => setTab('plan')} onSave={(id,outcome) => setWorkspace(current => ({...current,decisions:current.decisions.map(decision => decision.id === id ? {...decision,outcomes:[outcome,...(decision.outcomes || [])].slice(0,20)} : decision)}))}/>}
    {tab !== 'actual' && <>
    {helpOpen && <section className="ps-panel data-guide" aria-label={t("Hướng dẫn dữ liệu")}><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("CHUẨN BỊ TRONG 3 BƯỚC")}</span><h3>{t("Nhập đúng dữ liệu, rồi mới xem phương án")}</h3></div><button onClick={() => setHelpOpen(false)} aria-label={t("Đóng hướng dẫn")}>×</button></div><ol><li><strong>{t("Xuất lịch sử theo ngày và SKU")}</strong><p>{t("Dùng ít nhất 14 ngày có hàng, liên tiếp theo lịch. Ghi cả ngày bán 0; không dùng monthly_sold của đối thủ thay cho lượng bán của brand.")}</p></li><li><strong>{t("Kiểm tra giá và ngày hết hàng")}</strong><p>{t("Giá là giá niêm yết tham chiếu. stockout = 1 nếu hết hàng, = 0 nếu có hàng. Không có ngày trùng cho cùng SKU.")}</p></li><li><strong>{t("Xác nhận chi phí và vốn riêng")}</strong><p>{t("CSV không cung cấp giá vốn, tồn kho hoặc tiền sẵn có. Các giá trị có sẵn là đầu vào minh họa, cần thay trước khi duyệt.")}</p></li></ol><div className="enterprise-table-wrap"><table className="enterprise-table"><thead><tr><th>{t("date")}</th><th>{t("sku")}</th><th>{t("units")}</th><th>{t("price")}</th><th>{t("stockout")}</th></tr></thead><tbody><tr><td>2026-01-01</td><td>{t("SKU-001")}</td><td>20</td><td>62000</td><td>0</td></tr><tr><td>2026-01-02</td><td>{t("SKU-001")}</td><td>0</td><td>62000</td><td>1</td></tr></tbody></table></div><p className="ps-muted">{t("Ví dụ định dạng, không phải dữ liệu vận hành. File tối đa 5 MB. Nhập file mới sẽ thay lịch sử bán hàng hiện tại; nên sao lưu trước.")}</p><Button variant="outline" size="sm" onClick={() => download('sales-template-42-days.csv', demoSalesCsv().replaceAll('DEMO-SNACK-01','YOUR-SKU'), 'text/csv;charset=utf-8')}>{t("Tải mẫu 42 ngày · số liệu minh họa")}</Button></section>}
    {tab === 'log' ? <section className="ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("HỒ SƠ QUYẾT ĐỊNH")}</span><h3>{t("Những phương án đã được ghi nhận")}</h3></div><Button variant="outline" size="sm" disabled={!workspace.decisions.length} onClick={() => download('mavericks-decision-log.json', JSON.stringify(workspace.decisions, null, 2))}>{t("Xuất lịch sử")}</Button></div><p className="ps-muted">{t("Lưu tối đa 50 bản duyệt trên trình duyệt này. Tên người phụ trách do bạn nhập; hồ sơ chưa đồng bộ với đội nhóm.")}</p>{!workspace.decisions.length ? <div className="ps-empty"><History size={30} /><h3>{t("Chưa có phương án được duyệt")}</h3><p>{t("So sánh phương án, nhập tên người phụ trách và lưu bản phê duyệt đầu tiên.")}</p><Button onClick={() => setTab('plan')}>{t("Lập kế hoạch ")}<ArrowRight size={14} /></Button></div> : <div className="ps-log">{workspace.decisions.map((decision) => <article key={decision.id}><div><Badge variant={decision.basis === 'illustrative-demo' ? 'warning' : 'secondary'}>{decision.basis === 'illustrative-demo' ? t("Duyệt thử nghiệm") : t("Đã ghi nhận")}</Badge><h4>{decision.sku} · {money(decision.result.price)}</h4><p>{decision.owner} · {date(decision.createdAt, true)}</p><p>{decision.note || t("Không có ghi chú.")}</p><small>{decision.source}{t(" · lịch sử đến ")}{decision.historyEnd}</small></div><div><span>{t("Lợi nhuận vận hành dự kiến")}</span><strong>{money(decision.result.operatingProfit)}</strong><small>{t("Nhập ")}{count(decision.result.orderUnits)}{t(" đơn vị · vốn thiếu ")}{money(decision.result.additionalCapital)}</small><Button variant="ghost" size="sm" onClick={() => download(`decision-${decision.id}.json`, JSON.stringify(decision, null, 2))}>{t("Tải hồ sơ tính toán")}</Button></div></article>)}</div>}</section> : <>
      {!sales.length && <section className="ps-onboarding ps-panel"><span className="ps-onboarding-icon"><FileSpreadsheet size={32} /></span><div><span className="ps-eyebrow">{t("BẮT ĐẦU TỪ DỮ LIỆU CỦA BẠN")}</span><h3>{t("Cho Mavericks biết brand thực sự bán được bao nhiêu.")}</h3><p>{t("CSV mỗi ngày, mỗi SKU: ")}<code>{t("date,sku,units,price,stockout")}</code>{t(". Cần ít nhất 14 ngày có hàng; ghi cả ngày bán 0. Giá là giá niêm yết tham chiếu, chưa trừ voucher.")}</p><div className="ps-actions"><Button onClick={() => csvRef.current?.click()} disabled={!hydrated}><Upload size={15} />{t(" Nhập lịch sử bán hàng")}</Button><Button variant="outline" onClick={() => importSales(demoSalesCsv(), 'Demo 42 ngày · dữ liệu tổng hợp', true)} disabled={!hydrated}>{t("Thử với dữ liệu minh họa")}</Button><Button variant="ghost" onClick={() => download('sales-template.csv', 'date,sku,units,price,stockout\n2026-01-01,YOUR-SKU,20,62000,0\n2026-01-02,YOUR-SKU,0,62000,1\n', 'text/csv;charset=utf-8')}>{t("Tải mẫu CSV")}</Button></div></div></section>}
      {sales.length > 0 && <>
        <section className="ps-source-bar"><label className="ps-field"><span>{t("SKU của brand")}</span><select aria-label={t("SKU của brand")} value={sku} onChange={(event) => selectSku(event.target.value)}>{skus.map((value) => <option key={value}>{value}</option>)}</select></label><div><span className="ps-eyebrow">{t("DỮ LIỆU DÙNG ĐỂ TÍNH")}</span><p>{model.forecast ? t("{v0} ngày bán hàng · đến {v1} · {v2} ngày hết hàng được loại khỏi mức bán tham chiếu", { v0: model.forecast.historyDays, v1: model.forecast.lastDate, v2: model.forecast.stockoutDays }) : t("Kiểm tra chuỗi ngày và trạng thái tồn kho")}</p><small>{workspace.demo ? t("Ví dụ minh họa. Hãy thay chi phí, tồn kho và tiền sẵn có bằng dữ liệu của bạn khi dùng thực tế.") : t("Giá vốn, tồn kho và tiền sẵn có cần bạn xác nhận riêng; chưa có trong CSV bán hàng.")}</small></div></section>
        <details className="provenance-details"><summary>{workspace.demo ? t("Dữ liệu minh họa") : t("Dữ liệu do brand cung cấp")}{t(" · Chi phí cần xác nhận · Độ nhạy giá giả định ")}{input.elasticity}<span>{t("Xem nguồn & giới hạn")}</span></summary><div className="provenance-grid" aria-label={t("Nguồn và mức độ chắc chắn")}><div><Badge variant={workspace.demo ? 'warning' : 'secondary'}>{workspace.demo ? t("Dữ liệu minh họa") : t("File do brand cung cấp")}</Badge><strong>{t("Lịch sử bán hàng")}</strong><p>{workspace.source} · {model.forecast?.historyDays ?? '—'}{t(" ngày của SKU đang chọn. Chưa được đối soát với sàn.")}</p></div><div><Badge variant="outline">{t("Đầu vào cần xác nhận")}</Badge><strong>{t("Chi phí, tồn kho & tiền")}</strong><p>{t("Do bạn nhập; hệ thống chưa kết nối kế toán hoặc kho để xác minh.")}</p></div><div><Badge variant="warning">{t("Giả định mô hình")}</Badge><strong>{t("Độ nhạy giá: ")}{input.elasticity}</strong><p>{t("Chưa học từ thử nghiệm giá. Lượng bán có thể thay đổi khác giả định.")}</p></div><div><Badge variant="secondary">{t("Kết quả mô phỏng")}</Badge><strong>{t("Kế hoạch 8 tuần")}</strong><p>{t("Không phải cam kết lợi nhuận. Xem thêm kịch bản nhu cầu thấp trước khi duyệt.")}</p></div></div></details>
        {seed && <section className="ps-market-link"><Info size={18} /><div><strong>{t("Phương án từ Pricing Lab: ")}{money(seed.proposedPrice)}</strong><p>{seed.label}</p><small>{seed.approvedMatch ? t("Cặp SKU đã duyệt. ") : t("Scenario độc lập. ")}{t("Chỉ liên kết khi SKU bán hàng đang chọn đúng là sản phẩm nguồn; thao tác này sẽ cập nhật economics.")}</small></div><Button variant="outline" size="sm" onClick={applySeed}>{t("Xác nhận cùng SKU & liên kết")}</Button></section>}
        {workspace.market && <div className="ps-message">{t("Đang so sánh thêm mức giá ")}{money(workspace.market.price)}{t(" từ Pricing Lab. ")}<button onClick={() => setWorkspace((current) => ({ ...current, market: null }))}>{t("Gỡ liên kết")}</button></div>}
        <div className="ps-layout"><aside className="ps-input-panel ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("DO BẠN CUNG CẤP")}</span><h3>{t("Chi phí & điều kiện")}</h3></div></div>
          <dl className="ps-input-summary"><div><dt>{t("Giá bán hiện tại")}</dt><dd>{money(input.currentPrice)}</dd></div><div><dt>{t("Giá vốn / đơn vị")}</dt><dd>{money(input.unitCost)}</dd></div><div><dt>{t("Tồn kho đầu kỳ")}</dt><dd>{count(input.openingStock)}{t(" đơn vị")}</dd></div><div><dt>{t("Tiền sẵn có")}</dt><dd>{money(input.openingCash)}</dd></div><div><dt>{t("Biên tối thiểu")}</dt><dd>{input.minimumMargin}%</dd></div><div><dt>{t("Độ nhạy giá")}</dt><dd>{input.elasticity}{t(" · giả định")}</dd></div></dl>
          <p className="ps-help ps-assumption-intro">{t("Đây là đầu vào bạn cần xác nhận, không phải số liệu đã được hệ thống xác minh.")}</p><details className="ps-assumptions"><summary>{t("Điều chỉnh chi phí & điều kiện")}</summary>
          <div className="ps-input-section"><h4>{t("01 · Giá & chi phí / đơn vị")}</h4><div className="ps-fields"><NumberInput label={t("Giá hiện tại")} field="currentPrice" unit={t("đ")} input={input} update={update} /><NumberInput label={t("Giá vốn thực")} field="unitCost" unit={t("đ")} input={input} update={update} /><NumberInput label={t("Voucher brand")} field="voucherPercent" unit="%" input={input} update={update} /><NumberInput label={t("Phí sàn")} field="feePercent" unit="%" input={input} update={update} /><NumberInput label={t("Dự phòng hoàn tiền")} field="refundPercent" unit="%" input={input} update={update} /><NumberInput label={t("Ads + campaign")} field="adsPercent" unit="%" input={input} update={update} /><NumberInput label={t("Shipping hỗ trợ")} field="shippingCost" unit={t("đ")} input={input} update={update} /><NumberInput label={t("Bao bì / combo")} field="packagingCost" unit={t("đ")} input={input} update={update} /></div></div>
          <div className="ps-input-section"><h4>{t("02 · Policy & độ nhạy giá")}</h4><div className="ps-fields"><NumberInput label={t("Margin tối thiểu")} field="minimumMargin" unit="%" input={input} update={update} /><NumberInput label={t("Đổi giá tối đa ±")} field="maxPriceChange" unit="%" input={input} update={update} /><NumberInput label={t("Độ nhạy giá giả định")} field="elasticity" input={input} update={update} /></div><p className="ps-help">{t("−1 nghĩa là giá tăng 1% thì nhu cầu giảm xấp xỉ 1%. Đây là giả định do bạn nhập, chưa được AI học hoặc xác thực.")}</p></div>
          <div className="ps-input-section"><h4>{t("03 · Tồn kho & thời điểm tiền")}</h4><div className="ps-fields"><NumberInput label={t("Tồn kho đầu kỳ")} field="openingStock" input={input} update={update} /><NumberInput label={t("Giao hàng sau")} field="leadDays" unit={t("ngày")} input={input} update={update} /><NumberInput label={t("Safety stock")} field="safetyDays" unit={t("ngày bán")} input={input} update={update} /><NumberInput label={t("Tiền sẵn có")} field="openingCash" unit={t("đ")} input={input} update={update} /><NumberInput label={t("Sàn trả tiền sau")} field="settlementDays" unit={t("ngày bán")} input={input} update={update} /><NumberInput label={t("Trả NCC sau đặt")} field="supplierPaymentDays" unit={t("ngày")} input={input} update={update} /><NumberInput label={t("Chi phí cố định")} field="weeklyOverhead" unit={t("đ/tuần")} input={input} update={update} /></div><p className="ps-help">{t("Đặt một lô ở đầu kỳ, giao sau lead time. Tồn kho đầu kỳ giả định đã trả tiền; số ngày tính theo lịch.")}</p></div>
          </details>
        </aside><div className="ps-results">
          {model.message && <div className="ps-message error" role="alert">{t(model.message)}</div>}
          {model.forecast && chosen && <>
            <section className="ps-recommendation ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("PHƯƠNG ÁN ĐỂ CÂN NHẮC")}</span><h3>{best ? t("Thử mức giá {v0}", { v0: money(best.price) }) : t("Cần điều chỉnh trước khi chốt phương án")}</h3></div><Badge variant={best ? 'secondary' : 'warning'}>{best ? t("Chưa thực thi") : t("Chưa đủ điều kiện")}</Badge></div><p>{best && baseline ? <>{t("Với các giả định hiện tại, phương án này tạo thêm ")}<strong>{money(best.operatingProfit - baseline.operatingProfit)}</strong>{t(" lợi nhuận vận hành so với giữ giá trong 8 tuần. Đây là kết quả mô phỏng để bạn kiểm chứng, chưa phải cam kết doanh thu.")}</> : t("Xem điều kiện chưa đạt trong bảng so sánh và kiểm tra lại chi phí hoặc nguồn vốn trước khi phê duyệt.")}</p>
              {best && <div className="ps-checklist"><span><Check size={14}/>{t(" Biên ")}{percent(best.margin)} ≥ {input.minimumMargin}%</span><span><Check size={14}/>{t(" Thay đổi giá trong ±")}{input.maxPriceChange}%</span><span><Check size={14}/>{t(" Đủ tiền theo lịch thu chi")}</span></div>}
              <details className="ps-calculation-details"><summary>{t("Xem cơ sở tính toán")}</summary><div className="ps-evidence"><span>{t("Mức bán tham chiếu: ")}{model.forecast.method === 'weekday' ? t("trung bình theo thứ") : t("trung bình ngày có hàng")}</span><span>{t("Giá lịch sử bình quân: ")}{money(model.forecast.referencePrice)}</span><span>{t("Độ nhạy giá: ")}{input.elasticity}{t(" · do bạn giả định")}</span><span>{model.forecast.wape === null ? t("Chưa đủ dữ liệu đo sai số") : t("Sai số dự báo WAPE: {v0} · kiểm tra {v1} ngày", { v0: percent(model.forecast.wape), v1: model.forecast.backtestDays })}</span></div><p className="ps-help">{t("WAPE so sánh dự báo với lượng bán thực trên những ngày chưa dùng để dự báo. Chỉ số này không đo độ đúng của giả định về phản ứng với giá.")}</p></details>
            </section>
            <div className="ps-selected-heading"><span>{t("Phương án đang xem ")}<strong>{money(chosen.price)}</strong></span>{best && chosen.price !== best.price && <Button variant="ghost" size="sm" onClick={() => setSelectedPrice(best.price)}>{t("Về phương án đề xuất")}</Button>}</div>
            {baseline && <section className="decision-tradeoff ps-panel" aria-label={t("Đánh đổi so với giữ giá")}><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("SO VỚI GIỮ GIÁ · MÔ PHỎNG 8 TUẦN")}</span><h3>{t("Bạn được gì, đánh đổi gì?")}</h3></div></div><div className="tradeoff-grid"><div><span>{t("Lợi nhuận vận hành")}</span><strong>{chosen.operatingProfit - baseline.operatingProfit >= 0 ? '+' : ''}{money(chosen.operatingProfit - baseline.operatingProfit)}</strong><small>{money(baseline.operatingProfit)} → {money(chosen.operatingProfit)}</small></div><div><span>{t("Lượng bán")}</span><strong>{chosen.sold - baseline.sold >= 0 ? '+' : ''}{count(chosen.sold - baseline.sold)}{t(" đơn vị")}</strong><small>{count(baseline.sold)} → {count(chosen.sold)}{t(" · theo giả định độ nhạy giá")}</small></div><div><span>{t("Lượng cần nhập")}</span><strong>{chosen.orderUnits - baseline.orderUnits >= 0 ? '+' : ''}{count(chosen.orderUnits - baseline.orderUnits)}{t(" đơn vị")}</strong><small>{count(baseline.orderUnits)} → {count(chosen.orderUnits)}</small></div></div><p className="ps-muted">{t("“Tốt hơn” ở đây nghĩa là lợi nhuận vận hành cao hơn trong các mức giá đã thử và điều kiện đã nhập — không phải tối ưu toàn thị trường. ")}{chosen.feasible ? t("Phương án đang xem đạt các điều kiện hiện tại.") : t("Phương án đang xem chưa đủ điều kiện phê duyệt.")}</p></section>}
            <div className="ps-metrics"><div><span><CircleDollarSign size={15} />{t(" Lợi nhuận vận hành")}</span><strong>{money(chosen.operatingProfit)}</strong><small>{baseline ? t("{v0}{v1} so với giữ giá", { v0: chosen.operatingProfit >= baseline.operatingProfit ? '+' : '', v1: money(chosen.operatingProfit - baseline.operatingProfit) }) : t("8 tuần mô phỏng")}</small></div><div><span><ShieldCheck size={15} />{t(" Biên đóng góp")}</span><strong>{percent(chosen.margin)}</strong><small>{t("Ngưỡng tối thiểu ")}{input.minimumMargin}%</small></div><div><span><Package size={15} />{t(" Lượng hàng cần đặt")}</span><strong>{count(chosen.orderUnits)}</strong><small>{t("Tiền nhập hàng ")}{money(chosen.orderCost)}</small></div><div className={chosen.additionalCapital > 0 ? 'at-risk' : ''}><span><Wallet size={15} />{t(" Vốn cần bổ sung")}</span><strong>{money(chosen.additionalCapital)}</strong><small>{t("Đã tính ")}{money(input.openingCash)}{t(" tiền sẵn có")}</small></div></div>
            <section className="ps-panel ps-unit-economics"><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("GIẢI THÍCH CHI PHÍ")}</span><h3>{t("Mỗi đơn vị bán ra giữ lại bao nhiêu?")}</h3></div><span className="ps-unit-net">{t("Doanh thu sau voucher & hoàn tiền")}<br/><strong>{money(netPerUnit)}</strong></span></div><div className="ps-cost-bar" role="img" aria-label={t("Giá vốn {v0}, phí sàn {v1}, chi phí bán hàng {v2}, lợi nhuận đóng góp {v3} trên mỗi đơn vị.", { v0: money(input.unitCost), v1: money(feePerUnit), v2: money(sellingPerUnit), v3: money(profitPerUnit) })}>{costParts.map((part) => <span key={t(part.label)} style={{ width: `${Math.max(0, part.value) / costScale * 100}%`, background: part.color }} />)}</div><div className="ps-cost-legend">{costParts.map((part) => <div key={t(part.label)}><span><i style={{ background: part.color }}/>{t(part.label)}</span><strong>{money(part.value)}</strong></div>)}</div><p className="ps-help">{t("Chi phí bán hàng gồm quảng cáo, campaign, giao hàng hỗ trợ và bao bì. Lợi nhuận đóng góp còn phải trả chi phí cố định; chưa trừ thuế và lãi vay.")}</p></section>
            <section className="ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("SO SÁNH MỨC GIÁ")}</span><h3>{t("Chọn phương án để xem ảnh hưởng")}</h3></div><span className="ps-muted">{t("Lợi nhuận vận hành · 8 tuần giả định")}</span></div>
              <div className="ps-scenario-bars">{model.scenarios.map((scenario) => <button key={scenario.price} aria-label={t("Xem phương án {v0}", { v0: money(scenario.price) })} aria-pressed={chosen.price === scenario.price} className={chosen.price === scenario.price ? 'selected' : ''} onClick={() => setSelectedPrice(scenario.price)}><span className="ps-scenario-price"><strong>{money(scenario.price)}</strong><small>{scenario.price === Math.round(input.currentPrice) ? t("Giữ giá hiện tại") : t("{v0}{v1} giá bán", { v0: scenario.price > input.currentPrice ? '+' : '', v1: percent((scenario.price / input.currentPrice - 1) * 100) })}</small></span><span className="ps-scenario-track"><i style={{ width: `${Math.max(0, scenario.operatingProfit) / maxProfit * 100}%` }} /></span><span className="ps-scenario-value"><strong>{money(scenario.operatingProfit)}</strong><small>{!scenario.feasible ? t("Chưa đủ điều kiện") : best?.price === scenario.price ? t("Cao nhất trong các phương án khả thi") : t("{v0} đơn vị có thể bán", { v0: count(scenario.sold) })}</small></span></button>)}</div>
              <details className="ps-calculation-details"><summary>{t("Xem số liệu & điều kiện từng phương án")}</summary><div className="ps-table-scroll"><table className="ps-table"><thead><tr><th>{t("Giá bán")}</th><th>{t("Nhu cầu")}</th><th>{t("Lợi nhuận vận hành")}</th><th>{t("Biên")}</th><th>{t("Vốn thiếu")}</th><th>{t("Điều kiện")}</th></tr></thead><tbody>{model.scenarios.map((scenario) => <tr key={scenario.price} className={chosen.price === scenario.price ? 'selected' : ''}><td>{money(scenario.price)}</td><td>{count(scenario.demand)}</td><td>{money(scenario.operatingProfit)}</td><td>{percent(scenario.margin)}</td><td>{money(scenario.additionalCapital)}</td><td>{scenario.feasible ? <span className="ps-pass"><Check size={13} />{t(" Đạt")}</span> : <span className="ps-blocked">{scenario.blockers.map(item => t(item)).join(' · ')}</span>}</td></tr>)}</tbody></table></div><p className="ps-help">{t("Nhu cầu = mức bán tham chiếu × (giá mới / giá lịch sử bình quân)")}<sup>{t("độ nhạy giá")}</sup>{t(". Chỉ so sánh các mức giá đã thử, chưa xác định giá tối ưu toàn cục.")}</p></details>
            </section>
            <section className="ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("TIỀN VỀ VÀ TIỀN CHI")}</span><h3>{t("Khi nào cần tiền để nhập hàng?")}</h3></div><span className="ps-chart-legend"><i />{t(" Tiền về ")}<b />{t(" Tiền chi ")}<em />{t(" Số dư cuối tuần")}</span></div><div className="ps-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={cashSeries} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}><CartesianGrid stroke="#e9ece7" vertical={false} /><XAxis dataKey="week" tickFormatter={(value) => t("Tuần {v0}", { v0: String(value) })} stroke="#758178" tickLine={false} fontSize={11} /><YAxis width={65} tickFormatter={(value) => compact(Number(value))} stroke="#758178" tickLine={false} fontSize={11} /><Tooltip contentStyle={{ background: '#fff', border: '1px solid #d9dfd8', borderRadius: 8, color: '#24322c' }} formatter={(value) => money(Number(value))} labelFormatter={(value) => t("Tuần {v0}", { v0: String(value) })} /><ReferenceLine y={0} stroke="#96a397" /><Bar name={t("Tiền về")} dataKey="receipts" fill="#a2bcac" radius={[3, 3, 0, 0]} /><Bar name={t("Tiền chi")} dataKey="outflow" fill="#c5aa96" radius={[0, 0, 3, 3]} /><Line name={t("Số dư cuối tuần")} dataKey="closingCash" stroke="#2c6858" strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} /></ComposedChart></ResponsiveContainer></div><div className="ps-cash-notes"><span>{t("Tiền chưa về từ sàn")}<strong>{money(chosen.receivables)}</strong></span><span>{t("Còn phải trả NCC sau kỳ")}<strong>{money(chosen.payable)}</strong></span><span>{t("Hàng còn lại cuối kỳ")}<strong>{count(chosen.endingInventory)}{t(" đơn vị")}</strong></span><span>{t("Chưa bán được do thiếu hàng")}<strong>{count(chosen.lost)}{t(" đơn vị")}</strong></span></div>
              {chosen.orderUnits > 0 ? <div className="ps-order-timeline"><div><span>{t("01 · Đặt hàng")}</span><strong>{count(chosen.orderUnits)}{t(" đơn vị")}</strong><small>{nextDate(model.forecast.lastDate, 1)}</small></div><ArrowRight size={15}/><div><span>{t("02 · Hàng về dự kiến")}</span><strong>{nextDate(model.forecast.lastDate, input.leadDays + 1)}</strong><small>{t("Sau ")}{input.leadDays}{t(" ngày giao hàng")}</small></div><ArrowRight size={15}/><div><span>{t("03 · Trả nhà cung cấp")}</span><strong>{money(chosen.orderCost)}</strong><small>{nextDate(model.forecast.lastDate, input.supplierPaymentDays + 1)}</small></div></div> : <p className="ps-help">{t("Tồn đầu kỳ đủ cho phương án này; chưa cần đặt thêm lô hàng.")}</p>}
            </section>
            <section className="ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("KẾ HOẠCH THEO TUẦN")}</span><h3>{t("Nhập hàng, bán hàng, thu tiền")}</h3></div><Button size="sm" variant="outline" onClick={() => download('mavericks-weekly-plan.csv', '\uFEFFweek,start_date,demand,sold,lost,ending_inventory,net_revenue,contribution,receipts,procurement,operating_cash,closing_cash\n' + chosen.weeks.map((week) => [week.week, week.date, ...[week.demand, week.sold, week.lost, week.inventory, week.revenue, week.contribution, week.receipts, week.procurement, week.operatingCash, week.closingCash].map((value) => value.toFixed(2))].join(',')).join('\n'), 'text/csv;charset=utf-8')}><ArrowDownToLine size={13} />{t(" Tải bảng CSV")}</Button></div><details className="ps-week-details"><summary>{t("Xem 8 tuần chi tiết")}</summary><div className="ps-table-scroll"><table className="ps-table"><thead><tr><th>{t("Tuần")}</th><th>{t("Bán được")}</th><th>{t("Thiếu hàng")}</th><th>{t("Tồn cuối")}</th><th>{t("Tiền về")}</th><th>{t("Trả NCC")}</th><th>{t("Chi vận hành")}</th><th>{t("Tiền cuối")}</th></tr></thead><tbody>{chosen.weeks.map((week) => <tr key={week.week}><td><strong>{t("T")}{week.week}</strong><small>{week.date}</small></td><td>{count(week.sold)}</td><td>{count(week.lost)}</td><td>{count(week.inventory)}</td><td>{money(week.receipts)}</td><td>{money(week.procurement)}</td><td>{money(week.operatingCash)}</td><td className={week.closingCash < 0 ? 'ps-blocked' : ''}>{money(week.closingCash)}</td></tr>)}</tbody></table></div></details><p className="ps-help">{t("Bắt đầu từ ")}{nextDate(model.forecast.lastDate, 1)}{t(", ngay sau ngày cuối lịch sử. Vốn thiếu được tính theo đáy tiền hằng ngày trước khoản thu, không chỉ theo số dư cuối tuần.")}</p></section>
            <section className="ps-panel"><span className="ps-eyebrow">{t("KIỂM TRA RỦI RO")}</span><h3>{t("Nếu bán ít hơn dự kiến?")}</h3><div className="ps-sensitivity">{sensitivities.map(({ label, result }) => <div key={label}><span>{label === t("Baseline") ? t("Mức bán tham chiếu") : t(label)}</span><strong>{money(result.operatingProfit)}</strong><small>{t("Lợi nhuận vận hành · vốn thiếu ")}{money(result.additionalCapital)}</small></div>)}</div><p className="ps-help">{t("Ba kịch bản dựa trên mức dao động lượng bán lịch sử, không phải khoảng tin cậy đã xác thực. Mỗi kịch bản tính lại đơn nhập để thấy nhu cầu vốn tương ứng.")}</p></section>
            <section className="ps-approval ps-panel"><div><span className="ps-eyebrow">{t("BẠN LÀ NGƯỜI QUYẾT ĐỊNH")}</span><h3>{t("Ghi nhận phương án ")}{money(chosen.price)}</h3><p>{t("Kiểm tra các giả định trước khi duyệt. Thao tác này lưu hồ sơ, chưa đổi giá hoặc đặt hàng trên sàn.")}</p></div><div className="ps-fields"><label className="ps-field"><span>{t("Tên người phê duyệt")}</span><input value={owner} maxLength={100} onChange={(event) => setOwner(event.target.value)} placeholder={t("Tên người phụ trách")} /></label><label className="ps-field"><span>{t("Lý do / ghi chú")}</span><input value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder={t("Mục tiêu campaign, điều kiện thực hiện…")} /></label></div><div className="ps-actions"><Button disabled={!chosen.feasible || !owner.trim()} onClick={approve}><CheckCheck size={15} /> {workspace.demo ? t("Lưu bản duyệt thử nghiệm") : t("Duyệt & lưu phương án")}</Button><Button variant="outline" onClick={exportPlan}><ArrowDownToLine size={14} />{t(" Tải hồ sơ tính toán")}</Button></div>{!chosen.feasible && <p className="ps-blocked">{t("Chưa thể duyệt: ")}{chosen.blockers.map(item => t(item)).join(' · ')}.</p>}</section>
          </>}
        </div></div>
      </>}
      <aside className="ps-method-note" aria-label={t("Cơ sở tính toán và sử dụng")}><Info size={18} /><div><strong>{t("Rõ cơ sở tính toán. Chủ động khi triển khai.")}</strong><p>{t("So sánh phương án trên cùng dữ liệu bán hàng, chi phí và điều kiện của brand. Mỗi bản duyệt giữ lại đầu vào để bạn đối chiếu với kết quả thực tế.")}</p><details><summary>{t("Phương pháp tính & lưu trữ")}</summary><p>{t("Kế hoạch dùng mức bán tham chiếu từ lịch sử và độ nhạy giá bạn thiết lập. Lợi nhuận vận hành là lợi nhuận đóng góp trừ chi phí cố định, trước thuế và chi phí tài chính. Phê duyệt tạo hồ sơ quyết định; bạn chủ động triển khai giá và nhập hàng trên hệ thống vận hành. Workspace lưu trên trình duyệt của thiết bị này; dùng Sao lưu để chuyển máy hoặc giữ một bản dự phòng.")}</p></details></div></aside>
    </>}
    </>}
  </div>;
}
