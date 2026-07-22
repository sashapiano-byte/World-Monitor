import type { Point } from 'geojson';
import { registerLayerAdapter } from '../registry';
import type {
  LayerAdapter,
  LayerContext,
  LayerFetchResult,
  NormalizedFeature,
} from '../types';

/**
 * Adapter: NASA FIRMS — active fire / thermal anomalies
 * =====================================================
 * NASA's Fire Information for Resource Management System (FIRMS) serves
 * near-real-time active-fire detections from VIIRS and MODIS. The "area" CSV
 * API returns all detections inside a lon/lat rectangle over the last N days:
 *
 *   https://firms.modaps.eosdis.nasa.gov/api/area/csv/
 *     {MAP_KEY}/{sensor}/{west,south,east,north}/{day_range}
 *
 * This adapter is CONFLICT-AGNOSTIC by design: the rectangle comes straight
 * from ctx.conflict.bbox, so the exact same code serves Ukraine, Sudan, or any
 * future theatre. (Subagent B's Sudan layer reuses this adapter unchanged.)
 *
 * Output: point features, one per fire pixel, event_date from acq_date +
 * acq_time, properties carrying brightness / FRP / confidence.
 *
 * Auth: requires a FIRMS MAP_KEY (free). Read from ctx.env('FIRMS_MAP_KEY').
 * If missing, the adapter returns status 'partial' with zero features and a
 * clear message — it does NOT throw, so ingestion of other layers proceeds.
 *
 * License: NASA open data. Attribution requested ("Data courtesy of NASA
 * FIRMS") and echoed via ctx.layer.attribution.
 *
 * config: { "sensor": "VIIRS_SNPP_NRT", "day_range": 2 }
 *   sensor    — a FIRMS source id (VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT,
 *               MODIS_NRT, VIIRS_SNPP_SP, ...).
 *   day_range — number of days back (1..10 per FIRMS limits).
 */

interface FirmsConfig {
  sensor?: string;
  day_range?: number;
}

const DEFAULT_SENSOR = 'VIIRS_SNPP_NRT';
const DEFAULT_DAY_RANGE = 2;
const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

/** Simple CSV split — FIRMS CSV is unquoted, comma-delimited, one row/line. */
function splitCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(','));
}

function toNum(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (t === '') return null;
  const num = Number(t);
  return Number.isFinite(num) ? num : null;
}

/**
 * FIRMS acq_time is an HHMM string, often unpadded ("132" => 01:32,
 * "5" => 00:05). acq_date is YYYY-MM-DD. Combine into a UTC ISO timestamp
 * (FIRMS acquisition times are UTC).
 */
