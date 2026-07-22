import type { Point } from 'geojson';
import { registerLayerAdapter } from '../registry';
import type {
  LayerAdapter,
  LayerContext,
  LayerFetchResult,
  NormalizedFeature,
} from '../types';

/**
 * Adapter: UCDP Georeferenced Event Dataset (GED)
 * Source:  Uppsala Conflict Data Program — https://ucdp.uu.se/
 * API:     https://ucdpapi.pcr.uu.se/api/{resource}/{version}
 * License: CC BY 4.0 — cleanly licensed for commercial use with attribution.
 *          Attribution line lives on the conflict_layers row and is echoed
 *          here (registry fails closed if it goes missing).
 *
 * GED = individual events of organized violence (state-based, non-state,
 * one-sided) geocoded to points with low/best/high fatality estimates.
 * The curated yearly release (e.g. version "25.1") is updated annually;
 * UCDP Candidate monthly releases use versions like "25.0.6".
 *
 * config (conflict_layers.config):
 *   { "dataset": "gedevents", "country": "Sudan",
 *     "version"?: "25.1", "pagesize"?: 1000, "max_pages"?: 25,
 *     "start_date"?: "2023-04-15" }
 */

const UCDP_API_BASE = 'https://ucdpapi.pcr.uu.se/api';

// VERIFY: bump when UCDP publishes a new curated GED release (yearly, ~June).
const DEFAULT_GED_VERSION = '25.1';

/**
 * UCDP's `Country` filter takes Gleditsch–Ward country IDs, not names.
 * Minimal lookup for names we expect in config; extend as conflicts are added.
 * VERIFY: GW codes against UCDP's country list (Sudan=625, South Sudan=626).
 */
const GLEDITSCH_WARD_IDS: Record<string, number> = {
  Sudan: 625,
  'South Sudan': 626,
  Ukraine: 369,
  Russia: 365,
  Ethiopia: 530,
  Myanmar: 775,
};

/** Subset of documented GED event fields we consume. */
interface UcdpGedEvent {
  id: number;
  relid?: string;
  year?: number;
  type_of_violence?: number; // 1=state-based, 2=non-state, 3=one-sided
  conflict_name?: string;
  dyad_name?: string;
  side_a?: string;
  side_b?: string;
  source_article?: string;
  source_headline?: string;
  where_coordinates?: string;
  where_prec?: number;
  adm_1?: string;
  adm_2?: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  event_clarity?: number;
  date_prec?: number;
  date_start?: string;
  date_end?: string;
  deaths_a?: number;
  deaths_b?: number;
  deaths_civilians?: number;
  deaths_unknown?: number;
  low?: number;
  best?: number;
  high?: number;
}

/** Documented UCDP API page envelope. */
interface UcdpPage {
  TotalCount?: number;
  TotalPages?: number;
  PreviousPageUrl?: string;
  NextPageUrl?: string;
  Result?: UcdpGedEvent[];
}

const VIOLENCE_TYPE_LABELS: Record<number, string> = {
  1: 'state-based',
  2: 'non-state',
  3: 'one-sided',
};

function toFeature(ev: UcdpGedEvent): NormalizedFeature | null {
  const lng = Number(ev.longitude);
  const lat = Number(ev.latitude);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const geometry: Point = { type: 'Point', coordinates: [lng, lat] };
  const best = ev.best ?? 0;
  const dyad = ev.dyad_name || ev.conflict_name || 'Organized violence event';
  return {
    externalId: `ucdp-ged:${ev.id}`,
    geometry,
    eventDate: ev.date_start ?? null,
    title: `${dyad}${best ? ` — ${best} fatalities (best est.)` : ''}`,
    properties: {
      ucdp_id: ev.id,
      relid: ev.relid,
      year: ev.year,
      type_of_violence: ev.type_of_violence,
      type_of_violence_label:
        VIOLENCE_TYPE_LABELS[ev.type_of_violence ?? -1] ?? 'unknown',
      conflict_name: ev.conflict_name,
      dyad_name: ev.dyad_name,
      side_a: ev.side_a,
      side_b: ev.side_b,
      country: ev.country,
      adm_1: ev.adm_1,
      adm_2: ev.adm_2,
      where_coordinates: ev.where_coordinates,
      where_prec: ev.where_prec,
      date_start: ev.date_start,
      date_end: ev.date_end,
      date_prec: ev.date_prec,
      event_clarity: ev.event_clarity,
      deaths_civilians: ev.deaths_civilians,
      fatalities_low: ev.low,
      fatalities_best: ev.best,
      fatalities_high: ev.high,
    },
  };
}

