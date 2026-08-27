import type { Metadata } from 'next';
import './dashboard-base.css';
import './dashboard-theme.css';

export const metadata: Metadata = {
  title: 'Intelligence Control Room | Mavericks',
  description: 'Theo dõi đối thủ, ghép SKU tương đương và mô phỏng quyết định giá có kiểm soát lợi nhuận.',
  openGraph: {
    title: 'Mavericks Intelligence Control Room',
    description: 'Competitive intelligence biến dữ liệu Shopee thành tín hiệu, SKU match và quyết định giá có guardrail.',
    images: [{ url: '/mavericks-dashboard-social.png', width: 1733, height: 909, alt: 'Mavericks Market Intelligence dashboard' }],
  },
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
