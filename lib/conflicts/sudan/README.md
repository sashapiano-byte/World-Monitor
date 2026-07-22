# Sudan — data sources (layer set B)

Sudan is **data, not code**: the conflict row and its layers are seeded in
`supabase/migrations/0003_seed_conflicts.sql`; every layer binds to a
conflict-agnostic adapter in `lib/layers/adapters/` via `adapter_key`. This
file documents the Sudan-specific sourcing, cadence, and license obligations.

Theatre bbox (used by adapters via `ctx.conflict.bbox`):
`[21.8, 8.6, 38.6, 22.2]` (minLng, minLat, maxLng, maxLat).

| Layer key | Adapter | Enabled | Cadence | License |
|---|---|---|---|---|
| `acled_events` | `acled` | **no** (gated) | 6 h (when enabled) | ACLED Terms — non-commercial free tier; see memo |
| `ucdp_ged` | `ucdp_ged` | yes | daily | **CC BY 4.0** |
| `hdx_sudan` | `hdx` | yes | daily | **per-dataset** (preserved per feature) |
| `firms_fires` | `nasa_firms` | yes | 1 h | NASA open data (owned by layer set A — same adapter as Ukraine) |

---

## 1. UCDP GED — `ucdp_ged` (primary event layer)

- **What:** Uppsala Conflict Data Program, Georeferenced Event Dataset —
  individual events of organized violence (state-based, non-state, one-sided)
  geocoded to points with low/best/high fatality estimates. For Sudan this
  captures SAF–RSF fighting plus one-sided violence against civilians.
- **Endpoint:** `https://ucdpapi.pcr.uu.se/api/gedevents/{version}` with
  `pagesize` (max 1000), `page` (0-based), `Country` (Gleditsch–Ward id;
  Sudan = 625) and `StartDate`/`EndDate` filters; paginated via
  `NextPageUrl`. No API key required.
- **Config:** `{"dataset":"gedevents","country":"Sudan"}` — optional
  `version` (default `25.1`), `start_date`, `pagesize`, `max_pages`.
- **Cadence:** curated GED releases **yearly** (~June, version `YY.1`);
  UCDP **Candidate** releases land **monthly** (versions like `YY.0.M`) —
  switch `config.version` to a candidate version for fresher coverage.
  Layer refresh is daily (cheap; the dataset only changes on release).
- **License:** **CC BY 4.0** — commercial use OK **with attribution**:
  *"Uppsala Conflict Data Program (UCDP), Georeferenced Event Dataset,
  licensed under CC BY 4.0."* (stored on the layer row; ingestion fails
  closed if an adapter drops it). Cite Sundberg & Melander (2013) and the
  current GED codebook in any published methodology page.

## 2. HDX — `hdx_sudan` (humanitarian context)

- **What:** curated datasets from OCHA's Humanitarian Data Exchange for the
  Sudan group (`group=sdn`): admin boundaries (COD-AB) and IOM DTM
  displacement aggregates. Fill/polygon or point output depending on dataset.
- **Endpoint:** CKAN action API — `https://data.humdata.org/api/3/action/`
  (`package_show?id={name}` for metadata + license, then the chosen
  resource's download URL). GeoJSON resources only for now; CSV/SHP parsing
  is a follow-up.
- **Config:** `{"group":"sdn"}`; optional `datasets` array of CKAN names
  (defaults: `cod-ab-sdn`, `sudan-displacement-data-idps-iom-dtm` —
  VERIFY exact names on data.humdata.org), `max_datasets`,
  `max_features_per_dataset`.
- **Cadence:** dataset-dependent — COD-AB changes rarely; DTM displacement
  updates roughly bi-weekly/monthly. Daily refresh is sufficient.
- **License:** **HDX is a catalogue, not a license.** Each dataset carries
  its own terms (CC BY, CC BY-IGO, ODbL, ...). The adapter reads
  `license_title`/`license_id`/`dataset_source` per dataset and stamps them
  on every feature (`hdx_license`, `hdx_dataset_source`, ...); datasets with
  unspecified licenses are **skipped**. Map UI must surface the per-dataset
  credit, not just the generic HDX line.

## 3. ACLED — `acled_events` (GATED, ships disabled)

- **What (when licensed):** derived admin-1 intensity aggregates (event
  counts, fatality sums, dominant event types over a trailing window) built
  from ACLED political-violence events — **never raw event re-plots**, which
  ACLED's terms forbid ("substantially reworked" requirement).
- **Why disabled:** free tier is non-commercial only; this product may
  charge users. Full analysis + recommendation (DEFER the commercial
  license): `docs/sudan-acled-license.md` and DECISIONS.md item 3.
- **To enable (after a signed ACLED Commercial License — human decision):**
  1. Set env `ACLED_EMAIL` + `ACLED_API_KEY`.
  2. On the `acled_events` row: `config = {"commercial_licensed": true}`
     (optionally `country`, `window_days`), `enabled = true`.
  Until both are true the adapter returns status `partial` with zero
  features. Attribution required: *"Armed Conflict Location & Event Data
  Project (ACLED); acleddata.com."*
- **Endpoint (legacy, VERIFY):** `https://api.acleddata.com/acled/read` with
  `key`/`email` — ACLED moved to a new developer portal with OAuth in 2025;
  confirm provisioning at signing time.

## 4. NASA FIRMS — `firms_fires`

Same `nasa_firms` adapter as Ukraine (owned by layer set A) scoped to the
Sudan bbox — proof of the conflict-agnostic design. Config
`{"sensor":"VIIRS_SNPP_NRT","day_range":2}`, hourly refresh, NASA open data
with courtesy attribution. See the adapter's own docs; not maintained here.