export const ucdpGedAdapter: LayerAdapter = {
  key: 'ucdp_ged',
  label: 'UCDP Georeferenced Event Dataset',
  licenseNote:
    'CC BY 4.0 — free for commercial use with attribution to the Uppsala ' +
    'Conflict Data Program. Curated release updates yearly; consider UCDP ' +
    'Candidate (monthly) versions for fresher coverage.',

  async fetch(ctx: LayerContext): Promise<LayerFetchResult> {
    const config = ctx.layer.config;
    const dataset =
      typeof config['dataset'] === 'string'
        ? (config['dataset'] as string)
        : 'gedevents';
    const country =
      typeof config['country'] === 'string'
        ? (config['country'] as string)
        : ctx.conflict.name;
    const version =
      typeof config['version'] === 'string'
        ? (config['version'] as string)
        : DEFAULT_GED_VERSION;
    const pagesize = Math.min(
      typeof config['pagesize'] === 'number' ? (config['pagesize'] as number) : 1000,
      1000, // documented API max page size
    );
    const maxPages =
      typeof config['max_pages'] === 'number' ? (config['max_pages'] as number) : 25;
    const startDate =
      typeof config['start_date'] === 'string'
        ? (config['start_date'] as string)
        : undefined;

    const params = new URLSearchParams({
      pagesize: String(pagesize),
      page: '0', // UCDP pages are 0-based
    });
    const gwId = GLEDITSCH_WARD_IDS[country];
    if (gwId !== undefined) params.set('Country', String(gwId));
    // VERIFY: StartDate/EndDate filter parameter names against the UCDP API
    // docs (https://ucdp.uu.se/apidocs/) — documented as StartDate/EndDate.
    if (startDate) params.set('StartDate', startDate);

    let url: string | undefined =
      `${UCDP_API_BASE}/${encodeURIComponent(dataset)}/${encodeURIComponent(version)}?${params}`;

    const features: NormalizedFeature[] = [];
    let pagesFetched = 0;
    let totalCount: number | undefined;
    let truncated = false;
    let failed = false;

    while (url && pagesFetched < maxPages) {
      let page: UcdpPage;
      try {
        const res = await fetch(url, {
          signal: ctx.signal,
          headers: { accept: 'application/json' },
        });
        if (!res.ok) {
          failed = true;
          break;
        }
        page = (await res.json()) as UcdpPage;
      } catch (err) {
        if (ctx.signal?.aborted) throw err;
        failed = true;
        break;
      }
      pagesFetched += 1;
      totalCount = page.TotalCount ?? totalCount;

      for (const ev of page.Result ?? []) {
        // Belt-and-braces: the Country filter uses GW ids; also match by name
        // so a wrong/missing id mapping can only under-return, never leak
        // other countries' events into this conflict's layer.
        if (ev.country && ev.country !== country) continue;
        const f = toFeature(ev);
        if (f) features.push(f);
      }

      url = page.NextPageUrl || undefined;
    }
    if (url && pagesFetched >= maxPages) truncated = true;

    const fetchedAt = new Date().toISOString();
    if (failed && features.length === 0) {
      return {
        features: [],
        attribution: ctx.layer.attribution,
        fetchedAt,
        status: 'partial',
        message: `UCDP GED: request to ${UCDP_API_BASE}/${dataset}/${version} failed — no features ingested this run.`,
      };
    }
    return {
      features,
      attribution: ctx.layer.attribution,
      fetchedAt,
      status: failed || truncated ? 'partial' : 'ok',
      message:
        `UCDP GED v${version}: ${features.length} ${country} events across ${pagesFetched} page(s)` +
        (totalCount !== undefined ? ` of ${totalCount} total` : '') +
        (truncated ? ' — truncated at max_pages, raise config.max_pages for full backfill' : '') +
        (failed ? ' — a page request failed; partial ingest' : '') +
        '.',
    };
  },
};

registerLayerAdapter(ucdpGedAdapter);
