import type { Point } from 'geojson';
import { registerLayerAdapter } from '../registry';
import type {
  LayerAdapter,
  LayerContext,
  LayerFetchResult,
  NormalizedFeature,
} from '../types';

/**
 * Adapter: VIINA — Violent Incident Information from News Articles
 * ================================================================
 * VIINA (Zhukov et al., zhukovyuri/VIINA on GitHub) is a near-real-time,
 * event-level dataset of the 2022+ Russian invasion of Ukraine, machine-coded
 * from news articles and updated daily. Events are geolocated points with a
 * date, time, place name, and a battery of binary/probability event-type
 * indicators (artillery, airstrike, control, firefight, etc.).
 *
 * Output: point features, one per coded event, with event_date derived from
 * the `date` (YYYYMMDD) + `time` (HH:MM) columns.
 *
 * License: Open Database License (ODbL) 1.0. Obligations that MUST be honored:
 *   - ATTRIBUTE: credit VIINA (Zhukov et al.) as the source — carried verbatim
 *     in ctx.layer.attribution and echoed back here.
 *   - SHARE-ALIKE: any publicly distributed derivative database must be offered
 *     under ODbL as well.
 *   - KEEP-OPEN: no DRM on distributed copies (or provide an unrestricted
 *     version alongside).
 * The registry guard fails ingestion if the attribution line is dropped.
 *
 * config:
 *   { "data_url": "<csv url>" }  optional override of the source CSV.
 *   When absent, a documented default raw-GitHub event file is used.
 */

interface ViinaConfig {
  /** Override the source CSV URL (e.g. a specific dated event file). */
  data_url?: string;
  /** Cap number of rows normalized (defensive against huge daily dumps). */
  max_rows?: number;
}

/**
 * VERIFY: VIINA distributes event tables both as per-year zip archives
 * (event_info_latest_YYYY.zip) and as flat CSVs under /Data. This default
 * points at the "latest" event-info CSV on the master branch; confirm the
 * exact filename against https://github.com/zhukovyuri/VIINA/tree/master/Data
 * and set config.data_url accordingly. The adapter cannot unzip, so a plain
 * .csv URL is required.
 */
const DEFAULT_CSV_URL =
  'https://raw.githubusercontent.com/zhukovyuri/VIINA/master/Data/event_latest.csv';

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
 * embedded newlines, and doubled-quote escapes. Returns rows of string cells.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // Flush trailing field/row (file without trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toNum(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (t === '' || t.toUpperCase() === 'NA' || t.toUpperCase() === 'NULL') return null;
  const num = Number(t);
  return Number.isFinite(num) ? num : null;
}

/**
 * Build an ISO timestamp from VIINA's `date` (YYYYMMDD) + `time` (HH:MM).
 * Treated as UTC — VIINA timestamps are not strongly tz-qualified.
 * VERIFY: confirm VIINA's documented timezone if precise local time matters.
 */
