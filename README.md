# Mavericks — Market Intelligence Product Site

Website giới thiệu độc lập cho **Mavericks Market Intelligence** — nền tảng biến dữ liệu thị trường thành quyết định SKU, giá và biên lợi nhuận có guardrail.

## Trải nghiệm trực tuyến

- Product site: [meet-mavericks.ngophat031.chatgpt.site](https://meet-mavericks.ngophat031.chatgpt.site)
- MVP dashboard: [mavericks-market-intelligence.ngophat031.chatgpt.site](https://mavericks-market-intelligence.ngophat031.chatgpt.site)

## Nội dung chính

- Product story dành cho mentor và decision maker.
- Mô phỏng Intelligence Control Room có chiều sâu.
- Quy trình tương tác `Signal → Match → Simulate → Decide`.
- Giới thiệu Hybrid SKU Matching, Pricing Guardrail và Data Trust Layer.
- Thông tin hai thị trường Việt Nam và Indonesia.
- Responsive cho desktop, tablet và mobile.

## Chạy trên máy

Yêu cầu Node.js 22.13 trở lên.

```bash
npm install
npm run dev:next
```

Mở `http://localhost:3000`.

## Deploy lên Netlify

Repository đã có sẵn `netlify.toml`, vì vậy không cần nhập thủ công build setting:

1. Trong Netlify, chọn **Add new site → Import an existing project**.
2. Kết nối GitHub và chọn repository này.
3. Netlify tự nhận:
   - Build command: `npm run build:netlify`
   - Publish directory: `out`
4. Chọn **Deploy site**.

Đây là static export nên không cần database, server hoặc biến môi trường khi deploy landing page.

## Các lệnh hữu ích

```bash
npm run dev:next       # Chạy bằng Next.js
npm run build:netlify  # Tạo static export trong thư mục out
npm run lint           # Kiểm tra mã nguồn
npm run build          # Build cho OpenAI Sites/Vinext
```

## Bảo mật dữ liệu

Repository chỉ chứa website giới thiệu. Không có mật khẩu PostgreSQL, chuỗi kết nối database hay dữ liệu bí mật. CTA trên website dẫn sang MVP dashboard đã được triển khai riêng.
