import type { Metadata } from 'next';
import './dashboard-base.css';
import './dashboard-theme.css';

export const metadata: Metadata = {
  title: 'Intelligence Control Room | Mavericks',
  description: 'Luồng detect, match, human approval, pricing guardrail và recommend trên mẫu đối thủ Việt Nam.',
  openGraph: {
    title: 'Mavericks Intelligence Control Room',
    description: 'Decision support biến snapshot Shopee Việt Nam thành cặp SKU đã xác nhận và hành động có guardrail.',
    images: [{ url: '/mavericks-dashboard-social.png', width: 1733, height: 909, alt: 'Mavericks Market Intelligence dashboard' }],
  },
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
