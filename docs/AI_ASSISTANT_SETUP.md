# MAVERICKS — bật trợ lý AI cho pilot có kiểm soát

Trợ lý giúp giải thích các chỉ số tài chính trong workspace bằng tiếng Việt hoặc tiếng Anh. Công cụ không truy cập ngân hàng, không phải hệ thống kế toán và không thực hiện giao dịch. Các phép tính dòng tiền nằm trong engine xác định của ứng dụng; AI giải thích kết quả và giả định, không thay thế engine.

## 1. Trạng thái mặc định

AI **tắt mặc định**. Khi chưa cấu hình, endpoint trả HTTP 503 với mã `ASSISTANT_DISABLED` hoặc `ASSISTANT_NOT_CONFIGURED`; giao diện phải thể hiện đúng trạng thái này, không trình bày nội dung giải thích tại chỗ như câu trả lời của AI đang hoạt động.

Nguồn giao diện vẫn là bản Next.js export tĩnh trong `out`. AI chạy riêng qua Netlify Function `netlify/functions/financial-assistant.mjs` ở đường dẫn `/api/financial-assistant`. Không cần bật Next.js Runtime để chạy chức năng này. Chạy `next dev` hoặc server tĩnh thông thường **không tự khởi chạy Netlify Function**; khi phát triển cần dùng Netlify Dev hoặc môi trường Netlify thử nghiệm. Các bài kiểm thử của repository dùng mock và không gọi API thực.

## 2. Thiết lập trên Netlify

Trong Project configuration → Environment variables, khai báo ở **Functions scope**, chỉ bật cho môi trường pilot được kiểm soát:

| Biến | Giá trị / quy tắc |
| --- | --- |
| `AI_ASSISTANT_ENABLED` | Chuỗi chính xác `true` để bật; thiếu hoặc giá trị khác đều tắt. |
| `OPENAI_API_KEY` | API key riêng của dự án trên OpenAI Platform. Chỉ máy chủ được đọc. |
| `OPENAI_MODEL` | Model văn bản hỗ trợ Responses API mà tài khoản của bạn được phép sử dụng; phải chọn rõ model, không có model ngầm định. Nên chốt phiên bản đã đánh giá. |
| `AI_ASSISTANT_ACCESS_TOKEN` | Mã pilot ngẫu nhiên, riêng biệt với API key, dài ít nhất 32 ký tự và tối đa 512. Chỉ cấp cho người thử nghiệm được mời. |

Không dùng tiền tố `NEXT_PUBLIC_` cho bất kỳ biến nào ở trên. Không đặt giá trị thật vào `netlify.toml`, GitHub, client JavaScript, ảnh chụp, proposal hoặc chat hỗ trợ. Không dùng lại mật khẩu PostgreSQL. API key và mã pilot là hai bí mật **khác nhau**. Mã pilot được nhập vào ô truy cập ở giao diện, giữ trong bộ nhớ của phiên, không lưu vào localStorage, sessionStorage, JSON backup hoặc URL. Đóng/reload trang sẽ cần nhập lại.

Netlify đọc các biến từ Functions scope ở runtime; thay đổi cấu hình môi trường cần redeploy để function mới nhận cấu hình. Khai báo thư mục functions là `netlify/functions` trong cấu hình deploy nếu đã ghi đè mặc định. Không ghi đè đường dẫn `/api/financial-assistant` bằng redirect SPA `/*` hoặc proxy khác. Function có custom path nên không được truy cập tại đường dẫn mặc định `/.netlify/functions/financial-assistant`.

Trước khi bật, tạo project OpenAI riêng, cấu hình theo dõi chi phí/giới hạn chi tiêu phù hợp, chọn model và đánh giá bộ câu hỏi tài chính bằng dữ liệu tổng hợp không nhạy cảm. Không có khóa được tạo hoặc lượt gọi tính phí thực hiện bởi các bài test của thay đổi này.

## 3. Dữ liệu nào được gửi?

Chỉ sau khi người dùng chủ động đồng ý gửi để nhận giải thích AI:

- Câu hỏi, ngôn ngữ và tối đa 6 tin nhắn gần nhất (1.600 ký tự mỗi tin).
- Ngày số dư và nguồn `manual` hoặc `demo`.
- Số liệu tổng hợp bằng VND: số dư đầu kỳ/hiện tại, tiền dự kiến thu/chi, số dư cuối kỳ, đáy tiền mặt, ngưỡng dự phòng, nhu cầu vốn bù và khoản quá hạn; kèm số ngày trễ thu giả định đang áp dụng.
- Tùy chọn: tổng hợp một kịch bản nhập hàng (nguồn `manual`/`demo` riêng của kịch bản, giá trị đơn, ngày thanh toán, thu dự kiến, đáy tiền và nhu cầu bù). Sổ tiền thực có thể đi cùng chi phí đơn minh họa; không gộp hai nguồn thành một nhãn.

