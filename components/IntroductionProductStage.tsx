'use client';
import { useMemo } from 'react';
import { ArrowUpRight, Check, ChartNoAxesCombined, Layers3, PackageSearch, ShieldCheck, Wallet } from 'lucide-react';
import { compareScenarios, defaultPlanning, demoSalesCsv, forecastSales, parseSalesCsv } from '@/lib/planning';

const money=(value:number)=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(value)+'đ';
const count=(value:number)=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(value);

/** A code-native product cutaway, populated from the same illustrative planning engine. */
export default function IntroductionProductStage() {
  const scenarios=useMemo(()=>compareScenarios(forecastSales(parseSalesCsv(demoSalesCsv()),'DEMO-SNACK-01'),defaultPlanning),[]);
  const chosen=scenarios[3];const baseline=scenarios[2];
  const min=Math.min(...scenarios.map(row=>row.operatingProfit));const max=Math.max(...scenarios.map(row=>row.operatingProfit));
  const points=scenarios.map((row,i)=>({x:34+i*94,y:138-(row.operatingProfit-min)/(max-min||1)*104}));
  const path=points.map((point,i)=>`${i?'L':'M'} ${point.x},${point.y}`).join(' ');
  return <div className="premium-product-stage" aria-label="Minh họa giao diện Mavericks với dữ liệu demo">
    <div className="stage-caption"><span>PRODUCT / IN FOCUS</span><span>MINH HỌA · DỮ LIỆU TỔNG HỢP</span></div>
    <div className="stage-surface"><aside className="stage-sidebar" aria-hidden="true"><span className="stage-brand">M</span><span className="stage-nav-item"><ChartNoAxesCombined size={17}/></span><span className="stage-nav-item"><PackageSearch size={17}/></span><span className="stage-nav-item active"><Wallet size={17}/></span><span className="stage-nav-item"><ShieldCheck size={17}/></span><i/></aside><div className="stage-workspace"><div className="stage-toolbar"><span>Mavericks <b>/</b> Kế hoạch & vốn</span><span className="stage-demo-label">DEMO</span></div><div className="stage-title"><div><span>DECISION WORKSPACE</span><h3>Một phương án.<br/>Toàn bộ đánh đổi.</h3></div><span className="stage-review"><Check size={13}/> Đạt điều kiện demo</span></div><div className="stage-main"><div className="stage-chart-card"><div className="stage-chart-heading"><span>LỢI NHUẬN VẬN HÀNH / 8 TUẦN</span><ArrowUpRight size={17}/></div><strong>{money(chosen.operatingProfit)}</strong><small>{money(chosen.operatingProfit-baseline.operatingProfit)} so với giữ giá · mô phỏng</small><svg viewBox="0 0 444 177" role="img" aria-label="Lợi nhuận demo tại năm mức giá đã thử"><defs><linearGradient id="intro-profit-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a7c99c" stopOpacity=".23"/><stop offset="1" stopColor="#a7c99c" stopOpacity="0"/></linearGradient></defs>{[40,85,130].map(y=><line key={y} x1="20" y1={y} x2="420" y2={y} stroke="#e8ebe5" strokeDasharray="3 5"/>)}<path d={`${path} L410,150 L34,150 Z`} fill="url(#intro-profit-fill)"/><path d={path} fill="none" stroke="#4c7459" strokeWidth="3"/>{points.map((point,i)=><g key={i}><circle cx={point.x} cy={point.y} r={i===3?6:3} fill={i===3?'#b59b63':'#4c7459'} stroke="#fff" strokeWidth="2"/><text x={point.x} y="174" textAnchor="middle" fill="#7b8577" fontSize="10">{count(scenarios[i].price)}</text></g>)}</svg></div><div className="stage-price-card"><span>GIÁ ĐANG THỬ</span><strong>{money(chosen.price)}</strong><small>+5% so với giá tham chiếu</small><div><span>Biên đóng góp</span><b>{chosen.margin.toFixed(1)}%</b></div><div><span>Lượng bán dự kiến</span><b>{count(chosen.sold)} đơn vị</b></div><div><span>Lượng cần nhập</span><b>{count(chosen.orderUnits)} đơn vị</b></div><p>Độ nhạy giá {defaultPlanning.elasticity} · giả định<br/>Chưa thực thi hoặc cam kết kết quả</p></div></div><div className="stage-bottom-strip"><span><Layers3 size={13}/> 42 ngày minh họa</span><span><ShieldCheck size={13}/> Người phụ trách duyệt</span><span>Giá → Lãi → Vốn</span></div></div></div>
    <div className="stage-floating-tag"><span className="floating-tag-icon"><Wallet size={18}/></span><div><small>VỐN CẦN BỔ SUNG TRONG DEMO</small><strong>{money(chosen.additionalCapital)}</strong><p>Dựa trên {money(defaultPlanning.openingCash)} tiền đầu kỳ</p></div></div>
  </div>;
}
