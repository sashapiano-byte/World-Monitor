import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getCamerasForConflict,
  getGlobalCameras,
  type ConflictFrame,
} from '@/lib/cameras/queries';
import type { ClientCamera, CameraFeatureCollection } from '@/lib/cameras/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cameras
 *   ?conflict=<slug>     cameras for a conflict (+ city cams inside its bbox)
 *   (omit conflict)      the global camera set
 *   &format=geojson      FeatureCollection for the map (default: json list)
 *
 * Rows are RLS-gated by the anon client: only status='active' YouTube streams
 * (or ToS-reviewed 'other' sources) are returned. The seeded catalog ships
 * 'unverified', so this endpoint returns an empty set until a verification pass
 * flips rows to 'active' — that is intentional (see docs/camera-tos-review.md).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('conflict');
  const format = searchParams.get('format') === 'geojson' ? 'geojson' : 'json';

  try {
    const supabase = createSupabaseServerClient();
    let cameras: ClientCamera[] = [];

    if (slug) {
      const { data: conflict } = await supabase
        .from('conflicts')
        .select('id, bbox')
        .eq('slug', slug)
        .maybeSingle<{ id: string; bbox: number[] | null }>();
      if (conflict) {
        const frame: ConflictFrame = { id: conflict.id, bbox: conflict.bbox };
        cameras = await getCamerasForConflict(supabase, frame);
      }
    } else {
      cameras = await getGlobalCameras(supabase);
    }

    const body = format === 'geojson' ? toFeatureCollection(cameras) : { cameras };
    return NextResponse.json(body, {
      headers: { 'cache-control': 's-maxage=120, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('[api/cameras] error', err);
    return NextResponse.json(
      format === 'geojson'
        ? { type: 'FeatureCollection', features: [] }
        : { cameras: [] },
    );
  }
}

function toFeatureCollection(cameras: ClientCamera[]): CameraFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cameras.map((c) => {
      const { lng, lat, ...properties } = c;
      return {
        type: 'Feature',
        id: c.id,
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties,
      };
    }),
  };
}
