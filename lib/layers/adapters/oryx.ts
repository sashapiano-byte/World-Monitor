import type { Point } from 'geojson';
import { registerLayerAdapter } from '../registry';
import type {
  LayerAdapter,
  LayerContext,
  LayerFetchResult,
  NormalizedFeature,
} from '../types';

/**
 * Adapter: Oryx — documented (photo-verified) equipment losses
 * ============================================================
 * Oryx (oryxspioenkop.com) maintains the canonical open-source count of
 * visually confirmed equipment losses in the war in Ukraine. Every entry is
 * backed by a photo or video, and by design it is an UNDERCOUNT: losses that
 * are never photographed are never counted. That caveat is recorded on every
 * feature's properties (`undercount_by_design: true`).
 *
 * Oryx itself publishes HTML list posts, not a structured API. Community
 * machine-readable mirrors (scrapers) expose the same tallies as JSON, keyed
 * by country + equipment system + loss status (destroyed / damaged /
 * abandoned / captured). This adapter consumes such a JSON feed.
 *
 * Because Oryx tallies are aggregate counts (per equipment type), not
 * individually geolocated events, features are AGGREGATED points placed at the
 * theatre centroid (or a per-record lat/lng if the feed provides one), each
 * carrying its type, loss status, and count.
 *
 * License: attribution required. Credit line
 *   "Documented equipment losses via Oryx (oryxspioenkop.com). Photo-verified,
 *    undercount by design."
 * is carried in ctx.layer.attribution and echoed here; the registry guard
 * fails ingestion if it is dropped.
 *
 * config:
 *   { "data_url": "<json url>" }  the machine-readable Oryx mirror to read.
 *   { "country": "Russia" }       optional filter to one belligerent.
 */

interface OryxConfig {
  data_url?: string;
  country?: string;
}

/**
 * VERIFY: Oryx has no first-party API. This default points at a community
 * JSON mirror of the Oryx tallies; confirm a maintained, correctly-licensed
 * mirror (or a self-hosted scrape) and set config.data_url before relying on
 * live numbers. The adapter tolerates several record shapes (see normalize()).
 */
const DEFAULT_JSON_URL = '';

/** A tolerated loss record after loose normalization. */
interface LossRecord {
  country?: string;
  category?: string;
  system?: string;
  status?: string;
  count?: number;
  lat?: number;
  lng?: number;
}

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  if (typeof v === 'number') return String(v);
  return undefined;
}

/**
 * Flatten a variety of documented Oryx-mirror shapes into flat LossRecords.
 * Handles:
 *   A) flat array:   [{ country, system, category, status, count }, ...]
 *   B) by status:    [{ country, system, destroyed, damaged, abandoned, captured }]
 *   C) nested:       { "Russia": { "Tanks": { destroyed: n, ... } }, ... }
 */
function normalize(body: unknown): LossRecord[] {
  const out: LossRecord[] = [];
  const STATUS_KEYS = ['destroyed', 'damaged', 'abandoned', 'captured'];

  const pushStatusBreakdown = (
    base: Omit<LossRecord, 'status' | 'count'>,
    obj: Record<string, unknown>,
  ): boolean => {
    let matched = false;
    for (const s of STATUS_KEYS) {
      const n = asNum(obj[s]);
      if (n != null && n > 0) {
        out.push({ ...base, status: s, count: n });
        matched = true;
      }
    }
    return matched;
  };

  if (Array.isArray(body)) {
    for (const item of body) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const base = {
        country: asStr(rec.country) ?? asStr(rec.belligerent),
        category: asStr(rec.category) ?? asStr(rec.type),
        system: asStr(rec.system) ?? asStr(rec.equipment) ?? asStr(rec.name),
        lat: asNum(rec.lat ?? rec.latitude) ?? undefined,
        lng: asNum(rec.lng ?? rec.lon ?? rec.longitude) ?? undefined,
      };
      // Shape A: explicit status + count.
      const status = asStr(rec.status);
      const count = asNum(rec.count ?? rec.total ?? rec.losses);
      if (status && count != null) {
        out.push({ ...base, status, count });
        continue;
      }
      // Shape B: per-status columns on the same row.
      if (!pushStatusBreakdown(base, rec) && count != null) {
        out.push({ ...base, status: 'total', count });
      }
    }
    return out;
  }

  // Shape C: nested object country -> system -> {status: n}.
  if (body && typeof body === 'object') {
    for (const [country, sysMap] of Object.entries(body as Record<string, unknown>)) {
      if (!sysMap || typeof sysMap !== 'object') continue;
      for (const [system, statusMap] of Object.entries(sysMap as Record<string, unknown>)) {
        if (statusMap && typeof statusMap === 'object') {
          pushStatusBreakdown({ country, system }, statusMap as Record<string, unknown>);
        } else {
          const n = asNum(statusMap);
          if (n != null) out.push({ country, system, status: 'total', count: n });
        }
      }
    }
  }
  return out;
}

export const oryxAdapter: LayerAdapter = {
  key: 'oryx',
  label: 'Oryx documented losses',
  licenseNote: 'Attribution required; undercount by design',

  async fetch(ctx: LayerContext): Promise<LayerFetchResult> {
    const attribution = ctx.layer.attribution;
    const fetchedAt = new Date().toISOString();
    const cfg = (ctx.layer.config ?? {}) as OryxConfig;
    const url = cfg.data_url?.trim() || DEFAULT_JSON_URL;

    if (!url) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message:
          'oryx: no data_url configured (Oryx has no first-party API) — set config.data_url to a machine-readable mirror',
      };
    }

    let res: Response;
    try {
      res = await fetch(url, { signal: ctx.signal, headers: { Accept: 'application/json' } });
    } catch (err) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `oryx: fetch failed — ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (!res.ok) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `oryx: HTTP ${res.status} fetching ${url}`,
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
        message: 'oryx: response was not valid JSON',
      };
    }

    let records = normalize(body);
    if (cfg.country) {
      const want = cfg.country.toLowerCase();
      records = records.filter((r) => (r.country ?? '').toLowerCase() === want);
    }
    if (records.length === 0) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: 'oryx: no loss records recognized in feed (VERIFY mirror shape)',
      };
    }

    // Representative point when a record carries no coordinates: theatre centroid.
    const [cLng, cLat] = ctx.conflict.center;
    const features: NormalizedFeature[] = records.map((rec, i) => {
      const lng = rec.lng ?? cLng;
      const lat = rec.lat ?? cLat;
      const geometry: Point = { type: 'Point', coordinates: [lng, lat] };
      const country = rec.country ?? 'unknown';
      const system = rec.system ?? rec.category ?? 'equipment';
      const status = rec.status ?? 'total';
      const externalId = `oryx:${country}:${rec.category ?? ''}:${system}:${status}:${i}`
        .replace(/\s+/g, '_')
        .toLowerCase();
      return {
        externalId,
        geometry,
        eventDate: null, // Oryx tallies are cumulative, not per-date events.
        title: `${country} — ${system} (${status}: ${rec.count ?? 0})`,
        properties: {
          __source: 'oryx',
          country,
          category: rec.category ?? null,
          system,
          status,
          count: rec.count ?? 0,
          undercount_by_design: true,
          aggregated_point: rec.lat == null || rec.lng == null,
        },
      };
    });

    return {
      features,
      attribution,
      fetchedAt,
      status: 'ok',
      message: `oryx: ${features.length} aggregated loss records (undercount by design)`,
    };
  },
};

registerLayerAdapter(oryxAdapter);
