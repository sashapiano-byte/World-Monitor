import { registerLayerAdapter } from '../registry';
import { makeSkeletonAdapter } from './_skeleton';

/**
 * Adapter: HDX humanitarian datasets
 * License note: Per-dataset licenses
 *
 * Phase-1 skeleton. Replace `fetch` with real source integration; keep the
 * attribution guard (echo ctx.layer.attribution).
 */
export const hdxAdapter = makeSkeletonAdapter(
  'hdx',
  'HDX humanitarian datasets',
  'Per-dataset licenses',
);

registerLayerAdapter(hdxAdapter);
