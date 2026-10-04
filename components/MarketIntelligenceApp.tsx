'use client';

import { FormEvent, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BellRing,
  CalendarDays, ChartNoAxesCombined, Check, CircleDollarSign, Command, Database,
  ExternalLink, Filter, FlaskConical, Gauge, Info, LayoutDashboard, Link2, Menu,
  MoreHorizontal, PackageSearch, RefreshCw, ScanSearch, Search, ShieldCheck, ShoppingBag,
  Sparkles, Store, Target, TrendingDown, TrendingUp, Wallet, X, Zap, type LucideIcon,
} from 'lucide-react';
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { MATCHING_WEIGHTS, simulatePricingLocally } from '@/lib/engines';
import type { Alert, Country, Match, Overview, PricingInput, PricingResult, Quality, Segment, Shop, TrendPoint } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ProfitPlanner, { type PlanningSeed } from '@/components/ProfitPlanner';
import DecisionShowcase from '@/components/DecisionShowcase';

type View = 'overview' | 'alerts' | 'matches' | 'pricing' | 'planning' | 'quality';
type NavItem = { id: View; label: string; description: string; icon: LucideIcon };
type ReviewDecision = 'approved' | 'rejected';

const nav: NavItem[] = [
  { id: 'overview', label: 'Tổng quan', description: 'Tình hình và việc cần làm', icon: LayoutDashboard },
  { id: 'alerts', label: 'Biến động giá', description: 'Mẫu đối thủ theo dõi', icon: BellRing },
  { id: 'matches', label: 'So sánh sản phẩm', description: 'Xác nhận SKU tương đương', icon: ScanSearch },
  { id: 'pricing', label: 'Phương án giá', description: 'Giá bán và biên lợi nhuận', icon: FlaskConical },
  { id: 'planning', label: 'Kế hoạch & vốn', description: 'Bán hàng, tồn kho, dòng tiền', icon: CircleDollarSign },
  { id: 'quality', label: 'Kiểm tra dữ liệu', description: 'Nguồn và dữ liệu cần xác minh', icon: ShieldCheck },
];
const defaultPricing: PricingInput = {
  ourPrice: 62000, competitorPrice: 110000, competitorChangePercent: -30, competitorVoucherPercent: 0,
  cogsPercent: 55, targetMarginPercent: 15, platformFeePercent: 8, voucherPercent: 0, shippingPercent: 0,
  returnRatePercent: 1.5, adsSpendPercent: 3, campaignSpendPercent: 0, packagingCost: 1000,
  undercutPercent: 2, gapThresholdPercent: 12, skuRole: 'core',
};
const chartColors = ['#2c6858', '#648b9c', '#bba375', '#a4b6a2', '#a78d85', '#8793aa', '#c6bfb2'];
const emptyOverview: Overview = { country: 'vn', trackedSkus: 0, shops: 0, classifiedCoverage: 0, priceAlerts: 0, qualityFlags: 0, totalMonthlySold: 0, dateRange: { min_date: '', max_date: '', dates: 0 }, topShops: [], segments: [] };
const emptyQuality: Quality = { country: 'vn', totalProducts: 0, flaggedProducts: 0, orphanPromotionRows: 0, issues: [] };

