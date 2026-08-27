import type { Country, Match, PricingInput, PricingResult, Product } from './types';

export const MATCHING_WEIGHTS = { name: 58, keyword: 24, pack: 18 } as const;

const segments = {
  vn: [
    ['cookies-wafer', 'Cookies & Wafer', /banh quy|wafer|cracker|afc|ritz|cosy|goute/],
    ['candy', 'Candy', /keo|candy|skittles|m&m|mentos|sing.?gum|chupa|gummy|gum/],
    ['chocolate', 'Chocolate & Choco-pie', /socola|chocolate|choco.?pie|kitkat|snickers/],
    ['milk-nutrition', 'Milk & Nutrition', /sua|milo|nutren|boost|peptamen|collagen/],
    ['coffee-beverage', 'Coffee & Beverage', /ca phe|coffee|nescafe|nestea|tra |tea |cafe/],
    ['soft-cake-bread', 'Soft Cake & Bread', /banh mi|banh mem|solite|chiffon|karo|bong lan|sandwich|festa/],
    ['rice-savory', 'Rice & Savory Snack', /banh gao|rice|snack|khoai tay|potato|savory/],
    ['seasoning', 'Seasoning & Cooking', /maggi|hat nem|dau hao|nuoc tuong|seasoning/],
  ],
  id: [
    ['serum', 'Serum', /serum|essence|ampoule/],
    ['sunscreen', 'Sunscreen', /sunscreen|sun screen|spf/],
    ['cleanser', 'Cleanser', /cleanser|facial wash|sabun cuci|cleansing/],
    ['toner', 'Toner', /toner/],
    ['moisturizer', 'Moisturizer', /moisturizer|cream|pelembab/],
    ['mask', 'Mask', /mask|masker|gelmask/],
    ['lip-care', 'Lip Care', /lip|bibir/],
    ['hair-care', 'Hair Care', /hair|shampoo|rambut/],
  ],
} satisfies Record<Country, Array<readonly [string, string, RegExp]>>;

const noise = new Set(['chinh', 'hang', 'official', 'store', 'shop', 'san', 'giao', 'nhanh', 'moi', 'deal', 'doc', 'quyen', 'live', 'free', 'gift', 'promo', 'sale', 'tang', 'cho', 'voi', 'cua', 'dan', 'dapatkan', 'ready', 'stock', 'original']);

function normalizeText(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
    .replace(/\[[^\]]*]/g, ' ').replace(/[^a-z0-9&]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function classify(name: string, country: Country) {
  const normalized = normalizeText(name);
  const matched = segments[country].find(([, , pattern]) => pattern.test(normalized));
  return matched ? { id: matched[0], label: matched[1] } : { id: 'other', label: 'Other / Unclassified' };
}

function tokens(name: string) {
  return normalizeText(name).split(' ').filter((token) => token.length > 1 && !noise.has(token));
}

function grams(value: string) {
  const normalized = ` ${normalizeText(value)} `;
  const counts = new Map<string, number>();
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      const gram = normalized.slice(index, index + size);
      counts.set(gram, (counts.get(gram) || 0) + 1);
    }
  }
  return counts;
}

function cosine(left: string, right: string) {
  const a = grams(left); const b = grams(right);
  let dot = 0; let normA = 0; let normB = 0;
  for (const value of a.values()) normA += value * value;
  for (const value of b.values()) normB += value * value;
  for (const [key, value] of a) dot += value * (b.get(key) || 0);
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

function jaccard(left: string, right: string) {
  const a = new Set(tokens(left)); const b = new Set(tokens(right));
  const common = [...a].filter((token) => b.has(token));
  return { score: new Set([...a, ...b]).size ? common.length / new Set([...a, ...b]).size : 0, common };
}

function extractPack(name: string) {
  const normalized = normalizeText(name).replace(/,/g, '.');
  const units = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(kg|gr|g|ml|l)\b/g)].map((match) => ['kg', 'l'].includes(match[2]) ? Number(match[1]) * 1000 : Number(match[1])).filter(Number.isFinite);
  const counts = [...normalized.matchAll(/(?:combo\s*)?(\d+)\s*(?:hop|goi|thanh|hu|chai|tui|box|pack)\b/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  const multiplied = normalized.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(g|gr|ml)\b/);
  return { totalSize: multiplied ? Number(multiplied[1]) * Number(multiplied[2]) : (units.at(-1) || null), packCount: counts.at(-1) || (multiplied ? Number(multiplied[1]) : null) };
}

function ratio(a: number | null, b: number | null) {
  if (!a || !b) return .5;
  return Math.max(0, 1 - Math.abs(Math.log(a / b)) / Math.log(4));
}

function scorePair(source: Product, candidate: Product, country: Country): Match['scoring'] | null {
  const sourceSegment = classify(source.product_name, country);
  const candidateSegment = classify(candidate.product_name, country);
  if (sourceSegment.id === 'other' || sourceSegment.id !== candidateSegment.id) return null;
  const textScore = cosine(source.product_name, candidate.product_name);
  const token = jaccard(source.product_name, candidate.product_name);
  const sourcePack = extractPack(source.product_name); const candidatePack = extractPack(candidate.product_name);
  const sizeScore = ratio(sourcePack.totalSize, candidatePack.totalSize); const countScore = ratio(sourcePack.packCount, candidatePack.packCount);
  const packScore = (sizeScore + countScore) / 2;
  const score = textScore * .58 + token.score * .24 + packScore * .18;
  const reasons = [`Cùng phân khúc ${sourceSegment.label}`];
  if (token.common.length) reasons.push(`Từ khóa chung: ${token.common.slice(0, 4).join(', ')}`);
  if (sourcePack.totalSize && candidatePack.totalSize && sizeScore >= .78) reasons.push('Quy cách/khối lượng gần tương đương');
  if (sourcePack.packCount && candidatePack.packCount && countScore >= .78) reasons.push('Số lượng trong combo tương đương');
  const warnings: string[] = [];
  if (!sourcePack.totalSize || !candidatePack.totalSize) warnings.push('Thiếu quy cách để xác nhận hoàn toàn');
  else if (sizeScore < .55) warnings.push('Chênh lệch khối lượng/dung tích đáng kể');
  if (textScore < .5) warnings.push('Độ giống tên sản phẩm còn thấp');
  return { score, confidence: Math.round(score * 100), band: score >= .72 ? 'high' : score >= .56 ? 'review' : 'low', textScore: Math.round(textScore * 100), tokenScore: Math.round(token.score * 100), packScore: Math.round(packScore * 100), segment: sourceSegment, reasons, warnings, sourcePack, candidatePack };
}

