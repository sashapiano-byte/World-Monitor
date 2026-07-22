import { registerLayerAdapter } from '../registry';
import { makeSkeletonAdapter } from './_skeleton';

/**
 * Adapter: ACLED conflict events
 * License note: Non-commercial free tier — GATED (see DECISIONS.md)
 *
 * Phase-1 skeleton. Replace `fetch` with real source integration; keep the
 * attribution guard (echo ctx.layer.attribution).
 */
export const acledAdapter = makeSkeletonAdapter(
  'acled',
  'ACLED conflict events',
  'Non-commercial free tier — GATED (see DECISIONS.md)',
);

registerLayerAdapter(acledAdapter);
