import { createSupabaseServiceClient } from '@/lib/supabase/server';
import {
  requireLayerAdapter,
  runLayerAdapter,
} from '@/lib/layers/registry';
import '@/lib/layers'; // side-effect: register all adapters
import type { LayerContext } from '@/lib/layers/types';
import type { ConflictLayerRow, ConflictRow } from '@/lib/supabase/types';

export interface IngestSummary {
  layerKey: string;
  adapterKey: string;
  status: 'ok' | 'partial' | 'error';
  upserted: number;
  message?: string;
}

/**
 * Run ingestion for all due, enabled layers. `scope` maps to a refresh cadence
 * band so Vercel cron can call fast (frequent) vs slow (daily) separately.
 */
export async function runIngestion(
  scope: 'fast' | 'slow' | 'all' = 'all',
): Promise<IngestSummary[]> {
  const supabase = createSupabaseServiceClient();

  const { data: layers, error } = await supabase
    .from('conflict_layers')
    .select('*, conflicts(*)')
    .eq('enabled', true);
  if (error) throw error;

  const results: IngestSummary[] = [];

  for (const row of (layers ?? []) as Array<
    ConflictLayerRow & { conflicts: ConflictRow }
  >) {
    if (!inScope(row, scope)) continue;

    const started = Date.now();
    try {
      const adapter = requireLayerAdapter(row.adapter_key);
      const ctx: LayerContext = {
        conflict: {
          id: row.conflicts.id,
          slug: row.conflicts.slug,
          name: row.conflicts.name,
          center: [row.conflicts.center_lng, row.conflicts.center_lat],
          bbox: (row.conflicts.bbox as [number, number, number, number]) ?? null,
        },
        layer: {
          id: row.id,
          key: row.key,
          name: row.name,
          adapterKey: row.adapter_key,
          attribution: row.attribution,
          license: row.license,
          sourceUrl: row.source_url,
          config: (row.config as Record<string, unknown>) ?? {},
          style: (row.style as Record<string, unknown>) ?? {},
        },
        env: (k) => process.env[k],
      };

      const result = await runLayerAdapter(adapter, ctx);
      const upserted = await upsertFeatures(supabase, row.id, result.features);

      await supabase
        .from('conflict_layers')
        .update({ last_ingested_at: new Date().toISOString() } as never)
        .eq('id', row.id);

      await supabase.from('ingestion_runs').insert({
        layer_id: row.id,
        adapter_key: row.adapter_key,
        status: result.status,
        features_upserted: upserted,
        message: result.message,
        duration_ms: Date.now() - started,
        finished_at: new Date().toISOString(),
      } as never);

      results.push({
        layerKey: row.key,
        adapterKey: row.adapter_key,
        status: result.status,
        upserted,
        message: result.message,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from('ingestion_runs').insert({
        layer_id: row.id,
        adapter_key: row.adapter_key,
        status: 'error',
        message,
        duration_ms: Date.now() - started,
        finished_at: new Date().toISOString(),
      } as never);
      results.push({
        layerKey: row.key,
        adapterKey: row.adapter_key,
        status: 'error',
        upserted: 0,
        message,
      });
    }
  }

  return results;
}

function inScope(
  row: ConflictLayerRow,
  scope: 'fast' | 'slow' | 'all',
): boolean {
  if (scope === 'all') return true;
  const fast = row.refresh_interval_seconds <= 3600;
  return scope === 'fast' ? fast : !fast;
}

async function upsertFeatures(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  layerId: string,
  features: import('@/lib/layers/types').NormalizedFeature[],
): Promise<number> {
  if (features.length === 0) return 0;
  // layer_features.geom is geometry(4326); pass GeoJSON via ST_GeomFromGeoJSON
  // in an RPC in production. For the scaffold we store geometry as GeoJSON in
  // `properties.__geometry` and let a DB function normalize (see TODO).
  const rows = features.map((f) => ({
    layer_id: layerId,
    external_id: f.externalId,
    event_date: f.eventDate ?? null,
    title: f.title ?? null,
    properties: { ...f.properties, __geometry: f.geometry },
  }));
  const { error, count } = await supabase
    .from('layer_features')
    .upsert(rows as never, {
      onConflict: 'layer_id,external_id',
      count: 'exact',
      ignoreDuplicates: false,
    });
  if (error) throw error;
  return count ?? rows.length;
}
