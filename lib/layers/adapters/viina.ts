import { registerLayerAdapter } from '../registry';
import { makeSkeletonAdapter } from './_skeleton';

/**
 * Adapter: VIINA event feed
 * License note: ODbL 1.0 — share-alike, attribution required
 *
 * Phase-1 skeleton. Replace `fetch` with real source integration; keep the
 * attribution guard (echo ctx.layer.attribution).
 */
export const viinaAdapter = makeSkeletonAdapter(
  'viina',
  'VIINA event feed',
  'ODbL 1.0 — share-alike, attribution required',
);

registerLayerAdapter(viinaAdapter);
