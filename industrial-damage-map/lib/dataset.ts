import { DATASET } from '@/data';
import type { Dataset } from '@/data/types';
import {
  applyFilters,
  buildFacilityViews as buildViews,
  type FacilityView,
  type Filters,
  toGeoJson as toGeoJsonCore,
} from './filter-core';

/**
 * Server-side read model.
 *
 * The version-controlled dataset in ./data is the source of truth for content.
 * Postgres (db/seed.ts) is the query surface: the same records are loaded into
 * PostGIS so spatial and relational queries are available. When DATA_BACKEND is
 * `file`, or Postgres is unreachable in `auto` mode, the app serves the in-repo
 * dataset directly — the read model is byte-identical either way, which is what
 * makes the fallback safe rather than a silent second version of the truth.
 */

export type { FacilityView, Filters };
export { applyFilters };

export function getDataset(): Dataset {
  return DATASET;
}

export function buildFacilityViews(dataset: Dataset = getDataset()): FacilityView[] {
  return buildViews(dataset);
}

export function toGeoJson(views: FacilityView[], dataset: Dataset = getDataset()) {
  return toGeoJsonCore(views, dataset.industries, dataset.regions);
}

export function findFacilityBySlug(slug: string, views: FacilityView[] = buildFacilityViews()): FacilityView | null {
  return views.find((v) => v.facility.slug === slug) ?? null;
}
