# MAVERICKS — Financial Desk cho SME thương mại

## Phạm vi bản nâng cấp

Market Intelligence tiếp tục cung cấp tín hiệu cạnh tranh, matching SKU và phương án giá. Financial Desk bổ sung sổ dòng tiền của chính doanh nghiệp, để nối quyết định giá/nhập hàng với thời điểm phải có tiền. Không dùng doanh số snapshot của đối thủ để thay số liệu doanh nghiệp.

### VI / EN

Chuyển ngôn ngữ tại thanh công cụ dashboard; lựa chọn lưu trên thiết bị. Dashboard, Kế hoạch & vốn, Đối chiếu kết quả, Dòng tiền và Trợ lý đều có nhãn và hướng dẫn tương ứng. Tên sản phẩm, gian hàng, nguồn CSV và nội dung người dùng ghi được giữ nguyên. Trang giới thiệu About chưa được dịch trong bản nâng cấp này.

### Dòng tiền

- Số dư gắn với đầu ngày đối chiếu, mức dự phòng người dùng đặt.
- Khoản thu–chi có ngày dự kiến, trạng thái dự kiến/đã thanh toán/hủy và ngày thực thu–chi.
- Số dư hiện tại chỉ dùng giao dịch đã thực hiện; giao dịch trước ngày đầu kỳ được xem đã nằm trong số dư, không tính lần nữa.
- Dự báo 30/60/90 ngày theo lịch đã nhập; thử khoản thu chậm 7 hoặc 14 ngày.
- Khoản chi quá hạn xếp ngay vào ngày đầu dự báo; khoản thu quá hạn chưa được tự tính như tiền chắc chắn về.
- Đáy tiền xét chi trước thu cùng ngày. Vốn bù để giữ dự phòng khác với vốn bù để số dư không âm.
- Mô phỏng nhập hàng không sửa sổ gốc. Có thể lấy tiền nhập từ bản kế hoạch đã duyệt, nhưng người dùng xác nhận lại ngày thanh toán thực tế.
- Khoản thu thêm là giả định người dùng nhập; không tự coi doanh thu dự báo là tiền sẵn có. Khoản đã nằm trong sổ cần được chọn thay thế rõ để không tính trùng.
- Bảng tiền từng ngày và CSV; sao lưu/khôi phục JSON. Bản lưu lỗi không tự bị ghi đè. Việc sửa một khoản đã thanh toán cần xác nhận vì ảnh hưởng số dư.

Mô hình này hỗ trợ lập kế hoạch, chưa thay thế sổ kế toán hoặc đối soát ngân hàng. Lương, thuế, phí, khoản vay, lãi vay và các chi phí khác phải được nhập riêng để dự báo phản ánh đầy đủ doanh nghiệp. Dữ liệu vẫn lưu trong trình duyệt, chưa có đăng nhập và đồng bộ theo tenant.

### Trợ lý

Giải thích số liệu tại chỗ là công cụ theo quy tắc và công thức, được ghi rõ không phải AI. Hỏi AI là tích hợp thật qua Netlify Function, tắt mặc định, có mã pilot và đồng ý gửi dữ liệu. Chỉ gửi tóm tắt tổng hợp; không gửi từng giao dịch hoặc tên đối tác. Câu hỏi tự do vẫn có thể chứa thông tin nhạy cảm nên người dùng cần kiểm tra trước khi gửi.

AI không được phép đổi giá, đặt hàng, chuyển tiền hoặc sửa sổ. Khóa API nằm ở máy chủ. Mã pilot chỉ phù hợp thử nghiệm riêng, không thay thế đăng nhập/ủy quyền nhiều doanh nghiệp. Xem [AI_ASSISTANT_SETUP.md](AI_ASSISTANT_SETUP.md) để cấu hình và kiểm soát chi phí.

## Kiểm chứng

- Bộ test hiện có và test mới cho dòng tiền, i18n, request/schema/security của AI; tất cả gọi AI trong test đều được mock, không phát sinh yêu cầu tính phí.
- TypeScript và ESLint cho các file thay đổi.
- Production static export, kiểm tra desktop 1512 px và điện thoại 390 px.
- Kiểm tra giao dịch đã thanh toán tồn tại sau reload, ngôn ngữ tồn tại sau reload, độ trễ thu, đơn nhập giả định, liên kết bản duyệt, matching cần phê duyệt, CSV một BOM và bản lưu lỗi giữ nguyên.
- Kiểm tra AI không gửi dữ liệu khi chưa đồng ý; xử lý chưa cấu hình/lỗi và phản hồi thành công bằng transport mock. Chưa xác nhận gọi model thật hoặc deployment Netlify ở bản này.

## Ghi chú môi trường phát triển Windows

Thư mục `out` cũ thuộc tài khoản sandbox trước đây, khiến build tại checkout chính không xóa được thư mục xuất. Cùng source được kiểm chứng thành công trong `D:/file toan dien/dự án area 303/tmp/finance-verify-20261005`, không sao chép `.env` hoặc khóa. Preview tại `http://127.0.0.1:4173/dashboard/#cashflow` đang phục vụ bản đã build này.

Đây là vấn đề quyền filesystem cục bộ, không phải lỗi TypeScript hoặc Next/Netlify. Cấu hình production vẫn là `output: export`, publish `out`, cộng `netlify/functions`. Trước khi build lại trực tiếp ở checkout chính, chủ máy cần xử lý quyền của thư mục xuất cũ bằng tài khoản có quyền phù hợp hoặc build từ một checkout mới. Không xóa repository hoặc dữ liệu nguồn để xử lý lỗi này.

## Cơ sở thiết kế

- [business.gov.au — cash flow statement](https://business.gov.au/finance/cash-flow/set-up-a-cash-flow-statement): tách số dư đầu kỳ, dòng vào, dòng ra và thời điểm; nhận diện số liệu ước tính.
- [Netlify Functions](https://docs.netlify.com/build/functions/overview/): tách tác vụ máy chủ khỏi website tĩnh.
- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses): tích hợp server-side và cấu hình lưu response; chính sách xử lý dữ liệu cần được xem riêng, không coi `store: false` là Zero Data Retention.
