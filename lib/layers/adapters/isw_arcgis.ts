import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { registerLayerAdapter } from '../registry';
import type {
  LayerAdapter,
  LayerContext,
  LayerFetchResult,
  NormalizedFeature,
} from '../types';

/**
 * Adapter: ISW & Critical Threats Project — Assessed Control of Terrain
 * =====================================================================
 * The Institute for the Study of War (ISW) and AEI's Critical Threats
 * Project (CTP) publish their daily assessed-control-of-terrain layers as
 * hosted feature layers on ArcGIS Online. Each themed layer (assessed
 * Russian-controlled area, assessed Russian advances in the last 24h,
 * claimed/contested areas, etc.) is a MapServer/FeatureServer sublayer that
 * can be queried as GeoJSON via the standard Esri REST `query` operation.
 *
 * Output: polygon features (Polygon / MultiPolygon) suitable for a fill layer.
 *
 * License: ISW Fair Use. The credit line
 *   "Institute for the Study of War and AEI's Critical Threats Project (Fair Use)."
 * MUST be rendered wherever the layer is shown — it is echoed back verbatim
 * via ctx.layer.attribution and the registry guard fails ingestion if dropped.
 *
 * config: { "arcgis_layer": "assessed_control" }
 *   - selects which themed sublayer to pull. An optional `service_url` in
 *     config overrides the resolved endpoint entirely (escape hatch for when
 *     ISW rehosts the service).
 */

interface IswConfig {
  /** Logical layer name, e.g. "assessed_control". */
  arcgis_layer?: string;
  /**
   * Full override of the ArcGIS layer query base (everything up to and
   * including the `/{layerId}`; `/query?...` is appended by the adapter).
   */
  service_url?: string;
  /** Max features to request in one page. */
  result_record_count?: number;
}

/**
 * Documented default endpoints per logical layer.
 *
 * VERIFY: ISW/CTP periodically rehost these ArcGIS Online items; the item ids
 * and layer indices below reflect the public "Russian_CoT" / assessed-control
 * service structure but MUST be confirmed against the live service directory
 * (https://www.arcgis.com/ -> ISW org, or the interactive map's network
 * requests) before trusting geometry in production. Override via
 * config.service_url once confirmed.
 */
const DEFAULT_LAYER_ENDPOINTS: Record<string, string> = {
  // Assessed Russian-controlled area (the primary "front line" fill).
  // VERIFY: confirm org item + layer index against the live ISW map.
  assessed_control:
    'https://services9.arcgis.com/ISW/arcgis/rest/services/Russian_CoT/FeatureServer/0',
  // Assessed Russian advances in the last 24 hours.
  assessed_advances:
    'https://services9.arcgis.com/ISW/arcgis/rest/services/Russian_CoT/FeatureServer/1',
  // Claimed but unconfirmed Russian control.
  claimed_control:
    'https://services9.arcgis.com/ISW/arcgis/rest/services/Russian_CoT/FeatureServer/2',
};

function resolveServiceUrl(cfg: IswConfig): string | null {
  if (cfg.service_url && cfg.service_url.trim().length > 0) {
    return cfg.service_url.trim();
  }
  const key = cfg.arcgis_layer ?? 'assessed_control';
  return DEFAULT_LAYER_ENDPOINTS[key] ?? null;
}

function isPolygonal(g: Geometry | null | undefined): boolean {
  return !!g && (g.type === 'Polygon' || g.type === 'MultiPolygon');
}

/** Pull a plausible date field out of ArcGIS feature properties. */
function extractEventDate(props: Record<string, unknown>): string | null {
  const candidates = [
    'Timestamp',
    'timestamp',
    'DateTimeS',
    'EditDate',
    'edit_date',
    'last_edited_date',
    'date',
    'Date',
  ];
  for (const key of candidates) {
    const v = props[key];
    if (v == null) continue;
    // Esri epoch millis or ISO string.
    if (typeof v === 'number' && Number.isFinite(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    if (typeof v === 'string') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

function extractTitle(props: Record<string, unknown>): string | null {
  for (const key of ['Name', 'name', 'Descriptio', 'description', 'Label']) {
    const v = props[key];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

export const isw_arcgisAdapter: LayerAdapter = {
  key: 'isw_arcgis',
  label: 'ISW ArcGIS Assessed Control',
  licenseNote: 'ISW Fair Use — preserve credit line',

  async fetch(ctx: LayerContext): Promise<LayerFetchResult> {
    const attribution = ctx.layer.attribution;
    const fetchedAt = new Date().toISOString();
    const cfg = (ctx.layer.config ?? {}) as IswConfig;

    const base = resolveServiceUrl(cfg);
    if (!base) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `isw_arcgis: no endpoint for arcgis_layer "${cfg.arcgis_layer ?? '(unset)'}" — set config.service_url`,
      };
    }

    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
      resultRecordCount: String(cfg.result_record_count ?? 2000),
    });
    // Scope the query to the theatre bbox when known (Esri envelope, lng/lat).
    if (ctx.conflict.bbox) {
      const [minLng, minLat, maxLng, maxLat] = ctx.conflict.bbox;
      params.set('geometry', `${minLng},${minLat},${maxLng},${maxLat}`);
      params.set('geometryType', 'esriGeometryEnvelope');
      params.set('inSR', '4326');
      params.set('spatialRel', 'esriSpatialRelIntersects');
    }
    const url = `${base.replace(/\/$/, '')}/query?${params.toString()}`;

    let res: Response;
    try {
      res = await fetch(url, {
        signal: ctx.signal,
        headers: { Accept: 'application/geo+json,application/json' },
      });
    } catch (err) {
      // Network/abort — degraded, not a hard failure.
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `isw_arcgis: fetch failed — ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!res.ok) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `isw_arcgis: HTTP ${res.status} from ArcGIS service`,
      };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: 'isw_arcgis: response was not valid JSON/GeoJSON',
      };
    }

    // Esri sometimes returns {error:{...}} with HTTP 200.
    if (body && typeof body === 'object' && 'error' in body) {
      const e = (body as { error?: { message?: string } }).error;
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `isw_arcgis: ArcGIS error — ${e?.message ?? 'unknown'}`,
      };
    }

    const fc = body as FeatureCollection;
    if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: 'isw_arcgis: unexpected payload shape (expected GeoJSON FeatureCollection)',
      };
    }

    const layerName = cfg.arcgis_layer ?? 'assessed_control';
    const features: NormalizedFeature[] = [];
    let skipped = 0;

    fc.features.forEach((f: Feature, idx: number) => {
      if (!isPolygonal(f.geometry)) {
        skipped += 1;
        return;
      }
      const props = (f.properties ?? {}) as Record<string, unknown>;
      // Stable id: prefer OBJECTID / feature id, else deterministic index.
      const oid =
        props.OBJECTID ??
        props.objectid ??
        props.FID ??
        (f.id != null ? f.id : `idx-${idx}`);
      features.push({
        externalId: `${layerName}:${oid}`,
        geometry: f.geometry as Geometry,
        eventDate: extractEventDate(props),
        title: extractTitle(props) ?? layerName,
        properties: {
          ...props,
          __source: 'isw_ctp',
          __arcgis_layer: layerName,
        },
      });
    });

    return {
      features,
      attribution,
      fetchedAt,
      status: 'ok',
      message:
        skipped > 0
          ? `isw_arcgis: ${features.length} polygons (${skipped} non-polygon features skipped)`
          : `isw_arcgis: ${features.length} polygons`,
    };
  },
};

registerLayerAdapter(isw_arcgisAdapter);
