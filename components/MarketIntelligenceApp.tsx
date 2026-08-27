'use client';

import { FormEvent, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BellRing,
  CalendarDays, ChartNoAxesCombined, Check, ChevronDown, CircleDollarSign, Command, Database,
  ExternalLink, Filter, FlaskConical, Gauge, Info, LayoutDashboard, Link2, Menu,
  MoreHorizontal, PackageSearch, RefreshCw, ScanSearch, Search, ShieldCheck, ShoppingBag,
  Sparkles, Store, Target, TrendingDown, TrendingUp, X, Zap, type LucideIcon,
} from 'lucide-react';
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { MATCHING_WEIGHTS, simulatePricingLocally } from '@/lib/engines';
import type { Alert, Country, Match, Overview, PricingInput, PricingResult, Quality, Segment, Shop, TrendPoint } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type View = 'overview' | 'alerts' | 'matches' | 'pricing' | 'quality';
type NavItem = { id: View; label: string; description: string; icon: LucideIcon };

const nav: NavItem[] = [
  { id: 'overview', label: 'Tổng quan', description: 'Market pulse', icon: LayoutDashboard },
  { id: 'alerts', label: 'Cảnh báo', description: 'Price watch', icon: BellRing },
  { id: 'matches', label: 'SKU Matching', description: 'Comparable products', icon: ScanSearch },
  { id: 'pricing', label: 'Pricing Lab', description: 'Decision guardrail', icon: FlaskConical },
  { id: 'quality', label: 'Data Quality', description: 'Trust layer', icon: ShieldCheck },
];
const defaultPricing: PricingInput = { ourPrice: 62000, competitorPrice: 110000, competitorChangePercent: -30, cogsPercent: 55, targetMarginPercent: 15, platformFeePercent: 8, voucherPercent: 0, shippingPercent: 0, undercutPercent: 2 };
const chartColors = ['#b8f34a', '#65c7ff', '#47d7a1', '#ff765f', '#a98cff', '#ffd166', '#7f8fa1'];
const emptyOverview: Overview = { country: 'vn', trackedSkus: 0, shops: 0, classifiedCoverage: 0, priceAlerts: 0, qualityFlags: 0, totalMonthlySold: 0, dateRange: { min_date: '', max_date: '', dates: 0 }, topShops: [], segments: [] };
const emptyQuality: Quality = { country: 'vn', totalProducts: 0, flaggedProducts: 0, orphanPromotionRows: 0, issues: [] };

