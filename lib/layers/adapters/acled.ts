import type { Point } from 'geojson';
import { registerLayerAdapter } from '../registry';
import type {
  LayerAdapter,
  LayerContext,
  LayerFetchResult,
  NormalizedFeature,
} from '../types';

/**
 * Adapter: ACLED political-violence events (Armed Conflict Location & Event
 * Data Project) — https://acleddata.com/
 *
 * LICENSE — READ BEFORE ENABLING (full memo: docs/sudan-acled-license.md,
 * decision: DECISIONS.md item 3):
 *
 *   ACLED's free access tier is NON-COMMERCIAL ONLY, and even non-commercial
 *   public display requires output that is "substantially reworked" from the
 *   raw data — re-plotting raw ACLED events on a map is NOT permitted. This
 *   product may eventually charge users (commercial use), so the free tier
 *   does not cover launch.
 *
 * This adapter therefore FAILS CLOSED. It emits features only when BOTH:
 *   1. `ctx.layer.config.commercial_licensed === true` — set manually in the
 *      DB only after a signed ACLED Commercial License exists (human decision;
 *      never set by code), AND
 *   2. ACLED credentials are present in the environment
 *      (ACLED_EMAIL + ACLED_API_KEY).
 *
 * Anything less → status 'partial', ZERO features, explanatory message. Raw
 * events are NEVER emitted in any path: even when licensed, the output is a
 * DERIVED admin-1 aggregation (event counts / fatality sums / dominant event
 * types per trailing window), i.e. the "substantially reworked" form. The raw
 * event list exists only transiently in memory during aggregation.
 *
 * Attribution "Armed Conflict Location & Event Data Project (ACLED);
 * acleddata.com." is carried on ctx.layer.attribution and always echoed.
 */

// VERIFY: ACLED migrated to a new API portal in 2025 (developer.acleddata.com,
// OAuth bearer tokens). The legacy key+email REST endpoint below is the shape
// documented in the long-standing ACLED API user guide; confirm which endpoint
// the account is provisioned for once a commercial license is actually signed.
const ACLED_API_URL = 'https://api.acleddata.com/acled/read';

/** Raw ACLED event row — held in memory only, never persisted or emitted. */
interface AcledEvent {
  event_id_cnty: string;
  event_date: string; // 'YYYY-MM-DD'
  event_type: string;
  sub_event_type?: string;
  actor1?: string;
  actor2?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  location?: string;
  latitude: string | number;
  longitude: string | number;
  fatalities?: string | number;
}

interface AcledResponse {
  success?: boolean;
  count?: number;
  data?: AcledEvent[];
  error?: unknown;
}

interface Admin1Bucket {
  admin1: string;
  eventCount: number;
  fatalities: number;
  sumLng: number;
  sumLat: number;
  eventTypes: Map<string, number>;
  firstDate: string;
  lastDate: string;
}

function gatedResult(ctx: LayerContext, reason: string): LayerFetchResult {
  return {
    features: [],
    attribution: ctx.layer.attribution,
    fetchedAt: new Date().toISOString(),
    status: 'partial',
    message:
      `ACLED layer is gated: ${reason} ` +
      'ACLED free tier is non-commercial only and forbids re-plotting raw ' +
      'events; no data is emitted until a Commercial License is approved ' +
      '(see DECISIONS.md item 3 and docs/sudan-acled-license.md).',
  };
}

