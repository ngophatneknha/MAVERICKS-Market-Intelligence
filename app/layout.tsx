import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.URL || 'http://localhost:3000'),
  title: 'Mavericks Decision Support for Vietnam Commerce',
  description: 'Từ tín hiệu giá đến SKU đã xác nhận và quyết định thương mại có guardrail cho Category Manager.',
  openGraph: {
    title: 'Mavericks — Thấy tín hiệu. Chọn đúng SKU.',
    description: 'MVP biến mẫu đối thủ Việt Nam thành luồng detect, match, guardrail và recommend có human approval.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/og.png', width: 1728, height: 910, alt: 'Mavericks - Market Intelligence decision support' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mavericks - Thấy tín hiệu. Chọn đúng SKU.',
    description: 'Decision support cho Category Manager trên mẫu đối thủ Việt Nam.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
