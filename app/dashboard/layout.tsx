import type { Metadata } from 'next';
import './dashboard-base.css';
import './profit-studio.css';
import './commerce-theme.css';

export const metadata: Metadata = {
  title: 'Profit & Intelligence Workspace | Mavericks',
  description: 'Theo dõi đối thủ, so sánh phương án giá, dự báo nhu cầu và lập kế hoạch vốn nhập hàng cho brand.',
  openGraph: {
    title: 'Mavericks Intelligence Control Room',
    description: 'Decision support biến snapshot Shopee Việt Nam thành cặp SKU đã xác nhận và hành động có guardrail.',
    images: [{ url: '/mavericks-dashboard-social.png', width: 1733, height: 909, alt: 'Mavericks Market Intelligence dashboard' }],
  },
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
