# Mavericks — Market Intelligence Product Site

**Mavericks Profit & Market Intelligence** kết nối tín hiệu đối thủ với quyết định giá, lợi nhuận, tồn kho và kế hoạch vốn của brand. Landing page và ứng dụng dùng chung repository, xuất tĩnh và chạy trên Netlify.

## Cấu trúc trải nghiệm

- `/` — trang giới thiệu sản phẩm mới, nhận diện đen–trắng–cam, chuyển động và bản demo; thay thế landing page cũ trên cùng domain.
- `/about/` — đường dẫn trực tiếp tới cùng trang giới thiệu, giữ tương thích với các liên kết đã chia sẻ.
- `/dashboard/` — Intelligence Control Room tương tác đầy đủ.
- `/dashboard/#planning` — Profit & Capital Studio: nhập bán hàng CSV, so sánh giá và lập kế hoạch vốn 8 tuần.
- `/dashboard/#cashflow` — Financial Desk: số dư có ngày đối chiếu, sổ thu–chi và dự báo dòng tiền 30/60/90 ngày.

## Financial Assistant cho SMEs

Dashboard có nút **VI / EN**; ngôn ngữ được lưu trên trình duyệt. Nhãn, hướng dẫn và định dạng số đổi theo ngôn ngữ, còn tên sản phẩm, nguồn dữ liệu và ghi chú do người dùng nhập được giữ nguyên. Trang giới thiệu chưa nằm trong phạm vi chuyển ngôn ngữ này.

Trong **Dòng tiền**:

1. Nhập tổng tiền thực có **đầu ngày** tại ngày đối chiếu và mức dự phòng cần giữ. Đây là số dư do người dùng nhập, không phải ngân hàng kết nối trực tiếp.
2. Thêm khoản thu–chi với số tiền, ngày dự kiến và trạng thái. Khi đã thanh toán, cập nhật ngày thực thu/chi; không tự cộng lại khoản đó vào số dư đầu kỳ.
3. Chọn dự báo 30/60/90 ngày, thử thu chậm 7/14 ngày. Khoản chi quá hạn được xếp vào ngày đầu dự báo; khoản thu quá hạn chưa chắc thu được nên được loại trừ cho đến khi cập nhật ngày hoặc xác nhận đã thu.
4. Thử một đơn nhập hàng, hoặc lấy tiền nhập từ bản duyệt trong Kế hoạch & vốn. Xác nhận ngày trả nhà cung cấp. Doanh thu không tự chuyển thành tiền mặt; chỉ thêm khoản tiền thực dự kiến về chưa có trong sổ. Chọn khoản chi được thay thế nếu đơn này đã có trong sổ để không tính hai lần.
5. Xem đáy tiền **trước khoản thu cùng ngày**, vốn để duy trì dự phòng, bảng tiền từng ngày; tải CSV hoặc sao lưu/khôi phục JSON. Mô phỏng chưa tạo khoản phải trả và chưa đặt hàng.

Dữ liệu mới ban đầu trống; **Xem ví dụ** là bộ số liệu tổng hợp minh họa, được đánh dấu riêng. Workspace lưu localStorage trên thiết bị này, chưa đồng bộ đa người dùng. Hãy sao lưu trước khi thay dữ liệu hoặc chuyển máy.

Nút **Trợ lý tài chính** có hai chế độ:

- **Giải thích số liệu**: giải thích theo công thức và số liệu sổ tiền ngay trên thiết bị, không giả danh mô hình AI.
- **Hỏi AI · pilot**: gọi OpenAI từ Netlify Function, cần cấu hình máy chủ, mã truy cập pilot và sự đồng ý gửi câu hỏi/lịch sử ngắn/số liệu tổng hợp. Khóa API không được đưa vào frontend. Trợ lý chỉ giải thích, không đổi giá, đặt hàng hoặc chuyển tiền.

Xem [hướng dẫn cấu hình AI trên Netlify](docs/AI_ASSISTANT_SETUP.md). `npm run dev` hoặc preview tĩnh chỉ chạy frontend; không tự chạy Netlify Function. AI tắt mặc định và UI hiển thị trạng thái chưa cấu hình thay vì trả lời giả. Chưa có yêu cầu OpenAI tính phí nào được thực hiện trong quá trình kiểm thử.

Các CTA trên landing page dẫn thẳng tới dashboard cùng domain, không phụ thuộc website hoặc runtime bên ngoài.

Chỉ có một phiên bản trang giới thiệu dùng chung cho `/` và `/about/`. Logo trong dashboard trở về trang chủ mới; app và dữ liệu trình duyệt vẫn giữ nguyên. Deploy bản này lên site Netlify hiện có sẽ thay giao diện cũ, không cần xóa site hoặc đổi domain.

## Nội dung chính

