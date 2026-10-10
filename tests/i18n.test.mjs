import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { translate, enCatalog } from '../lib/translations.ts';

test('product navigation and financial terminology are translated explicitly', () => {
  assert.equal(translate('Dòng tiền', 'en'), 'Cash flow');
  assert.equal(translate('Lợi nhuận vận hành', 'en'), 'Operating profit');
  assert.equal(translate('Biên đóng góp', 'en'), 'Contribution margin');
  assert.equal(translate('Target margin (%)', 'vi'), 'Biên mục tiêu (%)');
});

test('interpolation preserves values and whitespace, without partial data translation', () => {
  assert.equal(translate(' {v0} dòng ', 'en', { v0: '1,200' }), ' 1,200 rows ');
  assert.equal(translate('Thử mức giá {v0}', 'en', { v0: '₫62,000' }), 'Explore a price of ₫62,000');
  assert.equal(translate('Bánh quy Tổng quan 500g', 'en'), 'Bánh quy Tổng quan 500g');
  assert.equal(translate('Owner <script>raw</script>', 'en'), 'Owner <script>raw</script>');
  assert.equal(translate('', 'en'), '');
  assert.equal(translate(' ', 'en'), ' ');
});

test('source notices and engine errors remain reversible across locale switches', () => {
  const source = 'Dòng 12: thiếu số hoặc stockout phải là 0/1.';
  assert.equal(translate(source, 'en'), 'Row 12: a number is missing or stockout must be 0/1.');
  assert.equal(translate(source, 'vi'), source);
  assert.equal(translate('Thiếu ngày giữa 2026-01-01 và 2026-01-03. Bổ sung cả ngày bán 0; không tự điền ngày thiếu.', 'en'), 'Missing dates between 2026-01-01 and 2026-01-03. Include zero-sale days; missing dates are not automatically filled.');
  assert.equal(translate('Price gap 11.2% chưa vượt ngưỡng hành động 12%.', 'en'), 'The 11.2% price gap does not exceed the 12% action threshold.');
  assert.equal(translate('Cùng phân khúc Cookies & Wafer', 'en'), 'Same segment: Cookies & Wafer');
});

test('all explicit Vietnamese UI translation keys have an English catalog entry', () => {
  const files = ['MarketIntelligenceApp', 'ProfitPlanner', 'OutcomeReview', 'DecisionShowcase'];
  const missing = [];
  for (const file of files) {
    const source = fs.readFileSync(new URL(`../components/${file}.tsx`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\bt\("([^"\n]*)"/g)) {
      const key = match[1].trim();
      if (/[à-ỹÀ-ỸđĐ]/u.test(key) && !enCatalog[key]) missing.push(`${file}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});