Không gửi dòng sổ thu–chi, tên đối tác, tên/SKU sản phẩm, số tài khoản, file CSV, mật khẩu hoặc lịch sử ngân hàng. Câu hỏi và lịch sử hội thoại vẫn là văn bản người dùng; giao diện cần nhắc không nhập thông tin cá nhân, bí mật hoặc dữ liệu không được phép chia sẻ. Strict allowlist bảo vệ **context có cấu trúc**, không phải bộ nhận diện toàn bộ thông tin nhạy cảm trong văn bản tự do.

Request dùng `store: false`, không conversation ID và không `previous_response_id`; MAVERICKS không ghi log nội dung câu hỏi/tóm tắt/câu trả lời trong function. Điều này không có nghĩa là Zero Data Retention: dữ liệu gửi đến Netlify/OpenAI vẫn chịu chính sách xử lý và lưu giữ của các nhà cung cấp. Cần thỏa thuận quyền chia sẻ dữ liệu và xem chính sách của tài khoản trước khi dùng số liệu doanh nghiệp thực.

## 4. Quy tắc an toàn và giới hạn pilot

| Kiểm soát | Cách thực hiện |
| --- | --- |
| Không có endpoint tính phí mở công khai | Mã pilot hợp lệ bắt buộc trước khi đọc payload hoặc gọi OpenAI. |
| Chặn request khác website | Origin phải trùng chính xác origin URL của function; không CORS. Đây là lớp bổ sung, không thay thế xác thực. |
| Giới hạn truy vấn | 20.000 byte body; câu hỏi tối đa 1.200 ký tự; history tối đa 6 tin; context strict allowlist, ngày hợp lệ, số hữu hạn. |
| Hạn chế chi phí mỗi yêu cầu | Tối đa 900 output tokens; timeout 25 giây; không retry tự động, không tool, không web search. |
| Rate limit nền tảng | Netlify `config.rateLimit`: tối đa 8 yêu cầu / 60 giây, nhóm theo IP và domain. Netlify thực thi khi deploy; unit test không giả lập CDN. |
| Giới hạn quyền AI | Chỉ trả lời văn bản. Không hành động/thanh toán/đặt hàng/đổi giá; không đọc DB hoặc bí mật. |
| Câu trả lời chưa hoàn chỉnh | Timeout, quota, response rỗng/refusal/incomplete được báo lỗi, không giả làm kết quả thành công. |
| Giảm rò rỉ lỗi | Không trả body lỗi upstream, stack trace, headers hay khóa; câu trả lời được giới hạn chiều dài và loại control characters. |

Mã dùng chung chỉ phù hợp **private pilot**, không phải đăng nhập, phân quyền nhiều doanh nghiệp hoặc billing theo người dùng. Không quảng bá chatbot là production-ready multi-tenant. Trước khi phát hành rộng cần xác thực người dùng, quyền theo workspace/tenant, quota server-side gắn với account, bảo vệ lạm dụng, chính sách dữ liệu và bộ đánh giá chất lượng. Người có mã pilot có thể gửi request từ công cụ riêng; Origin có thể bị giả bởi khách ngoài trình duyệt. Rate limit IP/domain không phải trần ngân sách tổng và không ngăn mọi lạm dụng phân tán. Nếu mã bị lộ: đổi mã, tắt `AI_ASSISTANT_ENABLED`, kiểm tra usage và thu hồi API key nếu cần.

## 5. Request / response contract v1

POST `/api/financial-assistant`, headers `Content-Type: application/json`, `x-mavericks-pilot-token` (mã phiên) và Origin do trình duyệt gửi.

```json
{
  "locale": "vi",
  "question": "Vì sao có doanh thu mà số dư dự báo vẫn âm?",
  "history": [],
  "context": {
    "version": 1,
    "asOf": "2026-10-05",
    "source": "manual",
    "currency": "VND",
    "cash": {
      "openingBalance": 100000000,
      "currentBalance": 80000000,
      "minimumReserve": 20000000,
      "expectedInflows": 50000000,
      "expectedOutflows": 90000000,
      "closingBalance": 40000000,
      "lowestBalance": -5000000,
      "additionalFunding": 25000000,
      "horizonDays": 56,
      "receiptDelayDays": 0,
      "lowestBalanceDate": "2026-10-10",
      "overdueReceivables": 10000000,
      "overduePayables": 0
    },
    "inventoryScenario": null
  }
}
```

