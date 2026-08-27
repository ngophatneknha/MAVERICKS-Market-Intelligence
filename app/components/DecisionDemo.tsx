'use client';

import { useState } from 'react';

const steps = [
  { id: 'signal', number: '01', label: 'Detect', title: 'Phát hiện biến động', description: 'Xác định SKU thay đổi giá từ 10%, ưu tiên theo mức độ và monthly_sold snapshot.', metric: '-18.4%', metricLabel: 'PRICE CHANGE', badge: 'SNAPSHOT', note: 'Vietnam snack tracked set' },
  { id: 'match', number: '02', label: 'Match', title: 'Xác nhận SKU tương đương', description: 'Chấm điểm taxonomy, tên, từ khóa và pack/size; Category Manager duyệt trước khi đi tiếp.', metric: '86%', metricLabel: 'MATCH SCORE', badge: 'HUMAN REVIEW', note: 'Evidence attached · approval required' },
  { id: 'simulate', number: '03', label: 'Guardrail', title: 'Tính effective price & economics', description: 'Áp voucher đối thủ và kiểm tra COGS, phí sàn, return, ads, campaign spend cùng target margin.', metric: '₫48K', metricLabel: 'MARGIN FLOOR', badge: 'GUARDED', note: 'Assumptions are visible' },
  { id: 'decide', number: '04', label: 'Recommend', title: 'Đề xuất hành động có lý do', description: 'Decision tree ưu tiên NO ACTION, chỉ match khi gap đủ lớn và target còn trên margin floor.', metric: 'NO ACTION', metricLabel: 'RECOMMENDATION', badge: 'EXPLAINED', note: 'Không cần giảm thêm · human owned' },
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
          <p><i /> Input validated</p><p><i /> Evidence attached</p><p><i /> Human approval recorded</p>
          <small>Every output is traceable · no auto-execution</small>
        </div>
      </div>
    </div>
  );
}
