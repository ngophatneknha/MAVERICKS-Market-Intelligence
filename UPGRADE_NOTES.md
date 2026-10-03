# Đợt nâng cấp Profit & Capital Studio — 03/10/2026

## Trải nghiệm

Mở `/dashboard/#planning`, chọn **Thử với dữ liệu minh họa** hoặc nhập sales CSV. Cập nhật giá vốn, chi phí, policy, tồn kho và vốn; chọn mức giá; xem kế hoạch 8 tuần; nhập tên CM và lưu phê duyệt. Lịch sử và bản duyệt được giữ khi tải lại trang. Backup/restore dùng để chuyển thiết bị.

Pricing Lab có nút chuyển sang kế hoạch vốn. Người dùng xác nhận lịch sử SKU thuộc đúng sản phẩm nguồn trước khi liên kết. Thay đổi đầu vào chưa chạy lại decision tree sẽ bị chặn khi chuyển phương án.

## Thay đổi có tác dụng thực tế

- Tính doanh thu sau voucher/hoàn tiền, biên đóng góp và lợi nhuận vận hành sau overhead; giữ giá vốn tiền/đơn vị cố định giữa các mức giá.
- Baseline nhu cầu dựa trên dữ liệu bán hàng của brand, loại ngày hết hàng; kiểm tra ngày thiếu/trùng và báo backtest WAPE cùng số mẫu.
- So sánh giá với độ nhạy giả định, chọn phương án khả thi theo margin, policy giá và vốn. Có ba kịch bản nhu cầu và toàn bộ công thức/giả định.
- Kế hoạch một lô nhập đầu kỳ: lead time, safety stock, lost demand, thời điểm trả NCC, settlement sàn, receivables, payable và đáy tiền hằng ngày.
- Human approval, immutable snapshots của bản duyệt trong workspace, xuất JSON evidence, CSV kế hoạch tuần và backup.
- Sửa Pricing Lab: không thay margin/COGS/ngưỡng 0 bằng số mặc định; quy đổi own voucher đúng khi tính target price; không áp lại promo minh họa −30% lên giá snapshot khi đưa cặp matching vào lab.
- Bỏ mặc định brand cụ thể; matching ban đầu tìm trên toàn bộ đối thủ. Chọn tín hiệu chuyển đúng shop đối thủ; đổi bộ lọc xóa kết quả cũ; không cho đổi bộ lọc giữa lúc matching.
- Tải market workspace theo một nguồn thống nhất. Health thành công nhưng một endpoint lỗi sẽ chuyển toàn bộ sang snapshot; không trộn rồi báo live. Có hỗ trợ API base trên domain public khi được cấu hình.
- Landing page, metadata và navigation được cập nhật để dẫn tới luồng giá → lợi nhuận → vốn.

## Kiểm chứng

- `npm test`: 22/22 đạt. Kiểm tra CSV, lịch sử, backtest không rò dữ liệu tương lai, unit economics, tồn kho, thu/chi, đáy vốn, policy và các nhánh Pricing Lab.
- `npm run lint`: đạt. `git diff --check`: không có whitespace error.
- Next.js production static export: thành công với webpack trên bản sao sạch; TypeScript và cả landing/dashboard được build. Cache `.next` cũ trong checkout bị quyền Windows của phiên trước chặn unlink; bản xuất dùng thư mục kiểm chứng riêng để giữ nguyên cache đó.
- 16 kiểm tra browser trên Chrome headless: onboarding, demo, duyệt, export log, persistence sau reload, chặn thiếu vốn, CSV lỗi, backup lỗi, không tràn mobile 390px, chặn pricing chưa cập nhật, chuyển pricing, sales CSV thật, đổi SKU, human gate cho matching, không double promo và atomic snapshot fallback. Không có page exception.

## Cập nhật giao diện workspace — 03/10/2026

- Chuyển dashboard sang nền sáng, bảng màu xanh trầm và bố cục làm việc; bỏ theme neon khỏi layout.
- Đổi điều hướng sang ngôn ngữ công việc của brand. Thay chỉ số readiness tổng hợp bằng phạm vi dữ liệu nguồn: gian hàng, SKU, ngày quan sát và dữ liệu bị loại.
- Kế hoạch hiển thị chi phí mỗi đơn vị, so sánh lợi nhuận theo mức giá, thu/chi và lịch nhập–nhận–trả tiền. Người dùng có thể chọn phương án trực tiếp từ biểu đồ so sánh.
- Đầu vào có tóm tắt và phần chỉnh sửa thu gọn; chi tiết công thức và bảng tuần mở khi cần. Ghi rõ dữ liệu demo, độ nhạy giả định và kết quả mô phỏng; lưu duyệt không thực thi thay đổi giá hay đặt hàng.
- Static export, lint và 16 kiểm tra browser đạt; không có lỗi JavaScript hoặc tràn ngang ở màn hình 390px. Không thay đổi mô hình tính toán trong đợt giao diện này.

