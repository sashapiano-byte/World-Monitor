# Frontline — Global Conflict Intelligence

Multi-conflict, multi-camera global intelligence dashboard (web + iOS).
Front lines, strikes, fires, documented equipment losses, live cameras, and
prediction-market odds across every active conflict — positioned against
worldmonitor.app on native mobile and live-camera coverage.

> **Working name is "Frontline"** — a placeholder. See
> [`DECISIONS.md`](./DECISIONS.md) for the name choice and every other item
> awaiting your approval (bundle ID, ACLED license, camera ToS, deploys).

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 14 (App Router) |
| Map | Mapbox GL JS |
| Data | Supabase (Postgres + PostGIS + Auth + Realtime + Storage) |
| iOS | Capacitor + EAS Build |
| Deploy | Vercel (cron-driven ingestion) |

Same stack as Happy Hour Live — **new** repo, **new** Supabase project, **new**
Apple bundle ID under Team `LMNGCLUC3S`.

## The load-bearing idea: conflict- & camera-agnostic from day one

There is no Ukraine or Sudan code path anywhere. A conflict is a **row** in
`conflicts`; a data source is a **row** in `conflict_layers` bound to a
registered `LayerAdapter` by `adapter_key`; a camera is a **row** in `cameras`.

```
conflicts ──< conflict_layers ──< layer_features
     │              │  adapter_key → lib/layers/registry.ts
     ├──< cameras   │
     └──< markets ──< market_snapshots
```

Adding a new war = inserting rows + (if a new source) one adapter file.
Ukraine and Sudan are just the first two rows in `0003_seed_conflicts.sql`.

### Layer registry (ported concept, not files)

`lib/layers/registry.ts` holds a `Map<adapter_key, LayerAdapter>`. Adapters
self-register on import (`lib/layers/index.ts`). The DB decides which adapter
runs for a given layer. `runLayerAdapter()` **fails closed if an adapter drops
its attribution** — credit lines (ISW Fair Use, VIINA ODbL, UCDP CC BY, …) can
never be silently stripped.

## Getting started

```bash
npm install
cp .env.example .env.local      # fill in Supabase + Mapbox (new project!)

# Local database (needs Docker) or link the hosted project:
supabase start                  # local, or:
supabase link --project-ref <ref> && supabase db push
npm run dev
```

Visit `http://localhost:3000` → redirects to the featured conflict.

## Ingestion

Adapters fetch + normalize source data into `layer_features`. Triggered by
Vercel cron (`vercel.json`) or manually:

```bash
curl "$SITE/api/ingest/run?scope=fast&secret=$INGEST_SECRET"
```

`scope=fast` = layers refreshing ≤1h; `scope=slow` = the rest.

## Layout

```
app/                     Next.js App Router (pages + /api routes)
components/              Map, LayerPanel, ConflictSwitcher, Dashboard,
                        CameraLayer (1C), MarketOverlay (1E)
lib/layers/             adapter contract + registry + per-source adapters
lib/conflicts/          Ukraine (1A) & Sudan (1B) source integrations
lib/cameras/            camera catalog + helpers (1C)
lib/markets/            Polymarket/Kalshi client (1E)
lib/ingest/             ingestion runner
supabase/migrations/    schema, RLS, seed
ios/                    Capacitor shell + TestFlight docs (1D)
docs/                   license/ToS memos, ops notes
```

## Guardrails

No paid signups, no ACLED registration, no `vercel --prod`, no TestFlight
submission without explicit approval. See `DECISIONS.md`.