function compact(value: number) { return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0); }
function money(value: number, country: Country) { const formatted = new Intl.NumberFormat(country === 'vn' ? 'vi-VN' : 'id-ID', { maximumFractionDigits: 0 }).format(value || 0); return country === 'vn' ? `${formatted}đ` : `Rp${formatted}`; }
function dateLabel(value?: string) { if (!value) return '—'; const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function shortDate(value: string) { const [, month, day] = value.split('-'); return `${day}/${month}`; }
function bandLabel(band: Match['scoring']['band']) { return band === 'high' ? 'Tin cậy cao' : band === 'review' ? 'Cần review' : 'Tin cậy thấp'; }
function badgeForSeverity(value: string): 'danger' | 'warning' | 'secondary' { return value === 'critical' ? 'danger' : value === 'warning' ? 'warning' : 'secondary'; }

export default function MarketIntelligenceApp() {
  const [view, setView] = useState<View>('overview');
  const [country, setCountry] = useState<Country>('vn');
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
  const [pricingInput, setPricingInput] = useState<PricingInput>(defaultPricing);
  const [pricing, setPricing] = useState<PricingResult>(() => simulatePricingLocally(defaultPricing));
  const [simulating, setSimulating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, []);

  useEffect(() => {
    let current = true;
    Promise.all([api.health(), api.snapshotMeta(country), api.overview(country), api.shops(country), api.segments(country), api.alerts(country), api.quality(country), api.trend(country)])
      .then(([health, meta, overviewData, shopData, segmentData, alertData, qualityData, trendData]) => {
        if (!current) return;
        setOverview(overviewData); setShops(shopData); setSegments(segmentData); setAlerts(alertData); setQuality(qualityData); setTrend(trendData);
        setSnapshotTime(meta.generatedAt);
        setDataMode(health.status === 'ok' ? 'live' : 'snapshot');
        const sourceHint = country === 'vn' ? /kinh do/i : /glad|azarine|scora/i;
        const targetHint = country === 'vn' ? /orion/i : /scora|zoicy/i;
        const source = shopData.find((shop) => sourceHint.test(shop.shop_name)) || shopData[0];
        const target = shopData.find((shop) => shop.shop_id !== source?.shop_id && targetHint.test(shop.shop_name)) || shopData.find((shop) => shop.shop_id !== source?.shop_id);
        setSourceShop(source?.shop_id || ''); setTargetShop(target?.shop_id || ''); setMatches([]); setSelected(null);
      })
      .catch(() => { if (current) setDataMode('error'); });
    return () => { current = false; };
  }, [country, refreshKey]);

  const currentNav = nav.find((item) => item.id === view) || nav[0];
  const CurrentIcon = currentNav.icon;
  const maxShopVolume = useMemo(() => Math.max(...shops.map((shop) => shop.monthly_sold), 1), [shops]);
  const cleanListings = Math.max(0, overview.trackedSkus - overview.qualityFlags);
  const downAlerts = alerts.filter((alert) => alert.direction === 'down').length;
  const upAlerts = alerts.filter((alert) => alert.direction === 'up').length;
  const cleanRate = overview.trackedSkus ? cleanListings / overview.trackedSkus * 100 : 0;
  const trustScore = Math.round(cleanRate * .45 + overview.classifiedCoverage * .55);
  const sourceLabel = dataMode === 'live' ? 'Live RDS' : dataMode === 'snapshot' ? 'RDS snapshot' : dataMode === 'loading' ? 'Syncing' : 'Unavailable';

  async function runMatching() {
    if (!sourceShop) return;
    setMatching(true);
    const result = await api.matches({ country, sourceShopId: sourceShop, targetShopId: targetShop || undefined, segmentId: segment || undefined });
    setMatches(result); setSelected(result[0] || null); setMatching(false);
  }
  function sendToPricing(match: Match) {
    const nextInput = { ...pricingInput, ourPrice: match.source.price, competitorPrice: match.candidate.price };
    setPricingInput(nextInput); setPricing(simulatePricingLocally(nextInput)); setSelected(match); setView('pricing');
  }
  async function simulate(event: FormEvent) { event.preventDefault(); setSimulating(true); setPricing(await api.pricing(pricingInput)); setSimulating(false); }
  function navigate(next: View) { setView(next); setSidebarOpen(false); }
  function exportBrief() {
    const payload = { exportedAt: new Date().toISOString(), market: country.toUpperCase(), source: sourceLabel, snapshotTime, overview, topSignals: alerts.slice(0, 20), dataQuality: quality };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `mavericks-brief-${country}-${overview.dateRange.max_date || 'latest'}.json`; link.click(); URL.revokeObjectURL(url);
  }

  return <TooltipProvider delayDuration={200}>
    <div className="mi-app">
      <aside className={`mi-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Link className="brand-symbol" href="/" aria-label="Về trang giới thiệu Mavericks"><span>M</span><i /></Link>
          <div><strong>MAVERICKS</strong><small>Market Intelligence</small></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu"><X size={18} /></button>
        </div>
        <div className="workspace-selector"><span>WORKSPACE</span><button><span className="workspace-icon"><ChartNoAxesCombined size={15} /></span><span><strong>Area 303</strong><small>Competitive Intelligence</small></span><ChevronDown size={14} /></button></div>
        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          <span className="nav-label">PHÂN TÍCH</span>
          {nav.slice(0, 4).map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} badge={item.id === 'alerts' ? alerts.length : undefined} />)}
          <span className="nav-label nav-label-second">HỆ THỐNG</span>
          <NavButton item={nav[4]} active={view === 'quality'} onClick={() => navigate('quality')} badge={quality.flaggedProducts || undefined} />
        </nav>
        <div className="model-card">
          <div className="model-title"><span><Sparkles size={13} /> Decision readiness</span><Badge variant={trustScore >= 85 ? 'success' : 'warning'}>{trustScore >= 85 ? 'Ready' : 'Review'}</Badge></div>
          <div className="model-score"><strong>{trustScore}%</strong><span>trust × coverage</span></div>
          <div className="health-bar"><i style={{ width: `${trustScore}%` }} /></div>
          <small>{cleanListings.toLocaleString('vi-VN')} SKU sạch · {quality.flaggedProducts} đã cô lập</small>
        </div>
        <div className="sidebar-status"><span className={`status-orb ${dataMode}`}><Database size={13} /></span><div><strong>{sourceLabel}</strong><small>{snapshotTime ? `Cập nhật ${new Date(snapshotTime).toLocaleDateString('vi-VN')}` : 'Đang lấy nguồn dữ liệu'}</small></div><MoreHorizontal size={16} /></div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu" />}

      <main className="mi-main">
        <header className="mi-topbar">
          <div className="topbar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Mở menu"><Menu size={19} /></button><div className="breadcrumb"><span>Area 303</span><i>/</i><strong>{currentNav.label}</strong></div></div>
          <label className="command-search"><Search size={15} /><input ref={searchRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && searchQuery.trim()) navigate('alerts'); }} placeholder="Tìm SKU hoặc gian hàng…" aria-label="Tìm SKU hoặc gian hàng"/><kbd><Command size={11} /> K</kbd></label>
          <div className="topbar-actions">
            <Tooltip><TooltipTrigger asChild><button className="icon-action" onClick={() => setRefreshKey((value) => value + 1)} aria-label="Làm mới dữ liệu"><RefreshCw className={dataMode === 'loading' ? 'spin' : ''} size={15} /></button></TooltipTrigger><TooltipContent>Làm mới dữ liệu</TooltipContent></Tooltip>
            <span className="date-chip"><CalendarDays size={14} />{dateLabel(overview.dateRange.min_date)} — {dateLabel(overview.dateRange.max_date)}</span>
            <div className="market-switch"><button className={country === 'vn' ? 'active' : ''} onClick={() => setCountry('vn')}>VN</button><button className={country === 'id' ? 'active' : ''} onClick={() => setCountry('id')}>ID</button></div>
          </div>
        </header>

        <div className="mi-content">
          <div className="page-title-row"><div><div className="page-kicker"><CurrentIcon size={14} />{currentNav.description}</div><h1>{currentNav.label}</h1><p>{view === 'overview' ? 'Một màn hình để nhìn tín hiệu, hiểu nguyên nhân và chọn hành động.' : view === 'alerts' ? 'Ưu tiên biến động đáng chú ý thay vì phản ứng với mọi thay đổi giá.' : view === 'matches' ? 'Ghép đúng sản phẩm tương đương trước khi so giá và ra quyết định.' : view === 'pricing' ? 'Mô phỏng phản ứng giá mà không đánh đổi biên lợi nhuận.' : 'Đo độ tin cậy của dữ liệu trước khi dữ liệu đi vào quyết định.'}</p></div><div className="page-actions"><Badge variant={dataMode === 'live' ? 'success' : dataMode === 'error' ? 'danger' : 'warning'}><span className="badge-dot" />{sourceLabel}</Badge><Button variant="outline" size="sm" onClick={exportBrief}><ExternalLink size={14} /> Export brief</Button></div></div>

          <AnimatePresence mode="wait">
            <motion.section key={`${view}-${country}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .24, ease: 'easeOut' }}>
              {view === 'overview' && <OverviewView overview={overview} shops={shops} segments={segments} alerts={alerts} trend={trend} cleanListings={cleanListings} maxShopVolume={maxShopVolume} onViewAlerts={() => navigate('alerts')} onPricing={() => navigate('pricing')} />}
              {view === 'alerts' && <AlertsView alerts={alerts} country={country} downAlerts={downAlerts} upAlerts={upAlerts} query={searchQuery} onMatch={() => navigate('matches')} />}
              {view === 'matches' && <MatchesView shops={shops} segments={segments} sourceShop={sourceShop} targetShop={targetShop} segment={segment} matches={matches} selected={selected} matching={matching} country={country} setSourceShop={setSourceShop} setTargetShop={setTargetShop} setSegment={setSegment} setSelected={setSelected} runMatching={runMatching} onPricing={sendToPricing} />}
              {view === 'pricing' && <PricingView country={country} input={pricingInput} result={pricing} simulating={simulating} setInput={setPricingInput} simulate={simulate} selected={selected} />}
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
  return <button className={`sidebar-nav-item ${active ? 'active' : ''}`} onClick={onClick}><span className="nav-icon"><Icon size={17} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{badge !== undefined && <em>{badge}</em>}</button>;
}

