import { registerLayerAdapter } from '../registry';
import { makeSkeletonAdapter } from './_skeleton';

/**
 * Adapter: Oryx documented losses
 * License note: Attribution required; undercount by design
 *
 * Phase-1 skeleton. Replace `fetch` with real source integration; keep the
 * attribution guard (echo ctx.layer.attribution).
 */
export const oryxAdapter = makeSkeletonAdapter(
  'oryx',
  'Oryx documented losses',
  'Attribution required; undercount by design',
);

registerLayerAdapter(oryxAdapter);