function compact(value: number) { return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0); }
function money(value: number, country: Country) { const formatted = new Intl.NumberFormat(country === 'vn' ? 'vi-VN' : 'id-ID', { maximumFractionDigits: 0 }).format(value || 0); return country === 'vn' ? `${formatted}đ` : `Rp${formatted}`; }
function dateLabel(value?: string) { if (!value) return '—'; const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function shortDate(value: string) { const [, month, day] = value.split('-'); return `${day}/${month}`; }
function bandLabel(band: Match['scoring']['band']) { return band === 'high' ? 'Tin cậy cao' : band === 'review' ? 'Cần review' : 'Tin cậy thấp'; }
function badgeForSeverity(value: string): 'danger' | 'warning' | 'secondary' { return value === 'critical' ? 'danger' : value === 'warning' ? 'warning' : 'secondary'; }
function matchKey(match: Match) { return `${match.source.shop_id}:${match.source.item_id}|${match.candidate.shop_id}:${match.candidate.item_id}`; }

export default function MarketIntelligenceApp() {
  const [view, setView] = useState<View>('overview');
  const country: Country = 'vn';
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [shops, setShops] = useState<Shop[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [quality, setQuality] = useState<Quality>(emptyQuality);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [dataMode, setDataMode] = useState<'loading' | 'live' | 'snapshot' | 'error'>('loading');
  const [snapshotTime, setSnapshotTime] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [sourceShop, setSourceShop] = useState('');
  const [targetShop, setTargetShop] = useState('');
  const [segment, setSegment] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [matching, setMatching] = useState(false);
  const [reviews, setReviews] = useState<Record<string, ReviewDecision>>({});
  const [pricingInput, setPricingInput] = useState<PricingInput>(defaultPricing);
  const [pricing, setPricing] = useState<PricingResult>(() => simulatePricingLocally(defaultPricing));
  const [simulating, setSimulating] = useState(false);
  const [planningSeed, setPlanningSeed] = useState<PlanningSeed | null>(null);
  const [operationError, setOperationError] = useState('');
  const [committedPricingInput, setCommittedPricingInput] = useState<PricingInput>(defaultPricing);
  const [decisionLatencyMs, setDecisionLatencyMs] = useState<number | null>(null);
  const [scenarioCount, setScenarioCount] = useState(0);
  const [guardrailCatches, setGuardrailCatches] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const flowStartedAt = useRef<number | null>(null);

  useEffect(() => {
    const syncView = () => {
      const route = window.location.hash.slice(1);
      if (nav.some((item) => item.id === route)) setView(route as View);
    };
    syncView(); window.addEventListener('hashchange', syncView);
    return () => window.removeEventListener('hashchange', syncView);
  }, []);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, []);

  useEffect(() => {
    let current = true;
    api.market(country)
      .then((data) => {
        if (!current) return;
        setOverview(data.overview); setShops(data.shops); setSegments(data.segments); setAlerts(data.alerts); setQuality(data.quality); setTrend(data.trend);
        setSnapshotTime(data.generatedAt); setDataMode(data.mode);
        const source = data.shops[0];
        setSourceShop(source?.shop_id || ''); setTargetShop(''); setMatches([]); setSelected(null);
      })
      .catch(() => { if (current) setDataMode('error'); });
    return () => { current = false; };
  }, [refreshKey]);

  const currentNav = nav.find((item) => item.id === view) || nav[0];
  const CurrentIcon = currentNav.icon;
  const maxShopVolume = useMemo(() => Math.max(...shops.map((shop) => shop.monthly_sold), 1), [shops]);
  const cleanListings = Math.max(0, overview.trackedSkus - overview.qualityFlags);
  const downAlerts = alerts.filter((alert) => alert.direction === 'down').length;
  const upAlerts = alerts.filter((alert) => alert.direction === 'up').length;
  const sourceLabel = dataMode === 'live' ? 'Live RDS' : dataMode === 'snapshot' ? 'RDS snapshot' : dataMode === 'loading' ? 'Syncing' : 'Unavailable';
  const reviewValues = Object.values(reviews);
  const reviewedCount = reviewValues.length;
  const approvedCount = reviewValues.filter((decision) => decision === 'approved').length;

  async function runMatching() {
    if (!sourceShop) return;
    flowStartedAt.current = performance.now();
    setMatching(true);
    try {
      const result = await api.matches({ country, sourceShopId: sourceShop, targetShopId: targetShop || undefined, segmentId: segment || undefined, mode: dataMode === 'live' ? 'live' : 'snapshot' });
      setMatches(result); setSelected(result[0] || null);
      setOperationError(result.length ? '' : 'Không tìm thấy cặp SKU cùng phân khúc. Thử mở rộng đối thủ hoặc đổi gian hàng nguồn.');
    } catch { setOperationError('Không tải được cặp SKU. Kiểm tra dữ liệu và thử lại.'); }
    finally { setMatching(false); }
  }
  function reviewMatch(match: Match, decision: ReviewDecision) {
    setReviews((current) => ({ ...current, [matchKey(match)]: decision }));
  }
  function sendToPricing(match: Match) {
    if (reviews[matchKey(match)] !== 'approved') return;
    const nextInput = { ...pricingInput, ourPrice: match.source.price, competitorPrice: match.candidate.price, competitorChangePercent: 0, competitorVoucherPercent: 0 };
    try {
      setPricing(simulatePricingLocally(nextInput)); setPricingInput(nextInput); setCommittedPricingInput(nextInput); setSelected(match); navigate('pricing');
    } catch (error) { setOperationError(error instanceof Error ? error.message : 'Không tính được phương án giá.'); }
  }
  async function simulate(event: FormEvent) {
    event.preventDefault(); setSimulating(true);
    try {
      const result = await api.pricing(pricingInput);
      setPricing(result); setCommittedPricingInput({ ...pricingInput }); setScenarioCount((value) => value + 1); setOperationError('');
      if (result.action !== 'MATCH_UNDERCUT') setGuardrailCatches((value) => value + 1);
      if (flowStartedAt.current !== null) setDecisionLatencyMs(performance.now() - flowStartedAt.current);
    } catch (error) { setOperationError(error instanceof Error ? error.message : 'Không tính được phương án giá.'); }
    finally { setSimulating(false); }
  }
  function navigate(next: View) { setView(next); window.history.replaceState(null, '', `#${next}`); setSidebarOpen(false); setOperationError(''); }
  function openPlanning() {
    if (JSON.stringify(pricingInput) !== JSON.stringify(committedPricingInput)) {
      setOperationError('Chạy decision tree với dữ liệu mới trước khi chuyển sang kế hoạch vốn.'); return;
    }
    const approved = Boolean(selected && reviews[matchKey(selected)] === 'approved');
    setPlanningSeed({ id: Date.now(), input: { ...committedPricingInput }, proposedPrice: pricing.recommendedPrice,
      label: approved && selected ? `${selected.source.product_name} ↔ ${selected.candidate.product_name}` : 'Scenario độc lập — chưa liên kết cặp SKU đã duyệt', approvedMatch: approved });
    navigate('planning');
  }
  function matchAlert(alert?: Alert) {
    if (alert) {
      setTargetShop(alert.shop_id);
      if (sourceShop === alert.shop_id) setSourceShop(shops.find((shop) => shop.shop_id !== alert.shop_id)?.shop_id || '');
      setMatches([]); setSelected(null); setSegment('');
    }
    navigate('matches');
  }
  function exportBrief() {
    const payload = {
      exportedAt: new Date().toISOString(), scope: 'VN_TRACKED_COMPETITOR_SET', source: sourceLabel, snapshotTime,
      limitations: ['Không đại diện toàn thị trường', 'monthly_sold là snapshot tham chiếu', 'Chưa suy ra causal promotion uplift'],
      overview, validation: { reviewedMatches: reviewedCount, approvedMatches: approvedCount, scenarios: scenarioCount, guardrailCatches, decisionLatencyMs },
      topSignals: alerts.slice(0, 20), dataQuality: quality,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `mavericks-brief-${country}-${overview.dateRange.max_date || 'latest'}.json`; link.click(); URL.revokeObjectURL(url);
  }

  return <TooltipProvider delayDuration={200}>
    <div className="mi-app">
      <aside id="workspace-navigation" className={`mi-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Link className="brand-symbol" href="/" aria-label="Về trang giới thiệu Mavericks"><span>M</span><i /></Link>
          <div><strong>Mavericks</strong><small>Không gian làm việc của brand</small></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu"><X size={18} /></button>
        </div>
        <div className="workspace-selector"><span>KHÔNG GIAN LÀM VIỆC</span><div className="commerce-workspace"><span className="workspace-icon"><ChartNoAxesCombined size={16} /></span><span><strong>Brand workspace</strong><small>Mẫu ngành hàng Việt Nam</small></span></div></div>
        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          <span className="nav-label">CÔNG VIỆC HẰNG NGÀY</span>
          {nav.slice(0, 5).map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} badge={item.id === 'alerts' ? alerts.length : undefined} />)}
          <span className="nav-label nav-label-second">DỮ LIỆU</span>
          <NavButton item={nav[5]} active={view === 'quality'} onClick={() => navigate('quality')} badge={quality.flaggedProducts || undefined} />
        </nav>
        <div className="model-card commerce-data-note">
          <div className="model-title"><span><Database size={14} /> Phạm vi dữ liệu đối thủ</span></div>
          <p><strong>{overview.shops}</strong> gian hàng · <strong>{cleanListings.toLocaleString('vi-VN')}</strong> SKU dùng để so sánh</p>
          <small>{overview.dateRange.dates} ngày quan sát. {quality.flaggedProducts} SKU cần xác minh được loại khỏi tập so sánh.</small>
          <button onClick={() => navigate('quality')}>Xem nguồn & kiểm tra <ArrowRight size={12}/></button>
        </div>
        <div className="sidebar-status"><span className={`status-orb ${dataMode}`}><Database size={13} /></span><div><strong>{sourceLabel}</strong><small>{snapshotTime ? `Cập nhật ${new Date(snapshotTime).toLocaleDateString('vi-VN')}` : 'Đang lấy nguồn dữ liệu'}</small></div><MoreHorizontal size={16} /></div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu" />}

      <main className="mi-main">
        <header className="mi-topbar">
          <div className="topbar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Mở menu" aria-expanded={sidebarOpen} aria-controls="workspace-navigation"><Menu size={19} /></button><div className="breadcrumb"><span>Workspace</span><i>/</i><strong>{currentNav.label}</strong></div></div>
          <label className="command-search"><Search size={15} /><input ref={searchRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && searchQuery.trim()) navigate('alerts'); }} placeholder="Tìm SKU hoặc gian hàng…" aria-label="Tìm SKU hoặc gian hàng"/><kbd><Command size={11} /> K</kbd></label>
          <div className="topbar-actions">
            <Tooltip><TooltipTrigger asChild><button className="icon-action" onClick={() => { api.invalidateSnapshot(country); setDataMode('loading'); setRefreshKey((value) => value + 1); }} aria-label="Làm mới dữ liệu"><RefreshCw className={dataMode === 'loading' ? 'spin' : ''} size={15} /></button></TooltipTrigger><TooltipContent>Làm mới dữ liệu</TooltipContent></Tooltip>
            {view !== 'planning' && <span className="date-chip"><CalendarDays size={14} />{dateLabel(overview.dateRange.min_date)} — {dateLabel(overview.dateRange.max_date)}</span>}
            <span className="scope-chip"><Target size={13} /> Mẫu đối thủ · Việt Nam</span>
          </div>
        </header>

        <div className="mi-content">
          <div className="decision-flow-strip" aria-label="Luồng quyết định MVP">
            <button className={`${view === 'alerts' ? 'active' : ''} ${alerts.length ? 'done' : ''}`} onClick={() => navigate('alerts')}><span>01</span><strong>Tín hiệu</strong><small>Biến động giá ≥10%</small></button>
            <i><ArrowRight size={14} /></i>
            <button className={`${view === 'matches' ? 'active' : ''} ${reviewedCount ? 'done' : ''}`} onClick={() => navigate('matches')}><span>02</span><strong>So sánh SKU</strong><small>{reviewedCount ? `${approvedCount}/${reviewedCount} đã duyệt` : 'Kiểm tra đúng sản phẩm'}</small></button>
            <i><ArrowRight size={14} /></i>
            <button className={`${view === 'pricing' && !scenarioCount ? 'active' : ''} ${scenarioCount ? 'done' : ''}`} onClick={() => navigate('pricing')}><span>03</span><strong>Kiểm tra giá</strong><small>Chi phí và biên lợi nhuận</small></button>
            <i><ArrowRight size={14} /></i>
            <button className={view === 'planning' ? 'active' : ''} onClick={() => navigate('planning')}><span>04</span><strong>Lập kế hoạch</strong><small>Hàng cần nhập và tiền cần có</small></button>
          </div>
          <div className="page-title-row"><div><div className="page-kicker"><CurrentIcon size={14} />{currentNav.description}</div><h1>{currentNav.label}</h1><p>{view === 'overview' ? 'Một màn hình để nhìn tín hiệu, hiểu nguyên nhân và chọn hành động.' : view === 'alerts' ? 'Ưu tiên biến động đáng chú ý thay vì phản ứng với mọi thay đổi giá.' : view === 'matches' ? 'Ghép đúng sản phẩm tương đương trước khi so giá và ra quyết định.' : view === 'pricing' ? 'Mô phỏng phản ứng giá mà không đánh đổi biên lợi nhuận.' : view === 'planning' ? 'So sánh giá, lợi nhuận và nhu cầu vốn từ lịch sử bán hàng của brand.' : 'Đo độ tin cậy của dữ liệu trước khi dữ liệu đi vào quyết định.'}</p></div><div className="page-actions"><Badge variant={dataMode === 'live' ? 'success' : dataMode === 'error' ? 'danger' : 'warning'}><span className="badge-dot" />{sourceLabel}</Badge><Button variant="outline" size="sm" onClick={exportBrief}><ExternalLink size={14} /> Export brief</Button></div></div>
          {operationError && <div className="ps-message error" role="alert">{operationError}</div>}
          {view === 'pricing' && JSON.stringify(pricingInput) !== JSON.stringify(committedPricingInput) && <div className="ps-message">Dữ liệu đầu vào đã thay đổi. Kết quả phía dưới thuộc lần chạy trước; hãy chạy lại decision tree để cập nhật.</div>}

          <AnimatePresence mode="wait">
            <motion.section key={`${view}-${country}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .24, ease: 'easeOut' }}>
              {view === 'overview' && <OverviewView overview={overview} shops={shops} segments={segments} alerts={alerts} trend={trend} cleanListings={cleanListings} maxShopVolume={maxShopVolume} evidence={{ reviewed: reviewedCount, approved: approvedCount, scenarios: scenarioCount, catches: guardrailCatches, latencyMs: decisionLatencyMs }} onViewAlerts={() => navigate('alerts')} onPricing={() => navigate('pricing')} onMatch={matchAlert} onPlanning={() => navigate('planning')} onQuality={() => navigate('quality')} />}
              {view === 'alerts' && <AlertsView alerts={alerts} country={country} downAlerts={downAlerts} upAlerts={upAlerts} query={searchQuery} onMatch={matchAlert} />}
              {view === 'matches' && <MatchesView shops={shops} segments={segments} sourceShop={sourceShop} targetShop={targetShop} segment={segment} matches={matches} selected={selected} matching={matching} reviews={reviews} country={country} setSourceShop={(value) => { setSourceShop(value); if (value === targetShop) setTargetShop(''); setMatches([]); setSelected(null); }} setTargetShop={(value) => { setTargetShop(value); setMatches([]); setSelected(null); }} setSegment={(value) => { setSegment(value); setMatches([]); setSelected(null); }} setSelected={setSelected} runMatching={runMatching} onReview={reviewMatch} onPricing={sendToPricing} />}
              {view === 'pricing' && <PricingView country={country} input={pricingInput} result={pricing} simulating={simulating} setInput={setPricingInput} simulate={simulate} selected={selected && reviews[matchKey(selected)] === 'approved' ? selected : null} onPlan={openPlanning} />}
              {view === 'planning' && <ProfitPlanner seed={planningSeed} />}
              {view === 'quality' && <QualityView quality={quality} overview={overview} country={country} />}
            </motion.section>
          </AnimatePresence>
        </div>
      </main>
    </div>
  </TooltipProvider>;
}

function NavButton({ item, active, badge, onClick }: { item: NavItem; active: boolean; badge?: number; onClick: () => void }) {
  const Icon = item.icon;
  return <button type="button" className={`sidebar-nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}><span className="nav-icon"><Icon size={17} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{badge !== undefined && <em>{badge}</em>}</button>;
}

function OverviewView({ overview, shops, segments, alerts, trend, cleanListings, maxShopVolume, evidence, onViewAlerts, onPricing, onMatch, onPlanning, onQuality }: { overview: Overview; shops: Shop[]; segments: Segment[]; alerts: Alert[]; trend: TrendPoint[]; cleanListings: number; maxShopVolume: number; evidence: { reviewed: number; approved: number; scenarios: number; catches: number; latencyMs: number | null }; onViewAlerts: () => void; onPricing: () => void; onMatch: (alert: Alert) => void; onPlanning: () => void; onQuality: () => void }) {
  const alertRate = cleanListings ? overview.priceAlerts / cleanListings * 100 : 0;
  const shopSeries = shops.slice(0, 8).map((shop) => shop.sku_count).reverse();
  const salesSeries = shops.slice(0, 8).map((shop) => shop.monthly_sold).reverse();
  const metrics = [
    { label: 'SKU sạch trong mẫu', value: cleanListings.toLocaleString('vi-VN'), delta: `${(100 - overview.qualityFlags / Math.max(overview.trackedSkus, 1) * 100).toFixed(1)}% usable`, icon: PackageSearch, tone: 'blue', series: trend.map((point) => point.listings) },
    { label: 'Gian hàng theo dõi', value: String(overview.shops), delta: `${shops.filter((shop) => shop.is_official_shop).length} official stores`, icon: Store, tone: 'violet', series: shopSeries },
    { label: 'SKU biến động ≥10%', value: overview.priceAlerts.toLocaleString('vi-VN'), delta: `${alertRate.toFixed(1)}% clean universe`, icon: Activity, tone: 'coral', series: trend.map((point) => point.cuts + point.increases) },
    { label: 'Monthly sold signal', value: compact(overview.totalMonthlySold), delta: `${overview.classifiedCoverage}% đã phân loại`, icon: ShoppingBag, tone: 'gold', series: salesSeries },
  ];
  return <div className="view-stack">
    <DecisionShowcase onPlan={onPlanning} onSignals={onViewAlerts}/>
    <section className="work-agenda" aria-label="Việc cần xử lý"><div className="agenda-heading"><div><span className="ps-eyebrow">BẮT ĐẦU CA LÀM VIỆC</span><h2>Việc cần xem trước khi quyết định giá</h2><p>Từ mẫu quan sát đến {dateLabel(overview.dateRange.max_date)} — không phải cảnh báo thời gian thực.</p></div><Badge variant="secondary">Dữ liệu quan sát</Badge></div><div className="agenda-grid">{[...alerts].sort((a,b) => Math.abs(b.change_percent)-Math.abs(a.change_percent)).slice(0,3).map((alert) => <article key={`${alert.shop_id}-${alert.item_id}`}><span className={`agenda-change ${alert.direction}`}>{alert.change_percent > 0 ? '+' : ''}{alert.change_percent}%</span><h3>{alert.product_name}</h3><p>{alert.shop_name} · {dateLabel(alert.previous_date)} → {dateLabel(alert.date)}</p><div className="agenda-prices"><span>{money(alert.previous_price,overview.country)}</span><ArrowRight size={14}/><strong>{money(alert.price,overview.country)}</strong></div><small>Đối thủ đổi giá. Cần xác nhận đúng sản phẩm và quy cách trước khi phản ứng; chưa có bằng chứng về tác động lên doanh thu.</small><Button variant="outline" size="sm" onClick={() => onMatch(alert)}>Kiểm tra SKU tương đương <ArrowRight size={14}/></Button></article>)}{!alerts.length && <p>Chưa có biến động giá trong mẫu. Không cần tạo hành động khi chưa có tín hiệu.</p>}</div><div className="agenda-next"><button onClick={onQuality}><ShieldCheck size={17}/><span><strong>{overview.qualityFlags} SKU cần xác minh</strong><small>Kiểm tra dữ liệu đã loại khỏi so sánh</small></span><ArrowRight size={15}/></button><button onClick={onPlanning}><Wallet size={17}/><span><strong>Kiểm tra lợi nhuận & vốn của brand</strong><small>Nhập lịch sử bán hàng và chi phí riêng</small></span><ArrowRight size={15}/></button></div></section>
    <details className="workspace-evidence"><summary>Xem số liệu kiểm chứng phiên làm việc</summary>
    <div className="evidence-grid" aria-label="KPI kiểm chứng MVP">
      <EvidenceMetric label="Matching acceptance" value={evidence.reviewed ? `${Math.round(evidence.approved / evidence.reviewed * 100)}%` : 'Chưa có mẫu'} detail={`${evidence.approved}/${evidence.reviewed} cặp được duyệt`} />
      <EvidenceMetric label="Decision latency" value={evidence.latencyMs !== null ? `${(evidence.latencyMs / 1000).toFixed(2)}s` : 'Chưa đo'} detail="Từ Run matching đến khuyến nghị" />
      <EvidenceMetric label="Guardrail catch rate" value={evidence.scenarios ? `${Math.round(evidence.catches / evidence.scenarios * 100)}%` : 'Chưa có mẫu'} detail={`${evidence.catches}/${evidence.scenarios} scenario chặn phản ứng naive`} />
      <div className="scope-proof"><ShieldCheck size={18}/><div><strong>Claim boundary</strong><p>Mẫu đối thủ Việt Nam · {overview.dateRange.dates} ngày quan sát · chưa suy ra market share hay causal uplift.</p></div></div>
    </div><Button variant="outline" size="sm" onClick={onPricing}>Mở phương án giá</Button></details>

    <div className="metric-grid-v2">{metrics.map((metric, index) => <MetricCard key={metric.label} {...metric} delay={index * .05} />)}</div>

    <div className="analytics-grid">
      <Card className="trend-card"><CardHeader><div><CardDescription>TRACKED-SET MOMENTUM</CardDescription><CardTitle>Chỉ số giá mẫu theo dõi</CardTitle></div><div className="chart-legend"><span><i className="gold" /> Price index</span><span><i className="coral" /> Price cuts</span></div></CardHeader><CardContent><div className="chart-summary"><div><span>Latest index</span><strong>{trend.at(-1)?.priceIndex.toFixed(1) || '—'}</strong><Badge variant={(trend.at(-1)?.priceIndex || 100) < 100 ? 'warning' : 'success'}>{((trend.at(-1)?.priceIndex || 100) - 100).toFixed(1)}% vs đầu kỳ</Badge></div><p>Chỉ số chuẩn hóa từng SKU về 100 tại ngày đầu; đây là mô tả competitive set, không đại diện toàn thị trường.</p></div><div className="main-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 16, right: 10, left: -24, bottom: 0 }}><defs><linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3559a6" stopOpacity={.28}/><stop offset="95%" stopColor="#3559a6" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9ecf2" strokeDasharray="3 4"/><XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#8992a3' }} interval={3}/><YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#8992a3' }}/><ChartTooltip content={<MarketTooltip />}/><Bar dataKey="cuts" fill="#e3907f" radius={[3,3,0,0]} barSize={7} yAxisId="right" opacity={.55}/><YAxis yAxisId="right" orientation="right" hide/><Area type="monotone" dataKey="priceIndex" stroke="#3559a6" strokeWidth={2.5} fill="url(#priceArea)" dot={false} activeDot={{ r: 4, fill: '#d4a63f', stroke: '#fff', strokeWidth: 2 }}/></ComposedChart></ResponsiveContainer></div></CardContent></Card>
      <Card className="segment-card"><CardHeader><div><CardDescription>ASSORTMENT MIX</CardDescription><CardTitle>Cấu trúc danh mục</CardTitle></div><Button variant="ghost" size="icon"><MoreHorizontal size={17}/></Button></CardHeader><CardContent><div className="donut-wrap"><ResponsiveContainer width="100%" height={205}><PieChart><Pie data={segments.slice(0,6)} dataKey="count" nameKey="label" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">{segments.slice(0,6).map((item,index)=><Cell key={item.id} fill={chartColors[index % chartColors.length]}/>)}</Pie><ChartTooltip content={<SegmentTooltip total={cleanListings}/>} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{cleanListings}</strong><span>clean SKU</span></div></div><div className="segment-legend">{segments.slice(0,5).map((item,index)=><div key={item.id}><span><i style={{background:chartColors[index]}}/>{item.label}</span><strong>{item.count}</strong></div>)}</div></CardContent></Card>
    </div>

    <div className="lower-grid">
      <Card><CardHeader><div><CardDescription>COMPETITOR LANDSCAPE</CardDescription><CardTitle>Gian hàng dẫn đầu</CardTitle></div><Badge variant="secondary">by monthly sold</Badge></CardHeader><CardContent className="shop-ranking">{shops.slice(0,6).map((shop,index)=><div className="shop-rank-row" key={shop.shop_id}><span className="rank-index">{String(index+1).padStart(2,'0')}</span><span className="shop-avatar">{shop.shop_name.slice(0,2).toUpperCase()}</span><div><strong>{shop.shop_name}</strong><small>{shop.sku_count} clean SKU {shop.is_official_shop && '· Official'}</small></div><div className="rank-bar"><i style={{width:`${shop.monthly_sold/maxShopVolume*100}%`}}/></div><b>{compact(shop.monthly_sold)}</b></div>)}</CardContent></Card>
      <Card><CardHeader><div><CardDescription>LATEST SNAPSHOT SIGNALS</CardDescription><CardTitle>Biến động gần nhất</CardTitle></div><Button variant="ghost" size="sm" onClick={onViewAlerts}>Xem tất cả <ArrowRight size={13}/></Button></CardHeader><CardContent className="mini-alert-list">{alerts.slice(0,5).map((alert)=><button key={`${alert.shop_id}-${alert.item_id}`} onClick={onViewAlerts}><span className={`signal-icon ${alert.direction}`}>{alert.direction==='down'?<TrendingDown size={15}/>:<TrendingUp size={15}/>}</span><span><strong>{alert.product_name}</strong><small>{alert.shop_name} · {dateLabel(alert.date)}</small></span><Badge variant={badgeForSeverity(alert.severity)}>{alert.change_percent>0?'+':''}{alert.change_percent}%</Badge></button>)}</CardContent></Card>
    </div>
  </div>;
}

function MetricCard({ label, value, delta, icon: Icon, tone, series, delay }: { label: string; value: string; delta: string; icon: LucideIcon; tone: string; series: number[]; delay: number }) {
  const min = Math.min(...series, 0); const max = Math.max(...series, 1); const bars = series.slice(-10).map((value) => 22 + (value - min) / Math.max(max - min, 1) * 78);
  return <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay}}><Card className={`metric-card-v2 ${tone}`}><CardContent><div className="metric-top"><span className="metric-icon"><Icon size={17}/></span><Tooltip><TooltipTrigger asChild><button aria-label={`Giải thích ${label}`}><Info size={13}/></button></TooltipTrigger><TooltipContent>{delta}</TooltipContent></Tooltip></div><span className="metric-label">{label}</span><div className="metric-value-row"><strong>{value}</strong><div className="mini-spark">{bars.map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div></div><small>{delta}</small></CardContent></Card></motion.div>;
}

function AlertsView({ alerts, country, downAlerts, upAlerts, query, onMatch }: { alerts: Alert[]; country: Country; downAlerts: number; upAlerts: number; query: string; onMatch: (alert?: Alert) => void }) {
  const [filter, setFilter] = useState<'all' | 'down' | 'up' | 'critical'>('all');
  const normalized = query.trim().toLocaleLowerCase();
  const visible = alerts.filter((alert) => {
    const matchesFilter = filter === 'all' || filter === 'critical' ? filter === 'all' || alert.severity === 'critical' : alert.direction === filter;
    const matchesQuery = !normalized || `${alert.product_name} ${alert.shop_name} ${alert.item_id}`.toLocaleLowerCase().includes(normalized);
    return matchesFilter && matchesQuery;
  });
  const critical = alerts.filter((alert) => alert.severity === 'critical').length;
  const filters = [
    ['all', 'Tất cả', alerts.length], ['down', 'Price drop', downAlerts], ['up', 'Price increase', upAlerts], ['critical', 'Critical', critical],
  ] as const;
  return <div className="view-stack">
    <div className="summary-strip">
      <SummaryStat icon={TrendingDown} label="Giảm giá" value={downAlerts} tone="coral" detail="Cần kiểm tra SKU tương đương"/>
      <SummaryStat icon={TrendingUp} label="Tăng giá" value={upAlerts} tone="green" detail="Cơ hội phục hồi margin"/>
      <SummaryStat icon={AlertTriangle} label="Critical signals" value={critical} tone="gold" detail="Biến động tuyệt đối ≥30%"/>
      <SummaryStat icon={Activity} label="Queue hiện tại" value={visible.length} tone="blue" detail={normalized ? `Kết quả cho “${query}”` : 'Đã loại gift & placeholder'}/>
    </div>
    <Card className="data-card">
      <CardHeader><div><CardDescription>PRIORITY QUEUE</CardDescription><CardTitle>{visible.length} tín hiệu đang hiển thị</CardTitle></div><div className="table-actions"><Badge variant="outline"><Filter size={13}/> {filter === 'all' ? 'All signals' : filter}</Badge><Button size="sm" onClick={() => onMatch()}><ScanSearch size={13}/> Mở matching</Button></div></CardHeader>
      <div className="filter-pills">{filters.map(([id, label, count]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label} <span>{count}</span></button>)}</div>
      <div className="enterprise-table-wrap"><table className="enterprise-table"><thead><tr><th>Tín hiệu</th><th>Sản phẩm / Gian hàng</th><th>Giá trước</th><th>Giá mới</th><th>Biến động</th><th>Sold</th><th></th></tr></thead><tbody>
        {visible.length ? visible.map((alert)=><tr key={`${alert.shop_id}-${alert.item_id}`}><td><span className={`signal-icon ${alert.direction}`}>{alert.direction==='down'?<ArrowDownRight size={15}/>:<ArrowUpRight size={15}/>}</span></td><td className="product-cell"><strong>{alert.product_name}</strong><small>{alert.shop_name} · {dateLabel(alert.date)}</small></td><td className="muted-value">{money(alert.previous_price,country)}</td><td><strong>{money(alert.price,country)}</strong></td><td><Badge variant={badgeForSeverity(alert.severity)}>{alert.change_percent>0?'+':''}{alert.change_percent}%</Badge></td><td>{compact(alert.monthly_sold)}</td><td><button className="row-action" onClick={() => onMatch(alert)} aria-label={`Tìm SKU tương đương với ${alert.product_name}`}><ArrowRight size={15}/></button></td></tr>) : <tr><td colSpan={7}><EmptyState icon={Search} title="Không tìm thấy tín hiệu" body="Thử từ khóa hoặc bộ lọc khác."/></td></tr>}
      </tbody></table></div>
    </Card>
  </div>;
}

function MatchesView({ shops, segments, sourceShop, targetShop, segment, matches, selected, matching, reviews, country, setSourceShop, setTargetShop, setSegment, setSelected, runMatching, onReview, onPricing }: { shops: Shop[]; segments: Segment[]; sourceShop: string; targetShop: string; segment: string; matches: Match[]; selected: Match|null; matching: boolean; reviews: Record<string, ReviewDecision>; country: Country; setSourceShop:(value:string)=>void; setTargetShop:(value:string)=>void; setSegment:(value:string)=>void; setSelected:(match:Match)=>void; runMatching:()=>void; onReview:(match:Match, decision:ReviewDecision)=>void; onPricing:(match:Match)=>void }) {
  return <div className="view-stack">
    <Card className="match-control-card"><CardContent>
      <div className="control-intro"><span className="control-icon"><Zap size={20}/></span><div><strong>Explainable matching MVP</strong><p>{MATCHING_WEIGHTS.name}% tên · {MATCHING_WEIGHTS.keyword}% từ khóa · {MATCHING_WEIGHTS.pack}% pack/size · ngưỡng route 75%</p></div></div>
      <div className="match-controls">
        <Field label="Gian hàng của ta"><select aria-label="Gian hàng của ta" disabled={matching} value={sourceShop} onChange={(e)=>setSourceShop(e.target.value)}>{shops.map((shop)=><option value={shop.shop_id} key={shop.shop_id}>{shop.shop_name}</option>)}</select></Field>
        <span className="control-arrow"><ArrowRight size={16}/></span>
        <Field label="Đối thủ"><select aria-label="Đối thủ" disabled={matching} value={targetShop} onChange={(e)=>setTargetShop(e.target.value)}><option value="">Tất cả đối thủ</option>{shops.filter((shop)=>shop.shop_id!==sourceShop).map((shop)=><option value={shop.shop_id} key={shop.shop_id}>{shop.shop_name}</option>)}</select></Field>
        <Field label="Phân khúc"><select aria-label="Phân khúc" disabled={matching} value={segment} onChange={(e)=>setSegment(e.target.value)}><option value="">Tất cả</option>{segments.filter((item)=>item.id!=='other').map((item)=><option value={item.id} key={item.id}>{item.label}</option>)}</select></Field>
        <Button onClick={runMatching} disabled={matching || !sourceShop}>{matching?<RefreshCw className="spin" size={15}/>:<ScanSearch size={15}/>} {matching?'Đang tính điểm':'Run matching'}</Button>
      </div>
      <div className="model-boundary"><Info size={14}/><p>MVP đang chạy taxonomy rules + character similarity. Embedding/LLM là tầng tiếp theo; cặp dưới 75% được route sang review tăng cường, không giả lập kết quả AI.</p></div>
    </CardContent></Card>
    <div className="matching-workspace">
      <Card className="match-results"><CardHeader><div><CardDescription>RANKED CANDIDATES</CardDescription><CardTitle>{matches.length} cặp đề xuất</CardTitle></div><Badge variant="secondary">Human-in-the-loop</Badge></CardHeader><CardContent>{matches.length?<div className="candidate-list">{matches.map((match,index)=>{const decision=reviews[matchKey(match)]; return <button key={`${match.source.item_id}-${match.candidate.item_id}-${index}`} className={`${selected===match?'active':''} review-${decision||'pending'}`} onClick={()=>setSelected(match)}><ScoreRing score={match.scoring.confidence} band={match.scoring.band}/><span className="candidate-copy"><strong>{match.source.product_name}</strong><i><Link2 size={11}/> {match.candidate.product_name}</i><small>{decision==='approved'?'Đã duyệt':decision==='rejected'?'Đã từ chối':`${match.source.shop_name} ↔ ${match.candidate.shop_name}`}</small></span><span className="candidate-price"><strong>{money(match.source.price,country)}</strong><small>{money(match.candidate.price,country)}</small></span><ArrowRight size={14}/></button>})}</div>:<EmptyState icon={ScanSearch} title="Sẵn sàng tính trên snapshot Việt Nam" body="Chọn hai gian hàng hoặc một phân khúc rồi chạy matching."/>}</CardContent></Card>
      <Card className="match-inspector">{selected?<MatchInspector match={selected} country={country} reviewStatus={reviews[matchKey(selected)]} onReview={(decision)=>onReview(selected,decision)} onPricing={()=>onPricing(selected)}/>:<EmptyState icon={PackageSearch} title="Chưa chọn cặp SKU" body="Điểm thành phần và bằng chứng sẽ xuất hiện sau khi chạy matching."/>}</Card>
    </div>
  </div>;
}

function MatchInspector({ match, country, reviewStatus, onReview, onPricing }: { match: Match; country: Country; reviewStatus?: ReviewDecision; onReview:(decision:ReviewDecision)=>void; onPricing:()=>void }) {
  const enhancedReview = match.scoring.confidence < 75;
  return <><CardHeader className="inspector-head"><div><CardDescription>MATCH INSPECTOR</CardDescription><CardTitle>Evidence review</CardTitle></div><Badge variant={reviewStatus==='approved'?'success':reviewStatus==='rejected'?'danger':match.scoring.band==='high'?'success':match.scoring.band==='review'?'warning':'secondary'}>{reviewStatus==='approved'?'Đã duyệt':reviewStatus==='rejected'?'Đã từ chối':bandLabel(match.scoring.band)}</Badge></CardHeader><CardContent>
    <div className="inspector-score"><ScoreRing score={match.scoring.confidence} band={match.scoring.band} large/><div><strong>{match.scoring.confidence}/100 điểm tương đồng</strong><p>Điểm theo quy tắc, không phải xác suất đúng. Người dùng cần xác nhận.</p></div></div>
    <div className={`routing-note ${enhancedReview?'review':'ready'}`}><Sparkles size={14}/><div><strong>{enhancedReview?'Route: enhanced review':'Route: review nhanh'}</strong><p>{enhancedReview?'Dưới ngưỡng 75%. Production sẽ gọi embedding/LLM fallback trước khi người dùng quyết định.':'Đạt ngưỡng 75%, nhưng Category Manager vẫn là người phê duyệt cuối.'}</p></div></div>
    <div className="product-compare-v2"><ProductCard title="SKU của ta" product={match.source} country={country}/><span className="versus-chip">VS</span><ProductCard title="SKU đối thủ" product={match.candidate} country={country}/></div>
    <div className="sku-facts"><span className="ps-eyebrow">ĐỐI CHIẾU TRƯỚC KHI DUYỆT</span><table><thead><tr><th>Thông tin</th><th>SKU nguồn</th><th>SKU đối thủ</th></tr></thead><tbody><tr><th>Thương hiệu</th><td>{match.source.brand || 'Chưa có dữ liệu'}</td><td>{match.candidate.brand || 'Chưa có dữ liệu'}</td></tr><tr><th>Số món trong gói*</th><td>{match.scoring.sourcePack.packCount ?? 'Chưa nhận diện'}</td><td>{match.scoring.candidatePack.packCount ?? 'Chưa nhận diện'}</td></tr><tr><th>Tổng size nhận diện*</th><td>{match.scoring.sourcePack.totalSize ?? 'Chưa nhận diện'}</td><td>{match.scoring.candidatePack.totalSize ?? 'Chưa nhận diện'}</td></tr><tr><th>Giá niêm yết quan sát</th><td>{money(match.source.price,country)}</td><td>{money(match.candidate.price,country)}</td></tr></tbody></table><p>*Trích từ tên bằng quy tắc. Cần kiểm tra đơn vị g/ml, biến thể và combo từ thông tin sản phẩm; giá chưa được chuẩn hóa theo đơn vị.</p><div className="sku-gap"><strong>{((match.source.price / Math.max(match.candidate.price,1) - 1)*100).toFixed(1)}%</strong><span>Chênh lệch giá nguồn so với đối thủ · chỉ có ý nghĩa sau khi xác nhận tương đương. Không cho biết mức giá nào tối ưu.</span></div></div>
    <div className="score-bars"><ScoreBar label="Tên sản phẩm" score={match.scoring.textScore}/><ScoreBar label="Từ khóa" score={match.scoring.tokenScore}/><ScoreBar label="Pack / size" score={match.scoring.packScore}/></div>
    <div className="evidence-box"><strong>Giải thích mô hình</strong>{match.scoring.reasons.map((reason)=><p key={reason}><Check size={13}/>{reason}</p>)}{match.scoring.warnings.map((warning)=><p className="warning" key={warning}><AlertTriangle size={13}/>{warning}</p>)}</div>
    <div className="review-actions"><button className={reviewStatus==='rejected'?'active reject':''} onClick={()=>onReview('rejected')} aria-pressed={reviewStatus==='rejected'}><X size={14}/> Không tương đương</button><button className={reviewStatus==='approved'?'active approve':''} onClick={()=>onReview('approved')} aria-pressed={reviewStatus==='approved'}><Check size={14}/> Xác nhận match</button></div>
    <Button className="full-button" disabled={reviewStatus!=='approved'} onClick={onPricing}><CircleDollarSign size={15}/> {reviewStatus==='approved'?'Đưa cặp đã duyệt vào Pricing Lab':'Cần xác nhận match trước'} <ArrowRight size={14}/></Button>
  </CardContent></>;
}

function PricingView({ country, input, result, simulating, setInput, simulate, selected, onPlan }: { country: Country; input: PricingInput; result: PricingResult; simulating: boolean; setInput:(value:PricingInput)=>void; simulate:(event:FormEvent)=>void; selected:Match|null; onPlan:()=>void }) {
  const scale = Math.max(result.competitorEffective, result.recommendedPrice, result.marginFloor, input.ourPrice, 1);
  const floorRatio=Math.min(100,result.marginFloor/scale*100); const priceRatio=Math.min(100,result.recommendedPrice/scale*100); const competitorRatio=Math.min(100,result.competitorEffective/scale*100);
  return <div className="pricing-grid">
    <Card className="scenario-panel"><CardHeader><div><CardDescription>SCENARIO INPUTS</CardDescription><CardTitle>Effective price & economics</CardTitle></div><Badge variant="outline">Interactive</Badge></CardHeader><CardContent><form onSubmit={simulate}>
      <div className="scenario-context">{selected?<><span><Link2 size={13}/></span><div><strong>Cặp SKU đã được duyệt</strong><p>{selected.source.product_name.slice(0,42)}… ↔ {selected.candidate.product_name.slice(0,42)}…</p></div></>:<><span><Info size={13}/></span><div><strong>Scenario độc lập</strong><p>Dùng để kiểm thử decision tree; chưa tự động thay đổi giá thật.</p></div></>}</div>
      <div className="form-group"><span>PRICE SIGNAL</span><div className="input-grid"><NumberField label="Giá niêm yết của ta" value={input.ourPrice} onChange={(v)=>setInput({...input,ourPrice:v})}/><NumberField label="Giá đối thủ pre-promo" value={input.competitorPrice} onChange={(v)=>setInput({...input,competitorPrice:v})}/><NumberField label="Đối thủ thay đổi (%)" value={input.competitorChangePercent} onChange={(v)=>setInput({...input,competitorChangePercent:v})}/><NumberField label="Voucher đối thủ (%)" value={input.competitorVoucherPercent} onChange={(v)=>setInput({...input,competitorVoucherPercent:v})}/></div></div>
      <div className="form-group"><span>PRICE-POSITION POLICY</span><div className="input-grid policy-inputs"><Field label="Vai trò SKU"><select value={input.skuRole} onChange={(event)=>setInput({...input,skuRole:event.target.value as PricingInput['skuRole']})}><option value="traffic">Traffic driver</option><option value="core">Core SKU</option><option value="margin">Margin driver</option></select></Field><NumberField label="Ngưỡng hành động (%)" value={input.gapThresholdPercent} onChange={(v)=>setInput({...input,gapThresholdPercent:v})}/><NumberField label="Undercut traffic SKU (%)" value={input.undercutPercent} onChange={(v)=>setInput({...input,undercutPercent:v})}/></div></div>
      <div className="form-group"><span>UNIT ECONOMICS</span><div className="input-grid"><NumberField label="COGS (%)" value={input.cogsPercent} onChange={(v)=>setInput({...input,cogsPercent:v})}/><NumberField label="Target margin (%)" value={input.targetMarginPercent} onChange={(v)=>setInput({...input,targetMarginPercent:v})}/><NumberField label="Phí sàn (%)" value={input.platformFeePercent} onChange={(v)=>setInput({...input,platformFeePercent:v})}/><NumberField label="Voucher của ta (%)" value={input.voucherPercent} onChange={(v)=>setInput({...input,voucherPercent:v})}/><NumberField label="Shipping subsidy (%)" value={input.shippingPercent} onChange={(v)=>setInput({...input,shippingPercent:v})}/><NumberField label="Return/refund (%)" value={input.returnRatePercent} onChange={(v)=>setInput({...input,returnRatePercent:v})}/><NumberField label="Ads spend (%)" value={input.adsSpendPercent} onChange={(v)=>setInput({...input,adsSpendPercent:v})}/><NumberField label="Campaign/trade spend (%)" value={input.campaignSpendPercent} onChange={(v)=>setInput({...input,campaignSpendPercent:v})}/><NumberField label="Bao bì/combo (đ)" value={input.packagingCost} onChange={(v)=>setInput({...input,packagingCost:v})}/></div></div>
      <Button className="full-button" disabled={simulating}>{simulating?<RefreshCw className="spin" size={15}/>:<Gauge size={15}/>} {simulating?'Đang mô phỏng':'Chạy decision tree'}</Button>
    </form></CardContent></Card>

    <Card className={`recommendation-panel action-${result.action.toLowerCase()}`}><div className="recommendation-glow"/><CardContent>
      <div className="recommendation-top"><div><Badge variant={result.reviewRequired?'warning':'outline'}><Sparkles size={12}/> {result.reviewRequired?'HUMAN REVIEW REQUIRED':'DECISION SUPPORT'}</Badge><h2>{result.headline}</h2><p>{result.rationale}</p></div><span className="action-seal"><ShieldCheck size={24}/><b>{result.action}</b></span></div>
      <div className="decision-tree"><span>DECISION TREE</span>{result.decisionSteps.map((step,index)=><div className={step.status} key={step.label}><i>{index}</i><p><strong>{step.label}</strong><small>{step.outcome}</small></p>{step.status==='passed'?<Check size={14}/>:step.status==='stopped'?<ShieldCheck size={14}/>:<MoreHorizontal size={14}/>}</div>)}</div>
      <div className="price-decision"><span>Giá hệ thống đề xuất</span><strong>{money(result.recommendedPrice,country)}</strong><small>{result.recommendedPrice===input.ourPrice?'Giữ nguyên giá; không auto-execute':`${((result.recommendedPrice/input.ourPrice-1)*100).toFixed(1)}% so với hiện tại · chờ Category Manager duyệt`}</small></div>
      <div className="decision-metric-grid five"><ResultMetric label="Giá ta sau voucher" value={money(result.ourEffective,country)} icon={CircleDollarSign}/><ResultMetric label="Đối thủ effective" value={money(result.competitorEffective,country)} icon={Target}/><ResultMetric label="Margin floor" value={money(result.marginFloor,country)} icon={ShieldCheck}/><ResultMetric label="Biên hiện tại" value={`${result.currentMarginPercent}%`} icon={ChartNoAxesCombined}/><ResultMetric label="Price gap" value={`${result.currentPriceGapPercent}%`} icon={Activity}/></div>
      <div className="price-rail"><div className="rail-labels"><span>0</span><span>Giá sàn</span><span>Giá đề xuất</span><span>Đối thủ effective</span></div><div className="rail-track"><i className="safe-zone" style={{left:`${floorRatio}%`}}/><b className="floor-pin" style={{left:`${floorRatio}%`}}/><b className="price-pin" style={{left:`${priceRatio}%`}}/><b className="competitor-pin" style={{left:`${competitorRatio}%`}}/></div><div className="rail-caption"><span><i/> Vùng phá margin</span><span><i/> Vùng có thể hành động</span></div></div>
      {(result.action==='DEFEND_MARGIN'||result.action==='HUMAN_REVIEW')&&<div className="lever-list"><strong>Non-price levers</strong>{result.nonPriceLevers.map((lever)=><span key={lever}><Check size={12}/>{lever}</span>)}</div>}
      <div className="guardrail-note"><ShieldCheck size={18}/><div><strong>Owner: {result.actionOwner}</strong><p>Hệ thống chỉ hỗ trợ quyết định. Không tự tăng giá, không tự giảm giá và không tự thực thi promotion.</p></div></div>
      <div className="assumption-list">{result.assumptions.map((assumption)=><span key={assumption}><Info size={11}/>{assumption}</span>)}</div>
      <div className="ps-planning-cta"><p>Giá phù hợp có cần thêm vốn? Chuyển phương án này sang lịch sử bán hàng của brand để lập kế hoạch tồn kho và tiền mặt.</p><Button onClick={onPlan}>Lập kế hoạch vốn <ArrowRight size={14}/></Button></div>
    </CardContent></Card>
  </div>;
}

function QualityView({ quality, overview, country }: { quality: Quality; overview: Overview; country: Country }) {
  const clean=Math.max(0,quality.totalProducts-quality.flaggedProducts); const cleanRate=quality.totalProducts?clean/quality.totalProducts*100:100;
  return <div className="view-stack"><div className="quality-hero"><div className="quality-gauge" style={{'--quality':`${cleanRate*3.6}deg`} as CSSProperties}><span><strong>{cleanRate.toFixed(1)}%</strong><small>usable data</small></span></div><div><Badge variant="success"><BadgeCheck size={12}/> TRUST LAYER ACTIVE</Badge><h2>Dữ liệu sạch trước, quyết định sau.</h2><p>{quality.flaggedProducts} trong {quality.totalProducts} listing bị cô lập khỏi matching và benchmark. Coverage phân loại trên tập sạch đạt {overview.classifiedCoverage}%.</p></div><div className="quality-checks"><p><Check size={14}/> Placeholder price filter</p><p><Check size={14}/> Gift & giveaway detection</p><p><Check size={14}/> Promotion orphan audit</p></div></div><div className="summary-strip"><SummaryStat icon={Database} label="Raw listings" value={quality.totalProducts} tone="blue" detail="Catalog mới nhất"/><SummaryStat icon={BadgeCheck} label="Clean listings" value={clean} tone="green" detail={`${cleanRate.toFixed(1)}% usable`}/><SummaryStat icon={AlertTriangle} label="Quarantined" value={quality.flaggedProducts} tone="coral" detail="Không dùng để benchmark"/><SummaryStat icon={Link2} label="Orphan rows" value={quality.orphanPromotionRows} tone="gold" detail="Promotion không có catalog"/></div><Card className="data-card"><CardHeader><div><CardDescription>QUARANTINE LOG</CardDescription><CardTitle>Listing cần xác minh</CardTitle></div><Badge variant="warning">{quality.flaggedProducts} flags</Badge></CardHeader><div className="enterprise-table-wrap"><table className="enterprise-table"><thead><tr><th>Severity</th><th>Rule</th><th>Sản phẩm</th><th>Gian hàng</th><th>Giá ghi nhận</th><th>Disposition</th></tr></thead><tbody>{quality.issues.length?quality.issues.map((issue)=><tr key={`${issue.item_id}-${issue.type}`}><td><Badge variant={issue.severity==='critical'?'danger':'warning'}>{issue.severity}</Badge></td><td><code>{issue.type}</code></td><td className="product-cell"><strong>{issue.product_name}</strong><small>Item ID · {issue.item_id}</small></td><td>{issue.shop_name}</td><td><strong>{money(issue.price,country)}</strong></td><td><span className="quarantine-status"><ShieldCheck size={13}/> Excluded</span></td></tr>):<tr><td colSpan={6}><EmptyState icon={BadgeCheck} title="Không có lỗi" body="Tập dữ liệu hiện vượt qua các quy tắc kiểm tra."/></td></tr>}</tbody></table></div></Card></div>;
}

function SummaryStat({ icon:Icon,label,value,tone,detail }: { icon:LucideIcon;label:string;value:number;tone:string;detail:string }) { return <Card className={`summary-stat ${tone}`}><CardContent><span><Icon size={17}/></span><div><small>{label}</small><strong>{value.toLocaleString('vi-VN')}</strong><p>{detail}</p></div></CardContent></Card>; }
function EvidenceMetric({label,value,detail}:{label:string;value:string;detail:string}) { return <div className="evidence-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="form-field"><span>{label}</span>{children}</label>; }
function NumberField({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) { return <Field label={label}><input type="number" value={value} onChange={(e)=>onChange(Number(e.target.value))}/></Field>; }
function ScoreRing({score,band,large=false}:{score:number;band:Match['scoring']['band'];large?:boolean}) { return <span className={`score-ring-v2 ${band} ${large?'large':''}`} style={{'--score':`${score*3.6}deg`} as CSSProperties}><b>{score}</b><small>%</small></span>; }
function ScoreBar({label,score}:{label:string;score:number}) { return <div><span>{label}<b>{score}%</b></span><i><em style={{width:`${score}%`}}/></i></div>; }
function ProductCard({title,product,country}:{title:string;product:Match['source'];country:Country}) { return <article className="product-card-v2">{product.image_url?<img src={product.image_url} alt="" /* eslint-disable-line @next/next/no-img-element */ />:<span className="product-fallback"><PackageSearch size={22}/></span>}<small>{title}</small><strong>{product.product_name}</strong><b>{money(product.price,country)}</b><p>{compact(product.monthly_sold)} sold · ★ {product.rating||'—'}</p></article>; }
function ResultMetric({label,value,icon:Icon}:{label:string;value:string;icon:LucideIcon}) { return <div><span><Icon size={13}/>{label}</span><strong>{value}</strong></div>; }
function EmptyState({icon:Icon,title,body}:{icon:LucideIcon;title:string;body:string}) { return <div className="empty-state-v2"><span><Icon size={25}/></span><strong>{title}</strong><p>{body}</p></div>; }
function MarketTooltip({active,payload,label}:{active?:boolean;payload?:Array<{name:string;value:number;color:string}>;label?:string}) { if(!active||!payload?.length)return null; return <div className="chart-tooltip"><strong>{label?dateLabel(label):''}</strong>{payload.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name==='priceIndex'?'Price index':'Price cuts'}<b>{item.value}</b></span>)}</div>; }
function SegmentTooltip({active,payload,total}:{active?:boolean;payload?:Array<{name:string;value:number}>;total:number}) { if(!active||!payload?.length)return null; const item=payload[0]; return <div className="chart-tooltip"><strong>{item.name}</strong><span>SKU <b>{item.value}</b></span><span>Tỷ trọng <b>{(item.value/Math.max(total,1)*100).toFixed(1)}%</b></span></div>; }