function OverviewView({ overview, shops, segments, alerts, trend, cleanListings, maxShopVolume, onViewAlerts, onPricing }: { overview: Overview; shops: Shop[]; segments: Segment[]; alerts: Alert[]; trend: TrendPoint[]; cleanListings: number; maxShopVolume: number; onViewAlerts: () => void; onPricing: () => void }) {
  const indexDelta = Number(((trend.at(-1)?.priceIndex || 100) - (trend[0]?.priceIndex || 100)).toFixed(1));
  const totalCuts = trend.reduce((sum, point) => sum + point.cuts, 0);
  const totalIncreases = trend.reduce((sum, point) => sum + point.increases, 0);
  const pressure = totalCuts > totalIncreases ? 'down' : 'up';
  const alertRate = cleanListings ? overview.priceAlerts / cleanListings * 100 : 0;
  const headline = pressure === 'down' ? 'Giá đang chịu áp lực giảm.\nPhản ứng có chọn lọc.' : 'Thị trường đang nâng giá.\nƯu tiên phục hồi margin.';
  const posture = pressure === 'down' ? 'Defend selectively' : 'Recover margin';
  const shopSeries = shops.slice(0, 8).map((shop) => shop.sku_count).reverse();
  const salesSeries = shops.slice(0, 8).map((shop) => shop.monthly_sold).reverse();
  const metrics = [
    { label: 'Clean SKU universe', value: cleanListings.toLocaleString('vi-VN'), delta: `${(100 - overview.qualityFlags / Math.max(overview.trackedSkus, 1) * 100).toFixed(1)}% usable`, icon: PackageSearch, tone: 'blue', series: trend.map((point) => point.listings) },
    { label: 'Gian hàng theo dõi', value: String(overview.shops), delta: `${shops.filter((shop) => shop.is_official_shop).length} official stores`, icon: Store, tone: 'violet', series: shopSeries },
    { label: 'SKU biến động ≥10%', value: overview.priceAlerts.toLocaleString('vi-VN'), delta: `${alertRate.toFixed(1)}% clean universe`, icon: Activity, tone: 'coral', series: trend.map((point) => point.cuts + point.increases) },
    { label: 'Monthly sold signal', value: compact(overview.totalMonthlySold), delta: `${overview.classifiedCoverage}% đã phân loại`, icon: ShoppingBag, tone: 'gold', series: salesSeries },
  ];
  return <div className="view-stack">
    <div className="insight-hero">
      <div className="hero-grid-pattern" /><div className="hero-glow" />
      <div className="hero-copy"><Badge variant="outline"><Sparkles size={12} /> DATA-DRIVEN BRIEF · {overview.dateRange.dates} DAYS</Badge><h2>{headline.split('\n').map((line) => <span key={line}>{line}<br /></span>)}</h2><p>Chỉ số giá thay đổi <strong>{indexDelta > 0 ? '+' : ''}{indexDelta}%</strong>; ghi nhận <strong>{totalCuts.toLocaleString('vi-VN')} lần giảm</strong> và {totalIncreases.toLocaleString('vi-VN')} lần tăng trên {cleanListings.toLocaleString('vi-VN')} SKU sạch.</p><div className="hero-actions"><Button onClick={onViewAlerts}>Mở priority queue <ArrowRight size={15} /></Button><Button variant="ghost" onClick={onPricing}>Chạy pricing scenario</Button></div></div>
      <div className="hero-decision"><div className="decision-orbit"><span><strong>{indexDelta > 0 ? '+' : ''}{indexDelta}%</strong><small>PRICE INDEX</small></span><i /><b /></div><div><small>DECISION POSTURE</small><strong>{posture}</strong><p>{alerts.filter((alert) => alert.severity === 'critical').length} critical signals.<br />Match trước khi phản ứng.</p></div></div>
    </div>

    <div className="metric-grid-v2">{metrics.map((metric, index) => <MetricCard key={metric.label} {...metric} delay={index * .05} />)}</div>

    <div className="analytics-grid">
      <Card className="trend-card"><CardHeader><div><CardDescription>MARKET MOMENTUM</CardDescription><CardTitle>Chỉ số giá thị trường</CardTitle></div><div className="chart-legend"><span><i className="gold" /> Price index</span><span><i className="coral" /> Price cuts</span></div></CardHeader><CardContent><div className="chart-summary"><div><span>Latest index</span><strong>{trend.at(-1)?.priceIndex.toFixed(1) || '—'}</strong><Badge variant={(trend.at(-1)?.priceIndex || 100) < 100 ? 'warning' : 'success'}>{((trend.at(-1)?.priceIndex || 100) - 100).toFixed(1)}% vs đầu kỳ</Badge></div><p>Chỉ số chuẩn hóa từng SKU về 100 tại ngày đầu, giúp so xu hướng giữa các mức giá khác nhau.</p></div><div className="main-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 16, right: 10, left: -24, bottom: 0 }}><defs><linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3559a6" stopOpacity={.28}/><stop offset="95%" stopColor="#3559a6" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9ecf2" strokeDasharray="3 4"/><XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#8992a3' }} interval={3}/><YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#8992a3' }}/><ChartTooltip content={<MarketTooltip />}/><Bar dataKey="cuts" fill="#e3907f" radius={[3,3,0,0]} barSize={7} yAxisId="right" opacity={.55}/><YAxis yAxisId="right" orientation="right" hide/><Area type="monotone" dataKey="priceIndex" stroke="#3559a6" strokeWidth={2.5} fill="url(#priceArea)" dot={false} activeDot={{ r: 4, fill: '#d4a63f', stroke: '#fff', strokeWidth: 2 }}/></ComposedChart></ResponsiveContainer></div></CardContent></Card>
      <Card className="segment-card"><CardHeader><div><CardDescription>ASSORTMENT MIX</CardDescription><CardTitle>Cấu trúc danh mục</CardTitle></div><Button variant="ghost" size="icon"><MoreHorizontal size={17}/></Button></CardHeader><CardContent><div className="donut-wrap"><ResponsiveContainer width="100%" height={205}><PieChart><Pie data={segments.slice(0,6)} dataKey="count" nameKey="label" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">{segments.slice(0,6).map((item,index)=><Cell key={item.id} fill={chartColors[index % chartColors.length]}/>)}</Pie><ChartTooltip content={<SegmentTooltip total={cleanListings}/>} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{cleanListings}</strong><span>clean SKU</span></div></div><div className="segment-legend">{segments.slice(0,5).map((item,index)=><div key={item.id}><span><i style={{background:chartColors[index]}}/>{item.label}</span><strong>{item.count}</strong></div>)}</div></CardContent></Card>
    </div>

    <div className="lower-grid">
      <Card><CardHeader><div><CardDescription>COMPETITOR LANDSCAPE</CardDescription><CardTitle>Gian hàng dẫn đầu</CardTitle></div><Badge variant="secondary">by monthly sold</Badge></CardHeader><CardContent className="shop-ranking">{shops.slice(0,6).map((shop,index)=><div className="shop-rank-row" key={shop.shop_id}><span className="rank-index">{String(index+1).padStart(2,'0')}</span><span className="shop-avatar">{shop.shop_name.slice(0,2).toUpperCase()}</span><div><strong>{shop.shop_name}</strong><small>{shop.sku_count} clean SKU {shop.is_official_shop && '· Official'}</small></div><div className="rank-bar"><i style={{width:`${shop.monthly_sold/maxShopVolume*100}%`}}/></div><b>{compact(shop.monthly_sold)}</b></div>)}</CardContent></Card>
      <Card><CardHeader><div><CardDescription>LIVE SIGNALS</CardDescription><CardTitle>Biến động gần nhất</CardTitle></div><Button variant="ghost" size="sm" onClick={onViewAlerts}>Xem tất cả <ArrowRight size={13}/></Button></CardHeader><CardContent className="mini-alert-list">{alerts.slice(0,5).map((alert)=><button key={`${alert.shop_id}-${alert.item_id}`} onClick={onViewAlerts}><span className={`signal-icon ${alert.direction}`}>{alert.direction==='down'?<TrendingDown size={15}/>:<TrendingUp size={15}/>}</span><span><strong>{alert.product_name}</strong><small>{alert.shop_name} · {dateLabel(alert.date)}</small></span><Badge variant={badgeForSeverity(alert.severity)}>{alert.change_percent>0?'+':''}{alert.change_percent}%</Badge></button>)}</CardContent></Card>
    </div>
  </div>;
}