- Product story dành cho mentor và decision maker.
- Mô phỏng Intelligence Control Room có chiều sâu.
- Quy trình tương tác `Signal → Match → Simulate → Decide`.
- Giới thiệu Hybrid SKU Matching, Pricing Guardrail và Data Trust Layer.
- Dashboard thật với Overview, Price Alerts, SKU Matching, Pricing Lab và Data Quality.
- Trải nghiệm chính dùng snapshot mẫu đối thủ Việt Nam; phạm vi ngày, SKU và shop được đọc từ dữ liệu thay vì gán cứng.
- Matcher có evidence review và bắt buộc Category Manager duyệt trước khi chuyển sang Pricing Lab.
- Pricing Lab tính effective price, margin floor và decision tree `NO_ACTION / MONITOR / MATCH_UNDERCUT / DEFEND_MARGIN / HUMAN_REVIEW`.
- Responsive cho desktop, tablet và mobile.
- Profit & Capital Studio: baseline từ sales CSV thật của brand, backtest WAPE, elasticity nhập thủ công, giá vốn bằng tiền/đơn vị và guardrails theo vốn.
- Dòng tiền theo ngày tổng hợp thành tuần: lead time, thời điểm trả NCC, settlement của sàn, mất nhu cầu khi thiếu hàng, tồn cuối kỳ và vốn thiếu.
- Decision log có tên CM, giả định và kết quả ở thời điểm duyệt; lưu localStorage, có backup/restore, xuất JSON evidence và kế hoạch CSV.
- Đối chiếu kết quả thực tế với bản duyệt đã đóng băng, theo kỳ 1–8 tuần; lưu nguồn dữ liệu và lịch sử cập nhật để tránh sửa ngược giả định.

## Trải nghiệm Profit & Capital

1. Mở `/dashboard/#planning` và chọn **Thử với dữ liệu minh họa**, hoặc import CSV của brand.
2. CSV cần `date,sku,units,price,stockout`, một dòng/SKU/ngày. `price` là giá niêm yết trước voucher, `stockout` là 0 hoặc 1. Ghi cả ngày bán 0; cần ít nhất 14 ngày có hàng và chuỗi ngày liên tục.
3. Nhập giá vốn thực, phí, policy margin, tồn kho, tiền sẵn có và kỳ thanh toán. Các giá trị ban đầu là giả định để thử sản phẩm.
4. So sánh phương án giá và các blocker. Chọn phương án, xem dòng tiền, rồi nhập tên CM để ghi nhận bản duyệt.
5. Dùng **Backup** trước khi chuyển máy. Dữ liệu không tự đồng bộ lên server. Khôi phục backup sẽ thay workspace trên trình duyệt hiện tại.
6. Trong phần **Kết quả thực tế**, nhập kết quả theo cùng kỳ với bản duyệt và ghi nguồn đối chiếu. Đây là so sánh kế hoạch–thực tế, không phải bằng chứng tác động nhân quả của một quyết định giá.

Mô hình hiện tại là baseline có thể giải thích, chưa phải AI học elasticity hoặc tối ưu toàn cục. Lợi nhuận vận hành mô phỏng chưa trừ thuế/chi phí tài chính. Không tự thực thi đổi giá hoặc đặt hàng. [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) ghi phạm vi hiện tại và các bước pilot tiếp theo.

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

Đây là static export; mặc định dùng snapshot đối thủ và CSV của brand trên trình duyệt, không cần database/server. Cấu hình `NETLIFY_NEXT_PLUGIN_SKIP=true` phát hành trực tiếp thư mục `out`.

Build production dùng Webpack để thống nhất với bản build đã kiểm thử. Sau khi deploy, truy cập `/about/` để xem trang giới thiệu và `/dashboard/` để mở ứng dụng, đều trên domain Netlify. Netlify cung cấp biến `URL` khi build để tạo đường dẫn chia sẻ đúng domain.

Nếu có HTTPS API riêng, đặt `NEXT_PUBLIC_API_BASE_URL` trước lúc build và cấu hình CORS đúng origin trên backend. UI chỉ báo live khi toàn bộ market workspace tải được từ API; nếu không sẽ dùng toàn bộ snapshot. Matching giữ cùng nguồn với workspace đang mở. Credentials PostgreSQL chỉ được đặt ở backend, không đưa vào biến NEXT_PUBLIC.

## Các lệnh hữu ích

```bash
npm run dev            # Chạy local bằng Next.js
npm run build          # Tạo static export trong thư mục out
npm run build:netlify  # Alias của static build
npm run lint           # Kiểm tra mã nguồn
npm test               # Kiểm thử forecast, economics, inventory, cash và pricing regressions
```

## Bảo mật dữ liệu

CSV bán hàng và decision log lưu trên trình duyệt người dùng; không commit vào Git. Repository dùng snapshot thị trường, không chứa credentials PostgreSQL. Phiên bản static không phụ thuộc ChatGPT hosting. Để phục vụ đội nhóm cần backend có xác thực, tenant, phân quyền và audit log theo roadmap.

Font Be Vietnam Pro được lưu tại `public/fonts/be-vietnam-pro`, kèm giấy phép SIL Open Font License trong `OFL.txt`.