export function rankSnapshotMatches(products: Product[], options: { country: Country; sourceShopId: string; targetShopId?: string; segmentId?: string; limit?: number }) {
  const sources = products.filter((product) => product.shop_id === options.sourceShopId)
    .filter((product) => !options.segmentId || classify(product.product_name, options.country).id === options.segmentId)
    .sort((a, b) => b.monthly_sold - a.monthly_sold);
  const candidates = products.filter((product) => product.shop_id !== options.sourceShopId && (!options.targetShopId || product.shop_id === options.targetShopId));
  const matches: Match[] = [];
  for (const source of sources) {
    const ranked = candidates.map((candidate) => ({ candidate, scoring: scorePair(source, candidate, options.country) }))
      .filter((item): item is { candidate: Product; scoring: Match['scoring'] } => Boolean(item.scoring))
      .sort((a, b) => b.scoring.score - a.scoring.score).slice(0, 3);
    for (const item of ranked) matches.push({ source, candidate: item.candidate, scoring: item.scoring });
  }
  return matches.sort((a, b) => b.scoring.score - a.scoring.score).slice(0, options.limit || 30);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function simulatePricingLocally(input: PricingInput): PricingResult {
  const ourPrice = Math.max(0, Number(input.ourPrice) || 0); const competitorPrice = Math.max(0, Number(input.competitorPrice) || 0);
  const competitorChangePercent = clamp(Number(input.competitorChangePercent) || 0, -95, 500);
  const targetMarginPercent = clamp(Number(input.targetMarginPercent) || 15, 0, 80); const cogsPercent = clamp(Number(input.cogsPercent) || 55, 0, 100);
  const platformFeePercent = clamp(Number(input.platformFeePercent) || 0, 0, 40); const voucherPercent = clamp(Number(input.voucherPercent) || 0, 0, 40);
  const shippingPercent = clamp(Number(input.shippingPercent) || 0, 0, 30); const undercutPercent = clamp(Number(input.undercutPercent) || 2, 0, 20);
  const unitCost = ourPrice * cogsPercent / 100; const deductionRate = (targetMarginPercent + platformFeePercent + voucherPercent + shippingPercent) / 100;
  if (!ourPrice || !competitorPrice || deductionRate >= .95) throw new Error('Dữ liệu giá hoặc tỷ lệ khấu trừ chưa hợp lệ.');
  const competitorAfter = competitorPrice * (1 + competitorChangePercent / 100); const marginFloor = unitCost / (1 - deductionRate);
  const competitiveTarget = competitorAfter * (1 - undercutPercent / 100); const currentMarginPercent = ((ourPrice * (1 - (platformFeePercent + voucherPercent + shippingPercent) / 100) - unitCost) / ourPrice) * 100;
  let action = 'HOLD'; let recommendedPrice = ourPrice; let headline = 'Giữ giá hiện tại'; let rationale = 'Giá hiện tại đã cạnh tranh và vẫn nằm trên margin floor.';
  if (ourPrice < marginFloor) { action = 'MARGIN_RISK'; recommendedPrice = marginFloor; headline = 'Khôi phục biên lợi nhuận'; rationale = 'Giá hiện tại đang thấp hơn margin floor; không nên giảm thêm.'; }
  else if (ourPrice > competitiveTarget && competitiveTarget >= marginFloor) { action = 'MATCH_UNDERCUT'; recommendedPrice = competitiveTarget; headline = 'Có thể match/undercut nhẹ'; rationale = 'Mức giá cạnh tranh vẫn cao hơn margin floor sau khi tính các khoản khấu trừ.'; }
  else if (competitiveTarget < marginFloor) { action = 'DEFEND_MARGIN'; recommendedPrice = Math.max(ourPrice, marginFloor); headline = 'Không chạy theo giá đối thủ'; rationale = 'Giá cần thiết để undercut đã xuống dưới margin floor; nên cạnh tranh bằng bundle, voucher có điều kiện, rating hoặc giao hàng.'; }
  else if (ourPrice <= competitiveTarget) { headline = 'Không cần giảm giá'; rationale = 'Giá hiện tại đã thấp hơn mục tiêu cạnh tranh; giảm thêm chỉ làm mất margin.'; }
  return { action, headline, rationale, unitCost: Math.round(unitCost), competitorAfter: Math.round(competitorAfter), competitiveTarget: Math.round(competitiveTarget), marginFloor: Math.round(marginFloor), recommendedPrice: Math.round(recommendedPrice), currentMarginPercent: Number(currentMarginPercent.toFixed(1)), currentPriceGapPercent: Number(((ourPrice / competitorAfter - 1) * 100).toFixed(1)), assumptions: [`COGS assumed at ${cogsPercent}% of current price`] };
}