function MetricCard({ label, value, delta, icon: Icon, tone, series, delay }: { label: string; value: string; delta: string; icon: LucideIcon; tone: string; series: number[]; delay: number }) {
  const min = Math.min(...series, 0); const max = Math.max(...series, 1); const bars = series.slice(-10).map((value) => 22 + (value - min) / Math.max(max - min, 1) * 78);
  return <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay}}><Card className={`metric-card-v2 ${tone}`}><CardContent><div className="metric-top"><span className="metric-icon"><Icon size={17}/></span><Tooltip><TooltipTrigger asChild><button aria-label={`Giải thích ${label}`}><Info size={13}/></button></TooltipTrigger><TooltipContent>{delta}</TooltipContent></Tooltip></div><span className="metric-label">{label}</span><div className="metric-value-row"><strong>{value}</strong><div className="mini-spark">{bars.map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div></div><small>{delta}</small></CardContent></Card></motion.div>;
}

function AlertsView({ alerts, country, downAlerts, upAlerts, query, onMatch }: { alerts: Alert[]; country: Country; downAlerts: number; upAlerts: number; query: string; onMatch: () => void }) {
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
      <CardHeader><div><CardDescription>PRIORITY QUEUE</CardDescription><CardTitle>{visible.length} tín hiệu đang hiển thị</CardTitle></div><div className="table-actions"><Button variant="outline" size="sm"><Filter size={13}/> {filter === 'all' ? 'All signals' : filter}</Button><Button size="sm" onClick={onMatch}><ScanSearch size={13}/> Mở matching</Button></div></CardHeader>
      <div className="filter-pills">{filters.map(([id, label, count]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label} <span>{count}</span></button>)}</div>
      <div className="enterprise-table-wrap"><table className="enterprise-table"><thead><tr><th>Tín hiệu</th><th>Sản phẩm / Gian hàng</th><th>Giá trước</th><th>Giá mới</th><th>Biến động</th><th>Sold</th><th></th></tr></thead><tbody>
        {visible.length ? visible.map((alert)=><tr key={`${alert.shop_id}-${alert.item_id}`}><td><span className={`signal-icon ${alert.direction}`}>{alert.direction==='down'?<ArrowDownRight size={15}/>:<ArrowUpRight size={15}/>}</span></td><td className="product-cell"><strong>{alert.product_name}</strong><small>{alert.shop_name} · {dateLabel(alert.date)}</small></td><td className="muted-value">{money(alert.previous_price,country)}</td><td><strong>{money(alert.price,country)}</strong></td><td><Badge variant={badgeForSeverity(alert.severity)}>{alert.change_percent>0?'+':''}{alert.change_percent}%</Badge></td><td>{compact(alert.monthly_sold)}</td><td><button className="row-action" onClick={onMatch}><ArrowRight size={15}/></button></td></tr>) : <tr><td colSpan={7}><EmptyState icon={Search} title="Không tìm thấy tín hiệu" body="Thử từ khóa hoặc bộ lọc khác."/></td></tr>}
      </tbody></table></div>
    </Card>
  </div>;
}

