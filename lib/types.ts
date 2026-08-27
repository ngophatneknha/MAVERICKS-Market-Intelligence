export type Country = 'vn' | 'id';

export type Shop = { shop_id: string; shop_name: string; is_official_shop: boolean; sku_count: number; monthly_sold: number };
export type Segment = { id: string; label: string; count: number; monthlySold: number };
export type Overview = {
  country: Country; trackedSkus: number; shops: number; classifiedCoverage: number; priceAlerts: number;
  qualityFlags: number; totalMonthlySold: number; dateRange: { min_date: string; max_date: string; dates: number };
  topShops: Shop[]; segments: Segment[];
};
export type Alert = {
  shop_id: string; shop_name: string; item_id: string; product_name: string; previous_date: string; date: string;
  previous_price: number; price: number; change_percent: number; monthly_sold: number; direction: 'up' | 'down';
  severity: 'critical' | 'warning' | 'info'; suggestedAction: string;
};
export type Product = {
  country_code: Country; shop_id: string; shop_name: string; item_id: string; product_name: string; url?: string;
  image_url?: string; price: number; price_original: number; discount_percent: number | null; monthly_sold: number;
  rating: number | null; rating_count: number; brand_id?: string; brand?: string;
};
export type Match = {
  source: Product; candidate: Product;
  scoring: {
    score: number; confidence: number; band: 'high' | 'review' | 'low'; textScore: number; tokenScore: number; packScore: number;
    segment: { id: string; label: string }; reasons: string[]; warnings: string[];
    sourcePack: { totalSize: number | null; packCount: number | null };
    candidatePack: { totalSize: number | null; packCount: number | null };
  };
};
export type QualityIssue = { type: string; severity: string; product_name: string; shop_name: string; price: number; item_id: string };
export type Quality = { country: Country; totalProducts: number; flaggedProducts: number; orphanPromotionRows: number; issues: QualityIssue[] };
export type TrendPoint = { date: string; priceIndex: number; listings: number; cuts: number; increases: number };
export type MarketSnapshot = {
  generatedAt: string;
  country: Country;
  source: 'PostgreSQL RDS snapshot';
  overview: Overview;
  shops: Shop[];
  segments: Segment[];
  alerts: Alert[];
  quality: Quality;
  trend: TrendPoint[];
  products: Product[];
};
export type PricingInput = {
  ourPrice: number; competitorPrice: number; competitorChangePercent: number; cogsPercent: number; targetMarginPercent: number;
  platformFeePercent: number; voucherPercent: number; shippingPercent: number; undercutPercent: number;
};
export type PricingResult = {
  action: string; headline: string; rationale: string; unitCost: number; competitorAfter: number; competitiveTarget: number;
  marginFloor: number; recommendedPrice: number; currentMarginPercent: number; currentPriceGapPercent: number; assumptions: string[];
};
