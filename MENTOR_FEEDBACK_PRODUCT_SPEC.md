# Mentor feedback → MVP product specification

Nguồn diễn giải: toàn bộ nội dung chữ đỏ trong brief mentoring ngày 25/08/2026. Các con số mang tính ví dụ hoặc kinh nghiệm dự án của mentor không được trình bày như kết quả đã kiểm chứng của Mavericks.

## 1. Product thesis đã chốt

Category Manager đang phải ghép các SKU tương đương và lựa chọn mức khuyến mãi bằng nhiều thao tác thủ công, nên dễ phản ứng theo cảm tính hoặc giảm giá không cần thiết. Mavericks phải giúp người dùng trả lời ba câu hỏi theo đúng thứ tự:

1. Hai SKU có thật sự tương đương không?
2. Chênh lệch giá sau khuyến mãi có đủ lớn để cần hành động không?
3. Hành động nào bảo vệ được vị thế giá và biên lợi nhuận?

Giá trị đầu ra phải luôn thể hiện: **Cần làm gì → Vì sao → Phù hợp thế nào với định hướng SKU/category**. MVP hỗ trợ quyết định; chưa tự động thực thi thay con người.

## 2. Luồng MVP bắt buộc

`Detect price signal → Match comparable SKU → Human approval → Apply pricing guardrails → Recommend action`

### Bước 1 — Detect

- Chỉ sử dụng competitive set tại Việt Nam cho câu chuyện chính.
- Gọi đúng phạm vi là “mẫu đối thủ theo dõi”, không gọi là toàn thị trường hoặc market share.
- Brief mentoring ghi nhận mẫu cũ 3 ngày. Snapshot PostgreSQL cập nhật đang dùng trong sản phẩm có 20 ngày quan sát; giao diện phải đọc phạm vi này từ dữ liệu thay vì gán cứng.
- `monthly_sold` vẫn là snapshot dùng để ưu tiên best-seller; chưa phải doanh số phát sinh từng ngày và 20 ngày vẫn chưa đủ để suy ra causal uplift.
- Ngưỡng biến động mặc định để vào hàng đợi: 10%; người dùng có thể điều chỉnh ở bước định giá.

### Bước 2 — Match

- Tách taxonomy/segment trước khi so sánh.
- Kiểm tra tên, từ khóa, quy cách/khối lượng và pack count.
- Ngưỡng 0,75 là routing threshold đề xuất: dưới ngưỡng phải vào hàng đợi review tăng cường; không được coi là chân lý nếu chưa có tập nhãn.
- Mọi cặp SKU phải có giải thích, cảnh báo dữ liệu thiếu và thao tác duyệt/từ chối của con người trước khi đi vào Pricing Lab.
- KPI phải đo trên tập nhãn nhỏ: acceptance rate và số cặp đã được review.

### Bước 3 — Effective price

- Phân biệt giá niêm yết/pre-voucher và giá khách thực trả.
- Áp voucher của đối thủ trở lại sau biến động giá để tính competitor effective price.
- Chuẩn hóa pack/size trước khi so sánh; nếu chưa đủ dữ liệu phải gắn cảnh báo.

### Bước 4 — Guardrail

Decision tree phải chạy theo thứ tự:

1. Nếu giá hiệu dụng của ta đã cạnh tranh hơn đối thủ → `NO_ACTION` trên trục giá.
2. Nếu đối thủ rẻ hơn nhưng gap chưa vượt ngưỡng (mặc định 12%, nằm trong khoảng mentor gợi ý 10–15%) → `MONITOR`.
3. Nếu gap vượt ngưỡng và target price vẫn trên margin floor → `MATCH_UNDERCUT` có kiểm soát.
4. Nếu target price xuống dưới margin floor → `DEFEND_MARGIN`, chuyển sang bundle, voucher có điều kiện, delivery hoặc rating.
5. Nếu economics hiện tại đã dưới margin floor → `HUMAN_REVIEW`; hệ thống không tự động đề xuất tăng giá.

Margin floor phải cho phép nhập: COGS, target margin, phí sàn, voucher, shipping subsidy, return/refund allowance, ads spend, campaign/trade spend và chi phí combo/bao bì.

### Bước 5 — Recommend

- Hiển thị action, lý do, price gap, effective price, margin floor và các giả định.
- Thể hiện vai trò SKU: traffic driver, core SKU hoặc margin driver.
- Không tự động thực thi. Category Manager là người phê duyệt cuối cùng.

## 3. KPI MVP

- **Matching acceptance rate:** số cặp được duyệt / tổng số cặp đã review.
- **Decision latency:** thời gian từ lúc chạy matching đến khi tạo khuyến nghị.
- **Guardrail catch rate:** tỷ lệ scenario mà phản ứng “match giá ngay” bị hệ thống chuyển đúng sang `NO_ACTION`, `MONITOR`, `DEFEND_MARGIN` hoặc `HUMAN_REVIEW`.

Không hiển thị phần trăm giả khi chưa có mẫu; phải hiển thị số mẫu và trạng thái “chưa đủ dữ liệu”.

## 4. Phạm vi và claim

### Làm thật trong MVP hiện tại

- Snapshot Việt Nam, 10 shop bánh kẹo; phạm vi ngày và số SKU được đọc từ snapshot mới nhất (hiện là 20 ngày, 762 SKU theo dõi, 664 SKU sạch).
- Explainable deterministic matcher trên dữ liệu snapshot.
- Human approval tại cặp SKU.
- Interactive price-alert simulator và decision tree.
- KPI phiên làm việc được tính từ thao tác thật của người dùng.

### Chỉ mô tả là kiến trúc tiếp theo

- Embedding + LLM fallback và taxonomy chuẩn như UNSPSC.
- Tập dữ liệu 6 tháng/500 brands.
- Ước tính uplift khuyến mãi hoặc quan hệ nhân quả giá–sản lượng.
- Tự động hóa quyết định và scorecard vận hành.

### Không dùng trong câu chuyện chính

- Indonesia và các outlier liên quan.
- Claim “real-time”, “whole market”, “market share” hoặc “promotion uplift” khi chưa có bằng chứng tương ứng.
- Các kết quả kinh nghiệm Hitachi, chi phí API hay độ chính xác của dự án khác như KPI của Mavericks.

## 5. Acceptance criteria cho bản nâng cấp

- Trang dashboard mặc định dẫn người dùng theo một luồng duy nhất, không bắt đầu bằng tập hợp biểu đồ rời rạc.
- Không còn market switch Indonesia trong trải nghiệm chính.
- Cặp SKU chưa được người dùng duyệt không thể chuyển sang Pricing Lab.
- Pricing Lab có effective competitor price, threshold, SKU role và đầy đủ nhóm chi phí mentor nêu.
- Decision engine luôn có nhánh `NO_ACTION` và không tự động tăng recommended price.
- KPI được tính từ tương tác thật trong phiên hoặc ghi rõ chưa đủ mẫu.
- Landing page và dashboard đều ghi đúng “mẫu đối thủ Việt Nam” và phạm vi ngày lấy động từ snapshot.
