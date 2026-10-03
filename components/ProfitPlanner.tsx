'use client';

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
const money = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value) + 'đ';
const count = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
const percent = (value: number) => `${value.toFixed(1)}%`;

function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function NumberInput({ label, field, input, update, unit = '' }: { label: string; field: keyof PlanningInput; input: PlanningInput; update: (key: keyof PlanningInput, value: number) => void; unit?: string }) {
  return <label className="ps-field"><span>{label} {unit && <small>{unit}</small>}</span><input type="number" min={field === 'elasticity' ? -5 : 0} step={field === 'elasticity' ? .1 : 'any'} value={input[field]} onChange={(event) => update(field, event.target.value === '' ? 0 : Number(event.target.value))} /></label>;
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
      <div><span className="ps-eyebrow">KẾ HOẠCH KINH DOANH · 8 TUẦN</span><h2>Bán ở giá nào, nhập bao nhiêu?</h2><p>So sánh phương án trước khi chốt giá và đặt hàng. Mỗi kết quả đi kèm dữ liệu nguồn, chi phí và giả định bạn có thể kiểm tra.</p><div className="ps-hero-tags"><span><FileSpreadsheet size={14} /> Dữ liệu của brand</span><span><CheckCheck size={14} /> Người phụ trách duyệt</span><span><History size={14} /> Có lịch sử tính toán</span></div></div>
      <div className="ps-data-card"><span>HỒ SƠ BÁN HÀNG</span><strong>{sales.length ? `${count(sales.length)} dòng` : 'Chưa có dữ liệu'}</strong><p>{sales.length ? `${skus.length} SKU · ${workspace.source}` : 'Nhập file bán hàng hoặc mở ví dụ để xem cách làm.'}</p><Badge variant={workspace.demo ? 'warning' : sales.length ? 'secondary' : 'secondary'}>{workspace.demo ? 'Ví dụ minh họa · không phải kết quả thực' : sales.length ? 'File do bạn cung cấp' : 'Chưa có lịch sử'}</Badge></div>
    </section>
    <div className="ps-toolbar">
      <div className="ps-tabs" role="tablist" aria-label="Kế hoạch kinh doanh"><button role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>Kế hoạch</button><button role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>Lịch sử phê duyệt <span>{workspace.decisions.length}</span></button><button role="tab" aria-selected={tab === 'actual'} className={tab === 'actual' ? 'active' : ''} onClick={() => setTab('actual')}>Kết quả thực tế</button></div>
      <div className="ps-actions"><Button size="sm" variant="ghost" aria-expanded={helpOpen && tab !== 'actual'} onClick={() => { if (tab === 'actual') { setTab('plan'); setHelpOpen(true); } else setHelpOpen(!helpOpen); }}><Info size={14}/> Hướng dẫn dữ liệu</Button><Button size="sm" variant="outline" disabled={!hydrated} onClick={() => csvRef.current?.click()}><Upload size={14} /> Nhập CSV</Button><Button size="sm" variant="outline" onClick={() => download('mavericks-workspace.json', JSON.stringify(workspace, null, 2))} disabled={!hydrated}><ArrowDownToLine size={14} /> Sao lưu</Button><Button size="sm" variant="ghost" onClick={() => backupRef.current?.click()} disabled={!hydrated}>Khôi phục</Button></div>
      <input ref={csvRef} hidden type="file" accept=".csv,.tsv,text/csv" aria-label="Nhập lịch sử bán hàng CSV" onChange={(event) => { void loadFile(event.target.files?.[0]); event.target.value = ''; }} />
      <input ref={backupRef} hidden type="file" accept=".json,application/json" aria-label="Khôi phục workspace JSON" onChange={(event) => { void loadFile(event.target.files?.[0], true); event.target.value = ''; }} />
    </div>
    {error && <div className="ps-message error" role="alert">{error}<button onClick={() => setError('')} aria-label="Đóng thông báo lỗi">×</button></div>}
    {notice && <div className="ps-message" role="status">{notice}</div>}
    {tab === 'actual' && <OutcomeReview decisions={workspace.decisions} onStart={() => setTab('plan')} onSave={(id,outcome) => setWorkspace(current => ({...current,decisions:current.decisions.map(decision => decision.id === id ? {...decision,outcomes:[outcome,...(decision.outcomes || [])].slice(0,20)} : decision)}))}/>}
    {tab !== 'actual' && <>
    {helpOpen && <section className="ps-panel data-guide" aria-label="Hướng dẫn dữ liệu"><div className="ps-panel-heading"><div><span className="ps-eyebrow">CHUẨN BỊ TRONG 3 BƯỚC</span><h3>Nhập đúng dữ liệu, rồi mới xem phương án</h3></div><button onClick={() => setHelpOpen(false)} aria-label="Đóng hướng dẫn">×</button></div><ol><li><strong>Xuất lịch sử theo ngày và SKU</strong><p>Dùng ít nhất 14 ngày có hàng, liên tiếp theo lịch. Ghi cả ngày bán 0; không dùng monthly_sold của đối thủ thay cho lượng bán của brand.</p></li><li><strong>Kiểm tra giá và ngày hết hàng</strong><p>Giá là giá niêm yết tham chiếu. stockout = 1 nếu hết hàng, = 0 nếu có hàng. Không có ngày trùng cho cùng SKU.</p></li><li><strong>Xác nhận chi phí và vốn riêng</strong><p>CSV không cung cấp giá vốn, tồn kho hoặc tiền sẵn có. Các giá trị có sẵn là đầu vào minh họa, cần thay trước khi duyệt.</p></li></ol><div className="enterprise-table-wrap"><table className="enterprise-table"><thead><tr><th>date</th><th>sku</th><th>units</th><th>price</th><th>stockout</th></tr></thead><tbody><tr><td>2026-01-01</td><td>SKU-001</td><td>20</td><td>62000</td><td>0</td></tr><tr><td>2026-01-02</td><td>SKU-001</td><td>0</td><td>62000</td><td>1</td></tr></tbody></table></div><p className="ps-muted">Ví dụ định dạng, không phải dữ liệu vận hành. File tối đa 5 MB. Nhập file mới sẽ thay lịch sử bán hàng hiện tại; nên sao lưu trước.</p><Button variant="outline" size="sm" onClick={() => download('sales-template-42-days.csv', demoSalesCsv().replaceAll('DEMO-SNACK-01','YOUR-SKU'), 'text/csv;charset=utf-8')}>Tải mẫu 42 ngày · số liệu minh họa</Button></section>}
    {tab === 'log' ? <section className="ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">HỒ SƠ QUYẾT ĐỊNH</span><h3>Những phương án đã được ghi nhận</h3></div><Button variant="outline" size="sm" disabled={!workspace.decisions.length} onClick={() => download('mavericks-decision-log.json', JSON.stringify(workspace.decisions, null, 2))}>Xuất lịch sử</Button></div><p className="ps-muted">Lưu tối đa 50 bản duyệt trên trình duyệt này. Tên người phụ trách do bạn nhập; hồ sơ chưa đồng bộ với đội nhóm.</p>{!workspace.decisions.length ? <div className="ps-empty"><History size={30} /><h3>Chưa có phương án được duyệt</h3><p>So sánh phương án, nhập tên người phụ trách và lưu bản phê duyệt đầu tiên.</p><Button onClick={() => setTab('plan')}>Lập kế hoạch <ArrowRight size={14} /></Button></div> : <div className="ps-log">{workspace.decisions.map((decision) => <article key={decision.id}><div><Badge variant={decision.basis === 'illustrative-demo' ? 'warning' : 'secondary'}>{decision.basis === 'illustrative-demo' ? 'Duyệt thử nghiệm' : 'Đã ghi nhận'}</Badge><h4>{decision.sku} · {money(decision.result.price)}</h4><p>{decision.owner} · {new Date(decision.createdAt).toLocaleString('vi-VN')}</p><p>{decision.note || 'Không có ghi chú.'}</p><small>{decision.source} · lịch sử đến {decision.historyEnd}</small></div><div><span>Lợi nhuận vận hành dự kiến</span><strong>{money(decision.result.operatingProfit)}</strong><small>Nhập {count(decision.result.orderUnits)} đơn vị · vốn thiếu {money(decision.result.additionalCapital)}</small><Button variant="ghost" size="sm" onClick={() => download(`decision-${decision.id}.json`, JSON.stringify(decision, null, 2))}>Tải hồ sơ tính toán</Button></div></article>)}</div>}</section> : <>
      {!sales.length && <section className="ps-onboarding ps-panel"><span className="ps-onboarding-icon"><FileSpreadsheet size={32} /></span><div><span className="ps-eyebrow">BẮT ĐẦU TỪ DỮ LIỆU CỦA BẠN</span><h3>Cho Mavericks biết brand thực sự bán được bao nhiêu.</h3><p>CSV mỗi ngày, mỗi SKU: <code>date,sku,units,price,stockout</code>. Cần ít nhất 14 ngày có hàng; ghi cả ngày bán 0. Giá là giá niêm yết tham chiếu, chưa trừ voucher.</p><div className="ps-actions"><Button onClick={() => csvRef.current?.click()} disabled={!hydrated}><Upload size={15} /> Nhập lịch sử bán hàng</Button><Button variant="outline" onClick={() => importSales(demoSalesCsv(), 'Demo 42 ngày · dữ liệu tổng hợp', true)} disabled={!hydrated}>Thử với dữ liệu minh họa</Button><Button variant="ghost" onClick={() => download('sales-template.csv', 'date,sku,units,price,stockout\n2026-01-01,YOUR-SKU,20,62000,0\n2026-01-02,YOUR-SKU,0,62000,1\n', 'text/csv;charset=utf-8')}>Tải mẫu CSV</Button></div></div></section>}
      {sales.length > 0 && <>
        <section className="ps-source-bar"><label className="ps-field"><span>SKU của brand</span><select aria-label="SKU của brand" value={sku} onChange={(event) => selectSku(event.target.value)}>{skus.map((value) => <option key={value}>{value}</option>)}</select></label><div><span className="ps-eyebrow">DỮ LIỆU DÙNG ĐỂ TÍNH</span><p>{model.forecast ? `${model.forecast.historyDays} ngày bán hàng · đến ${model.forecast.lastDate} · ${model.forecast.stockoutDays} ngày hết hàng được loại khỏi mức bán tham chiếu` : 'Kiểm tra chuỗi ngày và trạng thái tồn kho'}</p><small>{workspace.demo ? 'Ví dụ minh họa. Hãy thay chi phí, tồn kho và tiền sẵn có bằng dữ liệu của bạn khi dùng thực tế.' : 'Giá vốn, tồn kho và tiền sẵn có cần bạn xác nhận riêng; chưa có trong CSV bán hàng.'}</small></div></section>
        <details className="provenance-details"><summary>{workspace.demo ? 'Dữ liệu minh họa' : 'Dữ liệu do brand cung cấp'} · Chi phí cần xác nhận · Độ nhạy giá giả định {input.elasticity}<span>Xem nguồn & giới hạn</span></summary><div className="provenance-grid" aria-label="Nguồn và mức độ chắc chắn"><div><Badge variant={workspace.demo ? 'warning' : 'secondary'}>{workspace.demo ? 'Dữ liệu minh họa' : 'File do brand cung cấp'}</Badge><strong>Lịch sử bán hàng</strong><p>{workspace.source} · {model.forecast?.historyDays ?? '—'} ngày của SKU đang chọn. Chưa được đối soát với sàn.</p></div><div><Badge variant="outline">Đầu vào cần xác nhận</Badge><strong>Chi phí, tồn kho & tiền</strong><p>Do bạn nhập; hệ thống chưa kết nối kế toán hoặc kho để xác minh.</p></div><div><Badge variant="warning">Giả định mô hình</Badge><strong>Độ nhạy giá: {input.elasticity}</strong><p>Chưa học từ thử nghiệm giá. Lượng bán có thể thay đổi khác giả định.</p></div><div><Badge variant="secondary">Kết quả mô phỏng</Badge><strong>Kế hoạch 8 tuần</strong><p>Không phải cam kết lợi nhuận. Xem thêm kịch bản nhu cầu thấp trước khi duyệt.</p></div></div></details>
        {seed && <section className="ps-market-link"><Info size={18} /><div><strong>Phương án từ Pricing Lab: {money(seed.proposedPrice)}</strong><p>{seed.label}</p><small>{seed.approvedMatch ? 'Cặp SKU đã duyệt. ' : 'Scenario độc lập. '}Chỉ liên kết khi SKU bán hàng đang chọn đúng là sản phẩm nguồn; thao tác này sẽ cập nhật economics.</small></div><Button variant="outline" size="sm" onClick={applySeed}>Xác nhận cùng SKU & liên kết</Button></section>}
        {workspace.market && <div className="ps-message">Đang so sánh thêm mức giá {money(workspace.market.price)} từ Pricing Lab. <button onClick={() => setWorkspace((current) => ({ ...current, market: null }))}>Gỡ liên kết</button></div>}
        <div className="ps-layout"><aside className="ps-input-panel ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">DO BẠN CUNG CẤP</span><h3>Chi phí & điều kiện</h3></div></div>
          <dl className="ps-input-summary"><div><dt>Giá bán hiện tại</dt><dd>{money(input.currentPrice)}</dd></div><div><dt>Giá vốn / đơn vị</dt><dd>{money(input.unitCost)}</dd></div><div><dt>Tồn kho đầu kỳ</dt><dd>{count(input.openingStock)} đơn vị</dd></div><div><dt>Tiền sẵn có</dt><dd>{money(input.openingCash)}</dd></div><div><dt>Biên tối thiểu</dt><dd>{input.minimumMargin}%</dd></div><div><dt>Độ nhạy giá</dt><dd>{input.elasticity} · giả định</dd></div></dl>
          <p className="ps-help ps-assumption-intro">Đây là đầu vào bạn cần xác nhận, không phải số liệu đã được hệ thống xác minh.</p><details className="ps-assumptions"><summary>Điều chỉnh chi phí & điều kiện</summary>
          <div className="ps-input-section"><h4>01 · Giá & chi phí / đơn vị</h4><div className="ps-fields"><NumberInput label="Giá hiện tại" field="currentPrice" unit="đ" input={input} update={update} /><NumberInput label="Giá vốn thực" field="unitCost" unit="đ" input={input} update={update} /><NumberInput label="Voucher brand" field="voucherPercent" unit="%" input={input} update={update} /><NumberInput label="Phí sàn" field="feePercent" unit="%" input={input} update={update} /><NumberInput label="Dự phòng hoàn tiền" field="refundPercent" unit="%" input={input} update={update} /><NumberInput label="Ads + campaign" field="adsPercent" unit="%" input={input} update={update} /><NumberInput label="Shipping hỗ trợ" field="shippingCost" unit="đ" input={input} update={update} /><NumberInput label="Bao bì / combo" field="packagingCost" unit="đ" input={input} update={update} /></div></div>
          <div className="ps-input-section"><h4>02 · Policy & độ nhạy giá</h4><div className="ps-fields"><NumberInput label="Margin tối thiểu" field="minimumMargin" unit="%" input={input} update={update} /><NumberInput label="Đổi giá tối đa ±" field="maxPriceChange" unit="%" input={input} update={update} /><NumberInput label="Độ nhạy giá giả định" field="elasticity" input={input} update={update} /></div><p className="ps-help">−1 nghĩa là giá tăng 1% thì nhu cầu giảm xấp xỉ 1%. Đây là giả định do bạn nhập, chưa được AI học hoặc xác thực.</p></div>
          <div className="ps-input-section"><h4>03 · Tồn kho & thời điểm tiền</h4><div className="ps-fields"><NumberInput label="Tồn kho đầu kỳ" field="openingStock" input={input} update={update} /><NumberInput label="Giao hàng sau" field="leadDays" unit="ngày" input={input} update={update} /><NumberInput label="Safety stock" field="safetyDays" unit="ngày bán" input={input} update={update} /><NumberInput label="Tiền sẵn có" field="openingCash" unit="đ" input={input} update={update} /><NumberInput label="Sàn trả tiền sau" field="settlementDays" unit="ngày bán" input={input} update={update} /><NumberInput label="Trả NCC sau đặt" field="supplierPaymentDays" unit="ngày" input={input} update={update} /><NumberInput label="Chi phí cố định" field="weeklyOverhead" unit="đ/tuần" input={input} update={update} /></div><p className="ps-help">Đặt một lô ở đầu kỳ, giao sau lead time. Tồn kho đầu kỳ giả định đã trả tiền; số ngày tính theo lịch.</p></div>
          </details>
        </aside><div className="ps-results">
          {model.message && <div className="ps-message error" role="alert">{model.message}</div>}
          {model.forecast && chosen && <>
            <section className="ps-recommendation ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">PHƯƠNG ÁN ĐỂ CÂN NHẮC</span><h3>{best ? `Thử mức giá ${money(best.price)}` : 'Cần điều chỉnh trước khi chốt phương án'}</h3></div><Badge variant={best ? 'secondary' : 'warning'}>{best ? 'Chưa thực thi' : 'Chưa đủ điều kiện'}</Badge></div><p>{best && baseline ? <>Với các giả định hiện tại, phương án này tạo thêm <strong>{money(best.operatingProfit - baseline.operatingProfit)}</strong> lợi nhuận vận hành so với giữ giá trong 8 tuần. Đây là kết quả mô phỏng để bạn kiểm chứng, chưa phải cam kết doanh thu.</> : 'Xem điều kiện chưa đạt trong bảng so sánh và kiểm tra lại chi phí hoặc nguồn vốn trước khi phê duyệt.'}</p>
              {best && <div className="ps-checklist"><span><Check size={14}/> Biên {percent(best.margin)} ≥ {input.minimumMargin}%</span><span><Check size={14}/> Thay đổi giá trong ±{input.maxPriceChange}%</span><span><Check size={14}/> Đủ tiền theo lịch thu chi</span></div>}
              <details className="ps-calculation-details"><summary>Xem cơ sở tính toán</summary><div className="ps-evidence"><span>Mức bán tham chiếu: {model.forecast.method === 'weekday' ? 'trung bình theo thứ' : 'trung bình ngày có hàng'}</span><span>Giá lịch sử bình quân: {money(model.forecast.referencePrice)}</span><span>Độ nhạy giá: {input.elasticity} · do bạn giả định</span><span>{model.forecast.wape === null ? 'Chưa đủ dữ liệu đo sai số' : `Sai số dự báo WAPE: ${percent(model.forecast.wape)} · kiểm tra ${model.forecast.backtestDays} ngày`}</span></div><p className="ps-help">WAPE so sánh dự báo với lượng bán thực trên những ngày chưa dùng để dự báo. Chỉ số này không đo độ đúng của giả định về phản ứng với giá.</p></details>
            </section>
            <div className="ps-selected-heading"><span>Phương án đang xem <strong>{money(chosen.price)}</strong></span>{best && chosen.price !== best.price && <Button variant="ghost" size="sm" onClick={() => setSelectedPrice(best.price)}>Về phương án đề xuất</Button>}</div>
            {baseline && <section className="decision-tradeoff ps-panel" aria-label="Đánh đổi so với giữ giá"><div className="ps-panel-heading"><div><span className="ps-eyebrow">SO VỚI GIỮ GIÁ · MÔ PHỎNG 8 TUẦN</span><h3>Bạn được gì, đánh đổi gì?</h3></div></div><div className="tradeoff-grid"><div><span>Lợi nhuận vận hành</span><strong>{chosen.operatingProfit - baseline.operatingProfit >= 0 ? '+' : ''}{money(chosen.operatingProfit - baseline.operatingProfit)}</strong><small>{money(baseline.operatingProfit)} → {money(chosen.operatingProfit)}</small></div><div><span>Lượng bán</span><strong>{chosen.sold - baseline.sold >= 0 ? '+' : ''}{count(chosen.sold - baseline.sold)} đơn vị</strong><small>{count(baseline.sold)} → {count(chosen.sold)} · theo giả định độ nhạy giá</small></div><div><span>Lượng cần nhập</span><strong>{chosen.orderUnits - baseline.orderUnits >= 0 ? '+' : ''}{count(chosen.orderUnits - baseline.orderUnits)} đơn vị</strong><small>{count(baseline.orderUnits)} → {count(chosen.orderUnits)}</small></div></div><p className="ps-muted">“Tốt hơn” ở đây nghĩa là lợi nhuận vận hành cao hơn trong các mức giá đã thử và điều kiện đã nhập — không phải tối ưu toàn thị trường. {chosen.feasible ? 'Phương án đang xem đạt các điều kiện hiện tại.' : 'Phương án đang xem chưa đủ điều kiện phê duyệt.'}</p></section>}
            <div className="ps-metrics"><div><span><CircleDollarSign size={15} /> Lợi nhuận vận hành</span><strong>{money(chosen.operatingProfit)}</strong><small>{baseline ? `${chosen.operatingProfit >= baseline.operatingProfit ? '+' : ''}${money(chosen.operatingProfit - baseline.operatingProfit)} so với giữ giá` : '8 tuần mô phỏng'}</small></div><div><span><ShieldCheck size={15} /> Biên đóng góp</span><strong>{percent(chosen.margin)}</strong><small>Ngưỡng tối thiểu {input.minimumMargin}%</small></div><div><span><Package size={15} /> Lượng hàng cần đặt</span><strong>{count(chosen.orderUnits)}</strong><small>Tiền nhập hàng {money(chosen.orderCost)}</small></div><div className={chosen.additionalCapital > 0 ? 'at-risk' : ''}><span><Wallet size={15} /> Vốn cần bổ sung</span><strong>{money(chosen.additionalCapital)}</strong><small>Đã tính {money(input.openingCash)} tiền sẵn có</small></div></div>
            <section className="ps-panel ps-unit-economics"><div className="ps-panel-heading"><div><span className="ps-eyebrow">GIẢI THÍCH CHI PHÍ</span><h3>Mỗi đơn vị bán ra giữ lại bao nhiêu?</h3></div><span className="ps-unit-net">Doanh thu sau voucher & hoàn tiền<br/><strong>{money(netPerUnit)}</strong></span></div><div className="ps-cost-bar" role="img" aria-label={`Giá vốn ${money(input.unitCost)}, phí sàn ${money(feePerUnit)}, chi phí bán hàng ${money(sellingPerUnit)}, lợi nhuận đóng góp ${money(profitPerUnit)} trên mỗi đơn vị.`}>{costParts.map((part) => <span key={part.label} style={{ width: `${Math.max(0, part.value) / costScale * 100}%`, background: part.color }} />)}</div><div className="ps-cost-legend">{costParts.map((part) => <div key={part.label}><span><i style={{ background: part.color }}/>{part.label}</span><strong>{money(part.value)}</strong></div>)}</div><p className="ps-help">Chi phí bán hàng gồm quảng cáo, campaign, giao hàng hỗ trợ và bao bì. Lợi nhuận đóng góp còn phải trả chi phí cố định; chưa trừ thuế và lãi vay.</p></section>
            <section className="ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">SO SÁNH MỨC GIÁ</span><h3>Chọn phương án để xem ảnh hưởng</h3></div><span className="ps-muted">Lợi nhuận vận hành · 8 tuần giả định</span></div>
              <div className="ps-scenario-bars">{model.scenarios.map((scenario) => <button key={scenario.price} aria-label={`Xem phương án ${money(scenario.price)}`} aria-pressed={chosen.price === scenario.price} className={chosen.price === scenario.price ? 'selected' : ''} onClick={() => setSelectedPrice(scenario.price)}><span className="ps-scenario-price"><strong>{money(scenario.price)}</strong><small>{scenario.price === Math.round(input.currentPrice) ? 'Giữ giá hiện tại' : `${scenario.price > input.currentPrice ? '+' : ''}${percent((scenario.price / input.currentPrice - 1) * 100)} giá bán`}</small></span><span className="ps-scenario-track"><i style={{ width: `${Math.max(0, scenario.operatingProfit) / maxProfit * 100}%` }} /></span><span className="ps-scenario-value"><strong>{money(scenario.operatingProfit)}</strong><small>{!scenario.feasible ? 'Chưa đủ điều kiện' : best?.price === scenario.price ? 'Cao nhất trong các phương án khả thi' : `${count(scenario.sold)} đơn vị có thể bán`}</small></span></button>)}</div>
              <details className="ps-calculation-details"><summary>Xem số liệu & điều kiện từng phương án</summary><div className="ps-table-scroll"><table className="ps-table"><thead><tr><th>Giá bán</th><th>Nhu cầu</th><th>Lợi nhuận vận hành</th><th>Biên</th><th>Vốn thiếu</th><th>Điều kiện</th></tr></thead><tbody>{model.scenarios.map((scenario) => <tr key={scenario.price} className={chosen.price === scenario.price ? 'selected' : ''}><td>{money(scenario.price)}</td><td>{count(scenario.demand)}</td><td>{money(scenario.operatingProfit)}</td><td>{percent(scenario.margin)}</td><td>{money(scenario.additionalCapital)}</td><td>{scenario.feasible ? <span className="ps-pass"><Check size={13} /> Đạt</span> : <span className="ps-blocked">{scenario.blockers.join(' · ')}</span>}</td></tr>)}</tbody></table></div><p className="ps-help">Nhu cầu = mức bán tham chiếu × (giá mới / giá lịch sử bình quân)<sup>độ nhạy giá</sup>. Chỉ so sánh các mức giá đã thử, chưa xác định giá tối ưu toàn cục.</p></details>
            </section>
            <section className="ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">TIỀN VỀ VÀ TIỀN CHI</span><h3>Khi nào cần tiền để nhập hàng?</h3></div><span className="ps-chart-legend"><i /> Tiền về <b /> Tiền chi <em /> Số dư cuối tuần</span></div><div className="ps-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={cashSeries} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}><CartesianGrid stroke="#e9ece7" vertical={false} /><XAxis dataKey="week" tickFormatter={(value) => `Tuần ${value}`} stroke="#758178" tickLine={false} fontSize={11} /><YAxis width={65} tickFormatter={(value) => `${(Number(value) / 1e6).toFixed(0)}tr`} stroke="#758178" tickLine={false} fontSize={11} /><Tooltip contentStyle={{ background: '#fff', border: '1px solid #d9dfd8', borderRadius: 8, color: '#24322c' }} formatter={(value) => money(Number(value))} labelFormatter={(value) => `Tuần ${value}`} /><ReferenceLine y={0} stroke="#96a397" /><Bar name="Tiền về" dataKey="receipts" fill="#a2bcac" radius={[3, 3, 0, 0]} /><Bar name="Tiền chi" dataKey="outflow" fill="#c5aa96" radius={[0, 0, 3, 3]} /><Line name="Số dư cuối tuần" dataKey="closingCash" stroke="#2c6858" strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} /></ComposedChart></ResponsiveContainer></div><div className="ps-cash-notes"><span>Tiền chưa về từ sàn<strong>{money(chosen.receivables)}</strong></span><span>Còn phải trả NCC sau kỳ<strong>{money(chosen.payable)}</strong></span><span>Hàng còn lại cuối kỳ<strong>{count(chosen.endingInventory)} đơn vị</strong></span><span>Chưa bán được do thiếu hàng<strong>{count(chosen.lost)} đơn vị</strong></span></div>
              {chosen.orderUnits > 0 ? <div className="ps-order-timeline"><div><span>01 · Đặt hàng</span><strong>{count(chosen.orderUnits)} đơn vị</strong><small>{nextDate(model.forecast.lastDate, 1)}</small></div><ArrowRight size={15}/><div><span>02 · Hàng về dự kiến</span><strong>{nextDate(model.forecast.lastDate, input.leadDays + 1)}</strong><small>Sau {input.leadDays} ngày giao hàng</small></div><ArrowRight size={15}/><div><span>03 · Trả nhà cung cấp</span><strong>{money(chosen.orderCost)}</strong><small>{nextDate(model.forecast.lastDate, input.supplierPaymentDays + 1)}</small></div></div> : <p className="ps-help">Tồn đầu kỳ đủ cho phương án này; chưa cần đặt thêm lô hàng.</p>}
            </section>
            <section className="ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">KẾ HOẠCH THEO TUẦN</span><h3>Nhập hàng, bán hàng, thu tiền</h3></div><Button size="sm" variant="outline" onClick={() => download('mavericks-weekly-plan.csv', '\uFEFFweek,start_date,demand,sold,lost,ending_inventory,net_revenue,contribution,receipts,procurement,operating_cash,closing_cash\n' + chosen.weeks.map((week) => [week.week, week.date, ...[week.demand, week.sold, week.lost, week.inventory, week.revenue, week.contribution, week.receipts, week.procurement, week.operatingCash, week.closingCash].map((value) => value.toFixed(2))].join(',')).join('\n'), 'text/csv;charset=utf-8')}><ArrowDownToLine size={13} /> Tải bảng CSV</Button></div><details className="ps-week-details"><summary>Xem 8 tuần chi tiết</summary><div className="ps-table-scroll"><table className="ps-table"><thead><tr><th>Tuần</th><th>Bán được</th><th>Thiếu hàng</th><th>Tồn cuối</th><th>Tiền về</th><th>Trả NCC</th><th>Chi vận hành</th><th>Tiền cuối</th></tr></thead><tbody>{chosen.weeks.map((week) => <tr key={week.week}><td><strong>T{week.week}</strong><small>{week.date}</small></td><td>{count(week.sold)}</td><td>{count(week.lost)}</td><td>{count(week.inventory)}</td><td>{money(week.receipts)}</td><td>{money(week.procurement)}</td><td>{money(week.operatingCash)}</td><td className={week.closingCash < 0 ? 'ps-blocked' : ''}>{money(week.closingCash)}</td></tr>)}</tbody></table></div></details><p className="ps-help">Bắt đầu từ {nextDate(model.forecast.lastDate, 1)}, ngay sau ngày cuối lịch sử. Vốn thiếu được tính theo đáy tiền hằng ngày trước khoản thu, không chỉ theo số dư cuối tuần.</p></section>
            <section className="ps-panel"><span className="ps-eyebrow">KIỂM TRA RỦI RO</span><h3>Nếu bán ít hơn dự kiến?</h3><div className="ps-sensitivity">{sensitivities.map(({ label, result }) => <div key={label}><span>{label === 'Baseline' ? 'Mức bán tham chiếu' : label}</span><strong>{money(result.operatingProfit)}</strong><small>Lợi nhuận vận hành · vốn thiếu {money(result.additionalCapital)}</small></div>)}</div><p className="ps-help">Ba kịch bản dựa trên mức dao động lượng bán lịch sử, không phải khoảng tin cậy đã xác thực. Mỗi kịch bản tính lại đơn nhập để thấy nhu cầu vốn tương ứng.</p></section>
            <section className="ps-approval ps-panel"><div><span className="ps-eyebrow">BẠN LÀ NGƯỜI QUYẾT ĐỊNH</span><h3>Ghi nhận phương án {money(chosen.price)}</h3><p>Kiểm tra các giả định trước khi duyệt. Thao tác này lưu hồ sơ, chưa đổi giá hoặc đặt hàng trên sàn.</p></div><div className="ps-fields"><label className="ps-field"><span>Tên người phê duyệt</span><input value={owner} maxLength={100} onChange={(event) => setOwner(event.target.value)} placeholder="Tên người phụ trách" /></label><label className="ps-field"><span>Lý do / ghi chú</span><input value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Mục tiêu campaign, điều kiện thực hiện…" /></label></div><div className="ps-actions"><Button disabled={!chosen.feasible || !owner.trim()} onClick={approve}><CheckCheck size={15} /> {workspace.demo ? 'Lưu bản duyệt thử nghiệm' : 'Duyệt & lưu phương án'}</Button><Button variant="outline" onClick={exportPlan}><ArrowDownToLine size={14} /> Tải hồ sơ tính toán</Button></div>{!chosen.feasible && <p className="ps-blocked">Chưa thể duyệt: {chosen.blockers.join(' · ')}.</p>}</section>
          </>}
        </div></div>
      </>}
      <footer className="ps-method-note"><Info size={16} /><p>Phiên bản này dùng mô hình baseline có thể giải thích và độ nhạy giá do người dùng nhập. Lợi nhuận vận hành là lợi nhuận đóng góp trừ chi phí cố định, trước thuế và chi phí tài chính. Chưa kết nối AI học từ dữ liệu, tự đổi giá, đặt hàng hay chuyển tiền. Workspace lưu trên thiết bị; backup giúp chuyển sang máy khác.</p></footer>
    </>}
    </>}
  </div>;
}
