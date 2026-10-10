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
import CashWorkspace from '@/components/CashWorkspace';
import FinancialAssistant from '@/components/FinancialAssistant';
import { LanguageProvider, useLanguage } from '@/lib/i18n';

type View = 'overview' | 'alerts' | 'matches' | 'pricing' | 'planning' | 'cashflow' | 'quality';
type NavItem = { id: View; label: string; description: string; icon: LucideIcon };
type ReviewDecision = 'approved' | 'rejected';

const nav: NavItem[] = [
  { id: 'overview', label: 'Tổng quan', description: 'Tình hình và việc cần làm', icon: LayoutDashboard },
  { id: 'alerts', label: 'Biến động giá', description: 'Mẫu đối thủ theo dõi', icon: BellRing },
  { id: 'matches', label: 'So sánh sản phẩm', description: 'Xác nhận SKU tương đương', icon: ScanSearch },
  { id: 'pricing', label: 'Phương án giá', description: 'Giá bán và biên lợi nhuận', icon: FlaskConical },
  { id: 'planning', label: 'Kế hoạch & vốn', description: 'Bán hàng, tồn kho, dòng tiền', icon: CircleDollarSign },
  { id: 'cashflow', label: 'Dòng tiền', description: 'Số dư, thu–chi và vốn nhập hàng', icon: Wallet },
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

function bandLabel(band: Match['scoring']['band']) { return band === 'high' ? 'Tin cậy cao' : band === 'review' ? 'Cần review' : 'Tin cậy thấp'; }
function badgeForSeverity(value: string): 'danger' | 'warning' | 'secondary' { return value === 'critical' ? 'danger' : value === 'warning' ? 'warning' : 'secondary'; }
function matchKey(match: Match) { return `${match.source.shop_id}:${match.source.item_id}|${match.candidate.shop_id}:${match.candidate.item_id}`; }

export default function MarketIntelligenceApp() {
  return <LanguageProvider><WorkspaceApp /></LanguageProvider>;
}

function WorkspaceApp() {
  const { locale, setLocale, t, count, date, dateLabel } = useLanguage();
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
          <Link className="brand-symbol" href="/" aria-label={t("Về trang giới thiệu Mavericks")}><span>{t("M")}</span><i /></Link>
          <div><strong>{t("Mavericks")}</strong><small>{t("Không gian làm việc của brand")}</small></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label={t("Đóng menu")}><X size={18} /></button>
        </div>
        <div className="workspace-selector"><span>{t("KHÔNG GIAN LÀM VIỆC")}</span><div className="commerce-workspace"><span className="workspace-icon"><ChartNoAxesCombined size={16} /></span><span><strong>{t("Brand workspace")}</strong><small>{t("Mẫu ngành hàng Việt Nam")}</small></span></div></div>
        <nav className="sidebar-nav" aria-label={t("Điều hướng chính")}>
          <span className="nav-label">{t("CÔNG VIỆC HẰNG NGÀY")}</span>
          {nav.filter((item) => item.id !== 'quality').map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} badge={item.id === 'alerts' ? alerts.length : undefined} />)}
          <span className="nav-label nav-label-second">{t("DỮ LIỆU")}</span>
          <NavButton item={nav[6]} active={view === 'quality'} onClick={() => navigate('quality')} badge={quality.flaggedProducts || undefined} />
        </nav>
        <div className="model-card commerce-data-note">
          <div className="model-title"><span><Database size={14} />{t(" Phạm vi dữ liệu đối thủ")}</span></div>
          <p><strong>{overview.shops}</strong>{t(" gian hàng · ")}<strong>{count(cleanListings)}</strong>{t(" SKU dùng để so sánh")}</p>
          <small>{overview.dateRange.dates}{t(" ngày quan sát. ")}{quality.flaggedProducts}{t(" SKU cần xác minh được loại khỏi tập so sánh.")}</small>
          <button onClick={() => navigate('quality')}>{t("Xem nguồn & kiểm tra ")}<ArrowRight size={12}/></button>
        </div>
        <div className="sidebar-status"><span className={`status-orb ${dataMode}`}><Database size={13} /></span><div><strong>{t(sourceLabel)}</strong><small>{snapshotTime ? t("Cập nhật {v0}", { v0: date(snapshotTime) }) : t("Đang lấy nguồn dữ liệu")}</small></div><MoreHorizontal size={16} /></div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label={t("Đóng menu")} />}

      <main className="mi-main">
        <header className="mi-topbar">
          <div className="topbar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label={t("Mở menu")} aria-expanded={sidebarOpen} aria-controls="workspace-navigation"><Menu size={19} /></button><div className="breadcrumb"><span>{t("Workspace")}</span><i>/</i><strong>{t(currentNav.label)}</strong></div></div>
          <label className="command-search"><Search size={15} /><input ref={searchRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && searchQuery.trim()) navigate('alerts'); }} placeholder={t("Tìm SKU hoặc gian hàng…")} aria-label={t("Tìm SKU hoặc gian hàng")}/><kbd><Command size={11} />{t(" K")}</kbd></label>
          <div className="topbar-actions">
            <div className="language-switch" role="group" aria-label={t("Language / Ngôn ngữ")}><button type="button" aria-pressed={locale === 'vi'} onClick={() => setLocale('vi')}>{t("VI")}</button><button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>{t("EN")}</button></div>
            <Tooltip><TooltipTrigger asChild><button className="icon-action" onClick={() => { api.invalidateSnapshot(country); setDataMode('loading'); setRefreshKey((value) => value + 1); }} aria-label={t("Làm mới dữ liệu")}><RefreshCw className={dataMode === 'loading' ? 'spin' : ''} size={15} /></button></TooltipTrigger><TooltipContent>{t("Làm mới dữ liệu")}</TooltipContent></Tooltip>
            {view !== 'planning' && view !== 'cashflow' && <span className="date-chip"><CalendarDays size={14} />{dateLabel(overview.dateRange.min_date)} — {dateLabel(overview.dateRange.max_date)}</span>}
            <span className="scope-chip"><Target size={13} />{t(" Mẫu đối thủ · Việt Nam")}</span>
          </div>
        </header>

        <div className="mi-content">
          <div className="decision-flow-strip" aria-label={t("Luồng quyết định MVP")}>
            <button className={`${view === 'alerts' ? 'active' : ''} ${alerts.length ? 'done' : ''}`} onClick={() => navigate('alerts')}><span>01</span><strong>{t("Tín hiệu")}</strong><small>{t("Biến động giá ≥10%")}</small></button>
            <i><ArrowRight size={14} /></i>
            <button className={`${view === 'matches' ? 'active' : ''} ${reviewedCount ? 'done' : ''}`} onClick={() => navigate('matches')}><span>02</span><strong>{t("So sánh SKU")}</strong><small>{reviewedCount ? t("{v0}/{v1} đã duyệt", { v0: approvedCount, v1: reviewedCount }) : t("Kiểm tra đúng sản phẩm")}</small></button>
            <i><ArrowRight size={14} /></i>
            <button className={`${view === 'pricing' && !scenarioCount ? 'active' : ''} ${scenarioCount ? 'done' : ''}`} onClick={() => navigate('pricing')}><span>03</span><strong>{t("Kiểm tra giá")}</strong><small>{t("Chi phí và biên lợi nhuận")}</small></button>
            <i><ArrowRight size={14} /></i>
            <button className={view === 'planning' ? 'active' : ''} onClick={() => navigate('planning')}><span>04</span><strong>{t("Lập kế hoạch")}</strong><small>{t("Hàng cần nhập và tiền cần có")}</small></button>
          </div>
          <div className="page-title-row"><div><div className="page-kicker"><CurrentIcon size={14} />{t(currentNav.description)}</div><h1>{t(currentNav.label)}</h1><p>{view === 'overview' ? t("Một màn hình để nhìn tín hiệu, hiểu nguyên nhân và chọn hành động.") : view === 'alerts' ? t("Ưu tiên biến động đáng chú ý thay vì phản ứng với mọi thay đổi giá.") : view === 'matches' ? t("Ghép đúng sản phẩm tương đương trước khi so giá và ra quyết định.") : view === 'pricing' ? t("Mô phỏng phản ứng giá mà không đánh đổi biên lợi nhuận.") : view === 'planning' ? t("So sánh giá, lợi nhuận và nhu cầu vốn từ lịch sử bán hàng của brand.") : view === 'cashflow' ? t("Theo dõi số dư, khoản thu–chi và tác động của kế hoạch nhập hàng.") : t("Đo độ tin cậy của dữ liệu trước khi dữ liệu đi vào quyết định.")}</p></div><div className="page-actions"><Badge variant={dataMode === 'live' ? 'success' : dataMode === 'error' ? 'danger' : 'warning'}><span className="badge-dot" />{t(sourceLabel)}</Badge><Button variant="outline" size="sm" onClick={exportBrief}><ExternalLink size={14} />{t(" Export brief")}</Button></div></div>
          {operationError && <div className="ps-message error" role="alert">{t(operationError)}</div>}
          {view === 'pricing' && JSON.stringify(pricingInput) !== JSON.stringify(committedPricingInput) && <div className="ps-message">{t("Dữ liệu đầu vào đã thay đổi. Kết quả phía dưới thuộc lần chạy trước; hãy chạy lại decision tree để cập nhật.")}</div>}

          <AnimatePresence mode="wait">
            <motion.section key={`${view}-${country}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .24, ease: 'easeOut' }}>
              {view === 'overview' && <OverviewView overview={overview} shops={shops} segments={segments} alerts={alerts} trend={trend} cleanListings={cleanListings} maxShopVolume={maxShopVolume} evidence={{ reviewed: reviewedCount, approved: approvedCount, scenarios: scenarioCount, catches: guardrailCatches, latencyMs: decisionLatencyMs }} onViewAlerts={() => navigate('alerts')} onPricing={() => navigate('pricing')} onMatch={matchAlert} onPlanning={() => navigate('planning')} onQuality={() => navigate('quality')} />}
              {view === 'alerts' && <AlertsView alerts={alerts} country={country} downAlerts={downAlerts} upAlerts={upAlerts} query={searchQuery} onMatch={matchAlert} />}
              {view === 'matches' && <MatchesView shops={shops} segments={segments} sourceShop={sourceShop} targetShop={targetShop} segment={segment} matches={matches} selected={selected} matching={matching} reviews={reviews} country={country} setSourceShop={(value) => { setSourceShop(value); if (value === targetShop) setTargetShop(''); setMatches([]); setSelected(null); }} setTargetShop={(value) => { setTargetShop(value); setMatches([]); setSelected(null); }} setSegment={(value) => { setSegment(value); setMatches([]); setSelected(null); }} setSelected={setSelected} runMatching={runMatching} onReview={reviewMatch} onPricing={sendToPricing} />}
              {view === 'pricing' && <PricingView country={country} input={pricingInput} result={pricing} simulating={simulating} setInput={setPricingInput} simulate={simulate} selected={selected && reviews[matchKey(selected)] === 'approved' ? selected : null} onPlan={openPlanning} />}
              {view === 'planning' && <ProfitPlanner seed={planningSeed} />}
              {view === 'cashflow' && <CashWorkspace />}
              {view === 'quality' && <QualityView quality={quality} overview={overview} country={country} />}
            </motion.section>
          </AnimatePresence>
        </div>
      </main>
      <FinancialAssistant view={view} />
    </div>
  </TooltipProvider>;
}

function NavButton({ item, active, badge, onClick }: { item: NavItem; active: boolean; badge?: number; onClick: () => void }) { const { t } = useLanguage();
  const Icon = item.icon;
  return <button type="button" className={`sidebar-nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}><span className="nav-icon"><Icon size={17} /></span><span><strong>{t(item.label)}</strong><small>{t(item.description)}</small></span>{badge !== undefined && <em>{badge}</em>}</button>;
}

