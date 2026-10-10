'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, BookOpen, Check, MessageSquare, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '@/lib/i18n';
import { FINANCE_EVENT, savedFinanceContext, type FinanceContext } from '@/lib/finance-context';

type Message = { role: 'user' | 'assistant'; content: string; mode: 'guide' | 'ai' };

export default function FinancialAssistant({ view }: { view: string }) {
  const { locale, money, date } = useLanguage();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'guide' | 'ai'>('guide');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<FinanceContext>({ version: 1, asOf: '2000-01-01', source: 'manual', currency: 'VND', cash: null, inventoryScenario: null });
  const [consent, setConsent] = useState(false);
  const [pilotToken, setPilotToken] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [lastContext, setLastContext] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-local financial context.
    setContext(savedFinanceContext());
    const sync = (event: Event) => setContext((event as CustomEvent<FinanceContext>).detail);
    const storage = () => setContext(savedFinanceContext());
    window.addEventListener(FINANCE_EVENT, sync); window.addEventListener('storage', storage);
    return () => { window.removeEventListener(FINANCE_EVENT, sync); window.removeEventListener('storage', storage); abortRef.current?.abort(); };
  }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, pending]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  function localExplanation(text: string) {
    const cash = context.cash;
    const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const prefix = context.source === 'demo' ? copy('Ví dụ minh họa — ', 'Illustrative example — ') : '';
    if (/wape|margin|profit|loi nhuan|bien/.test(normalized)) return copy('Lợi nhuận và tiền mặt khác nhau. Lợi nhuận vận hành trong Kế hoạch & vốn bằng lợi nhuận đóng góp trừ chi phí cố định, trước thuế và lãi vay. Dòng tiền xét ngày thực thu và thực chi; bán có lãi vẫn có thể thiếu tiền khi phải trả nhà cung cấp trước lúc tiền sàn về. WAPE đo sai số dự báo lượng bán trên ngày kiểm tra, không xác nhận độ nhạy giá.', 'Profit and cash are different. Operating profit in Planning & capital is contribution less fixed costs, before tax and financing costs. Cash flow follows payment dates: a profitable sale can still leave a funding gap if suppliers are paid before marketplace settlement. WAPE measures sales forecast error on held-out days, not the validity of price elasticity.');
    if (!cash) return copy('Mở Dòng tiền, nhập số dư đầu ngày và các khoản thu–chi dự kiến. Sau đó bạn có thể hỏi về đáy tiền, dự phòng hoặc ảnh hưởng của nhập hàng. Trong Kế hoạch & vốn, nhập CSV bán hàng riêng của doanh nghiệp để so sánh phương án; dữ liệu đối thủ không được dùng thay cho doanh số của bạn.', 'Open Cash flow and enter start-of-day cash plus expected movements. You can then ask about cash troughs, reserves or inventory impact. In Planning & capital, import your own sales CSV to compare options; competitor data does not substitute for your sales history.');
    if (/nhap|inventory|order|supplier/.test(normalized)) {
      if (!context.inventoryScenario) return prefix + copy('Trong Dòng tiền, bật “Xem tác động đơn nhập”, nhập tiền và ngày trả nhà cung cấp. Có thể lấy chi phí từ bản duyệt trong Kế hoạch & vốn. Khoản thu thêm phải là tiền thực dự kiến về, không phải doanh thu; chọn khoản chi bị thay thế nếu đơn này đã nằm trong sổ để tránh tính trùng.', 'In Cash flow, enable the inventory preview and enter the supplier payment amount and date. You may load the cost from an approved plan. Additional receipts must be expected cash, not revenue; select replaced payments if this order is already recorded to avoid double-counting.');
      const plan = context.inventoryScenario;
      return (plan.source === 'demo' ? copy('Đơn nhập minh họa — ', 'Illustrative order — ') : prefix) + copy(`Đơn nhập cần ${money(plan.orderCost)} vào ${date(plan.purchaseDate)}. Đáy tiền sau đơn là ${money(plan.cashTrough)}; cần ${money(plan.additionalFunding)} để giữ dự phòng. Kết quả là mô phỏng, chưa đặt hàng. Kiểm tra đủ chi phí bán hàng và ngày tiền thực về trước khi quyết định.`, `The order needs ${money(plan.orderCost)} on ${date(plan.purchaseDate)}. The resulting cash trough is ${money(plan.cashTrough)}; maintaining the reserve requires ${money(plan.additionalFunding)}. This is a simulation, not an order. Check selling costs and actual settlement dates before deciding.`);
    }
    return prefix + copy(`Theo sổ Dòng tiền ${cash.horizonDays} ngày: tiền hiện tại ${money(cash.currentBalance)}, dự kiến thu ${money(cash.expectedInflows)} và chi ${money(cash.expectedOutflows)}. Đáy tiền ${money(cash.lowestBalance)} vào ${cash.lowestBalanceDate ? date(cash.lowestBalanceDate) : '—'}; cần ${money(cash.additionalFunding)} để duy trì dự phòng ${money(cash.minimumReserve)}. Khoản thu quá hạn ${money(cash.overdueReceivables)} chưa tự được tính là tiền về. Đây là phép tính từ sổ và giả định, không phải dự đoán đã được AI xác nhận.`, `In your ${cash.horizonDays}-day Cash flow ledger: current cash is ${money(cash.currentBalance)}, expected inflows ${money(cash.expectedInflows)} and outflows ${money(cash.expectedOutflows)}. The lowest balance is ${money(cash.lowestBalance)} on ${cash.lowestBalanceDate ? date(cash.lowestBalanceDate) : '—'}; ${money(cash.additionalFunding)} is needed to maintain the ${money(cash.minimumReserve)} reserve. Overdue receivables of ${money(cash.overdueReceivables)} are not automatically counted as incoming cash. This is a calculation from your ledger and assumptions, not an AI-validated prediction.`);
  }
  async function send(text = question) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    if (mode === 'ai' && (!consent || !pilotToken.trim())) { setError(copy('Cần đồng ý gửi dữ liệu và nhập mã truy cập pilot trước khi dùng AI.', 'Consent and a pilot access code are required before using AI.')); return; }
    const recent = messages.filter(m => m.mode === mode).slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 1600) }));
    setMessages(current => [...current, { role: 'user', content: trimmed, mode }]); setQuestion(''); setError('');
    if (mode === 'guide') {
      setMessages(current => [...current, { role: 'assistant', content: localExplanation(trimmed), mode: 'guide' }]); return;
    }
    setPending(true);
    const controller = new AbortController(); abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 28_000);
    try {
      const response = await fetch('/api/financial-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-mavericks-pilot-token': pilotToken },
        body: JSON.stringify({ locale, question: trimmed, history: recent, context }), signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error(copy('Mã pilot chưa đúng. Kiểm tra lại mã do quản trị viên cung cấp.', 'Invalid pilot code. Check the code provided by your administrator.'));
        if (response.status === 429) throw new Error(copy('Đã đến giới hạn lượt hỏi. Thử lại sau ít phút.', 'Request limit reached. Try again in a few minutes.'));
        if ([404, 503].includes(response.status)) throw new Error(copy('AI chưa được bật trên máy chủ này. Quản trị viên cần cấu hình Netlify Function và khóa API. Bạn vẫn có thể dùng mục Giải thích số liệu.', 'AI is not enabled on this server. An administrator must configure the Netlify Function and API key. The Data guide remains available.'));
        throw new Error(copy('Chưa nhận được trả lời từ AI. Thử lại; dữ liệu không bị thay đổi.', 'The AI request could not be completed. Try again; your data is unchanged.'));
      }
      const result = await response.json();
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error(copy('Phản hồi AI không hợp lệ.', 'Invalid AI response.'));
      setMessages(current => [...current, { role: 'assistant', content: result.answer, mode: 'ai' }]);
      setLastContext(result.contextAsOf || context.asOf);
      setWarnings(Array.isArray(result.warnings) ? result.warnings.filter((w: unknown): w is string => typeof w === 'string').slice(0, 3) : []);
    } catch (cause) { setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : copy('Đã dừng yêu cầu hoặc hết thời gian chờ. Bạn có thể thử lại.', 'Request stopped or timed out. You can try again.')); }
    finally { clearTimeout(timer); abortRef.current = null; setPending(false); }
  }
  function close() { setOpen(false); openerRef.current?.focus(); }
  function submit(event: FormEvent) { event.preventDefault(); void send(); }
  return <>
    <button ref={openerRef} className={`assistant-launcher ${open ? 'is-open' : ''}`} aria-expanded={open} aria-controls="financial-assistant-panel" onClick={() => open ? close() : setOpen(true)}><MessageSquare size={18}/><span>{copy('Trợ lý tài chính', 'Finance assistant')}</span></button>
    {open && <section id="financial-assistant-panel" data-workspace-view={view} className="assistant-panel" role="dialog" aria-modal="false" aria-label={copy('Trợ lý tài chính Mavericks', 'Mavericks finance assistant')} onKeyDown={e => { if (e.key === 'Escape') close(); }}>
      <header><span className="assistant-avatar"><BookOpen size={20}/></span><div><h2>{copy('Cùng hiểu con số', 'Make sense of the numbers')}</h2><small>{copy('Mavericks · Financial Assistant', 'Mavericks · Financial Assistant')}</small></div><button className="cash-icon-button" onClick={close} aria-label={copy('Đóng trợ lý', 'Close assistant')}><X size={18}/></button></header>
      <div className="assistant-tabs" role="group" aria-label={copy('Chế độ trợ lý', 'Assistant mode')}><button aria-pressed={mode === 'guide'} disabled={pending} onClick={() => { setMode('guide'); setError(''); }}>{copy('Giải thích số liệu', 'Data guide')}</button><button aria-pressed={mode === 'ai'} disabled={pending} onClick={() => { setMode('ai'); setError(''); }}>{copy('Hỏi AI · pilot', 'Ask AI · pilot')}</button><button className="assistant-reset" disabled={pending} onClick={() => { setMessages([]); setLastContext(''); setWarnings([]); }} aria-label={copy('Xóa hội thoại trên phiên này', 'Clear this session conversation')}><RefreshCw size={13}/></button></div>
      <div className="assistant-context"><ShieldCheck size={14}/><span>{context.cash ? copy(`Dòng tiền ${context.cash.horizonDays} ngày · ${context.source === 'demo' ? 'minh họa' : 'sổ của bạn'}`, `${context.cash.horizonDays}-day cash ledger · ${context.source === 'demo' ? 'demo' : 'manual'}`) : copy('Chưa có sổ dòng tiền', 'No cash ledger yet')}{context.cash?.receiptDelayDays ? copy(` · thu chậm ${context.cash.receiptDelayDays} ngày`, ` · receipts delayed ${context.cash.receiptDelayDays} days`) : ''}{context.inventoryScenario ? context.inventoryScenario.source === 'demo' ? copy(' · đơn nhập minh họa', ' · illustrative order preview') : copy(' · có mô phỏng nhập hàng', ' · inventory preview included') : ''}</span></div>
      {mode === 'ai' && <details className="assistant-setup" open={!consent || !pilotToken}><summary>{copy('Quyền truy cập & dữ liệu gửi cho AI', 'Access & data sent to AI')}</summary><p>{copy('AI nhận câu hỏi, tối đa 6 tin nhắn trước và số liệu tổng hợp từ Dòng tiền. Không gửi tên khách hàng, từng giao dịch hay mật khẩu. Không nhập thông tin nhạy cảm vào câu hỏi. AI chỉ giải thích, không thao tác tài chính.', 'AI receives your question, up to 6 previous messages, and aggregate Cash flow figures. Customer names, ledger entries and passwords are not sent. Do not put sensitive information in questions. AI explains only and cannot perform financial actions.')}</p><label className="ps-field"><span>{copy('Mã truy cập pilot · không phải API key', 'Pilot access code · not an API key')}</span><input type="password" value={pilotToken} maxLength={512} autoComplete="off" onChange={e => setPilotToken(e.target.value)} placeholder={copy('Mã do quản trị viên cung cấp', 'Code from your administrator')}/></label><label className="cash-toggle"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{copy('Tôi đồng ý gửi thông tin trên tới dịch vụ AI.', 'I consent to sending the above information to the AI service.')}</span></label></details>}
      <div ref={logRef} className="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text">{!messages.filter(m => m.mode === mode).length && <div className="assistant-welcome"><h3>{copy('Bạn muốn hiểu điều gì?', 'What would you like to understand?')}</h3><p>{mode === 'guide' ? copy('Giải thích bằng công thức và số liệu trong sổ, chạy ngay trên thiết bị — không phải mô hình AI.', 'Formula-based explanations from your ledger, running on this device — not an AI model.') : copy('Đặt câu hỏi tự nhiên. AI sẽ giải thích từ số liệu bạn cho phép gửi và nói rõ phần cần thêm dữ liệu.', 'Ask in your own words. AI explains the figures you consent to send and identifies missing information.')}</p>{[copy('Vì sao có lãi mà vẫn thiếu tiền?', 'Why can a profitable business run short of cash?'), copy('Tôi cần chuẩn bị thêm bao nhiêu vốn?', 'How much additional funding should I prepare?'), copy('Nhập hàng ảnh hưởng dòng tiền thế nào?', 'How does an inventory order affect cash flow?')].map(q => <button key={q} disabled={pending} onClick={() => void send(q)}>{q}<ArrowUp size={12}/></button>)}</div>}{messages.filter(m => m.mode === mode).map((m, i) => <article key={i} className={`assistant-message ${m.role}`}><span>{m.role === 'user' ? copy('BẠN', 'YOU') : m.mode === 'ai' ? 'AI · OpenAI' : copy('GIẢI THÍCH TỪ SỔ', 'LEDGER GUIDE')}</span><p>{m.content}</p></article>)}{pending && <p className="assistant-pending"><RefreshCw className="spin" size={14}/>{copy('Đang đọc số liệu…', 'Reading the figures…')}</p>}{error && <p className="assistant-error" role="alert">{error}</p>}</div>
      <form onSubmit={submit} className="assistant-composer"><textarea ref={inputRef} aria-label={copy('Câu hỏi cho trợ lý', 'Question for assistant')} rows={2} maxLength={1200} value={question} onChange={e => setQuestion(e.target.value)} placeholder={copy('Hỏi về dòng tiền, vốn, cách dùng…', 'Ask about cash, funding or how to use the app…')} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/><Button size="icon" type={pending ? 'button' : 'submit'} disabled={!pending && !question.trim()} onClick={pending ? () => abortRef.current?.abort() : undefined} aria-label={pending ? copy('Dừng yêu cầu', 'Stop request') : copy('Gửi câu hỏi', 'Send question')}>{pending ? <X size={16}/> : <ArrowUp size={18}/>}</Button></form><footer><Check size={12}/>{copy('Bạn quyết định. Trợ lý không đổi giá, đặt hàng hay chuyển tiền.', 'You decide. The assistant cannot reprice, order or transfer money.')}{mode === 'ai' && warnings.map(w => <small key={w}>{w}</small>)}{lastContext && <small>{copy('Dữ liệu đã gửi', 'Context sent')}: {date(lastContext)}</small>}</footer>
    </section>}
  </>;
}
