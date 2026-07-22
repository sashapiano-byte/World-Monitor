import type { LayerAdapter, LayerContext, LayerFetchResult } from '../types';

/**
 * Helper for building placeholder adapters during scaffolding. A real adapter
 * replaces `fetch` with source-specific logic but keeps the attribution guard:
 * always echo `ctx.layer.attribution` so credit lines survive ingestion.
 */
export function makeSkeletonAdapter(
  key: string,
  label: string,
  licenseNote?: string,
): LayerAdapter {
  return {
    key,
    label,
    licenseNote,
    async fetch(ctx: LayerContext): Promise<LayerFetchResult> {
      // Phase-1 subagents replace this body with real source integration.
      return {
        features: [],
        attribution: ctx.layer.attribution,
        fetchedAt: new Date().toISOString(),
        status: 'partial',
        message: `adapter "${key}" not yet implemented — returning no features`,
      };
    },
  };
}