`cash` có thể là `null` khi chưa nhập dữ liệu, không tự bù dữ liệu demo. Khi có `cash`, `receiptDelayDays` bắt buộc là số nguyên từ 0 đến 90: đây là giả định trễ thu do người dùng chọn, chỉ áp dụng vào khoản thu dự kiến, không thay đổi giao dịch đã thực hiện hay số dư hiện tại. AI phải nói rõ giả định, không xác nhận tiền chắc chắn về theo lịch đó. `inventoryScenario` cũng có thể `null`; nếu có, cần đủ các trường `source` (`manual` hoặc `demo`), `orderCost`, `purchaseDate` (YYYY-MM-DD), `expectedReceipts`, `cashTrough`, `additionalFunding`. `context.source` mô tả nguồn **sổ tiền**; `inventoryScenario.source` mô tả nguồn **kịch bản nhập hàng** (bao gồm chi phí lấy từ kế hoạch minh họa). AI phải phân biệt hai nguồn; chi phí đơn minh họa không biến sổ tiền người dùng nhập thành dữ liệu minh họa. `expectedReceipts` chỉ gồm khoản thu của kịch bản nằm trong kỳ dự báo sau khi áp dụng giả định trễ thu. Không cộng overlay vào totals lần nữa. `horizonDays` nguyên từ 1 đến 365; các số tiền hữu hạn trong khoảng ±1.000.000.000.000 VND, trường thu/chi/chi phí/vốn bù/dự phòng không âm. Ngày phải là ngày lịch thực, không chỉ đúng format.

Thành công:

```json
{
  "answer": "Nội dung giải thích dựa trên tóm tắt workspace...",
  "provider": "openai",
  "contextAsOf": "2026-10-05",
  "warnings": ["Nguồn dữ liệu và giới hạn dự báo..."]
}
```

Lỗi an toàn: `{ "error": { "code": "...", "message": "..." } }`.

| HTTP | Mã điển hình | Xử lý giao diện |
| --- | --- | --- |
| 400 / 413 / 415 | `INVALID_PAYLOAD` / `REQUEST_TOO_LARGE` / `INVALID_CONTENT_TYPE` | Kiểm tra và rút gọn dữ liệu; không gọi lại tự động. |
| 401 | `ACCESS_REQUIRED` | Yêu cầu nhập đúng mã pilot, không API key. |
| 403 | `ORIGIN_NOT_ALLOWED` | Chỉ gọi từ chính website, không proxy cross-domain. |
| 405 | `METHOD_NOT_ALLOWED` | Dùng POST. |
| 429 | `PROVIDER_RATE_LIMIT` hoặc rate limit Netlify | Đợi và thử sau; có thể không nhận JSON khi CDN rate-limit. |
| 503 | `ASSISTANT_DISABLED` / `ASSISTANT_NOT_CONFIGURED` | Giữ trải nghiệm giải thích tại chỗ, hiển thị AI chưa sẵn sàng. |
| 502 / 504 | `PROVIDER_UNAVAILABLE` / `EMPTY_RESPONSE` / `ASSISTANT_TIMEOUT` | Báo trạng thái thật; không biến lỗi thành câu trả lời thành công. |

## 6. Kiểm tra trước khi dùng dữ liệu thực

1. Chạy `npm test`: chỉ mock request/response, không cần key, không tính phí.
2. Build ứng dụng, deploy thử với AI tắt: hỏi vẫn hiện trạng thái chưa cấu hình.
3. Bật AI cho pilot riêng; xác nhận thiếu/sai mã không gọi provider, đúng mã mới được hỏi.
4. Kiểm tra Network: request chỉ chứa summary allowlisted; không có ledger rows, tên đối tác hoặc key.
5. Kiểm tra số liệu mẫu có cash âm, thiếu dữ liệu, source=demo, user cố yêu cầu chuyển tiền/đổi giá và yêu cầu bỏ qua hướng dẫn. Người kiểm tra phải đánh giá nội dung trả lời, không chỉ HTTP thành công.
6. Kiểm tra usage/cost, timeout và rate limit thực trên Netlify. Không công bố độ chính xác tài chính trước khi có bộ đánh giá phù hợp.

## Nguồn kỹ thuật chính thức

- [OpenAI Responses — text generation](https://developers.openai.com/api/docs/guides/text): API sinh câu trả lời và thứ tự ưu tiên chỉ dẫn.
- [OpenAI authentication](https://developers.openai.com/api/reference/overview): giữ API key trong môi trường server, không client.
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data): phân biệt response storage với chính sách lưu giữ khác.
- [OpenAI production practices](https://developers.openai.com/api/docs/guides/production-best-practices): project riêng và quản lý usage/chi phí.
- [Netlify Functions API](https://docs.netlify.com/build/functions/api/): Request/Response, custom path và rateLimit.
- [Netlify rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/): cấu hình giới hạn function tại source.
- [Netlify environment variables](https://docs.netlify.com/build/functions/environment-variables/): biến ở Functions scope, runtime và redeploy.