## Giới hạn và bước tiếp theo

### Kinetic /about — lỗi chữ và chuyển động

- Xác nhận câu tiếng Việt đúng NFC; Chrome trước đó trộn glyph Georgia/Times trong cùng chữ nghiêng. Thay serif bằng Be Vietnam Pro tự host (400/600/700), giữ giấy phép OFL, bỏ italic giả và tăng line-height cho dấu.
- Đổi palette riêng trang giới thiệu sang đen/trắng/cam. Dashboard và mô hình tính toán không thay đổi.
- Pointer tilt và ánh sáng tương tác dùng CSS variables/requestAnimationFrame, vệt sáng khung sản phẩm, marquee, sao xoay, floating card và reveal khi cuộn. Có nút pause/resume; tự tắt khi prefers-reduced-motion.
- Chrome xác nhận toàn bộ glyph câu “Quyết định không nhỏ.” dùng BeVietnamPro-SemiBold, không fallback. Kiểm tra chuyển động, pause/resume, reduced motion, demo và 320/390/768/1920px đạt; build/lint đạt. Chưa push/deploy public.

### Trang giới thiệu premium — chỉ `/about/`

- Đổi từ khung trang hẹp sang full-width: hero xanh đậm điện ảnh, chữ lớn serif/sans, vàng ấm và các phần nội dung sáng thoáng.
- Thay hình minh họa đầu trang bằng product cutaway code-native. Số giá, lợi nhuận, lượng bán và vốn tính từ cùng engine với bộ demo; nhãn tổng hợp, giả định và chưa thực thi luôn có trong hình.
- Có một H1, nav sticky, trạng thái focus, nút đủ diện tích chạm và reduced-motion; không có video/ảnh ngoài, logo khách hàng hay chỉ số thành tích giả.
- Phong cách giới hạn trong `.standalone-project`; không sửa DecisionShowcase, planner hoặc dashboard.
- Build static/TypeScript và lint đạt. Kiểm tra 320/390/768/1920px không tràn ngang; kiểm tra số demo khớp engine, sticky nav, reduced-motion, CTA và app overview giữ nguyên đều đạt. Chưa push hoặc deploy public.

### Điều chỉnh vị trí trang giới thiệu theo yêu cầu

- Trang giới thiệu tách thành `/about/`, độc lập với `/dashboard/#overview`, không có sidebar hoặc màn hình vận hành của app.
- Khôi phục Overview ứng dụng về Decision Desk và các bảng vận hành không thu gọn vào trang giới thiệu. Landing gốc `/` giữ nguyên.
- Nội dung giới thiệu và demo giữ trên trang riêng; CTA dẫn vào các view dashboard bằng đường dẫn nội bộ. Không nhập hoặc thay thế dữ liệu brand.
- Build thêm route static `/about`. Kiểm tra trang riêng, không có sidebar, demo, điều hướng vào app, khôi phục overview và mobile đạt. Vẫn chưa deploy public.

### Overview giới thiệu dự án

- Tham khảo cách tổ chức nội dung sản phẩm tại Linear, Stripe và Vercel; không sao chép tài sản thương hiệu, logo khách hàng hoặc số thành tích.
- Overview chuyển sang chín phần giới thiệu: hero/sơ đồ, vấn đề, quy trình, demo, khác biệt, khách hàng, trạng thái MVP, FAQ và CTA.
- Bảng vận hành và dữ liệu thị trường cũ giữ trong phần mở rộng; các nút vẫn dẫn vào ứng dụng thật, không tạo form liên hệ giả.
- Thiết kế xanh sage/kem, typography editorial, sơ đồ code-native, chuyển động nhẹ có hỗ trợ reduced-motion; không tải font hoặc ảnh bên ngoài.
- Production build, lint, kiểm tra tám nhóm chức năng trang giới thiệu và mobile 390px đạt. Demo luôn ghi nguồn tổng hợp; giới hạn localStorage và năng lực tương lai được nêu rõ. Chưa deploy public.

### Decision Desk — bản trình diễn tương tác