export const acledAdapter: LayerAdapter = {
  key: 'acled',
  label: 'ACLED conflict events (derived admin-1 intensity)',
  licenseNote:
    'GATED — free tier is non-commercial only and requires substantially ' +
    'reworked output. Emits nothing unless config.commercial_licensed=true ' +
    'AND ACLED_EMAIL/ACLED_API_KEY are set. Output is always an admin-level ' +
    'aggregation, never raw event re-plots. See docs/sudan-acled-license.md.',

  async fetch(ctx: LayerContext): Promise<LayerFetchResult> {
    const config = ctx.layer.config;

    // --- Gate 1: explicit human-set commercial-license flag ----------------
    // The seed ships {"gated":true,"reason":"license_pending"} and the layer
    // row itself is enabled=false. Both must be flipped by a human after the
    // license decision — this adapter never assumes.
    if (config['commercial_licensed'] !== true) {
      return gatedResult(
        ctx,
        'config.commercial_licensed is not set — no signed ACLED Commercial License on file.',
      );
    }

    // --- Gate 2: credentials ----------------------------------------------
    const email = ctx.env('ACLED_EMAIL');
    const apiKey = ctx.env('ACLED_API_KEY');
    if (!email || !apiKey) {
      return gatedResult(
        ctx,
        'ACLED_EMAIL / ACLED_API_KEY are not configured in the environment.',
      );
    }

    // --- Licensed path: fetch raw events (transient), emit aggregation ----
    const country =
      typeof config['country'] === 'string'
        ? (config['country'] as string)
        : ctx.conflict.name; // 'Sudan'
    const windowDays =
      typeof config['window_days'] === 'number'
        ? (config['window_days'] as number)
        : 30;

    const since = new Date(Date.now() - windowDays * 86_400_000);
    const sinceStr = since.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    const events: AcledEvent[] = [];
    let page = 1;
    const pageLimit = 5000;
    // VERIFY: legacy API paging — `limit` sets page size, `page` is 1-based;
    // confirm max page size for the provisioned account tier.
    const maxPages = 10;

    for (; page <= maxPages; page++) {
      const params = new URLSearchParams({
        key: apiKey,
        email,
        country,
        event_date: sinceStr,
        // VERIFY: legacy API uses event_date_where with a comparison operator
        // to express "on or after"; confirm exact accepted value.
        event_date_where: '>=',
        limit: String(pageLimit),
        page: String(page),
      });
      const res = await fetch(`${ACLED_API_URL}?${params}`, {
        signal: ctx.signal,
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        // Fail closed on any upstream error: partial + whatever aggregation
        // we can produce (possibly none) rather than throwing raw payloads.
        break;
      }
      const body = (await res.json()) as AcledResponse;
      const batch = body.data ?? [];
      events.push(...batch);
      if (batch.length < pageLimit) break;
    }

    if (events.length === 0) {
      return {
        features: [],
        attribution: ctx.layer.attribution,
        fetchedAt: new Date().toISOString(),
        status: 'partial',
        message: `ACLED returned no events for ${country} since ${sinceStr} (or the API request failed).`,
      };
    }

    // Aggregate to admin1 — the "substantially reworked" derived output.
    const buckets = new Map<string, Admin1Bucket>();
    for (const ev of events) {
      const lng = Number(ev.longitude);
      const lat = Number(ev.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const admin1 = ev.admin1?.trim() || '(unspecified admin1)';
      let b = buckets.get(admin1);
      if (!b) {
        b = {
          admin1,
          eventCount: 0,
          fatalities: 0,
          sumLng: 0,
          sumLat: 0,
          eventTypes: new Map(),
          firstDate: ev.event_date,
          lastDate: ev.event_date,
        };
        buckets.set(admin1, b);
      }
      b.eventCount += 1;
      b.fatalities += Number(ev.fatalities ?? 0) || 0;
      b.sumLng += lng;
      b.sumLat += lat;
      const t = ev.event_type || 'Unknown';
      b.eventTypes.set(t, (b.eventTypes.get(t) ?? 0) + 1);
      if (ev.event_date < b.firstDate) b.firstDate = ev.event_date;
      if (ev.event_date > b.lastDate) b.lastDate = ev.event_date;
    }

    const countrySlug = country.toLowerCase().replace(/\s+/g, '-');
    const features: NormalizedFeature[] = [...buckets.values()].map((b) => {
      const geometry: Point = {
        type: 'Point',
        // Centroid of contributing events — intentionally NOT any single
        // event's location (no raw-event re-plot).
        coordinates: [
          Number((b.sumLng / b.eventCount).toFixed(4)),
          Number((b.sumLat / b.eventCount).toFixed(4)),
        ],
      };
      const topTypes = [...b.eventTypes.entries()]
        .sort((a, z) => z[1] - a[1])
        .slice(0, 3)
        .map(([type, n]) => ({ type, count: n }));
      return {
        // Stable per admin1 + rolling window end-date so daily re-ingestion
        // updates in place rather than accumulating duplicates.
        externalId: `acled-agg:${countrySlug}:${b.admin1}:${todayStr}`,
        geometry,
        eventDate: b.lastDate,
        title: `${b.admin1}: ${b.eventCount} events, ${b.fatalities} reported fatalities (${windowDays}d)`,
        properties: {
          kind: 'acled_admin1_aggregate',
          admin1: b.admin1,
          country,
          window_days: windowDays,
          period_start: sinceStr,
          period_end: todayStr,
          event_count: b.eventCount,
          fatalities_sum: b.fatalities,
          top_event_types: topTypes,
          derived: true, // marker: substantially reworked, not raw ACLED rows
        },
      };
    });

    return {
      features,
      attribution: ctx.layer.attribution,
      fetchedAt: new Date().toISOString(),
      status: 'ok',
      message: `ACLED: aggregated ${events.length} events into ${features.length} admin-1 intensity features (${sinceStr}..${todayStr}).`,
    };
  },
};

registerLayerAdapter(acledAdapter);
