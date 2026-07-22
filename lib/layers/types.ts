import type { Feature, Geometry } from 'geojson';

/**
 * Layer adapter contract.
 *
 * This is the port of the Ukraine map's "layer registry" concept — the logic,
 * not the files. Every data source (ISW, VIINA, FIRMS, Oryx, ACLED, UCDP, HDX,
 * ...) is implemented as a `LayerAdapter` and registered once under a stable
 * `key`. A `conflict_layers` row references that key via its `adapter_key`
 * column. Nothing about any specific conflict is hard-coded in an adapter:
 * conflict-specific parameters (bbox, dataset name, country filter) arrive
 * through `LayerContext.config` / `LayerContext.conflict`.
 */

export interface ConflictRef {
  id: string;
  slug: string;
  name: string;
  center: [number, number];
  /** [minLng, minLat, maxLng, maxLat] — used to scope source queries. */
  bbox: [number, number, number, number] | null;
}

export interface LayerRef {
  id: string;
  key: string;
  name: string;
  adapterKey: string;
  attribution: string;
  license: string;
  sourceUrl: string | null;
  /** Adapter-specific configuration from the DB (`conflict_layers.config`). */
  config: Record<string, unknown>;
  style: Record<string, unknown>;
}

export interface LayerContext {
  conflict: ConflictRef;
  layer: LayerRef;
  /** Abort long-running source fetches (cron budget, request cancellation). */
  signal?: AbortSignal;
  /** Injected env accessor so adapters never read process.env directly. */
  env: (key: string) => string | undefined;
}

/**
 * A normalized feature ready to upsert into `layer_features`.
 * `externalId` must be stable for the source so re-ingestion dedupes.
 */
export interface NormalizedFeature {
  externalId: string;
  geometry: Geometry;
  eventDate?: string | null;
  title?: string | null;
  properties: Record<string, unknown>;
}

export interface LayerFetchResult {
  features: NormalizedFeature[];
  /** Echoed attribution — a runtime guard that credit lines survive ingestion. */
  attribution: string;
  fetchedAt: string;
  /** 'ok' = full, 'partial' = degraded (e.g. source rate-limited). */
  status: 'ok' | 'partial';
  message?: string;
}

/**
 * Optional client-side transform: turn stored features into Mapbox GL
 * source + layer specs. When omitted, a default renderer keyed off
 * `conflict_layers.layer_type` + `style` is used.
 */
export interface MapboxRenderSpec {
  sourceId: string;
  source: Record<string, unknown>;
  layers: Array<Record<string, unknown>>;
}

export interface LayerAdapter {
  /** Stable registry key; matches `conflict_layers.adapter_key`. */
  key: string;
  label: string;
  /** Free-tier / license note surfaced in the admin + report. */
  licenseNote?: string;
  /**
   * Server-side fetch + normalize. Runs in ingestion route handlers / cron.
   * MUST return `attribution` intact.
   */
  fetch(ctx: LayerContext): Promise<LayerFetchResult>;
  /** Optional custom Mapbox rendering. */
  toMapbox?(features: Feature[], ctx: LayerContext): MapboxRenderSpec;
}
