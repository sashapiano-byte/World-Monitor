import { registerLayerAdapter } from '../registry';
import { makeSkeletonAdapter } from './_skeleton';

/**
 * Adapter: UCDP Georeferenced Events
 * License note: CC BY 4.0
 *
 * Phase-1 skeleton. Replace `fetch` with real source integration; keep the
 * attribution guard (echo ctx.layer.attribution).
 */
export const ucdp_gedAdapter = makeSkeletonAdapter(
  'ucdp_ged',
  'UCDP Georeferenced Events',
  'CC BY 4.0',
);

registerLayerAdapter(ucdp_gedAdapter);
