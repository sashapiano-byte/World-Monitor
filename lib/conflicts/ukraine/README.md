# Ukraine data layers

Source documentation for the four Ukraine layers seeded in
`supabase/migrations/0003_seed_conflicts.sql`. Each source is implemented as a
conflict-agnostic `LayerAdapter` under `lib/layers/adapters/`; nothing about
Ukraine is hard-coded in the adapters — bbox, sensor, dataset URLs, and country
filters all arrive through `conflict_layers.config` and `ctx.conflict`.

The adapters are defensive: transient source problems (network error, HTTP
error, missing credential, unexpected payload) return `status: 'partial'` with
zero features and a human-readable `message` rather than throwing, so one bad
source never blocks ingestion of the others. Every `fetch()` echoes
`ctx.layer.attribution`; the registry (`runLayerAdapter`) fails closed if the
credit line is ever empty.

> Egress note: these endpoints were coded against their documented request /
> response shapes and could not all be verified live from the build sandbox.
> Items needing live confirmation are tagged `VERIFY:` in the adapter source and
> summarized under "Live-verification TODOs" below.

---

## 1. ISW & Critical Threats Project — Assessed Control of Terrain

- **Adapter:** `lib/layers/adapters/isw_arcgis.ts` (`adapter_key = isw_arcgis`)
- **Layer key:** `isw_control`  ·  **Geometry:** Polygon / MultiPolygon (fill)
- **Endpoint (documented):** Esri ArcGIS REST `query` on the ISW/CTP hosted
  feature service, requested as GeoJSON:
  `…/FeatureServer/{layerId}/query?where=1=1&outFields=*&returnGeometry=true&outSR=4326&f=geojson`
  The theatre bbox is passed as an `esriGeometryEnvelope` spatial filter.
- **config:** `{"arcgis_layer":"assessed_control"}` selects the themed sublayer.
  `service_url` overrides the resolved endpoint entirely; `result_record_count`
  caps page size.
- **Refresh cadence:** ISW/CTP update roughly daily; layer configured at
  `refresh_interval_seconds = 21600` (6h) to catch same-day republishes.
- **License / attribution — ISW Fair Use.** The exact credit line that MUST be
  displayed wherever the layer appears:

  > "Institute for the Study of War and AEI's Critical Threats Project (Fair Use)."

  ISW maps are provided for fair use with attribution; do not imply endorsement
  and do not remove the credit. Carried verbatim in the seeded `attribution`
  column and echoed by the adapter.

## 2. VIINA — Violent Incident Information from News Articles

- **Adapter:** `lib/layers/adapters/viina.ts` (`adapter_key = viina`)
- **Layer key:** `viina_events`  ·  **Geometry:** Point
- **Source:** `github.com/zhukovyuri/VIINA` (Zhukov et al.). Event-level tables,
  machine-coded from news, updated daily. Distributed as CSV (and per-year zip
  archives). The adapter consumes a **plain CSV URL** (it does not unzip).
- **Documented columns parsed:** `date` (YYYYMMDD), `time` (HH:MM), `latitude`,
  `longitude`, `asciiname`/location, `geonameid`, `event_id`, and the `t_*`
  event-type indicator columns (e.g. `t_mil`, `t_airstrike`, `t_artillery`,
  `t_control`, `t_firefight`). Header lookup is alias-tolerant.
- **config:** `{}` by default. `data_url` overrides the CSV; `max_rows` caps
  normalization.
- **Refresh cadence:** VIINA updates daily; layer at `refresh_interval_seconds =
  3600` (1h) — cheap because re-ingestion dedupes on `event_id`.
- **License / attribution — Open Database License (ODbL) 1.0.** Obligations that
  MUST be honored (quoted from the ODbL summary):

  > **Attribution** — "You must attribute any public use of the database, or
  > works produced from the database … Any derivative database that you publicly
  > use must clearly show this attribution."
  >
  > **Share-Alike** — "If you publicly use any adapted version of this database,
  > or works produced from an adapted database, you must also offer that adapted
  > database under the ODbL."
  >
  > **Keep open** — "If you redistribute the database, or an adapted version of
  > it, then you may use technological measures that restrict the work (such as
  > DRM) as long as you also redistribute a version without such measures."

  Seeded credit line:
  > "VIINA: Violent Incident Information from News Articles (Zhukov et al.),
  > licensed under ODbL 1.0."

  Practical consequence for Frontline: because VIINA is share-alike, any public
  redistribution of a VIINA-derived database must itself be offered under ODbL.

