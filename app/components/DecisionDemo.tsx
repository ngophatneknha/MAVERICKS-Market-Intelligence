'use client';

import { useState } from 'react';

const steps = [
  { id: 'signal', number: '01', label: 'Signal', title: 'Phát hiện biến động', description: 'Xác định SKU thay đổi giá từ 10%, ưu tiên theo mức độ và lượng bán.', metric: '-18.4%', metricLabel: 'PRICE CHANGE', badge: 'CRITICAL', note: 'Premium serum 30ml · VN' },
  { id: 'match', number: '02', label: 'Match', title: 'Tìm đúng sản phẩm tương đương', description: 'Chấm điểm tên, từ khóa và pack/size; hiển thị bằng chứng để review.', metric: '86%', metricLabel: 'MATCH SCORE', badge: 'HIGH', note: '3 evidence layers passed' },
  { id: 'simulate', number: '03', label: 'Simulate', title: 'Mô phỏng economics', description: 'Kết hợp COGS, phí sàn, voucher, shipping và target margin.', metric: '₫279K', metricLabel: 'MARGIN FLOOR', badge: 'GUARDED', note: '28% target margin protected' },
  { id: 'decide', number: '04', label: 'Decide', title: 'Ra quyết định có guardrail', description: 'Chỉ match/undercut khi competitive target còn trên giá sàn.', metric: 'HOLD', metricLabel: 'RECOMMENDATION', badge: 'EXPLAINED', note: 'Không cần giảm thêm' },
];

export default function DecisionDemo() {
  const [active, setActive] = useState(0);
  const item = steps[active];

  return (
    <div className="decision-demo">
      <div className="step-tabs" role="tablist" aria-label="Quy trình ra quyết định">
        {steps.map((step, index) => (
          <button key={step.id} type="button" role="tab" aria-selected={active === index} className={active === index ? 'active' : ''} onClick={() => setActive(index)}>
            <small>{step.number}</small><span>{step.label}</span><i />
          </button>
        ))}
      </div>
      <div className="demo-panel" role="tabpanel">
        <div className="demo-copy">
          <span>STEP {item.number}</span>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <div className="demo-badge"><i /> {item.badge}</div>
        </div>
        <div className="demo-orb" key={item.id}>
          <div className="orb-ring ring-one" /><div className="orb-ring ring-two" />
          <div className="orb-value"><span>{item.metricLabel}</span><strong>{item.metric}</strong><small>{item.note}</small></div>
        </div>
        <div className="demo-log">
          <span>DECISION LOG</span>
          <p><i /> Input validated</p><p><i /> Rule engine computed</p><p><i /> Evidence attached</p>
          <small>Every output is traceable</small>
        </div>
      </div>
    </div>
  );
}