function MatchesView({ shops, segments, sourceShop, targetShop, segment, matches, selected, matching, country, setSourceShop, setTargetShop, setSegment, setSelected, runMatching, onPricing }: { shops: Shop[]; segments: Segment[]; sourceShop: string; targetShop: string; segment: string; matches: Match[]; selected: Match|null; matching: boolean; country: Country; setSourceShop:(value:string)=>void; setTargetShop:(value:string)=>void; setSegment:(value:string)=>void; setSelected:(match:Match)=>void; runMatching:()=>void; onPricing:(match:Match)=>void }) {
  return <div className="view-stack"><Card className="match-control-card"><CardContent><div className="control-intro"><span className="control-icon"><Zap size={20}/></span><div><strong>Hybrid matching engine</strong><p>{MATCHING_WEIGHTS.name}% tên · {MATCHING_WEIGHTS.keyword}% từ khóa · {MATCHING_WEIGHTS.pack}% pack/size</p></div></div><div className="match-controls"><Field label="Gian hàng của ta"><select value={sourceShop} onChange={(e)=>setSourceShop(e.target.value)}>{shops.map((shop)=><option value={shop.shop_id} key={shop.shop_id}>{shop.shop_name}</option>)}</select></Field><span className="control-arrow"><ArrowRight size={16}/></span><Field label="Đối thủ"><select value={targetShop} onChange={(e)=>setTargetShop(e.target.value)}><option value="">Tất cả đối thủ</option>{shops.filter((shop)=>shop.shop_id!==sourceShop).map((shop)=><option value={shop.shop_id} key={shop.shop_id}>{shop.shop_name}</option>)}</select></Field><Field label="Phân khúc"><select value={segment} onChange={(e)=>setSegment(e.target.value)}><option value="">Tất cả</option>{segments.filter((item)=>item.id!=='other').map((item)=><option value={item.id} key={item.id}>{item.label}</option>)}</select></Field><Button onClick={runMatching} disabled={matching}>{matching?<RefreshCw className="spin" size={15}/>:<ScanSearch size={15}/>} {matching?'Đang tính điểm':'Run matching'}</Button></div></CardContent></Card><div className="matching-workspace"><Card className="match-results"><CardHeader><div><CardDescription>RANKED CANDIDATES</CardDescription><CardTitle>{matches.length} cặp đề xuất</CardTitle></div><Badge variant="secondary">Computed on demand</Badge></CardHeader><CardContent>{matches.length?<div className="candidate-list">{matches.map((match,index)=><button key={`${match.source.item_id}-${match.candidate.item_id}-${index}`} className={selected===match?'active':''} onClick={()=>setSelected(match)}><ScoreRing score={match.scoring.confidence} band={match.scoring.band}/><span className="candidate-copy"><strong>{match.source.product_name}</strong><i><Link2 size={11}/> {match.candidate.product_name}</i><small>{match.source.shop_name} ↔ {match.candidate.shop_name}</small></span><span className="candidate-price"><strong>{money(match.source.price,country)}</strong><small>{money(match.candidate.price,country)}</small></span><ArrowRight size={14}/></button>)}</div>:<EmptyState icon={ScanSearch} title="Sẵn sàng tính trên dữ liệu thật" body="Chọn hai gian hàng hoặc một phân khúc rồi chạy matching."/>}</CardContent></Card><Card className="match-inspector">{selected?<MatchInspector match={selected} country={country} onPricing={()=>onPricing(selected)}/>:<EmptyState icon={PackageSearch} title="Chưa chọn cặp SKU" body="Điểm thành phần và bằng chứng sẽ xuất hiện sau khi chạy matching."/>}</Card></div></div>;
}

