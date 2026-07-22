/**
 * Camera queries. These run against a caller-supplied Supabase client so the
 * same code works from a server component, a route handler, or the browser.
 *
 * RLS (supabase/migrations/0002_rls.sql) is the real gate: the anon key only
 * ever returns rows where
 *      status = 'active' AND (provider = 'youtube' OR tos_reviewed = true).
 * We do NOT re-implement that filter here — relying on RLS keeps a single
 * source of truth and means a preview run with the service-role client can see
 * the full (unverified) catalog by simply passing that client in.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { CameraRow, ClientCamera, CameraCategory } from './types';

type DB = SupabaseClient<Database>;

const CAMERA_COLUMNS =
  'id, conflict_id, title, description, provider, stream_type, external_id, url, embed_url, lng, lat, location_name, city, country, tags, is_live, status, tos_reviewed';

type CameraSelect = Pick<
  CameraRow,
  | 'id' | 'conflict_id' | 'title' | 'description' | 'provider' | 'stream_type'
  | 'external_id' | 'url' | 'embed_url' | 'lng' | 'lat' | 'location_name'
  | 'city' | 'country' | 'tags' | 'is_live' | 'status' | 'tos_reviewed'
>;

export interface ConflictFrame {
  id: string;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: number[] | null;
}

export interface CameraQueryOptions {
  /**
   * Also pull standalone city cameras (conflict_id NULL) that fall inside the
   * conflict's bbox, so a theatre view shows nearby city skylines too.
   * Default true.
   */
  includeCitiesInBbox?: boolean;
  limit?: number;
}

/** Map a DB row (or API JSON with the same keys) to the client view-model. */
export function toClientCamera(row: CameraSelect): ClientCamera {
  const category: CameraCategory = row.conflict_id ? 'conflict' : 'city';
  const canEmbed =
    row.provider === 'youtube' && !!row.embed_url && row.status !== 'removed';
  return {
    id: row.id,
    conflictId: row.conflict_id,
    title: row.title,
    description: row.description,
    provider: row.provider,
    streamType: row.stream_type,
    externalId: row.external_id,
    url: row.url,
    embedUrl: row.embed_url,
    lng: row.lng,
    lat: row.lat,
    locationName: row.location_name,
    city: row.city,
    country: row.country,
    tags: row.tags ?? [],
    isLive: row.is_live,
    status: row.status,
    tosReviewed: row.tos_reviewed,
    category,
    canEmbed,
  };
}

function dedupe(cameras: ClientCamera[]): ClientCamera[] {
  const seen = new Set<string>();
  const out: ClientCamera[] = [];
  for (const c of cameras) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/**
 * Cameras relevant to a conflict: everything linked via conflict_id, plus (by
 * default) city cameras whose point falls inside the conflict bbox. RLS decides
 * which of these are actually visible.
 */
export async function getCamerasForConflict(
  supabase: DB,
  conflict: ConflictFrame,
  opts: CameraQueryOptions = {},
): Promise<ClientCamera[]> {
  const includeCities = opts.includeCitiesInBbox ?? true;
  const limit = opts.limit ?? 1000;

  const results: ClientCamera[] = [];

  try {
    const linked = await supabase
      .from('cameras')
      .select(CAMERA_COLUMNS)
      .eq('conflict_id', conflict.id)
      .limit(limit)
      .returns<CameraSelect[]>();
    if (linked.error) throw linked.error;
    results.push(...(linked.data ?? []).map(toClientCamera));

    if (includeCities && conflict.bbox && conflict.bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = conflict.bbox;
      const nearby = await supabase
        .from('cameras')
        .select(CAMERA_COLUMNS)
        .is('conflict_id', null)
        .gte('lng', minLng)
        .lte('lng', maxLng)
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .limit(limit)
        .returns<CameraSelect[]>();
      if (nearby.error) throw nearby.error;
      results.push(...(nearby.data ?? []).map(toClientCamera));
    }
  } catch (err) {
    console.error('[cameras] getCamerasForConflict failed:', err);
  }

  return dedupe(results);
}

/** The global camera set (all conflicts + all cities), RLS-gated. */
export async function getGlobalCameras(
  supabase: DB,
  opts: { limit?: number } = {},
): Promise<ClientCamera[]> {
  try {
    const { data, error } = await supabase
      .from('cameras')
      .select(CAMERA_COLUMNS)
      .order('country', { ascending: true })
      .limit(opts.limit ?? 2000)
      .returns<CameraSelect[]>();
    if (error) throw error;
    return (data ?? []).map(toClientCamera);
  } catch (err) {
    console.error('[cameras] getGlobalCameras failed:', err);
    return [];
  }
}

/** Convenience: derive the unique country / city / tag facets for filter UIs. */
export function deriveFacets(cameras: ClientCamera[]): {
  countries: string[];
  cities: string[];
  tags: string[];
} {
  const countries = new Set<string>();
  const cities = new Set<string>();
  const tags = new Set<string>();
  for (const c of cameras) {
    if (c.country) countries.add(c.country);
    if (c.city) cities.add(c.city);
    for (const t of c.tags) tags.add(t);
  }
  return {
    countries: [...countries].sort(),
    cities: [...cities].sort(),
    tags: [...tags].sort(),
  };
}
