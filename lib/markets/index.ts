/**
 * Unified markets facade (Phase 1E).
 *
 * `getMarketsForConflict` queries BOTH providers (Polymarket + Kalshi) for a
 * conflict's keyword set, merges + dedupes, and normalizes to `UiMarket[]` for
 * the overlay and for ingestion into the `markets` table.
 *
 * Keyword sets are conflict-scoped and conflict-agnostic in shape: adding a new
 * theatre = adding a keyword entry (or passing `keywords` explicitly), never
 * editing provider code. Everything is defensive — a provider failing returns
 * nothing rather than throwing.
 */

import type { Market, UiMarket } from './types';
import {
  searchPolymarketMarkets,
  toPolymarketSnapshots,
} from './polymarket';
import { searchKalshiMarkets, toKalshiSnapshots } from './kalshi';

export * from './types';
export {
  searchPolymarketMarkets,
  refreshPolymarketWithClob,
  toPolymarketSnapshots,
} from './polymarket';
export {
  searchKalshiMarkets,
  getKalshiMarket,
  kalshiCredentials,
  toKalshiSnapshots,
} from './kalshi';

/** Per-conflict keyword sets used to discover relevant markets. */
export const CONFLICT_KEYWORDS: Record<string, string[]> = {
  ukraine: [
    'Ukraine',
    'Russia',
    'Putin',
    'Zelensky',
    'NATO',
    'Crimea',
    'Donbas',
    'ceasefire',
  ],
  sudan: ['Sudan', 'RSF', 'SAF', 'Khartoum', 'Darfur', 'ceasefire'],
};

export function keywordsForConflict(
  conflictSlug: string,
  override?: string[],
): string[] {
  if (override && override.length) return override;
  return CONFLICT_KEYWORDS[conflictSlug] ?? [conflictSlug];
}

/** Pick the most-relevant single outcome for the ranked list. */
function representativeOutcome(market: Market): { label: string; probability: number } {
  if (market.outcomes.length === 0) return { label: 'Yes', probability: 0 };
  // Prefer a 'Yes' outcome; else the highest-probability outcome.
  const yes = market.outcomes.find((o) => o.label.toLowerCase() === 'yes');
  if (yes) return { label: yes.label, probability: yes.probability };
  return market.outcomes.reduce((best, o) =>
    o.probability > best.probability ? o : best,
  );
}

/** Normalize a provider-native `Market` to the UI shape. */
export function toUiMarket(market: Market): UiMarket {
  const rep = representativeOutcome(market);
  return {
    id: `${market.provider}:${market.externalId}`,
    provider: market.provider,
    externalId: market.externalId,
    question: market.question,
    url: market.url,
    status: market.status,
    outcome: rep.label,
    probability: rep.probability,
    outcomes: market.outcomes,
    volume: market.volume,
    previousProbability: null,
    capturedAt: new Date().toISOString(),
    endDate: market.endDate ?? null,
  };
}

/** Merge markets from many keyword searches, deduping by provider+externalId. */
function dedupe(markets: Market[]): Market[] {
  const byKey = new Map<string, Market>();
  for (const m of markets) {
    const key = `${m.provider}:${m.externalId}`;
    const existing = byKey.get(key);
    // Keep the one with the higher volume signal.
    if (!existing || (m.volume ?? 0) > (existing.volume ?? 0)) {
      byKey.set(key, m);
    }
  }
  return [...byKey.values()];
}

/**
 * Query both providers for a conflict's keywords and return normalized,
 * volume-ranked markets. Runs all searches in parallel; a slow/failed provider
 * simply contributes nothing. `limit` caps the final list.
 */
export async function getMarketsForConflict(
  conflictSlug: string,
  keywords?: string[],
  opts: { limit?: number; perKeyword?: number; signal?: AbortSignal } = {},
): Promise<UiMarket[]> {
  const kws = keywordsForConflict(conflictSlug, keywords);
  const perKeyword = opts.perKeyword ?? 10;
  const limit = opts.limit ?? 20;

  const tasks: Promise<Market[]>[] = [];
  for (const kw of kws) {
    tasks.push(
      searchPolymarketMarkets(kw, { limit: perKeyword, signal: opts.signal }),
    );
    tasks.push(
      searchKalshiMarkets(kw, { limit: perKeyword, signal: opts.signal }),
    );
  }

  const settled = await Promise.allSettled(tasks);
  const found: Market[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') found.push(...r.value);
  }

  return dedupe(found)
    .map(toUiMarket)
    .sort((a, b) => {
      const dv = (b.volume ?? 0) - (a.volume ?? 0);
      if (dv !== 0) return dv;
      return b.probability - a.probability;
    })
    .slice(0, limit);
}

/** Snapshot rows for a provider-native market (delegates per provider). */
export function toSnapshots(market: Market) {
  return market.provider === 'polymarket'
    ? toPolymarketSnapshots(market)
    : toKalshiSnapshots(market);
}
