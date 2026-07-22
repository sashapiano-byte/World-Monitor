import { registerLayerAdapter } from '../registry';
import { makeSkeletonAdapter } from './_skeleton';

/**
 * Adapter: NASA FIRMS active fire
 * License note: NASA open data — attribution requested
 *
 * Phase-1 skeleton. Replace `fetch` with real source integration; keep the
 * attribution guard (echo ctx.layer.attribution).
 */
export const nasa_firmsAdapter = makeSkeletonAdapter(
  'nasa_firms',
  'NASA FIRMS active fire',
  'NASA open data — attribution requested',
);

registerLayerAdapter(nasa_firmsAdapter);