function toEventDate(date: string | undefined, time: string | undefined): string | null {
  if (!date) return null;
  const d = date.trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(d);
  if (!m) {
    // Some releases use YYYY-MM-DD already.
    const iso = new Date(`${d}T${(time ?? '00:00').trim()}:00Z`);
    return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
  }
  const [, yyyy, mm, dd] = m;
  const hhmm = (time ?? '00:00').trim() || '00:00';
  const iso = new Date(`${yyyy}-${mm}-${dd}T${hhmm}:00Z`);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

/** Find a column index by trying several documented header aliases. */
function idxOf(header: string[], ...aliases: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

export const viinaAdapter: LayerAdapter = {
  key: 'viina',
  label: 'VIINA event feed',
  licenseNote: 'ODbL 1.0 — attribution + share-alike required',

  async fetch(ctx: LayerContext): Promise<LayerFetchResult> {
    const attribution = ctx.layer.attribution;
    const fetchedAt = new Date().toISOString();
    const cfg = (ctx.layer.config ?? {}) as ViinaConfig;
    const url = cfg.data_url?.trim() || DEFAULT_CSV_URL;

    let res: Response;
    try {
      res = await fetch(url, { signal: ctx.signal, headers: { Accept: 'text/csv' } });
    } catch (err) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `viina: fetch failed — ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (!res.ok) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: `viina: HTTP ${res.status} fetching ${url}`,
      };
    }

    const text = await res.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message: 'viina: no data rows parsed from CSV',
      };
    }

    const header = rows[0];
    const iLat = idxOf(header, 'latitude', 'lat');
    const iLng = idxOf(header, 'longitude', 'lon', 'lng');
    const iDate = idxOf(header, 'date');
    const iTime = idxOf(header, 'time');
    const iId = idxOf(header, 'event_id', 'eventid', 'id');
    const iName = idxOf(header, 'asciiname', 'location', 'address', 'name');
    const iGeoname = idxOf(header, 'geonameid', 'geoname_id');

    if (iLat < 0 || iLng < 0) {
      return {
        features: [],
        attribution,
        fetchedAt,
        status: 'partial',
        message:
          'viina: could not locate latitude/longitude columns — schema may have changed (VERIFY headers)',
      };
    }

    // Event-type indicator columns (VIINA prefixes these with "t_").
    const eventTypeCols = header
      .map((h, i) => ({ name: h.trim(), i }))
      .filter((c) => /^t_/i.test(c.name));

    const bbox = ctx.conflict.bbox;
    const maxRows = cfg.max_rows ?? 50000;
    const features: NormalizedFeature[] = [];
    let skippedNoGeo = 0;
    let skippedOob = 0;

    for (let r = 1; r < rows.length && features.length < maxRows; r += 1) {
      const cells = rows[r];
      if (cells.length === 1 && cells[0].trim() === '') continue; // blank line
      const lat = toNum(cells[iLat]);
      const lng = toNum(cells[iLng]);
      if (lat == null || lng == null) {
        skippedNoGeo += 1;
        continue;
      }
      if (bbox) {
        const [minLng, minLat, maxLng, maxLat] = bbox;
        if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) {
          skippedOob += 1;
          continue;
        }
      }

      const dateRaw = iDate >= 0 ? cells[iDate] : undefined;
      const timeRaw = iTime >= 0 ? cells[iTime] : undefined;
      const eventDate = toEventDate(dateRaw, timeRaw);
      const placeName = iName >= 0 ? cells[iName]?.trim() : undefined;

      // Which event types fired (indicator == 1 / true)?
      const activeTypes: string[] = [];
      const typeFlags: Record<string, unknown> = {};
      for (const { name, i } of eventTypeCols) {
        const raw = cells[i]?.trim();
        typeFlags[name] = raw;
        if (raw === '1' || raw?.toLowerCase() === 'true') {
          activeTypes.push(name.replace(/^t_/i, ''));
        }
      }

      const geoname = iGeoname >= 0 ? cells[iGeoname]?.trim() : undefined;
      const rawId = iId >= 0 ? cells[iId]?.trim() : undefined;
      // Stable external id: prefer source event_id, else compose one that is
      // deterministic across re-ingestion of the same file.
      const externalId =
        rawId && rawId.length > 0
          ? `viina:${rawId}`
          : `viina:${dateRaw ?? 'nd'}:${geoname ?? `${lat.toFixed(4)},${lng.toFixed(4)}`}:${r}`;

      const geometry: Point = { type: 'Point', coordinates: [lng, lat] };
      const title =
        activeTypes.length > 0
          ? `${activeTypes.join(', ')}${placeName ? ` — ${placeName}` : ''}`
          : placeName ?? 'VIINA event';

      features.push({
        externalId,
        geometry,
        eventDate,
        title,
        properties: {
          __source: 'viina',
          event_id: rawId ?? null,
          place: placeName ?? null,
          geonameid: geoname ?? null,
          date: dateRaw ?? null,
          time: timeRaw ?? null,
          event_types: activeTypes,
          ...typeFlags,
        },
      });
    }

    const notes: string[] = [`viina: ${features.length} events`];
    if (skippedOob > 0) notes.push(`${skippedOob} outside bbox`);
    if (skippedNoGeo > 0) notes.push(`${skippedNoGeo} missing coords`);

    return {
      features,
      attribution,
      fetchedAt,
      status: 'ok',
      message: notes.join(', '),
    };
  },
};

registerLayerAdapter(viinaAdapter);
