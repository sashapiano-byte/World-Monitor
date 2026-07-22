import type { LayerAdapter, LayerContext, LayerFetchResult } from './types';

/**
 * Global layer-adapter registry.
 *
 * Adapters register themselves at module load (see lib/layers/index.ts which
 * imports every adapter module for its side effects). Resolution is by the
 * `adapter_key` stored on a `conflict_layers` row, so the database drives which
 * code runs — adding a conflict/layer never requires touching this file.
 */
const registry = new Map<string, LayerAdapter>();

export function registerLayerAdapter(adapter: LayerAdapter): void {
  if (registry.has(adapter.key)) {
    // Last registration wins but warn loudly — usually a duplicate-import bug.
    console.warn(`[layers] adapter "${adapter.key}" re-registered`);
  }
  registry.set(adapter.key, adapter);
}

export function getLayerAdapter(key: string): LayerAdapter | undefined {
  return registry.get(key);
}

export function requireLayerAdapter(key: string): LayerAdapter {
  const adapter = registry.get(key);
  if (!adapter) {
    throw new Error(
      `[layers] no adapter registered for key "${key}". ` +
        `Registered: ${[...registry.keys()].join(', ') || '(none)'}`,
    );
  }
  return adapter;
}

export function listLayerAdapters(): LayerAdapter[] {
  return [...registry.values()];
}

/**
 * Run an adapter with a hard guarantee that the source's attribution survives.
 * If an adapter drops or mangles the credit line, ingestion fails closed rather
 * than silently publishing uncredited data.
 */
export async function runLayerAdapter(
  adapter: LayerAdapter,
  ctx: LayerContext,
): Promise<LayerFetchResult> {
  const result = await adapter.fetch(ctx);
  if (!result.attribution || result.attribution.trim().length === 0) {
    throw new Error(
      `[layers] adapter "${adapter.key}" returned no attribution — refusing to ingest`,
    );
  }
  return result;
}
