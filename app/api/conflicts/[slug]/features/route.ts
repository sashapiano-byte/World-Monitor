import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conflicts/:slug/features?layer=:key
 * Returns a GeoJSON FeatureCollection for one layer of one conflict, built from
 * stored `layer_features`. Geometry is read from properties.__geometry.
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const { searchParams } = new URL(request.url);
  const layerKey = searchParams.get('layer');
  const empty = { type: 'FeatureCollection', features: [] as unknown[] };
  if (!layerKey) return NextResponse.json(empty);

  try {
    const supabase = createSupabaseServerClient();

    const { data: conflict } = await supabase
      .from('conflicts')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle<{ id: string }>();
    if (!conflict) return NextResponse.json(empty);

    const { data: layer } = await supabase
      .from('conflict_layers')
      .select('id')
      .eq('conflict_id', conflict.id)
      .eq('key', layerKey)
      .maybeSingle<{ id: string }>();
    if (!layer) return NextResponse.json(empty);

    const { data: features } = await supabase
      .from('layer_features')
      .select('external_id, event_date, title, properties')
      .eq('layer_id', layer.id)
      .limit(5000)
      .returns<
        Array<{
          external_id: string;
          event_date: string | null;
          title: string | null;
          properties: Record<string, unknown> | null;
        }>
      >();

    const collection = {
      type: 'FeatureCollection',
      features: (features ?? []).map((f) => {
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const { __geometry, ...rest } = props;
        return {
          type: 'Feature',
          id: f.external_id,
          geometry: __geometry ?? null,
          properties: { ...rest, title: f.title, event_date: f.event_date },
        };
      }),
    };

    return NextResponse.json(collection, {
      headers: { 'cache-control': 's-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error('[api/features] error', err);
    return NextResponse.json(empty);
  }
}