function toEventDate(acqDate: string | undefined, acqTime: string | undefined): string | null {
  if (!acqDate) return null;
  const date = acqDate.trim();
  const raw = (acqTime ?? '0').trim();
  const padded = raw.padStart(4, '0');
  const hh = padded.slice(0, 2);
  const mm = padded.slice(2, 4);
  const iso = new Date(`${date}T${hh}:${mm}:00Z`);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

function idxOf(header: string[], ...aliases: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

export const nasa_firmsAdapter: LayerAdapter = {
  key: 'nasa_firms',
  label: 'NASA FIRMS active fire',
  licenseNote: 'NASA open data — attribution requested; requires free MAP_KEY',

  async fetch(ctx: LayerContext): Promise<LayerFetchResult> {
    const attribution = ctx.layer.attribution;
    const fetchedAt = new Date().toISOString();
    const cfg = (ctx.layer.config ?? {}) as FirmsConfig;

    const mapKey = ctx.env('FIRMS_MAP_KEY');
    if (!mapKey || mapKey.trim().length === 0) {
      // Missing credential is a soft/degraded state, not a crash.
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message:
          'nasa_firms: FIRMS_MAP_KEY not set — skipping active-fire ingestion (set env FIRMS_MAP_KEY, free from firms.modaps.eosdis.nasa.gov)',
      };
    }

    if (!ctx.conflict.bbox) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `nasa_firms: conflict "${ctx.conflict.slug}" has no bbox — cannot scope area query`,
      };
    }

    const sensor = (cfg.sensor ?? DEFAULT_SENSOR).trim();
    const dayRange = Math.max(1, Math.min(10, Math.trunc(cfg.day_range ?? DEFAULT_DAY_RANGE)));
    const [minLng, minLat, maxLng, maxLat] = ctx.conflict.bbox;
    // FIRMS area is west,south,east,north.
    const area = `${minLng},${minLat},${maxLng},${maxLat}`;
    const url = `${FIRMS_BASE}/${encodeURIComponent(mapKey.trim())}/${encodeURIComponent(
      sensor,
    )}/${area}/${dayRange}`;

    let res: Response;
    try {
      res = await fetch(url, { signal: ctx.signal, headers: { Accept: 'text/csv' } });
    } catch (err) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `nasa_firms: fetch failed — ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (!res.ok) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `nasa_firms: HTTP ${res.status} from FIRMS area API`,
      };
    }

    const text = await res.text();
    // FIRMS returns a plain-text error (e.g. "Invalid MAP_KEY") rather than CSV
    // on auth/quota problems; detect the absence of a header row.
    if (!/latitude/i.test(text.split(/\r?\n/)[0] ?? '')) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `nasa_firms: unexpected response (no CSV header) — "${text.slice(0, 120).trim()}"`,
      };
    }

    const rows = splitCsv(text);
    const header = rows[0];
    const iLat = idxOf(header, 'latitude');
    const iLng = idxOf(header, 'longitude');
    const iAcqDate = idxOf(header, 'acq_date');
    const iAcqTime = idxOf(header, 'acq_time');
    const iSat = idxOf(header, 'satellite');
    const iInstr = idxOf(header, 'instrument');
    const iConf = idxOf(header, 'confidence');
    const iFrp = idxOf(header, 'frp');
    // VIIRS uses bright_ti4; MODIS uses brightness. Accept either.
    const iBright = idxOf(header, 'bright_ti4', 'brightness');
    const iBright2 = idxOf(header, 'bright_ti5', 'bright_t31');
    const iDayNight = idxOf(header, 'daynight');
    const iScan = idxOf(header, 'scan');
    const iTrack = idxOf(header, 'track');
    const iVersion = idxOf(header, 'version');

    if (iLat < 0 || iLng < 0) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: 'nasa_firms: CSV missing latitude/longitude columns',
      };
    }

    const features: NormalizedFeature[] = [];
    const seen = new Set<string>();

    for (let r = 1; r < rows.length; r += 1) {
      const cells = rows[r];
      const lat = toNum(cells[iLat]);
      const lng = toNum(cells[iLng]);
      if (lat == null || lng == null) continue;

      const acqDate = iAcqDate >= 0 ? cells[iAcqDate]?.trim() : undefined;
      const acqTime = iAcqTime >= 0 ? cells[iAcqTime]?.trim() : undefined;
      const sat = iSat >= 0 ? cells[iSat]?.trim() : undefined;
      const eventDate = toEventDate(acqDate, acqTime);

      // FIRMS has no native pixel id; compose a stable one so re-ingestion of
      // an overlapping day window dedupes.
      let externalId = `firms:${sensor}:${lat.toFixed(5)},${lng.toFixed(5)}:${acqDate ?? 'nd'}:${acqTime ?? '0'}:${sat ?? ''}`;
      // Guard against duplicate pixels within one response.
      if (seen.has(externalId)) {
        externalId = `${externalId}:${r}`;
      }
      seen.add(externalId);

      const brightness = iBright >= 0 ? toNum(cells[iBright]) : null;
      const frp = iFrp >= 0 ? toNum(cells[iFrp]) : null;
      const confidenceRaw = iConf >= 0 ? cells[iConf]?.trim() : undefined;

      const geometry: Point = { type: 'Point', coordinates: [lng, lat] };

      features.push({
        externalId,
        geometry,
        eventDate,
        title: `Fire detection (${sensor})`,
        properties: {
          __source: 'nasa_firms',
          sensor,
          satellite: sat ?? null,
          instrument: iInstr >= 0 ? cells[iInstr]?.trim() ?? null : null,
          brightness,
          brightness_secondary: iBright2 >= 0 ? toNum(cells[iBright2]) : null,
          frp,
          confidence: confidenceRaw ?? null,
          daynight: iDayNight >= 0 ? cells[iDayNight]?.trim() ?? null : null,
          scan: iScan >= 0 ? toNum(cells[iScan]) : null,
          track: iTrack >= 0 ? toNum(cells[iTrack]) : null,
          version: iVersion >= 0 ? cells[iVersion]?.trim() ?? null : null,
          acq_date: acqDate ?? null,
          acq_time: acqTime ?? null,
        },
      });
    }

    return {
      features,
      attribution,
      fetchedAt,
      status: 'ok',
      message: `nasa_firms: ${features.length} fire detections (${sensor}, ${dayRange}d)`,
    };
  },
};

registerLayerAdapter(nasa_firmsAdapter);
