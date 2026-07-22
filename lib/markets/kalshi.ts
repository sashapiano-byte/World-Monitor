/**
 * Kalshi client — public market data over the Trade API v2.
 *
 * Base: https://api.elections.kalshi.com/trade-api/v2 (the "elections" host also
 * serves general markets; https://api.kalshi.com/trade-api/v2 is the legacy
 * host). Public market data (GetMarkets / GetEvents / GetMarket) is readable
 * WITHOUT authentication. Some account/trading endpoints require signed
 * requests (RSA-PSS over `timestamp + METHOD + path`) using KALSHI_API_KEY_ID +
 * KALSHI_PRIVATE_KEY — we read those from process.env ONLY if present and never
 * require them for the read paths used here.
 *
 * Kalshi prices are integer cents (0..100). Probability = price / 100.
 *
 * VERIFY: host choice, series tickers, market URL pattern, and whether the
 * elections host requires a session for non-election series — this sandbox
 * cannot reach the API.
 */

import type { Market, MarketOutcome, MarketSnapshot } from './types';

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const DEFAULT_TIMEOUT_MS = 8000;

/** Raw Kalshi market object (subset of documented fields). */
interface KalshiMarket {
  ticker?: string;
  event_ticker?: string;
  series_ticker?: string;
  title?: string;
  subtitle?: string;
  yes_sub_title?: string;
  status?: string; // 'active' | 'closed' | 'settled' | 'initialized' | ...
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  open_interest?: number;
  liquidity?: number;
  close_time?: string;
  can_close_early?: boolean;
}

/**
 * Auth posture: read keys if present. Kalshi authenticated requests are signed
 * with RSA-PSS, not a bearer token, so we do NOT attempt signing here — public
 * read endpoints need no auth. If keys exist we surface them for a future
 * signed-ingestion path but requests below stay unauthenticated.
 *
 * VERIFY: implement RSA-PSS request signing if authenticated endpoints are ever
 * needed (KALSHI_API_KEY_ID + KALSHI_PRIVATE_KEY, header `KALSHI-ACCESS-*`).
 */
export function kalshiCredentials(
  env: (k: string) => string | undefined = (k) => process.env[k],
): { keyId?: string; privateKey?: string; present: boolean } {
  const keyId = env('KALSHI_API_KEY_ID');
  const privateKey = env('KALSHI_PRIVATE_KEY');
  return { keyId, privateKey, present: Boolean(keyId && privateKey) };
}

async function safeFetchJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function centsToProb(cents: number | undefined): number | null {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return null;
  return clamp01(cents / 100);
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function kalshiStatus(status?: string): Market['status'] {
  if (status === 'settled' || status === 'finalized') return 'resolved';
  if (status === 'closed') return 'closed';
  return 'open';
}

/** Derive Yes/No probabilities from bid/ask midpoints, falling back to last. */
function kalshiOutcomes(m: KalshiMarket): MarketOutcome[] {
  const yesLabel = m.yes_sub_title?.trim() || 'Yes';
  let yesProb: number | null = null;
  if (m.yes_bid != null && m.yes_ask != null) {
    yesProb = centsToProb((m.yes_bid + m.yes_ask) / 2);
  } else if (m.last_price != null) {
    yesProb = centsToProb(m.last_price);
  } else if (m.yes_bid != null) {
    yesProb = centsToProb(m.yes_bid);
  }
  if (yesProb == null) yesProb = 0;
  const noProb = clamp01(1 - yesProb);
  return [
    { label: yesLabel, probability: yesProb, price: yesProb },
    { label: 'No', probability: noProb, price: noProb },
  ];
}

function normalizeKalshiMarket(m: KalshiMarket): Market | null {
  const externalId = m.ticker?.trim();
  const question = (m.title || m.subtitle)?.trim();
  if (!externalId || !question) return null;

  const outcomes = kalshiOutcomes(m);
  // VERIFY: public market URL pattern.
  const url = m.event_ticker
    ? `https://kalshi.com/markets/${m.event_ticker}`
    : `https://kalshi.com/markets/${externalId}`;

  return {
    provider: 'kalshi',
    externalId,
    question: m.subtitle ? `${question} — ${m.subtitle}` : question,
    url,
    status: kalshiStatus(m.status),
    outcomes,
    volume: m.volume ?? null,
    liquidity: m.liquidity ?? null,
    endDate: m.close_time ?? null,
    metadata: {
      eventTicker: m.event_ticker ?? null,
      seriesTicker: m.series_ticker ?? null,
      openInterest: m.open_interest ?? null,
      source: 'kalshi:trade-api-v2',
      needsVerification: true,
    },
  };
}

/**
 * Search open Kalshi markets by keyword. Kalshi's `/markets` endpoint has no
 * full-text param, so we page open markets and filter by title/subtitle. When a
 * `series_ticker` is known it can be passed to scope the query server-side.
 */
export async function searchKalshiMarkets(
  keyword: string,
  opts: { limit?: number; seriesTicker?: string; signal?: AbortSignal } = {},
): Promise<Market[]> {
  const limit = opts.limit ?? 30;
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];

  const params = new URLSearchParams({ status: 'open', limit: '200' });
  if (opts.seriesTicker) params.set('series_ticker', opts.seriesTicker);
  const url = `${KALSHI_BASE}/markets?${params.toString()}`;

  const data = await safeFetchJson<{ markets?: KalshiMarket[] }>(url, opts.signal);
  const rows = data?.markets ?? [];
  return rows
    .map(normalizeKalshiMarket)
    .filter((m): m is Market => m !== null)
    .filter(
      (m) =>
        m.question.toLowerCase().includes(kw) ||
        String(m.metadata?.seriesTicker ?? '').toLowerCase().includes(kw),
    )
    .slice(0, limit);
}

/** Fetch a single market by ticker and normalize it. */
export async function getKalshiMarket(
  ticker: string,
  signal?: AbortSignal,
): Promise<Market | null> {
  const data = await safeFetchJson<{ market?: KalshiMarket }>(
    `${KALSHI_BASE}/markets/${encodeURIComponent(ticker)}`,
    signal,
  );
  if (!data?.market) return null;
  return normalizeKalshiMarket(data.market);
}

/** Convert a market's outcomes to `market_snapshots`-ready rows. */
export function toKalshiSnapshots(market: Market): MarketSnapshot[] {
  const capturedAt = new Date().toISOString();
  return market.outcomes.map((o) => ({
    outcome: o.label,
    probability: o.probability,
    volume: market.volume,
    capturedAt,
  }));
}
