# Deployment

## Local, one command

```bash
cp .env.example .env
docker compose up --build
```

Three services come up:

| Service | What it does |
|---|---|
| `db` | PostgreSQL 16 + PostGIS 3.4. Published on `${POSTGRES_PORT:-55432}`. Healthchecked. |
| `migrate` | One-shot. Applies `db/migrations/*.sql`, then runs quality control and seeds `./data`. Exits 0. |
| `web` | Next.js standalone server on `${WEB_PORT:-3000}`. Starts only after `migrate` completes successfully. |

`migrate` **refuses to seed** if the dataset has any error-severity QC finding,
and `web` will not start if `migrate` failed. A rule-breaking dataset therefore
cannot reach a running deployment.

Verify:

```bash
curl -s localhost:3000/api/health | jq
curl -s localhost:3000/api/qc | jq .summary
docker compose exec db psql -U idm -d industrial_damage \
  -c "SELECT industry_id, count(*) FROM facilities GROUP BY 1 ORDER BY 2 DESC;"
```

## Behind a TLS-intercepting proxy

Corporate networks and sandboxed CI runners often re-sign TLS, which breaks
`npm` inside the build container. Two hooks handle it:

```bash
# 1. drop the proxy's root certificate here (git-ignored)
cp /path/to/corporate-root.crt docker/certs/ca.crt

# 2. pass the proxy through to the build
docker compose build \
  --build-arg HTTP_PROXY="$HTTP_PROXY" \
  --build-arg HTTPS_PROXY="$HTTPS_PROXY" \
  --build-arg NO_PROXY="$NO_PROXY"

docker compose up
```

Both are optional and inert when unused.

## Without Docker

```bash
npm install
npm run build
DATA_BACKEND=file npx next start -p 3000
```

With a database:

```bash
export DATABASE_URL=postgres://user:pass@host:5432/industrial_damage
npm run db:migrate      # tsx db/migrate.ts
npm run db:seed
npm run build && npm start
```

`db/migrate.ts` waits for the database (30 attempts, backing off to 5 s),
records applied files in `schema_migrations`, and is idempotent. `--reset` drops
and recreates the `public` schema; `--seed` chains the seed.

## Data backends

`DATA_BACKEND` decides how hard the app leans on Postgres:

| Value | Behaviour |
|---|---|
| `auto` (default) | Use Postgres when reachable, else serve the version-controlled dataset. |
| `postgres` | Require Postgres. A connection failure is fatal. |
| `file` | Never connect. Serve `./data`. |

The read model is identical either way — that is what makes the fallback safe
rather than a second, quieter version of the truth. `GET /api/health` reports
`effectiveBackend`.

Use `postgres` in production: silently falling back to a file-backed copy after
a database outage would mask the outage.

## Environment

Everything in `.env.example` has a working default. Nothing is required to serve
the read-only map. Notable variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `DATA_BACKEND` | See above. |
| `NEXT_PUBLIC_BASEMAP_STYLE_URL` | Your own MapLibre style JSON. Default is OSM raster tiles built locally — no key, no vendor account. |
| `INGEST_SECRET` | Required by `POST /api/ingest/run`. **Unset means the endpoint returns 503** — ingestion is closed by default. |
| `INGEST_FEEDS` | Comma-separated RSS/Atom feeds. |
| `INGEST_MIN_AGE_HOURS` | Clamped to a floor of 72. Setting it lower has no effect. |
| `SENTINEL_HUB_*` | Optional. See [SATELLITE_IMAGERY.md](./SATELLITE_IMAGERY.md). |

**Never commit real credentials.** `.env` and `docker/certs/ca.crt` are
git-ignored.

## Production notes

- **Basemap tiles.** The default style points at `tile.openstreetmap.org`, whose
  usage policy does not permit heavy production traffic. For anything beyond
  local research, host your own tiles or use a commercial provider and set
  `NEXT_PUBLIC_BASEMAP_STYLE_URL`. The map degrades to a blank basemap with
  markers intact if tiles are unavailable, so this fails visibly rather than
  fatally.
- **Read-only surface.** No route mutates the dataset. `POST /api/ingest/run`
  returns a draft and writes nothing.
- **Static pages.** `/`, `/table`, `/dashboard`, `/methodology`, `/sources`,
  `/review-queue` and all 64 facility pages are prerendered at build time.
  Re-seeding the database does not change them — rebuild to publish new data.
- **`robots` is set to `noindex`.** Remove that from `app/layout.tsx`
  deliberately, not by accident.
- **Scaling.** The dataset is small and served from memory; a single instance is
  ample. Postgres matters for editorial work and spatial queries, not for read
  throughput.

## CI

```bash
npm ci
npm run typecheck
npm run qc          # exits 1 on any error-severity finding
npm test
npm run build
npm run test:e2e
```

For a runner with a pre-provisioned Chromium whose build number does not match
this Playwright release, set `CHROMIUM_EXECUTABLE` and Playwright will use it
instead of downloading.
