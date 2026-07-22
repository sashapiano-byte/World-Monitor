/**
 * Frontline — prediction-market types (Phase 1E).
 *
 * These types describe prediction-market contracts from Polymarket and Kalshi
 * and normalize them into a single shape the odds overlay renders. They mirror
 * the DB contract in supabase/migrations/0001_core_schema.sql:
 *   - markets(provider, external_id, question, url, status, metadata)
 *   - market_snapshots(market_id, outcome, probability 0..1, volume, captured_at)
 */

export type MarketProvider = 'polymarket' | 'kalshi';
export type MarketStatus = 'open' | 'closed' | 'resolved';

/** A single tradable outcome of a market and its current implied probability. */
export interface MarketOutcome {
  /** Human label — 'Yes' / 'No' / candidate name / bucket. */
  label: string;
  /** Implied probability, 0..1. */
  probability: number;
  /** Raw provider price if it differs from probability (e.g. cents). */
  price?: number | null;
  /** Provider token / contract identifier for this outcome, when available. */
  tokenId?: string | null;
}

/**
 * A point-in-time odds reading, shaped to upsert directly into
 * `market_snapshots`. Probability is always 0..1.
 */
export interface MarketSnapshot {
  outcome: string;
  probability: number;
  volume: number | null;
  capturedAt: string; // ISO 8601
}

/**
 * Provider-native market as returned by a client, before it is persisted or
 * normalized for the UI. `externalId` is the stable provider id
 * (Polymarket conditionId, Kalshi ticker) used for dedupe in `markets`.
 */
export interface Market {
  provider: MarketProvider;
  externalId: string;
  question: string;
  url: string | null;
  status: MarketStatus;
  outcomes: MarketOutcome[];
  volume: number | null;
  liquidity?: number | null;
  endDate?: string | null;
  /** Free-form provider fields kept for the DB `metadata` column. */
  metadata?: Record<string, unknown>;
}

/**
 * The shape the overlay consumes and /api/markets returns. One row per market,
 * flattened to its single most-relevant outcome for the ranked list, plus the
 * full outcome set and optional movement.
 */
export interface UiMarket {
  /** DB id when persisted, else `${provider}:${externalId}`. */
  id: string;
  provider: MarketProvider;
  externalId: string;
  question: string;
  url: string | null;
  status: MarketStatus;
  /** Representative outcome label (usually 'Yes' or the leading candidate). */
  outcome: string;
  /** Representative probability, 0..1. */
  probability: number;
  /** All outcomes, for expanded views. */
  outcomes: MarketOutcome[];
  volume: number | null;
  /** Prior probability for the representative outcome, for movement arrows. */
  previousProbability: number | null;
  /** When the current probability was captured (ISO), if known. */
  capturedAt: string | null;
  endDate: string | null;
}