function MatchInspector({ match, country, onPricing }: { match: Match; country: Country; onPricing:()=>void }) {
  return <><CardHeader className="inspector-head"><div><CardDescription>MATCH INSPECTOR</CardDescription><CardTitle>Evidence review</CardTitle></div><Badge variant={match.scoring.band==='high'?'success':match.scoring.band==='review'?'warning':'secondary'}>{bandLabel(match.scoring.band)}</Badge></CardHeader><CardContent><div className="inspector-score"><ScoreRing score={match.scoring.confidence} band={match.scoring.band} large/><div><strong>{match.scoring.confidence}% similarity</strong><p>{match.scoring.segment.label} · human review {match.scoring.band==='high'?'không bắt buộc':'bắt buộc'}</p></div></div><div className="product-compare-v2"><ProductCard title="SKU của ta" product={match.source} country={country}/><span className="versus-chip">VS</span><ProductCard title="SKU đối thủ" product={match.candidate} country={country}/></div><div className="score-bars"><ScoreBar label="Tên sản phẩm" score={match.scoring.textScore}/><ScoreBar label="Từ khóa" score={match.scoring.tokenScore}/><ScoreBar label="Pack / size" score={match.scoring.packScore}/></div><div className="evidence-box"><strong>Giải thích mô hình</strong>{match.scoring.reasons.map((reason)=><p key={reason}><Check size={13}/>{reason}</p>)}{match.scoring.warnings.map((warning)=><p className="warning" key={warning}><AlertTriangle size={13}/>{warning}</p>)}</div><Button className="full-button" onClick={onPricing}><CircleDollarSign size={15}/> Dùng trong Pricing Lab <ArrowRight size={14}/></Button></CardContent></>;
}