function OverviewView({ overview, shops, segments, alerts, trend, cleanListings, maxShopVolume, evidence, onViewAlerts, onPricing, onMatch, onPlanning, onQuality }: { overview: Overview; shops: Shop[]; segments: Segment[]; alerts: Alert[]; trend: TrendPoint[]; cleanListings: number; maxShopVolume: number; evidence: { reviewed: number; approved: number; scenarios: number; catches: number; latencyMs: number | null }; onViewAlerts: () => void; onPricing: () => void; onMatch: (alert: Alert) => void; onPlanning: () => void; onQuality: () => void }) { const { t, money, count, compact, dateLabel, shortDate } = useLanguage();
  const alertRate = cleanListings ? overview.priceAlerts / cleanListings * 100 : 0;
  const shopSeries = shops.slice(0, 8).map((shop) => shop.sku_count).reverse();
  const salesSeries = shops.slice(0, 8).map((shop) => shop.monthly_sold).reverse();
  const metrics = [
    { label: 'SKU sạch trong mẫu', value: count(cleanListings), delta: `${(100 - overview.qualityFlags / Math.max(overview.trackedSkus, 1) * 100).toFixed(1)}% usable`, icon: PackageSearch, tone: 'blue', series: trend.map((point) => point.listings) },
    { label: 'Gian hàng theo dõi', value: String(overview.shops), delta: `${shops.filter((shop) => shop.is_official_shop).length} official stores`, icon: Store, tone: 'violet', series: shopSeries },
    { label: 'SKU biến động ≥10%', value: overview.priceAlerts.toLocaleString('vi-VN'), delta: `${alertRate.toFixed(1)}% clean universe`, icon: Activity, tone: 'coral', series: trend.map((point) => point.cuts + point.increases) },
    { label: 'Monthly sold signal', value: compact(overview.totalMonthlySold), delta: `${overview.classifiedCoverage}% đã phân loại`, icon: ShoppingBag, tone: 'gold', series: salesSeries },
  ];
  return <div className="view-stack">
    <DecisionShowcase onPlan={onPlanning} onSignals={onViewAlerts}/>
    <section className="work-agenda" aria-label={t("Việc cần xử lý")}><div className="agenda-heading"><div><span className="ps-eyebrow">{t("BẮT ĐẦU CA LÀM VIỆC")}</span><h2>{t("Việc cần xem trước khi quyết định giá")}</h2><p>{t("Từ mẫu quan sát đến ")}{dateLabel(overview.dateRange.max_date)}{t(" — không phải cảnh báo thời gian thực.")}</p></div><Badge variant="secondary">{t("Dữ liệu quan sát")}</Badge></div><div className="agenda-grid">{[...alerts].sort((a,b) => Math.abs(b.change_percent)-Math.abs(a.change_percent)).slice(0,3).map((alert) => <article key={`${alert.shop_id}-${alert.item_id}`}><span className={`agenda-change ${alert.direction}`}>{alert.change_percent > 0 ? '+' : ''}{alert.change_percent}%</span><h3>{alert.product_name}</h3><p>{alert.shop_name} · {dateLabel(alert.previous_date)} → {dateLabel(alert.date)}</p><div className="agenda-prices"><span>{money(alert.previous_price,overview.country)}</span><ArrowRight size={14}/><strong>{money(alert.price,overview.country)}</strong></div><small>{t("Đối thủ đổi giá. Cần xác nhận đúng sản phẩm và quy cách trước khi phản ứng; chưa có bằng chứng về tác động lên doanh thu.")}</small><Button variant="outline" size="sm" onClick={() => onMatch(alert)}>{t("Kiểm tra SKU tương đương ")}<ArrowRight size={14}/></Button></article>)}{!alerts.length && <p>{t("Chưa có biến động giá trong mẫu. Không cần tạo hành động khi chưa có tín hiệu.")}</p>}</div><div className="agenda-next"><button onClick={onQuality}><ShieldCheck size={17}/><span><strong>{overview.qualityFlags}{t(" SKU cần xác minh")}</strong><small>{t("Kiểm tra dữ liệu đã loại khỏi so sánh")}</small></span><ArrowRight size={15}/></button><button onClick={onPlanning}><Wallet size={17}/><span><strong>{t("Kiểm tra lợi nhuận & vốn của brand")}</strong><small>{t("Nhập lịch sử bán hàng và chi phí riêng")}</small></span><ArrowRight size={15}/></button></div></section>
    <details className="workspace-evidence"><summary>{t("Xem số liệu kiểm chứng phiên làm việc")}</summary>
    <div className="evidence-grid" aria-label={t("KPI kiểm chứng MVP")}>
      <EvidenceMetric label="Matching acceptance" value={evidence.reviewed ? `${Math.round(evidence.approved / evidence.reviewed * 100)}%` : t("Chưa có mẫu")} detail={t("{v0}/{v1} cặp được duyệt", { v0: evidence.approved, v1: evidence.reviewed })} />
      <EvidenceMetric label="Decision latency" value={evidence.latencyMs !== null ? `${(evidence.latencyMs / 1000).toFixed(2)}s` : t("Chưa đo")} detail="Từ Run matching đến khuyến nghị" />
      <EvidenceMetric label="Guardrail catch rate" value={evidence.scenarios ? `${Math.round(evidence.catches / evidence.scenarios * 100)}%` : t("Chưa có mẫu")} detail={t("{v0}/{v1} scenario chặn phản ứng naive", { v0: evidence.catches, v1: evidence.scenarios })} />
      <div className="scope-proof"><ShieldCheck size={18}/><div><strong>{t("Claim boundary")}</strong><p>{t("Mẫu đối thủ Việt Nam · ")}{overview.dateRange.dates}{t(" ngày quan sát · chưa suy ra market share hay causal uplift.")}</p></div></div>
    </div><Button variant="outline" size="sm" onClick={onPricing}>{t("Mở phương án giá")}</Button></details>

    <div className="metric-grid-v2">{metrics.map((metric, index) => <MetricCard key={t(metric.label)} {...metric} delay={index * .05} />)}</div>

    <div className="analytics-grid">
      <Card className="trend-card"><CardHeader><div><CardDescription>{t("TRACKED-SET MOMENTUM")}</CardDescription><CardTitle>{t("Chỉ số giá mẫu theo dõi")}</CardTitle></div><div className="chart-legend"><span><i className="gold" />{t(" Price index")}</span><span><i className="coral" />{t(" Price cuts")}</span></div></CardHeader><CardContent><div className="chart-summary"><div><span>{t("Latest index")}</span><strong>{trend.at(-1)?.priceIndex.toFixed(1) || '—'}</strong><Badge variant={(trend.at(-1)?.priceIndex || 100) < 100 ? 'warning' : 'success'}>{((trend.at(-1)?.priceIndex || 100) - 100).toFixed(1)}{t("% vs đầu kỳ")}</Badge></div><p>{t("Chỉ số chuẩn hóa từng SKU về 100 tại ngày đầu; đây là mô tả competitive set, không đại diện toàn thị trường.")}</p></div><div className="main-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 16, right: 10, left: -24, bottom: 0 }}><defs><linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3559a6" stopOpacity={.28}/><stop offset="95%" stopColor="#3559a6" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9ecf2" strokeDasharray="3 4"/><XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#8992a3' }} interval={3}/><YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#8992a3' }}/><ChartTooltip content={<MarketTooltip />}/><Bar dataKey="cuts" fill="#e3907f" radius={[3,3,0,0]} barSize={7} yAxisId="right" opacity={.55}/><YAxis yAxisId="right" orientation="right" hide/><Area type="monotone" dataKey="priceIndex" stroke="#3559a6" strokeWidth={2.5} fill="url(#priceArea)" dot={false} activeDot={{ r: 4, fill: '#d4a63f', stroke: '#fff', strokeWidth: 2 }}/></ComposedChart></ResponsiveContainer></div></CardContent></Card>
      <Card className="segment-card"><CardHeader><div><CardDescription>{t("ASSORTMENT MIX")}</CardDescription><CardTitle>{t("Cấu trúc danh mục")}</CardTitle></div><Button variant="ghost" size="icon"><MoreHorizontal size={17}/></Button></CardHeader><CardContent><div className="donut-wrap"><ResponsiveContainer width="100%" height={205}><PieChart><Pie data={segments.slice(0,6)} dataKey="count" nameKey="label" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">{segments.slice(0,6).map((item,index)=><Cell key={item.id} fill={chartColors[index % chartColors.length]}/>)}</Pie><ChartTooltip content={<SegmentTooltip total={cleanListings}/>} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{cleanListings}</strong><span>{t("clean SKU")}</span></div></div><div className="segment-legend">{segments.slice(0,5).map((item,index)=><div key={item.id}><span><i style={{background:chartColors[index]}}/>{t(item.label)}</span><strong>{item.count}</strong></div>)}</div></CardContent></Card>
    </div>

    <div className="lower-grid">
      <Card><CardHeader><div><CardDescription>{t("COMPETITOR LANDSCAPE")}</CardDescription><CardTitle>{t("Gian hàng dẫn đầu")}</CardTitle></div><Badge variant="secondary">{t("by monthly sold")}</Badge></CardHeader><CardContent className="shop-ranking">{shops.slice(0,6).map((shop,index)=><div className="shop-rank-row" key={shop.shop_id}><span className="rank-index">{String(index+1).padStart(2,'0')}</span><span className="shop-avatar">{shop.shop_name.slice(0,2).toUpperCase()}</span><div><strong>{shop.shop_name}</strong><small>{shop.sku_count}{t(" clean SKU ")}{shop.is_official_shop && '· Official'}</small></div><div className="rank-bar"><i style={{width:`${shop.monthly_sold/maxShopVolume*100}%`}}/></div><b>{compact(shop.monthly_sold)}</b></div>)}</CardContent></Card>
      <Card><CardHeader><div><CardDescription>{t("LATEST SNAPSHOT SIGNALS")}</CardDescription><CardTitle>{t("Biến động gần nhất")}</CardTitle></div><Button variant="ghost" size="sm" onClick={onViewAlerts}>{t("Xem tất cả ")}<ArrowRight size={13}/></Button></CardHeader><CardContent className="mini-alert-list">{alerts.slice(0,5).map((alert)=><button key={`${alert.shop_id}-${alert.item_id}`} onClick={onViewAlerts}><span className={`signal-icon ${alert.direction}`}>{alert.direction==='down'?<TrendingDown size={15}/>:<TrendingUp size={15}/>}</span><span><strong>{alert.product_name}</strong><small>{alert.shop_name} · {dateLabel(alert.date)}</small></span><Badge variant={badgeForSeverity(alert.severity)}>{alert.change_percent>0?'+':''}{alert.change_percent}%</Badge></button>)}</CardContent></Card>
    </div>
  </div>;
}