## 3. NASA FIRMS — Active Fire / Thermal Anomalies

- **Adapter:** `lib/layers/adapters/nasa_firms.ts` (`adapter_key = nasa_firms`)
  — **owned here, reused unchanged by the Sudan layer** (proof of the
  conflict-agnostic design: same code, different bbox).
- **Layer key:** `firms_fires`  ·  **Geometry:** Point (rendered as heatmap)
- **Endpoint:** FIRMS area CSV API —
  `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{sensor}/{west,south,east,north}/{day_range}`
  The rectangle is `ctx.conflict.bbox`; the adapter is fully bbox-driven.
- **Auth:** free **MAP_KEY** read from `ctx.env('FIRMS_MAP_KEY')`. If unset, the
  adapter returns `status: 'partial'` with a clear message and zero features —
  it never throws.
- **Columns parsed:** `latitude`, `longitude`, `acq_date`, `acq_time`,
  `satellite`, `instrument`, `confidence`, `frp`, and brightness
  (`bright_ti4`/`brightness`, plus secondary `bright_ti5`/`bright_t31`).
  `event_date` = `acq_date` + `acq_time` (UTC). `acq_time` HHMM is zero-padded.
- **config:** `{"sensor":"VIIRS_SNPP_NRT","day_range":2}`. `day_range` is clamped
  to 1–10 per FIRMS limits.
- **Refresh cadence:** NRT products refresh through the day; layer at
  `refresh_interval_seconds = 3600` (1h). External id is composed from
  sensor+coords+acq time+satellite so overlapping day windows dedupe.
- **License / attribution — NASA open data.** Credit requested; seeded line:
  > "Data courtesy of NASA FIRMS (Fire Information for Resource Management System)."

## 4. Oryx — Documented Equipment Losses

- **Adapter:** `lib/layers/adapters/oryx.ts` (`adapter_key = oryx`)
- **Layer key:** `oryx_losses`  ·  **Geometry:** Point (aggregated)
- **Source:** `oryxspioenkop.com` — photo/video-verified loss tallies. Oryx
  itself publishes HTML posts, **not a structured API**, so the adapter reads a
  machine-readable JSON mirror configured via `config.data_url`. It tolerates
  three documented shapes (flat rows with status+count, per-status columns, and
  nested country→system→status objects).
- **Aggregation:** Oryx counts are per equipment type, not geolocated events, so
  features are placed at the theatre centroid (`ctx.conflict.center`) unless a
  record carries its own `lat`/`lng`. `properties.undercount_by_design = true`
  is set on every feature.
- **config:** `{}` by default (no default endpoint — must supply `data_url`).
  `country` optionally filters to one belligerent.
- **Refresh cadence:** Oryx updates irregularly (days); layer at
  `refresh_interval_seconds = 86400` (24h).
- **License / attribution — attribution required.** Seeded line:
  > "Documented equipment losses via Oryx (oryxspioenkop.com). Photo-verified,
  > undercount by design."

---

## Live-verification TODOs

These are the `VERIFY:` items from the adapter source — confirm each against the
live source before trusting production numbers:

1. **ISW ArcGIS service URL + layer indices** (`isw_arcgis.ts`
   `DEFAULT_LAYER_ENDPOINTS`). ISW/CTP periodically rehost their ArcGIS Online
   items; confirm the org, item, and per-theme `FeatureServer/{index}` against
   the live interactive map's network requests (or the ArcGIS REST services
   directory), then set `config.service_url` per layer. Also confirm which
   properties field carries the assessment date (`extractEventDate` alias list).
2. **VIINA CSV filename** (`viina.ts` `DEFAULT_CSV_URL`). Confirm the exact
   "latest" flat CSV path under
   `github.com/zhukovyuri/VIINA/tree/master/Data` (the repo also ships per-year
   zip archives, which the adapter cannot unzip) and set `config.data_url`.
   Re-confirm the `t_*` event-type column names and the timezone of `time`.
3. **NASA FIRMS** — mostly a documented-API integration, but confirm the exact
   `sensor` id string you want (VIIRS_SNPP_NRT vs VIIRS_NOAA20_NRT vs MODIS_NRT)
   and that the free MAP_KEY quota covers the configured `day_range` × bbox area.
4. **Oryx mirror** (`oryx.ts` `DEFAULT_JSON_URL` is intentionally empty).
   Identify a maintained, correctly-licensed machine-readable Oryx mirror (or
   self-host a scrape) and set `config.data_url`. Verify the record shape matches
   one of the three `normalize()` branches.
