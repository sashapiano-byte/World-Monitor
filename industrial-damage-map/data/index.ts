import { DUPLICATE_RESOLUTIONS } from './duplicate-resolutions';
import { INDUSTRIES, REGIONS } from './reference';
import { REVIEW_QUEUE } from './review-queue';
import { SOURCES } from './sources';
import {
  BORDERLINE_CLAIMS,
  BORDERLINE_FACILITIES,
  BORDERLINE_INCIDENTS,
  BORDERLINE_STATUS,
} from './facilities/borderline';
import {
  CHEM_CLAIMS,
  CHEM_FACILITIES,
  CHEM_INCIDENTS,
  CHEM_MEDIA,
  CHEM_STATUS,
} from './facilities/chemicals-metallurgy';
import {
  LOGISTICS_CLAIMS,
  LOGISTICS_ESTIMATES,
  LOGISTICS_FACILITIES,
  LOGISTICS_INCIDENTS,
  LOGISTICS_STATUS,
} from './facilities/logistics-food';
import { MFG_CLAIMS, MFG_FACILITIES, MFG_INCIDENTS, MFG_STATUS } from './facilities/manufacturing';
import {
  REFINING_CLAIMS,
  REFINING_ESTIMATES,
  REFINING_FACILITIES,
  REFINING_INCIDENTS,
  REFINING_MEDIA,
  REFINING_STATUS,
} from './facilities/oil-refining';
import {
  TERMINAL_CLAIMS,
  TERMINAL_ESTIMATES,
  TERMINAL_FACILITIES,
  TERMINAL_INCIDENTS,
  TERMINAL_MEDIA,
  TERMINAL_STATUS,
} from './facilities/terminals-ports';
import type { Dataset } from './types';

/** Semantic version of the dataset itself, independent of the app version. */
export const DATASET_VERSION = '0.1.0';

/** Date of the last complete end-to-end review of every record in the set. */
export const LAST_FULL_REVIEW = '2026-07-30';

/**
 * Cut-off for published incidents. Nothing that happened after this instant is
 * published, because of the 72-hour embargo (SECURITY_AND_ETHICS.md §Embargo).
 * Dataset build date is 2026-07-30, so the embargo boundary is 2026-07-27.
 */
export const EMBARGO_CUTOFF_DATE = '2026-07-27';

export const DATASET: Dataset = {
  version: DATASET_VERSION,
  lastFullReview: LAST_FULL_REVIEW,
  generatedAt: LAST_FULL_REVIEW,
  license: 'CC BY 4.0 — data. Source articles and imagery remain the property of their publishers.',
  industries: INDUSTRIES,
  regions: REGIONS,
  sources: SOURCES,
  reviewQueue: REVIEW_QUEUE,
  // Not part of the published record set; carried alongside it so the QC engine
  // and the editorial docs can see which duplicate flags have been closed.

  facilities: [
    ...REFINING_FACILITIES,
    ...TERMINAL_FACILITIES,
    ...CHEM_FACILITIES,
    ...MFG_FACILITIES,
    ...LOGISTICS_FACILITIES,
    ...BORDERLINE_FACILITIES,
  ],
  incidents: [
    ...REFINING_INCIDENTS,
    ...TERMINAL_INCIDENTS,
    ...CHEM_INCIDENTS,
    ...MFG_INCIDENTS,
    ...LOGISTICS_INCIDENTS,
    ...BORDERLINE_INCIDENTS,
  ],
  statusHistory: [
    ...REFINING_STATUS,
    ...TERMINAL_STATUS,
    ...CHEM_STATUS,
    ...MFG_STATUS,
    ...LOGISTICS_STATUS,
    ...BORDERLINE_STATUS,
  ],
  damageEstimates: [...REFINING_ESTIMATES, ...TERMINAL_ESTIMATES, ...LOGISTICS_ESTIMATES],
  media: [...REFINING_MEDIA, ...TERMINAL_MEDIA, ...CHEM_MEDIA],
  claims: [
    ...REFINING_CLAIMS,
    ...TERMINAL_CLAIMS,
    ...CHEM_CLAIMS,
    ...MFG_CLAIMS,
    ...LOGISTICS_CLAIMS,
    ...BORDERLINE_CLAIMS,
  ],
};

export { DUPLICATE_RESOLUTIONS } from './duplicate-resolutions';
export type { DuplicateResolution } from './duplicate-resolutions';
export * from './types';
export { INDUSTRIES, REGIONS, INDUSTRY_BY_ID, REGION_BY_ID } from './reference';
export { SOURCES, SOURCE_BY_ID } from './sources';
