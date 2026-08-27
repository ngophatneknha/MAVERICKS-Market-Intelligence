# Mavericks — Market Intelligence Product Site

Website giới thiệu độc lập cho **Mavericks Market Intelligence** — nền tảng biến dữ liệu thị trường thành quyết định SKU, giá và biên lợi nhuận có guardrail. Dự án được xuất thành website tĩnh và triển khai hoàn toàn trên Netlify.

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
npm run dev
```

Mở `http://localhost:3000`.

## Deploy lên Netlify

Repository đã có sẵn `netlify.toml`, vì vậy không cần nhập thủ công build setting hoặc cài Next.js Runtime:

1. Trong Netlify, chọn **Add new site → Import an existing project**.
2. Kết nối GitHub và chọn repository này.
3. Netlify tự nhận:
   - Build command: `npm run build`
   - Publish directory: `out`
4. Chọn **Deploy site**.

Đây là static export nên không cần database, server hoặc biến môi trường. Cấu hình `NETLIFY_NEXT_PLUGIN_SKIP=true` bảo đảm Netlify phát hành trực tiếp thư mục `out` và không chạy `@netlify/plugin-nextjs`.

## Các lệnh hữu ích

```bash
npm run dev            # Chạy local bằng Next.js
npm run build          # Tạo static export trong thư mục out
npm run build:netlify  # Alias của static build
npm run lint           # Kiểm tra mã nguồn
```

## Bảo mật dữ liệu

Repository chỉ chứa website giới thiệu. Không có mật khẩu PostgreSQL, chuỗi kết nối database hay dữ liệu bí mật. Website không phụ thuộc vào OpenAI Sites, ChatGPT hosting, server hoặc API riêng.
