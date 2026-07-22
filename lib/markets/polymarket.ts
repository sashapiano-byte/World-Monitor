/**
 * Polymarket client — public read only, no auth/keys.
 *
 * Two public APIs are used:
 *  - Gamma API  (https://gamma-api.polymarket.com) — market/event metadata AND
 *    current outcome prices. The `/markets` endpoint returns `outcomes` and
 *    `outcomePrices` as JSON-encoded string arrays; the prices ARE the current
 *    implied probabilities (0..1), so most odds can be read from Gamma alone.
 *  - CLOB API   (https://clob.polymarket.com) — live order-book prices/midpoints
 *    keyed by CLOB token id. Used to refresh a single outcome to the tightest
 *    current price when Gamma is stale.
 *
 * All endpoints here are public GETs. We never send keys. Everything is
 * defensive: timeouts, empty-on-error, never throw on empty.
 *
 * VERIFY: exact query-param names, the `public-search` endpoint, the CLOB
 * `/price` + `/midpoint` shapes, and the public market URL pattern below need
 * live confirmation — this sandbox cannot reach the APIs.
 */

import type { Market, MarketOutcome, MarketSnapshot } from './types';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CLOB_BASE = 'https://clob.polymarket.com';
const DEFAULT_TIMEOUT_MS = 8000;

/** Raw Gamma market object (subset of documented fields we rely on). */
interface GammaMarket {
  id?: string | number;
  conditionId?: string;
  question?: string;
  slug?: string;
  // Both are JSON-encoded string arrays, e.g. '["Yes","No"]', '["0.62","0.38"]'.
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  volume?: string | number;
  volumeNum?: number;
  liquidity?: string | number;
  liquidityNum?: number;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  endDate?: string;
  events?: Array<{ slug?: string }>;
}

/** Fetch JSON with a hard timeout; returns null instead of throwing. */
async function safeFetchJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  // Chain an external abort signal if provided.
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

/** Best-effort JSON.parse of Gamma's stringified array fields. */
function parseJsonArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map a Gamma market to our provider-native `Market`. */
function normalizeGammaMarket(m: GammaMarket): Market | null {
  const externalId = m.conditionId || (m.id != null ? String(m.id) : '');
  const question = m.question?.trim();
  if (!externalId || !question) return null;

  const labels = parseJsonArray(m.outcomes);
  const prices = parseJsonArray(m.outcomePrices);
  const tokenIds = parseJsonArray(m.clobTokenIds);

  const outcomes: MarketOutcome[] = labels.map((label, i) => {
    const p = toNumber(prices[i]);
    return {
      label,
      // Gamma prices are already 0..1 probabilities.
      probability: p != null ? clamp01(p) : 0,
      price: p,
      tokenId: tokenIds[i] ?? null,
    };
  });

  const volume = m.volumeNum ?? toNumber(m.volume);
  const liquidity = m.liquidityNum ?? toNumber(m.liquidity);
  const status = m.closed ? 'closed' : 'open';
  const slug = m.slug || m.events?.[0]?.slug;
  // VERIFY: public URL pattern. Event pages live at /event/:slug.
  const url = slug ? `https://polymarket.com/event/${slug}` : null;

  return {
    provider: 'polymarket',
    externalId,
    question,
    url,
    status,
    outcomes,
    volume,
    liquidity,
    endDate: m.endDate ?? null,
    metadata: {
      slug: slug ?? null,
      gammaId: m.id != null ? String(m.id) : null,
      clobTokenIds: tokenIds,
      source: 'polymarket:gamma',
      needsVerification: true,
    },
  };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Search open Polymarket markets whose question mentions `keyword`.
 *
 * Gamma has no reliable public full-text param, so we page the most-liquid open
 * markets and filter by question text client-side. `public-search` is tried
 * first when available and falls back to the filtered `/markets` scan.
 */
export async function searchPolymarketMarkets(
  keyword: string,
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<Market[]> {
  const limit = opts.limit ?? 30;
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];

  // Attempt 1: dedicated public search (fast, keyword-native).
  // VERIFY: endpoint name + response envelope.
  const searchUrl =
    `${GAMMA_BASE}/public-search?q=${encodeURIComponent(keyword)}` +
    `&limit_per_type=${limit}&events_status=active`;
  const search = await safeFetchJson<{ markets?: GammaMarket[] }>(
    searchUrl,
    opts.signal,
  );
  if (search?.markets?.length) {
    return search.markets
      .map(normalizeGammaMarket)
      .filter((m): m is Market => m !== null)
      .slice(0, limit);
  }

  // Attempt 2: page open, liquid markets and filter by question text.
  const scanUrl =
    `${GAMMA_BASE}/markets?closed=false&active=true&archived=false` +
    `&limit=200&order=volumeNum&ascending=false`;
  const scan = await safeFetchJson<GammaMarket[] | { data?: GammaMarket[] }>(
    scanUrl,
    opts.signal,
  );
  const rows = Array.isArray(scan) ? scan : scan?.data ?? [];
  return rows
    .map(normalizeGammaMarket)
    .filter((m): m is Market => m !== null)
    .filter((m) => m.question.toLowerCase().includes(kw))
    .slice(0, limit);
}

/**
 * Refresh a market's outcome probabilities from the CLOB order book (midpoint).
 * Falls back silently to the passed-in Gamma probabilities on any failure.
 *
 * VERIFY: CLOB `/midpoint?token_id=` returns `{ mid: "0.61" }` per docs.
 */
export async function refreshPolymarketWithClob(
  market: Market,
  signal?: AbortSignal,
): Promise<Market> {
  const enriched = await Promise.all(
    market.outcomes.map(async (o) => {
      if (!o.tokenId) return o;
      const data = await safeFetchJson<{ mid?: string | number }>(
        `${CLOB_BASE}/midpoint?token_id=${encodeURIComponent(o.tokenId)}`,
        signal,
      );
      const mid = toNumber(data?.mid);
      if (mid == null) return o;
      return { ...o, probability: clamp01(mid), price: mid };
    }),
  );
  return { ...market, outcomes: enriched };
}

/** Convert a market's outcomes to `market_snapshots`-ready rows. */
export function toPolymarketSnapshots(market: Market): MarketSnapshot[] {
  const capturedAt = new Date().toISOString();
  return market.outcomes.map((o) => ({
    outcome: o.label,
    probability: o.probability,
    volume: market.volume,
    capturedAt,
  }));
}
