import { rankSnapshotMatches, simulatePricingLocally } from './engines';
import type { Alert, Country, MarketSnapshot, Match, Overview, PricingInput, PricingResult, Quality, Segment, Shop, TrendPoint } from './types';

const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
const snapshots = new Map<Country, Promise<MarketSnapshot>>();

function liveBase() {
  if (typeof window === 'undefined') return '';
  if (configuredBase) return configuredBase;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:8788' : '';
}

async function snapshot(country: Country) {
  if (!snapshots.has(country)) {
    snapshots.set(country, fetch(`/data/market-${country}.json`, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error(`Snapshot ${response.status}`);
      return response.json() as Promise<MarketSnapshot>;
    }).catch((error) => { snapshots.delete(country); throw error; }));
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
  invalidateSnapshot: (country: Country) => { snapshots.delete(country); },
  market: async (country: Country) => {
    try {
      const [health, overview, shops, segments, alerts, quality, trend] = await Promise.all([
        liveRequest<{ status: string }>('/api/health'),
        liveRequest<Overview>(`/api/overview?country=${country}`),
        liveRequest<Shop[]>(`/api/shops?country=${country}`),
        liveRequest<Segment[]>(`/api/segments?country=${country}`),
        liveRequest<Alert[]>(`/api/alerts?country=${country}&limit=100`),
        liveRequest<Quality>(`/api/quality?country=${country}`),
        liveRequest<TrendPoint[]>(`/api/market-trend?country=${country}`),
      ]);
      if (health.status !== 'ok') throw new Error('API chưa sẵn sàng');
      return { mode: 'live' as const, generatedAt: new Date().toISOString(), overview, shops, segments, alerts, quality, trend };
    } catch {
      const data = await snapshot(country);
      return { mode: 'snapshot' as const, ...data };
    }
  },
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
  matches: async (params: { country: Country; sourceShopId: string; targetShopId?: string; segmentId?: string; mode?: 'live' | 'snapshot' }) => {
    const query = new URLSearchParams({ country: params.country, sourceShopId: params.sourceShopId, limit: '30' });
    if (params.targetShopId) query.set('targetShopId', params.targetShopId);
    if (params.segmentId) query.set('segmentId', params.segmentId);
    if (params.mode === 'live') return liveRequest<Match[]>(`/api/matches?${query}`);
    try {
      if (params.mode === 'snapshot') throw new Error('Pinned to snapshot');
      return await liveRequest<Match[]>(`/api/matches?${query}`);
    }
    catch {
      const data = await snapshot(params.country);
      return rankSnapshotMatches(data.products, { ...params, limit: 30 });
    }
  },
  pricing: async (input: PricingInput): Promise<PricingResult> => simulatePricingLocally(input),
};