- Màn hình tổng quan mở đầu bằng bố cục editorial xanh đậm/kem, thông điệp Một mức giá — Ba hệ quả và bộ thử năm mức giá.
- Demo dùng sales tổng hợp 42 ngày và cùng forecast/scenario engine của kế hoạch; hiển thị lợi nhuận, lượng bán, biên, lượng nhập và vốn qua ba bước. Không gán số liệu kết quả để trang trí.
- Bộ demo không nhập hoặc thay thế lịch sử brand. Điều hướng tới kế hoạch vẫn yêu cầu người dùng chủ động nhập dữ liệu hoặc chọn minh họa.
- Biểu đồ chỉ nối các mức giá đã thử; ghi rõ độ nhạy giả định, giới hạn mô phỏng và nhãn demo. Không tự thực thi hoặc hứa hẹn kết quả đầu tư.
- Thu gọn hero khi đã có lịch sử, tăng phân cấp phương án giá và đưa giải thích nguồn vào details; nhãn demo/giả định vẫn hiện ở trạng thái thu gọn.

### Theo dõi kết quả sau phê duyệt

- Thêm tab Kết quả thực tế: chọn bản duyệt và kỳ lũy kế 1–8 tuần; ghi lượng bán, doanh thu sau giảm giá/hoàn tiền, lợi nhuận vận hành, người nhập, nguồn và bối cảnh.
- So sánh đúng số tuần từ snapshot đã duyệt; overhead dùng giá trị lúc duyệt. Không cập nhật ngược bản dự kiến hoặc lấy giả định mới thay thế.
- Cho phép thực tế lỗ, không hiển thị tỷ lệ tăng lợi nhuận khi dự kiến bằng 0 hoặc âm; chặn số sai và kỳ tương lai đối với bản không-demo.
- Ghi nhận mới được thêm vào lịch sử tối đa 20 bản/quyết định. Backup cũ không có outcomes vẫn tương thích; backup có outcomes được kiểm tra trước khi thay workspace. Có xuất báo cáo JSON gồm đầu vào, bản dự kiến và kết quả đối chiếu.
- Kết quả nhập thủ công, lưu trình duyệt, chưa xác thực người ghi, chưa kết nối sàn/kế toán; không chứng minh tác động nhân quả hoặc tự học độ nhạy giá. Bản demo luôn giữ nhãn thử nghiệm.

### Đợt cải thiện trải nghiệm ra quyết định

- Tổng quan bắt đầu bằng tối đa ba biến động có chênh lệch tuyệt đối lớn nhất trong mẫu, kèm giá trước/sau và ngày; không gọi là cảnh báo thời gian thực. Nút mở luồng matching theo gian hàng tín hiệu, vẫn cần chọn và duyệt cặp SKU.
- Thu gọn KPI phiên làm việc, bỏ hero quảng cáo; thêm lối tắt kiểm tra dữ liệu và kế hoạch vốn.
- Inspector bổ sung đối chiếu thương hiệu, pack, size và giá; nêu rõ điểm tương đồng không phải xác suất đúng, thuộc tính nhận diện bằng quy tắc chưa xác minh đơn vị.
- Kế hoạch phân biệt bốn nguồn: lịch sử nhập/demo, chi phí người dùng nhập, giả định độ nhạy và kết quả mô phỏng. Bảng đánh đổi cập nhật theo phương án đang chọn so với giữ giá.
- Hướng dẫn nhập CSV có thể mở lại, ba bước kiểm tra, ví dụ định dạng, mẫu 42 ngày minh họa và lưu ý nhập mới thay lịch sử hiện tại.
- Build TypeScript/static export và lint đạt. 16 luồng browser cũ cùng 8 nhóm kiểm tra trải nghiệm mới đạt, không có page exception; kiểm tra mobile 390px không tràn ngang. Chưa push hoặc triển khai public.

Đây là bản tính toán và workflow MVP, chưa phải AI học độ nhạy giá hoặc tự thực thi. Độ nhạy giá, economics, tồn kho và tiền là giả định/đầu vào cần brand xác nhận. Lợi nhuận vận hành chưa trừ thuế và chi phí tài chính. Chưa tối ưu nhiều lần nhập hoặc MOQ/expiry.

Workspace lưu localStorage và tối đa 50 bản duyệt. Tên CM tự nhập; chưa có xác thực, phân quyền tenant, server audit log hoặc đồng bộ đội nhóm. Bản duyệt cũ là snapshot của thời điểm duyệt; chưa được đối chiếu với actual outcome. Cần design partner pilot và backend theo `PRODUCT_ROADMAP.md` để đưa vào vận hành thật.

Nguồn được chỉnh ở `mavericks-product-site`; bản `market-intelligence-mvp` cũ giữ vai trò backend/thử nghiệm, chưa đồng bộ các module UI mới.

Đợt này tạo bản build và gói Netlify dùng thử; chưa push GitHub hoặc cập nhật deployment công khai.