function PricingView({ country, input, result, simulating, setInput, simulate, selected }: { country: Country; input: PricingInput; result: PricingResult; simulating: boolean; setInput:(value:PricingInput)=>void; simulate:(event:FormEvent)=>void; selected:Match|null }) {
  const floorRatio=Math.min(100,result.marginFloor/Math.max(result.competitorAfter,result.recommendedPrice,1)*100); const priceRatio=Math.min(100,result.recommendedPrice/Math.max(result.competitorAfter,result.recommendedPrice,1)*100);
  return <div className="pricing-grid"><Card className="scenario-panel"><CardHeader><div><CardDescription>SCENARIO INPUTS</CardDescription><CardTitle>Giả định thương mại</CardTitle></div><Badge variant="outline">Interactive</Badge></CardHeader><CardContent><form onSubmit={simulate}><div className="scenario-context">{selected?<><span><Link2 size={13}/></span><div><strong>Cặp SKU đang dùng</strong><p>{selected.source.product_name.slice(0,42)}… ↔ {selected.candidate.product_name.slice(0,42)}…</p></div></>:<><span><Info size={13}/></span><div><strong>Scenario độc lập</strong><p>Thay đổi giá và economics; engine sẽ tính lại khuyến nghị khi bạn bấm nút.</p></div></>}</div><div className="form-group"><span>PRICE SIGNAL</span><div className="input-grid"><NumberField label="Giá của ta" value={input.ourPrice} onChange={(v)=>setInput({...input,ourPrice:v})}/><NumberField label="Giá đối thủ" value={input.competitorPrice} onChange={(v)=>setInput({...input,competitorPrice:v})}/><NumberField label="Đối thủ thay đổi (%)" value={input.competitorChangePercent} onChange={(v)=>setInput({...input,competitorChangePercent:v})}/><NumberField label="Undercut (%)" value={input.undercutPercent} onChange={(v)=>setInput({...input,undercutPercent:v})}/></div></div><div className="form-group"><span>UNIT ECONOMICS</span><div className="input-grid"><NumberField label="COGS (%)" value={input.cogsPercent} onChange={(v)=>setInput({...input,cogsPercent:v})}/><NumberField label="Target margin (%)" value={input.targetMarginPercent} onChange={(v)=>setInput({...input,targetMarginPercent:v})}/><NumberField label="Phí sàn (%)" value={input.platformFeePercent} onChange={(v)=>setInput({...input,platformFeePercent:v})}/><NumberField label="Voucher + ship (%)" value={input.voucherPercent+input.shippingPercent} onChange={(v)=>setInput({...input,voucherPercent:v,shippingPercent:0})}/></div></div><Button className="full-button" disabled={simulating}>{simulating?<RefreshCw className="spin" size={15}/>:<Gauge size={15}/>} {simulating?'Đang mô phỏng':'Tính khuyến nghị'}</Button></form></CardContent></Card><Card className={`recommendation-panel action-${result.action.toLowerCase()}`}><div className="recommendation-glow"/><CardContent><div className="recommendation-top"><div><Badge variant="outline"><Sparkles size={12}/> DECISION ENGINE</Badge><h2>{result.headline}</h2><p>{result.rationale}</p></div><span className="action-seal"><ShieldCheck size={24}/><b>{result.action}</b></span></div><div className="price-decision"><span>Giá khuyến nghị</span><strong>{money(result.recommendedPrice,country)}</strong><small>{result.recommendedPrice===input.ourPrice?'Giữ nguyên mức giá hiện tại':`${((result.recommendedPrice/input.ourPrice-1)*100).toFixed(1)}% so với hiện tại`}</small></div><div className="decision-metric-grid"><ResultMetric label="Đối thủ sau biến động" value={money(result.competitorAfter,country)} icon={Target}/><ResultMetric label="Margin floor" value={money(result.marginFloor,country)} icon={ShieldCheck}/><ResultMetric label="Biên hiện tại" value={`${result.currentMarginPercent}%`} icon={ChartNoAxesCombined}/><ResultMetric label="Price gap" value={`${result.currentPriceGapPercent}%`} icon={Activity}/></div><div className="price-rail"><div className="rail-labels"><span>0</span><span>Giá sàn</span><span>Giá đề xuất</span><span>Đối thủ</span></div><div className="rail-track"><i className="safe-zone" style={{left:`${floorRatio}%`}}/><b className="floor-pin" style={{left:`${floorRatio}%`}}/><b className="price-pin" style={{left:`${priceRatio}%`}}/><b className="competitor-pin"/></div><div className="rail-caption"><span><i/> Vùng phá margin</span><span><i/> Vùng có thể hành động</span></div></div><div className="guardrail-note"><ShieldCheck size={18}/><div><strong>Margin guardrail đang bật</strong><p>Hệ thống không khuyến nghị match nếu competitive target thấp hơn giá sàn {money(result.marginFloor,country)}.</p></div></div></CardContent></Card></div>;
}

