import { rankSnapshotMatches, simulatePricingLocally } from './engines';
import type { Alert, Country, MarketSnapshot, Match, Overview, PricingInput, PricingResult, Quality, Segment, Shop, TrendPoint } from './types';

const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8788';
const snapshots = new Map<Country, Promise<MarketSnapshot>>();

function liveBase() {
  if (typeof window === 'undefined') return '';
  return ['localhost', '127.0.0.1'].includes(window.location.hostname) ? configuredBase : '';
}

async function snapshot(country: Country) {
  if (!snapshots.has(country)) {
    snapshots.set(country, fetch(`/data/market-${country}.json`, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error(`Snapshot ${response.status}`);
      return response.json() as Promise<MarketSnapshot>;
    }));
  }
  return snapshots.get(country)!;
}

async function liveRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = liveBase();
  if (!base) throw new Error('Live API is not configured for this origin');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${base}${path}`, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    if (!response.ok) throw new Error(`API ${response.status}`);
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function liveOrSnapshot<T>(country: Country, path: string, key: keyof MarketSnapshot) {
  try { return await liveRequest<T>(path); }
  catch { return (await snapshot(country))[key] as T; }
}

export const api = {
  health: async () => {
    try { return await liveRequest<{ status: string; database: string }>('/api/health'); }
    catch { return { status: 'snapshot', database: 'PostgreSQL snapshot' }; }
  },
  snapshotMeta: async (country: Country) => {
    const data = await snapshot(country);
    return { generatedAt: data.generatedAt, source: data.source, products: data.products.length };
  },
  overview: (country: Country) => liveOrSnapshot<Overview>(country, `/api/overview?country=${country}`, 'overview'),
  shops: (country: Country) => liveOrSnapshot<Shop[]>(country, `/api/shops?country=${country}`, 'shops'),
  segments: (country: Country) => liveOrSnapshot<Segment[]>(country, `/api/segments?country=${country}`, 'segments'),
  alerts: (country: Country) => liveOrSnapshot<Alert[]>(country, `/api/alerts?country=${country}&limit=100`, 'alerts'),
  quality: (country: Country) => liveOrSnapshot<Quality>(country, `/api/quality?country=${country}`, 'quality'),
  trend: (country: Country) => liveOrSnapshot<TrendPoint[]>(country, `/api/market-trend?country=${country}`, 'trend'),
  matches: async (params: { country: Country; sourceShopId: string; targetShopId?: string; segmentId?: string }) => {
    const query = new URLSearchParams({ country: params.country, sourceShopId: params.sourceShopId, limit: '30' });
    if (params.targetShopId) query.set('targetShopId', params.targetShopId);
    if (params.segmentId) query.set('segmentId', params.segmentId);
    try { return await liveRequest<Match[]>(`/api/matches?${query}`); }
    catch {
      const data = await snapshot(params.country);
      return rankSnapshotMatches(data.products, { ...params, limit: 30 });
    }
  },
  pricing: async (input: PricingInput): Promise<PricingResult> => {
    try { return await liveRequest<PricingResult>('/api/pricing/simulate', { method: 'POST', body: JSON.stringify(input) }); }
    catch { return simulatePricingLocally(input); }
  },
};
