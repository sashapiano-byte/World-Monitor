# Ops note — Ukraine sources

Quick operational reference for the four Ukraine layers. Full source docs live
in `lib/conflicts/ukraine/README.md`. Adapters are in `lib/layers/adapters/`.

| Layer key      | Adapter       | Geometry        | Refresh | Auth / config it needs                          | Degrades to `partial` when… |
|----------------|---------------|-----------------|---------|-------------------------------------------------|------------------------------|
| `isw_control`  | `isw_arcgis`  | Polygon (fill)  | 6h      | `config.service_url` if ISW rehosts the service | ArcGIS unreachable / non-polygon payload |
| `viina_events` | `viina`       | Point           | 1h      | `config.data_url` (plain CSV; not a zip)        | CSV unreachable / no lat-lng columns |
| `firms_fires`  | `nasa_firms`  | Point (heatmap) | 1h      | **env `FIRMS_MAP_KEY`** + `config.sensor/day_range` | MAP_KEY unset / bbox missing / API error |
| `oryx_losses`  | `oryx`        | Point (agg.)    | 24h     | `config.data_url` (JSON mirror — no default)    | no data_url / unrecognized feed shape |

## Env vars

- **`FIRMS_MAP_KEY`** (required for the FIRMS layer). Free key from
  <https://firms.modaps.eosdis.nasa.gov/api/area/>. Read via `ctx.env`, never
  `process.env` directly. Missing key = `partial`, not a crash. **This is the
  only new env var these four adapters introduce.**

## Operational behavior

- **Fail-soft:** every adapter returns `{status:'partial', features:[], message}`
  on source trouble instead of throwing, so a single dead source does not stall
  the ingestion run. `runner.ts` records the message in `ingestion_runs`.
- **Dedupe:** re-ingestion is idempotent via `(layer_id, external_id)`.
  - ISW: `assessed_control:{OBJECTID}`
  - VIINA: `viina:{event_id}` (falls back to date+place+row)
  - FIRMS: `firms:{sensor}:{lat,lng}:{acq_date}:{acq_time}:{sat}`
  - Oryx: `oryx:{country}:{category}:{system}:{status}:{i}`
- **Attribution guard:** all four echo `ctx.layer.attribution`; ingestion fails
  closed if a credit line is ever empty. Do not edit the seeded attribution
  strings to remove credit (ISW Fair Use, VIINA ODbL, NASA, Oryx).
- **Cost:** all four sources are free. VIINA/Oryx are pulled from public files;
  FIRMS needs the free MAP_KEY; ISW is public ArcGIS. No paid tiers.

## Before going live

Resolve the `VERIFY:` items (full list in the README): confirm the ISW ArcGIS
service URL/indices, the VIINA "latest" CSV filename, the desired FIRMS sensor,
and a maintained Oryx JSON mirror. Set the corresponding `config.*` values on
the `conflict_layers` rows (or `service_url`/`data_url` overrides) once
confirmed.