function QualityView({ quality, overview, country }: { quality: Quality; overview: Overview; country: Country }) {
  const clean=Math.max(0,quality.totalProducts-quality.flaggedProducts); const cleanRate=quality.totalProducts?clean/quality.totalProducts*100:100;
  return <div className="view-stack"><div className="quality-hero"><div className="quality-gauge" style={{'--quality':`${cleanRate*3.6}deg`} as CSSProperties}><span><strong>{cleanRate.toFixed(1)}%</strong><small>usable data</small></span></div><div><Badge variant="success"><BadgeCheck size={12}/> TRUST LAYER ACTIVE</Badge><h2>Dữ liệu sạch trước, quyết định sau.</h2><p>{quality.flaggedProducts} trong {quality.totalProducts} listing bị cô lập khỏi matching và benchmark. Coverage phân loại trên tập sạch đạt {overview.classifiedCoverage}%.</p></div><div className="quality-checks"><p><Check size={14}/> Placeholder price filter</p><p><Check size={14}/> Gift & giveaway detection</p><p><Check size={14}/> Promotion orphan audit</p></div></div><div className="summary-strip"><SummaryStat icon={Database} label="Raw listings" value={quality.totalProducts} tone="blue" detail="Catalog mới nhất"/><SummaryStat icon={BadgeCheck} label="Clean listings" value={clean} tone="green" detail={`${cleanRate.toFixed(1)}% usable`}/><SummaryStat icon={AlertTriangle} label="Quarantined" value={quality.flaggedProducts} tone="coral" detail="Không dùng để benchmark"/><SummaryStat icon={Link2} label="Orphan rows" value={quality.orphanPromotionRows} tone="gold" detail="Promotion không có catalog"/></div><Card className="data-card"><CardHeader><div><CardDescription>QUARANTINE LOG</CardDescription><CardTitle>Listing cần xác minh</CardTitle></div><Badge variant="warning">{quality.flaggedProducts} flags</Badge></CardHeader><div className="enterprise-table-wrap"><table className="enterprise-table"><thead><tr><th>Severity</th><th>Rule</th><th>Sản phẩm</th><th>Gian hàng</th><th>Giá ghi nhận</th><th>Disposition</th></tr></thead><tbody>{quality.issues.length?quality.issues.map((issue)=><tr key={`${issue.item_id}-${issue.type}`}><td><Badge variant={issue.severity==='critical'?'danger':'warning'}>{issue.severity}</Badge></td><td><code>{issue.type}</code></td><td className="product-cell"><strong>{issue.product_name}</strong><small>Item ID · {issue.item_id}</small></td><td>{issue.shop_name}</td><td><strong>{money(issue.price,country)}</strong></td><td><span className="quarantine-status"><ShieldCheck size={13}/> Excluded</span></td></tr>):<tr><td colSpan={6}><EmptyState icon={BadgeCheck} title="Không có lỗi" body="Tập dữ liệu hiện vượt qua các quy tắc kiểm tra."/></td></tr>}</tbody></table></div></Card></div>;
}

function SummaryStat({ icon:Icon,label,value,tone,detail }: { icon:LucideIcon;label:string;value:number;tone:string;detail:string }) { return <Card className={`summary-stat ${tone}`}><CardContent><span><Icon size={17}/></span><div><small>{label}</small><strong>{value.toLocaleString('vi-VN')}</strong><p>{detail}</p></div></CardContent></Card>; }
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="form-field"><span>{label}</span>{children}</label>; }
function NumberField({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) { return <Field label={label}><input type="number" value={value} onChange={(e)=>onChange(Number(e.target.value))}/></Field>; }
function ScoreRing({score,band,large=false}:{score:number;band:Match['scoring']['band'];large?:boolean}) { return <span className={`score-ring-v2 ${band} ${large?'large':''}`} style={{'--score':`${score*3.6}deg`} as CSSProperties}><b>{score}</b><small>%</small></span>; }
function ScoreBar({label,score}:{label:string;score:number}) { return <div><span>{label}<b>{score}%</b></span><i><em style={{width:`${score}%`}}/></i></div>; }
function ProductCard({title,product,country}:{title:string;product:Match['source'];country:Country}) { return <article className="product-card-v2">{product.image_url?<img src={product.image_url} alt="" /* eslint-disable-line @next/next/no-img-element */ />:<span className="product-fallback"><PackageSearch size={22}/></span>}<small>{title}</small><strong>{product.product_name}</strong><b>{money(product.price,country)}</b><p>{compact(product.monthly_sold)} sold · ★ {product.rating||'—'}</p></article>; }
function ResultMetric({label,value,icon:Icon}:{label:string;value:string;icon:LucideIcon}) { return <div><span><Icon size={13}/>{label}</span><strong>{value}</strong></div>; }
function EmptyState({icon:Icon,title,body}:{icon:LucideIcon;title:string;body:string}) { return <div className="empty-state-v2"><span><Icon size={25}/></span><strong>{title}</strong><p>{body}</p></div>; }
function MarketTooltip({active,payload,label}:{active?:boolean;payload?:Array<{name:string;value:number;color:string}>;label?:string}) { if(!active||!payload?.length)return null; return <div className="chart-tooltip"><strong>{label?dateLabel(label):''}</strong>{payload.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name==='priceIndex'?'Price index':'Price cuts'}<b>{item.value}</b></span>)}</div>; }
function SegmentTooltip({active,payload,total}:{active?:boolean;payload?:Array<{name:string;value:number}>;total:number}) { if(!active||!payload?.length)return null; const item=payload[0]; return <div className="chart-tooltip"><strong>{item.name}</strong><span>SKU <b>{item.value}</b></span><span>Tỷ trọng <b>{(item.value/Math.max(total,1)*100).toFixed(1)}%</b></span></div>; }
