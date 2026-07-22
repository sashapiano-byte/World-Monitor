# Prediction Markets (Phase 1E)

The odds overlay surfaces relevant **Polymarket** and **Kalshi** prediction
markets next to each conflict. This document covers the endpoints used, auth
posture, refresh strategy, and how markets get linked to conflicts/features.

## Data model (recap)

From `supabase/migrations/0001_core_schema.sql`:

- `markets` — one contract. `(provider, external_id)` unique;
  `conflict_id` nullable; `status ∈ {open,closed,resolved}`; free-form
  `metadata` JSONB.
- `market_snapshots` — time-series odds. `probability` is always `0..1`,
  one row per `(market, outcome)` capture. Enables movement, not just spot.
- `market_feature_links` — optional pin of a market to a specific plotted
  `layer_features` row (e.g. a market about a city pinned to that city's event).

All tables are public-read via RLS (`0002_rls.sql`); writes go through the
service role during ingestion.

## Providers & endpoints

### Polymarket — public, no keys

Client: `lib/markets/polymarket.ts`.

- **Gamma API** — `https://gamma-api.polymarket.com`
  - `GET /markets?closed=false&active=true&archived=false&limit=200&order=volumeNum&ascending=false`
    — metadata **and** current odds. `outcomes` and `outcomePrices` are
    JSON-encoded string arrays (e.g. `'["Yes","No"]'`, `'["0.62","0.38"]'`);
    the prices ARE the implied probabilities (`0..1`), so odds can be read from
    Gamma alone. `conditionId` is used as `markets.external_id`.
  - `GET /public-search?q=<kw>&limit_per_type=<n>` — keyword search, tried first;
    falls back to the filtered `/markets` scan. **VERIFY**: endpoint name +
    response envelope.
- **CLOB API** — `https://clob.polymarket.com`
  - `GET /midpoint?token_id=<clobTokenId>` — live order-book midpoint for a
    single outcome, used by `refreshPolymarketWithClob` to tighten a stale Gamma
    price. **VERIFY**: response shape (`{ mid }`).

Public URL for a market: `https://polymarket.com/event/<slug>` (**VERIFY**).

### Kalshi — public market data; optional keys

Client: `lib/markets/kalshi.ts`.

- **Trade API v2** — `https://api.elections.kalshi.com/trade-api/v2`
  (legacy host `https://api.kalshi.com/trade-api/v2`).
  - `GET /markets?status=open&limit=200[&series_ticker=<S>]` — list markets;
    filtered by keyword client-side (no public full-text param). `ticker` is
    used as `markets.external_id`.
  - `GET /markets/{ticker}` — single market.
  - Prices are integer **cents** (`0..100`). Probability =
    `mid(yes_bid, yes_ask) / 100`, falling back to `last_price`.

Public URL: `https://kalshi.com/markets/<event_ticker>` (**VERIFY**).

#### Auth posture

Public market data (GetMarkets / GetEvents / GetMarket) needs **no auth**.
Authenticated endpoints use **RSA-PSS request signing** (not a bearer token)
over `timestamp + METHOD + path` with `KALSHI_API_KEY_ID` +
`KALSHI_PRIVATE_KEY`. `kalshiCredentials()` reads those from `process.env`
**only if present** and surfaces them for a future signed-ingestion path — the
read paths here never require them and never send keys. **VERIFY**: implement
RSA-PSS signing (`KALSHI-ACCESS-KEY` / `-SIGNATURE` / `-TIMESTAMP` headers) only
if authenticated endpoints become necessary.

## Unified facade

`lib/markets/index.ts`:

- `CONFLICT_KEYWORDS` — per-conflict keyword sets (`ukraine`, `sudan`). Adding a
  theatre = adding a keyword entry (or passing `keywords` explicitly). No
  provider code changes — conflict-agnostic by construction.
- `getMarketsForConflict(slug, keywords?, opts?)` — runs Polymarket + Kalshi
  searches for every keyword in parallel (`Promise.allSettled`), dedupes by
  `provider:external_id` (keeping the higher-volume duplicate), normalizes to
  `UiMarket`, and returns volume-ranked results. A failing provider contributes
  nothing rather than throwing.
- `toUiMarket` / `toSnapshots` — normalize to the UI shape and to
  `market_snapshots`-ready rows.

Everything is defensive: 8s per-request timeouts, empty-on-error, no throws on
empty results. This sandbox generally cannot reach the live APIs, so the clients
are written against documented response shapes with `// VERIFY:` markers where a
field or endpoint needs live confirmation.

## API route

`GET /api/markets?conflict=<slug>` (`app/api/markets/route.ts`) returns
`{ markets: UiMarket[] }`. It reads from `markets` + `market_snapshots`
(seed today, live ingestion later), derives odds movement from the two most
recent snapshots per market, ranks by volume then probability, and sets
`Cache-Control: s-maxage=120, stale-while-revalidate=600`. On **any** error it
returns an empty list (never 500) so the overlay degrades to "No linked
markets".

## Overlay UI

`components/MarketOverlay.tsx` — collapsible card pinned bottom-right of the map
`<main>`. Per market: question, current `%` with a probability bar, provider
badge, volume, movement arrow (when a prior snapshot exists), and a link out.
Loading and empty states handled. Fetches only `/api/markets`; no direct
provider calls from the client.

## Refresh strategy

- **Live ingestion** (future cron / route): call `getMarketsForConflict` per
  conflict, upsert into `markets` (dedupe on `provider,external_id`), insert a
  new `market_snapshots` row per outcome each run. Suggested cadence: every
  10–15 min for open markets — odds move slowly relative to event feeds.
- **Read path**: `/api/markets` serves cached DB rows; movement comes from
  successive snapshots. The overlay refetches on conflict switch.
- **Seed** (`0005_seed_markets.sql`): ~12 representative markets across
  Ukraine/Sudan with one `Yes`/`No` snapshot each, so the overlay renders before
  any live ingestion. `external_id`s are placeholder/best-known and flagged
  `metadata.needs_verification = true`.

## Linking markets to conflicts / events

1. **Conflict link** — `markets.conflict_id`. In the seed, set via a subquery on
   `conflicts.slug`; in live ingestion, resolve the conflict a keyword set
   belongs to. A market with no conflict stays unlinked (`conflict_id NULL`) and
   is simply not shown.
2. **Feature link** (optional) — `market_feature_links(market_id, feature_id)`
   pins a market to a specific plotted `layer_features` row so the overlay can
   place odds next to the exact event (e.g. an "el-Fasher falls" market next to
   the el-Fasher event marker). Not seeded in Phase 1; wire during ingestion
   when a market's subject maps cleanly to one feature.

## VERIFY checklist

- Polymarket `public-search` endpoint name + envelope.
- Polymarket `/markets` param names (`order=volumeNum`, `closed`, `archived`).
- Polymarket CLOB `/midpoint` response (`{ mid }`) and `/price` alternative.
- Polymarket public event URL pattern (`/event/<slug>`).
- Kalshi host (elections vs legacy) for non-election series; series tickers.
- Kalshi market URL pattern (`/markets/<event_ticker>`).
- Seed `external_id`s → reconcile against live `conditionId` / `ticker`.
