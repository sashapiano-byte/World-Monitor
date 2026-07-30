import type {
  DamageEstimateRecord,
  FacilityRecord,
  IncidentRecord,
  MediaRecord,
  StatusChangeRecord,
} from './types';

const DATASET_CREATED = '2026-07-30';

type FacilityInput = Omit<
  FacilityRecord,
  'createdAt' | 'updatedAt' | 'alternativeNames' | 'tags' | 'siteCategory' | 'territoryStatus'
> &
  Partial<Pick<FacilityRecord, 'createdAt' | 'updatedAt' | 'alternativeNames' | 'tags' | 'siteCategory' | 'territoryStatus'>>;

export function facility(input: FacilityInput): FacilityRecord {
  return {
    alternativeNames: [],
    tags: [],
    siteCategory: 'industrial',
    territoryStatus: 'internationally_recognised_russia',
    createdAt: DATASET_CREATED,
    updatedAt: DATASET_CREATED,
    ...input,
  };
}

type IncidentInput = Omit<
  IncidentRecord,
  | 'weaponModelConfidence'
  | 'methodConfidence'
  | 'damagedAssets'
  | 'downtimeIsEstimate'
  | 'established'
  | 'unresolved'
  | 'lastReviewed'
  | 'fireConfirmed'
  | 'claimedBy'
> &
  Partial<
    Pick<
      IncidentRecord,
      | 'weaponModelConfidence'
      | 'methodConfidence'
      | 'damagedAssets'
      | 'downtimeIsEstimate'
      | 'established'
      | 'unresolved'
      | 'lastReviewed'
      | 'fireConfirmed'
      | 'claimedBy'
    >
  >;

export function incident(input: IncidentInput): IncidentRecord {
  return {
    weaponModelConfidence: 'unknown',
    methodConfidence: 'medium',
    damagedAssets: [],
    downtimeIsEstimate: true,
    established: [],
    unresolved: [],
    fireConfirmed: null,
    claimedBy: 'unclear',
    lastReviewed: DATASET_CREATED,
    ...input,
  };
}

type StatusInput = Omit<StatusChangeRecord, 'notes' | 'capacityEstimatePercent'> &
  Partial<Pick<StatusChangeRecord, 'notes' | 'capacityEstimatePercent'>>;

export function statusChange(input: StatusInput): StatusChangeRecord {
  return {
    notes: '',
    capacityEstimatePercent: null,
    ...input,
  };
}

type EstimateInput = Omit<DamageEstimateRecord, 'assumptions' | 'scope'> &
  Partial<Pick<DamageEstimateRecord, 'assumptions' | 'scope'>>;

export function damageEstimate(input: EstimateInput): DamageEstimateRecord {
  return {
    assumptions: [],
    scope: 'facility',
    ...input,
  };
}

type MediaInput = Omit<MediaRecord, 'thumbnailUrl' | 'resolutionMetres' | 'interpretationLimits'> &
  Partial<Pick<MediaRecord, 'thumbnailUrl' | 'resolutionMetres' | 'interpretationLimits'>>;

export function media(input: MediaInput): MediaRecord {
  return {
    // Default is NO hosted thumbnail. A thumbnail is opt-in and only permitted
    // when the licence positively allows redistribution (see SOURCES_POLICY.md).
    thumbnailUrl: null,
    resolutionMetres: null,
    ...input,
  };
}
