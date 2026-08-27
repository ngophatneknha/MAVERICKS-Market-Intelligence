import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.URL || 'http://localhost:3000'),
  title: 'Mavericks Market Intelligence for SEA Commerce',
  description: 'Biến tín hiệu thị trường thành quyết định SKU, giá và biên lợi nhuận rõ ràng.',
  openGraph: {
    title: 'Mavericks — Thấy tín hiệu. Chọn đúng SKU.',
    description: 'Market Intelligence biến dữ liệu Việt Nam và Indonesia thành quyết định SKU, giá và margin có guardrail.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/og.png', width: 1728, height: 910, alt: 'Mavericks - Market Intelligence for SEA Commerce' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mavericks - Thấy tín hiệu. Chọn đúng SKU.',
    description: 'Market Intelligence cho thương mại điện tử Đông Nam Á.',
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
