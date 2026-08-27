import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'latin-ext'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://meet-mavericks.ngophat031.chatgpt.site'),
  title: 'Mavericks — Market Intelligence for SEA Commerce',
  description: 'Biến tín hiệu thị trường thành quyết định SKU, giá và biên lợi nhuận rõ ràng.',
  openGraph: {
    title: 'Mavericks — Thấy tín hiệu. Chọn đúng SKU.',
    description: 'Market Intelligence biến dữ liệu Việt Nam và Indonesia thành quyết định SKU, giá và margin có guardrail.',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/og.png', width: 1728, height: 910, alt: 'Mavericks — Market Intelligence for SEA Commerce' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mavericks — Thấy tín hiệu. Chọn đúng SKU.',
    description: 'Market Intelligence cho thương mại điện tử Đông Nam Á.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
