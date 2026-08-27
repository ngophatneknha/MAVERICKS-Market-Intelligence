import DecisionDemo from './components/DecisionDemo';
import vnSnapshot from '../public/data/market-vn.json';

export default function Home() {
  const overview = vnSnapshot.overview;
  const cleanSkus = overview.trackedSkus - overview.qualityFlags;
  return (
    <main className="site-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <nav className="topbar" aria-label="Điều hướng chính">
        <a className="brand" href="#top" aria-label="Mavericks - Trang chủ">
          <span className="brand-mark">M</span>
          <span className="brand-word">MAVERICKS</span>
        </a>
        <div className="nav-links">
          <a href="#product">Sản phẩm</a>
          <a href="#workflow">Cách hoạt động</a>
          <a href="#data">Dữ liệu</a>
        </div>
        <a className="nav-cta" href="/dashboard/">
          Mở dashboard <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> DECISION SUPPORT FOR VIETNAM COMMERCE</div>
          <h1>
            Thấy tín hiệu.<br />
            Chọn đúng SKU.<br />
            <em>Giữ trọn biên lợi nhuận.</em>
          </h1>
          <p className="hero-lede">
            Mavericks giúp Category Manager đi từ tín hiệu giá đến cặp SKU đã xác nhận,
            rồi chọn hành động phù hợp mà không phản ứng theo cảm tính.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/dashboard/">
              Trải nghiệm dashboard <span aria-hidden="true">→</span>
            </a>
            <a className="button button-secondary" href="#workflow">Xem cách hoạt động</a>
          </div>
          <p className="hero-proof">
            <span className="live-dot" /> Mẫu {overview.shops} đối thủ Việt Nam · {overview.dateRange.dates} ngày quan sát · PostgreSQL snapshot
          </p>
        </div>

        <div className="product-stage" id="product" aria-label="Mô phỏng giao diện Mavericks">
          <div className="orbit orbit-a" aria-hidden="true" />
          <div className="orbit orbit-b" aria-hidden="true" />
          <div className="signal-card floating-card">
            <span className="mini-label">TÍN HIỆU MỚI</span>
            <strong>-18.4%</strong>
            <small>Cookies &amp; Wafer · Việt Nam</small>
          </div>

          <div className="dashboard-frame">
            <div className="window-bar">
              <div className="window-brand"><i>M</i> Mavericks</div>
              <div className="window-search">Tìm SKU, thương hiệu, tín hiệu...</div>
              <div className="window-avatar">NP</div>
            </div>
            <div className="dashboard-body">
              <aside className="mock-sidebar" aria-hidden="true">
                <span className="active" /><span /><span /><span /><span />
              </aside>
              <div className="mock-content">
                <div className="mock-heading">
                  <div><small>DECISION FLOW</small><strong>Category Manager Control Room</strong></div>
                  <button type="button">VN</button>
                </div>
                <div className="metric-row">
                  <div><span>Clean SKUs</span><strong>{cleanSkus.toLocaleString('vi-VN')}</strong><small>{overview.classifiedCoverage}% classified</small></div>
                  <div><span>Signals</span><strong>{overview.priceAlerts}</strong><small>Snapshot queue</small></div>
                  <div><span>Matching logic</span><strong>3 lớp</strong><small>Name · keyword · pack</small></div>
                </div>
                <div className="insight-grid">
                  <div className="chart-card">
                    <div className="card-line"><span>Tracked-set momentum</span><small>{overview.dateRange.dates}D</small></div>
                    <div className="chart-bars" aria-hidden="true">
                      <i style={{ height: '34%' }} /><i style={{ height: '48%' }} /><i style={{ height: '42%' }} />
                      <i style={{ height: '68%' }} /><i style={{ height: '61%' }} /><i style={{ height: '82%' }} />
                      <i style={{ height: '76%' }} /><i style={{ height: '92%' }} />
                    </div>
                  </div>
                  <div className="decision-card">
                    <div className="card-line"><span>Decision support</span><small>HITL</small></div>
                    <b>Không cần giảm thêm</b>
                    <p>Giá ta đã cạnh tranh; giữ margin và chờ người duyệt.</p>
                    <div className="decision-score"><span>Action</span><strong>HOLD</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="margin-card floating-card">
            <span className="mini-label">DECISION OWNER</span>
            <strong>HUMAN</strong>
            <small>Category Manager approval</small>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Quy mô dữ liệu">
        <div><strong>{cleanSkus.toLocaleString('vi-VN')}</strong><span>SKU sạch trong mẫu</span></div>
        <div><strong>{overview.shops}</strong><span>gian hàng theo dõi</span></div>
        <div><strong>{overview.priceAlerts}</strong><span>tín hiệu chờ đánh giá</span></div>
        <div><strong>{overview.dateRange.dates} ngày</strong><span>cửa sổ quan sát</span></div>
      </section>

      <section className="story-section">
        <div className="story-kicker"><span>01</span> VẤN ĐỀ THẬT</div>
        <div className="story-headline">
          <p>Không thiếu dữ liệu.</p>
          <h2>Đội ngũ đang thiếu một đường thẳng từ <em>&quot;có biến động&quot;</em> đến <em>&quot;nên làm gì tiếp theo&quot;.</em></h2>
        </div>
        <div className="story-compare">
          <article className="old-way">
            <div className="compare-label">TRƯỚC MAVERICKS</div>
            <ul>
              <li><span>01</span> Dữ liệu nằm ở nhiều bảng và thiếu ngữ cảnh quyết định</li>
              <li><span>02</span> Không biết SKU nào thực sự tương đương</li>
              <li><span>03</span> Phản ứng giá theo cảm tính, dễ mất margin</li>
              <li><span>04</span> Phải rà lại chất lượng trước mỗi phân tích</li>
            </ul>
          </article>
          <div className="compare-arrow" aria-hidden="true">→</div>
          <article className="new-way">
            <div className="compare-label">VỚI MAVERICKS</div>
            <strong>Một control room.<br />Một logic quyết định.<br />Một hành động có guardrail.</strong>
            <p>Tín hiệu được ưu tiên, cặp SKU có bằng chứng, và mỗi kịch bản giá đều biết điểm dừng.</p>
          </article>
        </div>
      </section>

      <section className="workflow-section" id="workflow">
        <div className="section-heading centered">
          <span>FROM SIGNAL TO DECISION</span>
          <h2>Bốn bước. Một quyết định<br /><em>có thể giải thích.</em></h2>
          <p>Mavericks không chỉ trình bày biểu đồ. Hệ thống dẫn người dùng đi trọn quy trình ra quyết định.</p>
        </div>
        <DecisionDemo />
      </section>

      <section className="feature-section">
        <div className="section-heading split-heading">
          <div><span>PRODUCT CAPABILITIES</span><h2>Đủ sâu cho analyst.<br /><em>Đủ rõ cho decision maker.</em></h2></div>
          <p>Mỗi lớp của sản phẩm trả lời một câu hỏi kinh doanh cụ thể, nhưng dùng chung một nguồn dữ liệu đã làm sạch.</p>
        </div>

        <div className="bento-grid">
          <article className="bento-card bento-wide signal-bento">
            <div className="bento-number">01</div>
            <div className="bento-copy"><span>PRIORITY QUEUE</span><h3>Biến động nào đáng để đội ngũ chú ý trước?</h3><p>Lọc tăng/giảm giá từ 10%, xếp mức độ ảnh hưởng và giữ nguyên bối cảnh SKU, shop, lượng bán.</p></div>
            <div className="signal-list" aria-hidden="true">
              <div><i className="down">↓</i><span><b>Bánh quy bơ hộp thiếc</b><small>Official Store · snapshot mới nhất</small></span><strong>-18%</strong></div>
              <div><i className="up">↑</i><span><b>Kẹo dẻo trái cây</b><small>Brand shop · snapshot mới nhất</small></span><strong>+14%</strong></div>
              <div><i className="down">↓</i><span><b>Bánh gạo vị mặn</b><small>Official Store · snapshot mới nhất</small></span><strong>-11%</strong></div>
            </div>
          </article>

          <article className="bento-card match-bento">
            <div className="bento-number">02</div>
            <div className="bento-copy"><span>HYBRID MATCHING</span><h3>Đây có thật sự là cùng một sản phẩm?</h3><p>Điểm tương đồng được tách thành tên, từ khóa và pack/size — luôn có bằng chứng để người dùng review.</p></div>
            <div className="match-visual" aria-hidden="true">
              <div><small>SKU CỦA TA</small><b>Bánh quy bơ 300g</b></div>
              <span><strong>86</strong><small>MATCH</small></span>
              <div><small>ĐỐI THỦ</small><b>Butter cookies hộp 300 g</b></div>
            </div>
          </article>

          <article className="bento-card price-bento">
            <div className="bento-number">03</div>
            <div className="bento-copy"><span>PRICING GUARDRAIL</span><h3>Giá cạnh tranh có đang phá vỡ lợi nhuận?</h3><p>So giá sau voucher và kiểm tra COGS, phí sàn, shipping, return, ads, campaign spend và target margin.</p></div>
            <div className="price-track" aria-hidden="true"><span /><i /><b /><small>Margin floor</small><em>Recommended</em></div>
          </article>

          <article className="bento-card bento-wide quality-bento">
            <div className="bento-number">04</div>
            <div className="bento-copy"><span>DATA TRUST LAYER</span><h3>Dữ liệu sạch trước. Quyết định sau.</h3><p>Placeholder price, quà tặng, bản ghi khuyến mãi mồ côi và listing bất thường được cô lập khỏi benchmark.</p></div>
            <div className="quality-visual" aria-hidden="true">
              <div className="quality-ring"><strong>99.2%</strong><small>USABLE</small></div>
              <ul><li><i /> Placeholder filter <b>PASS</b></li><li><i /> Giveaway detection <b>PASS</b></li><li><i /> Promotion audit <b>PASS</b></li></ul>
            </div>
          </article>
        </div>
      </section>

      <section className="data-section" id="data">
        <div className="data-copy">
          <span className="section-code">02 / DATA FOUNDATION</span>
          <h2>Một nền dữ liệu đủ tin cậy để đội ngũ <em>dám hành động.</em></h2>
          <p>Snapshot được xuất read-only từ PostgreSQL, chỉ chứa dữ liệu sản phẩm cần thiết. Quy mô, cửa sổ ngày, tìm kiếm, matching và pricing đều được đọc hoặc tính từ snapshot — không dùng con số trình diễn gán cứng.</p>
          <div className="data-checks">
            <div><span>✓</span><p><b>Read-only snapshot</b><small>Không để lộ thông tin kết nối database</small></p></div>
            <div><span>✓</span><p><b>Computed on demand</b><small>Bộ lọc và engine chạy theo lựa chọn thật</small></p></div>
            <div><span>✓</span><p><b>Human review built in</b><small>Cặp match chưa rõ luôn được gắn cảnh báo</small></p></div>
          </div>
        </div>
        <div className="market-cards">
          <article><div><span>VN</span><small>MẪU ĐỐI THỦ VIỆT NAM</small></div><strong>{cleanSkus.toLocaleString('vi-VN')}</strong><p>clean product records</p><i>Current MVP scope</i></article>
          <article><div><span>{overview.dateRange.dates}D</span><small>OBSERVATION WINDOW</small></div><strong>{overview.shops}</strong><p>tracked shops</p><i>Not whole-market coverage</i></article>
          <div className="data-bridge"><span /> ONE DECISION FLOW <span /></div>
        </div>
      </section>

      <section className="role-section">
        <div className="section-heading centered"><span>BUILT FOR THE DECISION TEAM</span><h2>Mỗi vai trò thấy đúng thứ<br /><em>họ cần để tiến lên.</em></h2></div>
        <div className="role-grid">
          <article><span>01</span><h3>Category &amp; Brand</h3><p>Nhìn nhanh ngành hàng, đối thủ và cụm SKU đang tạo áp lực.</p><a href="/dashboard/">Mở market overview →</a></article>
          <article><span>02</span><h3>Pricing &amp; Commercial</h3><p>Kiểm tra competitive target nhưng không vượt qua margin floor.</p><a href="/dashboard/">Chạy pricing scenario →</a></article>
          <article><span>03</span><h3>Data &amp; Analytics</h3><p>Review match evidence, quality flags và toàn bộ giả định mô hình.</p><a href="/dashboard/">Kiểm tra trust layer →</a></article>
        </div>
      </section>

      <section className="faq-section">
        <div className="faq-intro"><span>FAQ</span><h2>Những điều mentor<br />có thể hỏi.</h2><p>Câu trả lời ngắn, tập trung vào cách MVP tạo giá trị và giữ tính minh bạch.</p></div>
        <div className="faq-list">
          <details open><summary>Mavericks khác một dashboard BI thông thường ở đâu?<span>+</span></summary><p>Dashboard BI dừng ở &quot;điều gì đã xảy ra&quot;. Mavericks nối tín hiệu với matching, rồi đưa tín hiệu đó vào pricing guardrail để trả lời &quot;nên làm gì tiếp theo và vì sao&quot;.</p></details>
          <details><summary>Kết quả matching có phải AI quyết định hoàn toàn?<span>+</span></summary><p>Không. MVP chấm điểm dựa trên taxonomy, tên, từ khóa và pack/size. Mọi cặp đều cần Category Manager duyệt; dưới 75% được route sang review tăng cường thay vì giả lập kết quả LLM.</p></details>
          <details><summary>MVP có phụ thuộc vào dữ liệu mẫu gán cứng không?<span>+</span></summary><p>Không. Dữ liệu sản phẩm được xuất thành snapshot sạch từ PostgreSQL. Search, filter, match và pricing đều tính toán trên snapshot theo lựa chọn của người dùng.</p></details>
          <details><summary>Hệ thống có tự động giảm giá theo đối thủ không?<span>+</span></summary><p>Không. Nếu mức giá cần để undercut thấp hơn margin floor, Mavericks khuyến nghị bảo vệ biên và chuyển sang bundle, voucher có điều kiện, rating hoặc giao hàng.</p></details>
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-orbit" aria-hidden="true" />
        <span>MAVERICKS / MARKET INTELLIGENCE</span>
        <h2>Từ một biến động thị trường<br />đến một quyết định <em>có kiểm soát.</em></h2>
        <p>Khám phá MVP đang chạy trên mẫu đối thủ Việt Nam và luôn giữ con người ở bước phê duyệt cuối.</p>
        <a className="button button-primary" href="/dashboard/">Mở Intelligence Control Room <b aria-hidden="true">↗</b></a>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark">M</span><span className="brand-word">MAVERICKS</span></a>
        <p>Decision support for smarter Vietnam commerce.</p>
        <div><a href="#product">Sản phẩm</a><a href="#workflow">Cách hoạt động</a><a href="/dashboard/">Dashboard ↗</a></div>
      </footer>
    </main>
  );
}
