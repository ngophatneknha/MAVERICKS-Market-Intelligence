'use client';
import { useLanguage } from '@/lib/i18n';
import { useState } from 'react';
import { ArrowDownToLine, ArrowRight, FileSpreadsheet, History } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { compareOutcome, validateOutcome, type Outcome, type OutcomeDecision } from '@/lib/outcomes';
import { nextDate } from '@/lib/planning';


export default function OutcomeReview({ decisions, onSave, onStart }: { decisions: OutcomeDecision[]; onSave: (id: string, outcome: Outcome) => void; onStart: () => void }) {
  const { t, money, count, date } = useLanguage();
  const [selected, setSelected] = useState('');
  const [weeks, setWeeks] = useState(1);
  const [units, setUnits] = useState('');
  const [revenue, setRevenue] = useState('');
  const [profit, setProfit] = useState('');
  const [owner, setOwner] = useState('');
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const decision = decisions.find(row => row.id === selected) || decisions[0];
  const latest = decision?.outcomes?.find(row => row.weeks === weeks);
  const comparison = latest && decision ? compareOutcome(decision, latest) : null;
  const periodEnd = decision ? nextDate(decision.historyEnd, weeks * 7) : '';
  const today = new Date();
  const todayLabel = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const isFuture = periodEnd > todayLabel;
  const completed = decisions.filter(row => row.outcomes?.length).length;
  function exportResults() {
    const report = decisions.filter(row => row.outcomes?.length).map(row => ({id:row.id,sku:row.sku,basis:row.basis,historyEnd:row.historyEnd,approvedInput:row.input,approvedResult:row.result,observations:row.outcomes!.map(actual => ({actual,comparison:compareOutcome(row,actual)}))}));
    const url = URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),limitations:['Dữ liệu nhập thủ công, chưa đối soát.','Chênh lệch với dự kiến không phải tác động nhân quả của giá.','Lợi nhuận trước thuế và chi phí tài chính.'],decisions:report},null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href=url;link.download='mavericks-outcome-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function save() {
    try {
      if (!decision) return;
      if (isFuture && decision.basis !== 'illustrative-demo') throw new Error('Kỳ đối chiếu chưa kết thúc; chưa thể ghi kết quả đầy đủ cho kỳ này.');
      if (![units,revenue,profit].every(v => v.trim())) throw new Error('Điền đủ lượng bán, doanh thu và lợi nhuận. Có thể nhập 0, không để trống.');
      const outcome = validateOutcome({id:crypto.randomUUID(),createdAt:new Date().toISOString(),weeks,units:Number(units),netRevenue:Number(revenue),operatingProfit:Number(profit),owner,source,note});
      compareOutcome(decision,outcome);
      onSave(decision.id,outcome); setError(''); setNotice('Đã ghi kết quả. Bản dự kiến đã duyệt được giữ nguyên; đây không phải bằng chứng tác động của việc đổi giá.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không ghi được kết quả.'); }
  }
  if (!decision) return <section className="ps-panel ps-empty"><History size={30}/><h3>{t("Chưa có quyết định để đối chiếu")}</h3><p>{t("Lưu một phương án đã duyệt trước. Sau đó ghi kết quả thực tế của cùng SKU và cùng kỳ.")}</p><Button onClick={onStart}>{t("Lập kế hoạch ")}<ArrowRight size={14}/></Button></section>;
  return <section className="outcome-review">
    <div className="ps-panel outcome-intro"><span className="ps-eyebrow">{t("SAU QUYẾT ĐỊNH")}</span><h3>{t("Dự kiến và thực tế có khớp nhau?")}</h3><p>{t("Đối chiếu cùng SKU, cùng số tuần. Giữ nguyên bản tính lúc duyệt để không dùng giả định mới giải thích ngược kết quả cũ.")}</p><div className="outcome-counts"><span><strong>{completed}/{decisions.length}</strong>{t(" bản duyệt có kết quả")}</span><span><strong>{decisions.reduce((sum,row) => sum+(row.outcomes?.length || 0),0)}</strong>{t(" lần ghi nhận")}</span><Button variant="outline" size="sm" disabled={!completed} onClick={exportResults}><ArrowDownToLine size={14}/>{t(" Xuất báo cáo đối chiếu")}</Button></div></div>
    <div className="ps-panel"><div className="ps-fields"><label className="ps-field"><span>{t("Bản duyệt cần đối chiếu")}</span><select aria-label={t("Bản duyệt cần đối chiếu")} value={decision.id} onChange={e => {setSelected(e.target.value);setNotice('');setError('');setUnits('');setRevenue('');setProfit('');setNote('');}}>{decisions.map(row => <option key={row.id} value={row.id}>{row.sku} · {money(row.result.price)}{t(" · kế hoạch từ ")}{nextDate(row.historyEnd,1)} · {row.id.slice(0,8)}</option>)}</select></label><label className="ps-field"><span>{t("Kỳ đối chiếu")}</span><select aria-label={t("Kỳ đối chiếu")} value={weeks} onChange={e => {setWeeks(Number(e.target.value));setNotice('');setError('');setUnits('');setRevenue('');setProfit('');}}>{Array.from({length:8},(_,i) => <option key={i} value={i+1}>{i+1}{t(" tuần đầu · ")}{(i+1)*7}{t(" ngày")}</option>)}</select></label></div><p className="ps-muted">{t("Kỳ lũy kế: ")}{nextDate(decision.historyEnd,1)} → {periodEnd}{t(". Ghi đủ ")}{weeks*7}{t(" ngày, không so kết quả vài ngày với dự kiến cả kỳ.")}</p><Badge variant={decision.basis === 'illustrative-demo' ? 'warning' : 'secondary'}>{decision.basis === 'illustrative-demo' ? t("Bản duyệt minh họa · kết quả chỉ để thử nghiệm") : t("Nhập thủ công · chưa được đối soát")}</Badge></div>
    {comparison && latest ? <section className="ps-panel"><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("KẾT QUẢ ĐÃ GHI · ")}{weeks}{t(" TUẦN")}</span><h3>{t("Chênh lệch so với bản dự kiến")}</h3></div></div><div className="outcome-comparison">{([{key:'units',label:t("Lượng bán"),format:count},{key:'netRevenue',label:t("Doanh thu sau giảm giá & hoàn tiền"),format:money},{key:'operatingProfit',label:t("Lợi nhuận vận hành"),format:money}] as const).map(metric => <div key={metric.key}><span>{t(metric.label)}</span><strong>{metric.format(latest[metric.key])}</strong><small>{t("Dự kiến ")}{metric.format(comparison.expected[metric.key])}</small><b className={comparison.delta[metric.key]<0 ? 'below' : 'above'}>{comparison.delta[metric.key]>=0?'+':''}{metric.format(comparison.delta[metric.key])}{comparison.relative[metric.key]!==null ? ` (${comparison.relative[metric.key]!.toFixed(1)}%)` : t(" · chưa có tỷ lệ phù hợp")}</b></div>)}</div><p className="ps-muted">{latest.owner} · {date(latest.createdAt, true)}{t(" · nguồn: ")}{latest.source}</p><p>{latest.note || t("Chưa ghi bối cảnh.")}</p><div className="outcome-caution"><strong>{t("Chênh lệch không đồng nghĩa với hiệu quả do đổi giá.")}</strong><p>{t("Cần xem chiến dịch, tồn kho, mùa vụ, cách phân bổ chi phí và việc thực thi giá. Chưa có nhóm đối chứng; hệ thống chưa dùng kết quả này để tự học độ nhạy giá.")}</p></div></section> : <div className="ps-panel ps-muted">{t("Chưa có kết quả cho kỳ ")}{weeks}{t(" tuần. Chuẩn bị số liệu theo cùng phạm vi bên dưới.")}</div>}
    <form className="ps-panel outcome-form" onSubmit={e => {e.preventDefault();save();}}><div className="ps-panel-heading"><div><span className="ps-eyebrow">{t("DỮ LIỆU DO BẠN GHI NHẬN")}</span><h3>{latest ? t("Ghi bản cập nhật kết quả") : t("Ghi kết quả thực tế")}</h3></div><FileSpreadsheet size={20}/></div><p className="ps-muted">{t("Lượng bán dùng cùng định nghĩa units trong lịch sử. Doanh thu sau voucher và hoàn tiền; lợi nhuận trừ giá vốn, phí, quảng cáo, vận chuyển, bao bì và overhead, trước thuế và chi phí tài chính. Không dùng số tiền sàn chuyển về thay doanh thu.")}</p><div className="ps-fields"><label className="ps-field"><span>{t("Lượng bán thực tế")}</span><input aria-label={t("Lượng bán thực tế")} type="number" min="0" step="1" required value={units} onChange={e=>setUnits(e.target.value)}/></label><label className="ps-field"><span>{t("Doanh thu thực tế đ")}</span><input aria-label={t("Doanh thu thực tế đ")} type="number" min="0" step="any" required value={revenue} onChange={e=>setRevenue(e.target.value)}/></label><label className="ps-field"><span>{t("Lợi nhuận vận hành thực tế đ")}</span><input aria-label={t("Lợi nhuận vận hành thực tế đ")} type="number" step="any" required value={profit} onChange={e=>setProfit(e.target.value)}/></label><label className="ps-field"><span>{t("Người ghi kết quả")}</span><input aria-label={t("Người ghi kết quả")} required maxLength={2000} value={owner} onChange={e=>setOwner(e.target.value)}/></label><label className="ps-field"><span>{t("Nguồn số liệu thực tế")}</span><input aria-label={t("Nguồn số liệu thực tế")} required maxLength={2000} placeholder={t("VD: Báo cáo bán hàng và P&L tuần 1")} value={source} onChange={e=>setSource(e.target.value)}/></label><label className="ps-field"><span>{t("Bối cảnh và việc cần kiểm tra")}</span><textarea aria-label={t("Bối cảnh và việc cần kiểm tra")} maxLength={2000} placeholder={t("Giá có thực thi không? Có chạy chiến dịch, hết hàng hoặc đổi chi phí không?")} value={note} onChange={e=>setNote(e.target.value)}/></label></div>{error && <p className="ps-message error" role="alert">{t(error)}</p>}{notice && <p className="ps-message" role="status">{t(notice)}</p>}{isFuture && decision.basis !== 'illustrative-demo' && <p className="ps-muted">{t("Kỳ này chưa kết thúc. Chọn kỳ ngắn hơn đã hoàn thành.")}</p>}<Button type="submit" disabled={isFuture && decision.basis !== 'illustrative-demo'}>{t("Lưu kết quả đối chiếu")}</Button><p className="ps-muted">{t("Giữ tối đa 20 lần ghi nhận mỗi bản duyệt trên trình duyệt này. Cập nhật tạo bản ghi mới, không sửa số liệu của bản kế hoạch.")}</p></form>
    {!!decision.outcomes?.length && <details className="ps-panel outcome-history"><summary>{t("Lịch sử ghi nhận · ")}{decision.outcomes.length}{t(" bản")}</summary>{decision.outcomes.map(row => <div key={row.id}><strong>{row.weeks}{t(" tuần · ")}{row.owner}</strong><span>{date(row.createdAt, true)} · {row.source}</span><span>{count(row.units)}{t(" đơn vị · doanh thu ")}{money(row.netRevenue)}{t(" · lợi nhuận ")}{money(row.operatingProfit)}</span></div>)}</details>}
  </section>;
}