function MetricCard({ label, value, delta, icon: Icon, tone, series, delay }: { label: string; value: string; delta: string; icon: LucideIcon; tone: string; series: number[]; delay: number }) { const { t } = useLanguage();
  const min = Math.min(...series, 0); const max = Math.max(...series, 1); const bars = series.slice(-10).map((value) => 22 + (value - min) / Math.max(max - min, 1) * 78);
  return <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay}}><Card className={`metric-card-v2 ${tone}`}><CardContent><div className="metric-top"><span className="metric-icon"><Icon size={17}/></span><Tooltip><TooltipTrigger asChild><button aria-label={t("Giải thích {v0}", { v0: label })}><Info size={13}/></button></TooltipTrigger><TooltipContent>{t(delta)}</TooltipContent></Tooltip></div><span className="metric-label">{t(label)}</span><div className="metric-value-row"><strong>{value}</strong><div className="mini-spark">{bars.map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div></div><small>{t(delta)}</small></CardContent></Card></motion.div>;
}

function AlertsView({ alerts, country, downAlerts, upAlerts, query, onMatch }: { alerts: Alert[]; country: Country; downAlerts: number; upAlerts: number; query: string; onMatch: (alert?: Alert) => void }) { const { t, money, compact, dateLabel } = useLanguage();
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
      <SummaryStat icon={TrendingDown} label={t("Giảm giá")} value={downAlerts} tone="coral" detail="Cần kiểm tra SKU tương đương"/>
      <SummaryStat icon={TrendingUp} label={t("Tăng giá")} value={upAlerts} tone="green" detail="Cơ hội phục hồi margin"/>
      <SummaryStat icon={AlertTriangle} label="Critical signals" value={critical} tone="gold" detail="Biến động tuyệt đối ≥30%"/>
      <SummaryStat icon={Activity} label={t("Queue hiện tại")} value={visible.length} tone="blue" detail={normalized ? t("Kết quả cho “{v0}”", { v0: query }) : t("Đã loại gift & placeholder")}/>
    </div>
    <Card className="data-card">
      <CardHeader><div><CardDescription>{t("PRIORITY QUEUE")}</CardDescription><CardTitle>{visible.length}{t(" tín hiệu đang hiển thị")}</CardTitle></div><div className="table-actions"><Badge variant="outline"><Filter size={13}/> {filter === 'all' ? 'All signals' : filter}</Badge><Button size="sm" onClick={() => onMatch()}><ScanSearch size={13}/>{t(" Mở matching")}</Button></div></CardHeader>
      <div className="filter-pills">{filters.map(([id, label, count]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{t(label)} <span>{count}</span></button>)}</div>
      <div className="enterprise-table-wrap"><table className="enterprise-table"><thead><tr><th>{t("Tín hiệu")}</th><th>{t("Sản phẩm / Gian hàng")}</th><th>{t("Giá trước")}</th><th>{t("Giá mới")}</th><th>{t("Biến động")}</th><th>{t("Sold")}</th><th></th></tr></thead><tbody>
        {visible.length ? visible.map((alert)=><tr key={`${alert.shop_id}-${alert.item_id}`}><td><span className={`signal-icon ${alert.direction}`}>{alert.direction==='down'?<ArrowDownRight size={15}/>:<ArrowUpRight size={15}/>}</span></td><td className="product-cell"><strong>{alert.product_name}</strong><small>{alert.shop_name} · {dateLabel(alert.date)}</small></td><td className="muted-value">{money(alert.previous_price,country)}</td><td><strong>{money(alert.price,country)}</strong></td><td><Badge variant={badgeForSeverity(alert.severity)}>{alert.change_percent>0?'+':''}{alert.change_percent}%</Badge></td><td>{compact(alert.monthly_sold)}</td><td><button className="row-action" onClick={() => onMatch(alert)} aria-label={t("Tìm SKU tương đương với {v0}", { v0: alert.product_name })}><ArrowRight size={15}/></button></td></tr>) : <tr><td colSpan={7}><EmptyState icon={Search} title={t("Không tìm thấy tín hiệu")} body={t("Thử từ khóa hoặc bộ lọc khác.")}/></td></tr>}
      </tbody></table></div>
    </Card>
  </div>;
}

function MatchesView({ shops, segments, sourceShop, targetShop, segment, matches, selected, matching, reviews, country, setSourceShop, setTargetShop, setSegment, setSelected, runMatching, onReview, onPricing }: { shops: Shop[]; segments: Segment[]; sourceShop: string; targetShop: string; segment: string; matches: Match[]; selected: Match|null; matching: boolean; reviews: Record<string, ReviewDecision>; country: Country; setSourceShop:(value:string)=>void; setTargetShop:(value:string)=>void; setSegment:(value:string)=>void; setSelected:(match:Match)=>void; runMatching:()=>void; onReview:(match:Match, decision:ReviewDecision)=>void; onPricing:(match:Match)=>void }) { const { t, money } = useLanguage();
  return <div className="view-stack">
    <Card className="match-control-card"><CardContent>
      <div className="control-intro"><span className="control-icon"><Zap size={20}/></span><div><strong>{t("Explainable matching MVP")}</strong><p>{MATCHING_WEIGHTS.name}{t("% tên · ")}{MATCHING_WEIGHTS.keyword}{t("% từ khóa · ")}{MATCHING_WEIGHTS.pack}{t("% pack/size · ngưỡng route 75%")}</p></div></div>
      <div className="match-controls">
        <Field label={t("Gian hàng của ta")}><select aria-label={t("Gian hàng của ta")} disabled={matching} value={sourceShop} onChange={(e)=>setSourceShop(e.target.value)}>{shops.map((shop)=><option value={shop.shop_id} key={shop.shop_id}>{shop.shop_name}</option>)}</select></Field>
        <span className="control-arrow"><ArrowRight size={16}/></span>
        <Field label={t("Đối thủ")}><select aria-label={t("Đối thủ")} disabled={matching} value={targetShop} onChange={(e)=>setTargetShop(e.target.value)}><option value="">{t("Tất cả đối thủ")}</option>{shops.filter((shop)=>shop.shop_id!==sourceShop).map((shop)=><option value={shop.shop_id} key={shop.shop_id}>{shop.shop_name}</option>)}</select></Field>
        <Field label={t("Phân khúc")}><select aria-label={t("Phân khúc")} disabled={matching} value={segment} onChange={(e)=>setSegment(e.target.value)}><option value="">{t("Tất cả")}</option>{segments.filter((item)=>item.id!=='other').map((item)=><option value={item.id} key={item.id}>{t(item.label)}</option>)}</select></Field>
        <Button onClick={runMatching} disabled={matching || !sourceShop}>{matching?<RefreshCw className="spin" size={15}/>:<ScanSearch size={15}/>} {matching?t("Đang tính điểm"):'Run matching'}</Button>
      </div>
      <div className="model-boundary"><Info size={14}/><p>{t("MVP đang chạy taxonomy rules + character similarity. Embedding/LLM là tầng tiếp theo; cặp dưới 75% được route sang review tăng cường, không giả lập kết quả AI.")}</p></div>
    </CardContent></Card>
    <div className="matching-workspace">
      <Card className="match-results"><CardHeader><div><CardDescription>{t("RANKED CANDIDATES")}</CardDescription><CardTitle>{matches.length}{t(" cặp đề xuất")}</CardTitle></div><Badge variant="secondary">{t("Human-in-the-loop")}</Badge></CardHeader><CardContent>{matches.length?<div className="candidate-list">{matches.map((match,index)=>{const decision=reviews[matchKey(match)]; return <button key={`${match.source.item_id}-${match.candidate.item_id}-${index}`} className={`${selected===match?'active':''} review-${decision||'pending'}`} onClick={()=>setSelected(match)}><ScoreRing score={match.scoring.confidence} band={match.scoring.band}/><span className="candidate-copy"><strong>{match.source.product_name}</strong><i><Link2 size={11}/> {match.candidate.product_name}</i><small>{decision==='approved'?t("Đã duyệt"):decision==='rejected'?t("Đã từ chối"):`${match.source.shop_name} ↔ ${match.candidate.shop_name}`}</small></span><span className="candidate-price"><strong>{money(match.source.price,country)}</strong><small>{money(match.candidate.price,country)}</small></span><ArrowRight size={14}/></button>})}</div>:<EmptyState icon={ScanSearch} title={t("Sẵn sàng tính trên snapshot Việt Nam")} body={t("Chọn hai gian hàng hoặc một phân khúc rồi chạy matching.")}/>}</CardContent></Card>
      <Card className="match-inspector">{selected?<MatchInspector match={selected} country={country} reviewStatus={reviews[matchKey(selected)]} onReview={(decision)=>onReview(selected,decision)} onPricing={()=>onPricing(selected)}/>:<EmptyState icon={PackageSearch} title={t("Chưa chọn cặp SKU")} body={t("Điểm thành phần và bằng chứng sẽ xuất hiện sau khi chạy matching.")}/>}</Card>
    </div>
  </div>;
}

function MatchInspector({ match, country, reviewStatus, onReview, onPricing }: { match: Match; country: Country; reviewStatus?: ReviewDecision; onReview:(decision:ReviewDecision)=>void; onPricing:()=>void }) { const { t, money } = useLanguage();
  const enhancedReview = match.scoring.confidence < 75;
  return <><CardHeader className="inspector-head"><div><CardDescription>{t("MATCH INSPECTOR")}</CardDescription><CardTitle>{t("Evidence review")}</CardTitle></div><Badge variant={reviewStatus==='approved'?'success':reviewStatus==='rejected'?'danger':match.scoring.band==='high'?'success':match.scoring.band==='review'?'warning':'secondary'}>{reviewStatus==='approved'?t("Đã duyệt"):reviewStatus==='rejected'?t("Đã từ chối"):t(bandLabel(match.scoring.band))}</Badge></CardHeader><CardContent>
    <div className="inspector-score"><ScoreRing score={match.scoring.confidence} band={match.scoring.band} large/><div><strong>{match.scoring.confidence}{t("/100 điểm tương đồng")}</strong><p>{t("Điểm theo quy tắc, không phải xác suất đúng. Người dùng cần xác nhận.")}</p></div></div>
    <div className={`routing-note ${enhancedReview?'review':'ready'}`}><Sparkles size={14}/><div><strong>{enhancedReview?t('Route: enhanced review'):t('Route: review nhanh')}</strong><p>{enhancedReview?t("Dưới ngưỡng 75%. Production sẽ gọi embedding/LLM fallback trước khi người dùng quyết định."):t("Đạt ngưỡng 75%, nhưng Category Manager vẫn là người phê duyệt cuối.")}</p></div></div>
    <div className="product-compare-v2"><ProductCard title={t("SKU của ta")} product={match.source} country={country}/><span className="versus-chip">{t("VS")}</span><ProductCard title={t("SKU đối thủ")} product={match.candidate} country={country}/></div>
    <div className="sku-facts"><span className="ps-eyebrow">{t("ĐỐI CHIẾU TRƯỚC KHI DUYỆT")}</span><table><thead><tr><th>{t("Thông tin")}</th><th>{t("SKU nguồn")}</th><th>{t("SKU đối thủ")}</th></tr></thead><tbody><tr><th>{t("Thương hiệu")}</th><td>{match.source.brand || t("Chưa có dữ liệu")}</td><td>{match.candidate.brand || t("Chưa có dữ liệu")}</td></tr><tr><th>{t("Số món trong gói*")}</th><td>{match.scoring.sourcePack.packCount ?? t("Chưa nhận diện")}</td><td>{match.scoring.candidatePack.packCount ?? t("Chưa nhận diện")}</td></tr><tr><th>{t("Tổng size nhận diện*")}</th><td>{match.scoring.sourcePack.totalSize ?? t("Chưa nhận diện")}</td><td>{match.scoring.candidatePack.totalSize ?? t("Chưa nhận diện")}</td></tr><tr><th>{t("Giá niêm yết quan sát")}</th><td>{money(match.source.price,country)}</td><td>{money(match.candidate.price,country)}</td></tr></tbody></table><p>{t("*Trích từ tên bằng quy tắc. Cần kiểm tra đơn vị g/ml, biến thể và combo từ thông tin sản phẩm; giá chưa được chuẩn hóa theo đơn vị.")}</p><div className="sku-gap"><strong>{((match.source.price / Math.max(match.candidate.price,1) - 1)*100).toFixed(1)}%</strong><span>{t("Chênh lệch giá nguồn so với đối thủ · chỉ có ý nghĩa sau khi xác nhận tương đương. Không cho biết mức giá nào tối ưu.")}</span></div></div>
    <div className="score-bars"><ScoreBar label={t("Tên sản phẩm")} score={match.scoring.textScore}/><ScoreBar label={t("Từ khóa")} score={match.scoring.tokenScore}/><ScoreBar label="Pack / size" score={match.scoring.packScore}/></div>
    <div className="evidence-box"><strong>{t("Giải thích mô hình")}</strong>{match.scoring.reasons.map((reason)=><p key={t(reason)}><Check size={13}/>{t(reason)}</p>)}{match.scoring.warnings.map((warning)=><p className="warning" key={t(warning)}><AlertTriangle size={13}/>{t(warning)}</p>)}</div>
    <div className="review-actions"><button className={reviewStatus==='rejected'?'active reject':''} onClick={()=>onReview('rejected')} aria-pressed={reviewStatus==='rejected'}><X size={14}/>{t(" Không tương đương")}</button><button className={reviewStatus==='approved'?'active approve':''} onClick={()=>onReview('approved')} aria-pressed={reviewStatus==='approved'}><Check size={14}/>{t(" Xác nhận match")}</button></div>
    <Button className="full-button" disabled={reviewStatus!=='approved'} onClick={onPricing}><CircleDollarSign size={15}/> {reviewStatus==='approved'?t("Đưa cặp đã duyệt vào Pricing Lab"):t("Cần xác nhận match trước")} <ArrowRight size={14}/></Button>
  </CardContent></>;
}

function PricingView({ country, input, result, simulating, setInput, simulate, selected, onPlan }: { country: Country; input: PricingInput; result: PricingResult; simulating: boolean; setInput:(value:PricingInput)=>void; simulate:(event:FormEvent)=>void; selected:Match|null; onPlan:()=>void }) { const { t, money } = useLanguage();
  const scale = Math.max(result.competitorEffective, result.recommendedPrice, result.marginFloor, input.ourPrice, 1);
  const floorRatio=Math.min(100,result.marginFloor/scale*100); const priceRatio=Math.min(100,result.recommendedPrice/scale*100); const competitorRatio=Math.min(100,result.competitorEffective/scale*100);
  return <div className="pricing-grid">
    <Card className="scenario-panel"><CardHeader><div><CardDescription>{t("SCENARIO INPUTS")}</CardDescription><CardTitle>{t("Effective price & economics")}</CardTitle></div><Badge variant="outline">{t("Interactive")}</Badge></CardHeader><CardContent><form onSubmit={simulate}>
      <div className="scenario-context">{selected?<><span><Link2 size={13}/></span><div><strong>{t("Cặp SKU đã được duyệt")}</strong><p>{selected.source.product_name.slice(0,42)}… ↔ {selected.candidate.product_name.slice(0,42)}…</p></div></>:<><span><Info size={13}/></span><div><strong>{t("Scenario độc lập")}</strong><p>{t("Dùng để kiểm thử decision tree; chưa tự động thay đổi giá thật.")}</p></div></>}</div>
      <div className="form-group"><span>{t("PRICE SIGNAL")}</span><div className="input-grid"><NumberField label={t("Giá niêm yết của ta")} value={input.ourPrice} onChange={(v)=>setInput({...input,ourPrice:v})}/><NumberField label={t("Giá đối thủ pre-promo")} value={input.competitorPrice} onChange={(v)=>setInput({...input,competitorPrice:v})}/><NumberField label={t("Đối thủ thay đổi (%)")} value={input.competitorChangePercent} onChange={(v)=>setInput({...input,competitorChangePercent:v})}/><NumberField label={t("Voucher đối thủ (%)")} value={input.competitorVoucherPercent} onChange={(v)=>setInput({...input,competitorVoucherPercent:v})}/></div></div>
      <div className="form-group"><span>{t("PRICE-POSITION POLICY")}</span><div className="input-grid policy-inputs"><Field label={t("Vai trò SKU")}><select value={input.skuRole} onChange={(event)=>setInput({...input,skuRole:event.target.value as PricingInput['skuRole']})}><option value="traffic">{t("Traffic driver")}</option><option value="core">{t("Core SKU")}</option><option value="margin">{t("Margin driver")}</option></select></Field><NumberField label={t("Ngưỡng hành động (%)")} value={input.gapThresholdPercent} onChange={(v)=>setInput({...input,gapThresholdPercent:v})}/><NumberField label="Undercut traffic SKU (%)" value={input.undercutPercent} onChange={(v)=>setInput({...input,undercutPercent:v})}/></div></div>
      <div className="form-group"><span>{t("UNIT ECONOMICS")}</span><div className="input-grid"><NumberField label="COGS (%)" value={input.cogsPercent} onChange={(v)=>setInput({...input,cogsPercent:v})}/><NumberField label="Target margin (%)" value={input.targetMarginPercent} onChange={(v)=>setInput({...input,targetMarginPercent:v})}/><NumberField label={t("Phí sàn (%)")} value={input.platformFeePercent} onChange={(v)=>setInput({...input,platformFeePercent:v})}/><NumberField label={t("Voucher của ta (%)")} value={input.voucherPercent} onChange={(v)=>setInput({...input,voucherPercent:v})}/><NumberField label="Shipping subsidy (%)" value={input.shippingPercent} onChange={(v)=>setInput({...input,shippingPercent:v})}/><NumberField label="Return/refund (%)" value={input.returnRatePercent} onChange={(v)=>setInput({...input,returnRatePercent:v})}/><NumberField label="Ads spend (%)" value={input.adsSpendPercent} onChange={(v)=>setInput({...input,adsSpendPercent:v})}/><NumberField label="Campaign/trade spend (%)" value={input.campaignSpendPercent} onChange={(v)=>setInput({...input,campaignSpendPercent:v})}/><NumberField label={t("Bao bì/combo (đ)")} value={input.packagingCost} onChange={(v)=>setInput({...input,packagingCost:v})}/></div></div>
      <Button className="full-button" disabled={simulating}>{simulating?<RefreshCw className="spin" size={15}/>:<Gauge size={15}/>} {simulating?t("Đang mô phỏng"):t("Chạy decision tree")}</Button>
    </form></CardContent></Card>

    <Card className={`recommendation-panel action-${result.action.toLowerCase()}`}><div className="recommendation-glow"/><CardContent>
      <div className="recommendation-top"><div><Badge variant={result.reviewRequired?'warning':'outline'}><Sparkles size={12}/> {result.reviewRequired?t('HUMAN REVIEW REQUIRED'):t('DECISION SUPPORT')}</Badge><h2>{t(result.headline)}</h2><p>{t(result.rationale)}</p></div><span className="action-seal"><ShieldCheck size={24}/><b>{t(result.action)}</b></span></div>
      <div className="decision-tree"><span>{t("DECISION TREE")}</span>{result.decisionSteps.map((step,index)=><div className={step.status} key={t(step.label)}><i>{index}</i><p><strong>{t(step.label)}</strong><small>{t(step.outcome)}</small></p>{step.status==='passed'?<Check size={14}/>:step.status==='stopped'?<ShieldCheck size={14}/>:<MoreHorizontal size={14}/>}</div>)}</div>
      <div className="price-decision"><span>{t("Giá hệ thống đề xuất")}</span><strong>{money(result.recommendedPrice,country)}</strong><small>{result.recommendedPrice===input.ourPrice?t("Giữ nguyên giá; không auto-execute"):t("{v0}% so với hiện tại · chờ Category Manager duyệt", { v0: ((result.recommendedPrice/input.ourPrice-1)*100).toFixed(1) })}</small></div>
      <div className="decision-metric-grid five"><ResultMetric label={t("Giá ta sau voucher")} value={money(result.ourEffective,country)} icon={CircleDollarSign}/><ResultMetric label={t("Đối thủ effective")} value={money(result.competitorEffective,country)} icon={Target}/><ResultMetric label="Margin floor" value={money(result.marginFloor,country)} icon={ShieldCheck}/><ResultMetric label={t("Biên hiện tại")} value={`${result.currentMarginPercent}%`} icon={ChartNoAxesCombined}/><ResultMetric label="Price gap" value={`${result.currentPriceGapPercent}%`} icon={Activity}/></div>
      <div className="price-rail"><div className="rail-labels"><span>0</span><span>{t("Giá sàn")}</span><span>{t("Giá đề xuất")}</span><span>{t("Đối thủ effective")}</span></div><div className="rail-track"><i className="safe-zone" style={{left:`${floorRatio}%`}}/><b className="floor-pin" style={{left:`${floorRatio}%`}}/><b className="price-pin" style={{left:`${priceRatio}%`}}/><b className="competitor-pin" style={{left:`${competitorRatio}%`}}/></div><div className="rail-caption"><span><i/>{t(" Vùng phá margin")}</span><span><i/>{t(" Vùng có thể hành động")}</span></div></div>
      {(result.action==='DEFEND_MARGIN'||result.action==='HUMAN_REVIEW')&&<div className="lever-list"><strong>{t("Non-price levers")}</strong>{result.nonPriceLevers.map((lever)=><span key={t(lever)}><Check size={12}/>{t(lever)}</span>)}</div>}
      <div className="guardrail-note"><ShieldCheck size={18}/><div><strong>{t("Owner: ")}{result.actionOwner}</strong><p>{t("Hệ thống chỉ hỗ trợ quyết định. Không tự tăng giá, không tự giảm giá và không tự thực thi promotion.")}</p></div></div>
      <div className="assumption-list">{result.assumptions.map((assumption)=><span key={t(assumption)}><Info size={11}/>{t(assumption)}</span>)}</div>
      <div className="ps-planning-cta"><p>{t("Giá phù hợp có cần thêm vốn? Chuyển phương án này sang lịch sử bán hàng của brand để lập kế hoạch tồn kho và tiền mặt.")}</p><Button onClick={onPlan}>{t("Lập kế hoạch vốn ")}<ArrowRight size={14}/></Button></div>
    </CardContent></Card>
  </div>;
}

function QualityView({ quality, overview, country }: { quality: Quality; overview: Overview; country: Country }) { const { t, money } = useLanguage();
  const clean=Math.max(0,quality.totalProducts-quality.flaggedProducts); const cleanRate=quality.totalProducts?clean/quality.totalProducts*100:100;
  return <div className="view-stack"><div className="quality-hero"><div className="quality-gauge" style={{'--quality':`${cleanRate*3.6}deg`} as CSSProperties}><span><strong>{cleanRate.toFixed(1)}%</strong><small>{t("usable data")}</small></span></div><div><Badge variant="success"><BadgeCheck size={12}/>{t(" TRUST LAYER ACTIVE")}</Badge><h2>{t("Dữ liệu sạch trước, quyết định sau.")}</h2><p>{quality.flaggedProducts}{t(" trong ")}{quality.totalProducts}{t(" listing bị cô lập khỏi matching và benchmark. Coverage phân loại trên tập sạch đạt ")}{overview.classifiedCoverage}%.</p></div><div className="quality-checks"><p><Check size={14}/>{t(" Placeholder price filter")}</p><p><Check size={14}/>{t(" Gift & giveaway detection")}</p><p><Check size={14}/>{t(" Promotion orphan audit")}</p></div></div><div className="summary-strip"><SummaryStat icon={Database} label="Raw listings" value={quality.totalProducts} tone="blue" detail="Catalog mới nhất"/><SummaryStat icon={BadgeCheck} label="Clean listings" value={clean} tone="green" detail={`${cleanRate.toFixed(1)}% usable`}/><SummaryStat icon={AlertTriangle} label="Quarantined" value={quality.flaggedProducts} tone="coral" detail="Không dùng để benchmark"/><SummaryStat icon={Link2} label="Orphan rows" value={quality.orphanPromotionRows} tone="gold" detail="Promotion không có catalog"/></div><Card className="data-card"><CardHeader><div><CardDescription>{t("QUARANTINE LOG")}</CardDescription><CardTitle>{t("Listing cần xác minh")}</CardTitle></div><Badge variant="warning">{quality.flaggedProducts}{t(" flags")}</Badge></CardHeader><div className="enterprise-table-wrap"><table className="enterprise-table"><thead><tr><th>{t("Severity")}</th><th>{t("Rule")}</th><th>{t("Sản phẩm")}</th><th>{t("Gian hàng")}</th><th>{t("Giá ghi nhận")}</th><th>{t("Disposition")}</th></tr></thead><tbody>{quality.issues.length?quality.issues.map((issue)=><tr key={`${issue.item_id}-${issue.type}`}><td><Badge variant={issue.severity==='critical'?'danger':'warning'}>{issue.severity}</Badge></td><td><code>{issue.type}</code></td><td className="product-cell"><strong>{issue.product_name}</strong><small>{t("Item ID · ")}{issue.item_id}</small></td><td>{issue.shop_name}</td><td><strong>{money(issue.price,country)}</strong></td><td><span className="quarantine-status"><ShieldCheck size={13}/>{t(" Excluded")}</span></td></tr>):<tr><td colSpan={6}><EmptyState icon={BadgeCheck} title={t("Không có lỗi")} body={t("Tập dữ liệu hiện vượt qua các quy tắc kiểm tra.")}/></td></tr>}</tbody></table></div></Card></div>;
}

function SummaryStat({ icon:Icon,label,value,tone,detail }: { icon:LucideIcon;label:string;value:number;tone:string;detail:string }) { const { t, count } = useLanguage(); return <Card className={`summary-stat ${tone}`}><CardContent><span><Icon size={17}/></span><div><small>{t(label)}</small><strong>{count(value)}</strong><p>{t(detail)}</p></div></CardContent></Card>; }
function EvidenceMetric({label,value,detail}:{label:string;value:string;detail:string}) { const { t } = useLanguage(); return <div className="evidence-metric"><span>{t(label)}</span><strong>{value}</strong><small>{t(detail)}</small></div>; }
function Field({label,children}:{label:string;children:ReactNode}) { const { t } = useLanguage(); return <label className="form-field"><span>{t(label)}</span>{children}</label>; }
function NumberField({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) { return <Field label={label}><input type="number" value={value} onChange={(e)=>onChange(Number(e.target.value))}/></Field>; }
function ScoreRing({score,band,large=false}:{score:number;band:Match['scoring']['band'];large?:boolean}) { return <span className={`score-ring-v2 ${band} ${large?'large':''}`} style={{'--score':`${score*3.6}deg`} as CSSProperties}><b>{score}</b><small>%</small></span>; }
function ScoreBar({label,score}:{label:string;score:number}) { const { t } = useLanguage(); return <div><span>{t(label)}<b>{score}%</b></span><i><em style={{width:`${score}%`}}/></i></div>; }
function ProductCard({title,product,country}:{title:string;product:Match['source'];country:Country}) { const { t, money, compact } = useLanguage(); return <article className="product-card-v2">{product.image_url?<img src={product.image_url} alt="" /* eslint-disable-line @next/next/no-img-element */ />:<span className="product-fallback"><PackageSearch size={22}/></span>}<small>{t(title)}</small><strong>{product.product_name}</strong><b>{money(product.price,country)}</b><p>{compact(product.monthly_sold)}{t(" sold · ★ ")}{product.rating||'—'}</p></article>; }
function ResultMetric({label,value,icon:Icon}:{label:string;value:string;icon:LucideIcon}) { const { t } = useLanguage(); return <div><span><Icon size={13}/>{t(label)}</span><strong>{value}</strong></div>; }
function EmptyState({icon:Icon,title,body}:{icon:LucideIcon;title:string;body:string}) { const { t } = useLanguage(); return <div className="empty-state-v2"><span><Icon size={25}/></span><strong>{t(title)}</strong><p>{t(body)}</p></div>; }
function MarketTooltip({active,payload,label}:{active?:boolean;payload?:Array<{name:string;value:number;color:string}>;label?:string}) { const { t, dateLabel } = useLanguage(); if(!active||!payload?.length)return null; return <div className="chart-tooltip"><strong>{label?dateLabel(label):''}</strong>{payload.map((item)=><span key={item.name}><i style={{background:item.color}}/>{t(item.name==='priceIndex'?'Price index':'Price cuts')}<b>{item.value}</b></span>)}</div>; }
function SegmentTooltip({active,payload,total}:{active?:boolean;payload?:Array<{name:string;value:number}>;total:number}) { const { t } = useLanguage(); if(!active||!payload?.length)return null; const item=payload[0]; return <div className="chart-tooltip"><strong>{item.name}</strong><span>{t("SKU ")}<b>{item.value}</b></span><span>{t("Tỷ trọng ")}<b>{(item.value/Math.max(total,1)*100).toFixed(1)}%</b></span></div>; }
