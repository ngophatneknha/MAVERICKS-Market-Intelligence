# Mavericks: Profit & Intelligence Workspace

## Product direction

Giúp brand kết nối tín hiệu cạnh tranh với quyết định giá, tồn kho và vốn để tăng trưởng có lợi nhuận. Khách hàng ban đầu: brand bánh kẹo/snack có CM và KA. CM sở hữu quyết định và policy; KA xác nhận SKU/evidence; finance xác nhận giá vốn và điều kiện thanh toán.

## Đợt nâng cấp này: chạy được, có giới hạn rõ

- Profit & Capital Studio ở `/dashboard/`, nối trực tiếp với Pricing Lab.
- CSV bán hàng của brand: `date,sku,units,price,stockout`; giá niêm yết, số đơn vị bán theo ngày; mỗi SKU/ngày một dòng. Ghi rõ ngày bán 0 và ngày hết hàng. Không suy doanh số ngày từ monthly_sold đối thủ.
- Baseline dùng tối đa 28 ngày có hàng, trung bình theo thứ khi đủ 4 tuần hoặc trung bình ngày. Chuỗi lịch sử phải liên tục; tối thiểu 14 ngày có hàng và 14 ngày có hàng trong 28 ngày gần nhất.
- Backtest rolling origin tối đa 7 ngày, không đưa holdout vào tập huấn luyện; báo WAPE và số mẫu. Không công bố accuracy giả nếu chưa đủ dữ liệu hoặc mẫu thực tế bằng 0.
- So sánh giá -10%, -5%, hiện tại, +5%, +10% và phương án từ Pricing Lab khi người dùng xác nhận cùng SKU. Nhu cầu thay đổi theo elasticity người dùng nhập, neo vào giá lịch sử bình quân. Không gọi đây là mô hình causal đã học.
- Giá vốn nhập bằng tiền/đơn vị và giữ cố định giữa các phương án. Doanh thu sau voucher và dự phòng hoàn tiền; phí sàn và ads tính trên doanh thu này. Shipping/bao bì tính tiền/đơn vị. Lợi nhuận đóng góp trừ chi phí cố định tuần tạo lợi nhuận vận hành mô phỏng, chưa phải net profit sau thuế/tài chính.
- Một lô nhập ở đầu kỳ. Tính 56 ngày, safety stock, lead time, lost demand khi hết hàng. Payment NCC và settlement sàn có lịch riêng; phát hiện đáy tiền trong ngày trước khoản thu. Tiền đầu kỳ, công nợ và receivables được thể hiện riêng.
- Guardrail: margin tối thiểu, mức thay đổi giá, đủ tiền và lợi nhuận vận hành dương. Chỉ xếp hạng trong các mức giá thử; cần CM ghi nhận phê duyệt. Không tự đổi giá/đặt hàng.
- Workspace và tối đa 50 bản duyệt lưu localStorage; có CSV plan, JSON evidence, backup/restore. Tên người duyệt tự nhập, chưa phải danh tính xác thực hoặc audit trail bất biến.
- Market dashboard dùng toàn bộ live API hoặc toàn bộ snapshot trong một lần tải, không trộn nguồn rồi gắn nhãn live. Có thể cấu hình HTTPS API qua NEXT_PUBLIC_API_BASE_URL. Matching giữ cùng mode nguồn dữ liệu.

## Giai đoạn tiếp theo: design partner pilot

1. Làm việc cùng 2–3 brand: xác định quyết định thường gặp, baseline Excel, dữ liệu có quyền sử dụng và willingness to pay.
2. Kết nối dữ liệu nội bộ: sales/returns, COGS, ads, tồn kho, purchase orders, settlement. Tenant riêng, login, quyền CM–KA–finance và audit log trên backend trước khi dùng chung trong vận hành.
3. Theo dõi outcome từng quyết định, đối chiếu forecast với actual; đo decision latency, forecast WAPE, contribution, stockout và working capital. So sánh với baseline theo cùng phạm vi và thời kỳ.
4. Forecast theo SKU/category và promotion calendar khi đủ lịch sử. Ước lượng elasticity bằng thiết kế thử nghiệm/causal phù hợp, có dữ liệu kiểm chứng.
5. Tối ưu nhiều lần nhập, MOQ, expiry, supplier constraints, payment terms và ngân sách danh mục.
6. AI giải thích dựa trên dữ liệu và engine; chỉ có công cụ thực thi được kiểm soát, policy, phê duyệt và rollback sau khi pilot chứng minh chất lượng.

## Acceptance checks

`npm test`: CSV quality, missing days, stockouts, holdout leakage, profit accounting, inventory lead times, settlement/payment timing, funding trough, policy blockers và zero input regression.
`npm run lint` và `npm run build`: TypeScript, static export Netlify.

Không commit credentials PostgreSQL hoặc lịch sử bán hàng riêng của brand. Việc triển khai công khai và đưa dữ liệu của khách hàng lên server là bước riêng sau pilot configuration.
