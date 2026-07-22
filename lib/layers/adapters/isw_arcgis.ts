import { registerLayerAdapter } from '../registry';
import { makeSkeletonAdapter } from './_skeleton';

/**
 * Adapter: ISW ArcGIS Assessed Control
 * License note: ISW Fair Use — preserve credit line
 *
 * Phase-1 skeleton. Replace `fetch` with real source integration; keep the
 * attribution guard (echo ctx.layer.attribution).
 */
export const isw_arcgisAdapter = makeSkeletonAdapter(
  'isw_arcgis',
  'ISW ArcGIS Assessed Control',
  'ISW Fair Use — preserve credit line',
);

registerLayerAdapter(isw_arcgisAdapter);
