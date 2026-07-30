/**
 * Domain model for the Russian Industrial Damage Map.
 *
 * The units of record are deliberately separated (see METHODOLOGY.md §4):
 *
 *   Facility          — a permanent card for a physical industrial site.
 *   Incident          — one attack / damage event affecting that facility.
 *   Damage            — what an incident physically did (fields on Incident).
 *   Source            — a publication, document, image or statement.
 *   Claim             — a specific assertion a source makes about a record.
 *   RecoveryEvent     — a status change: resumption, unit restart, repair done.
 *
 * One facility may carry many incidents. A new attack NEVER creates a new
 * facility card.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** How the facility was struck. `unknown_means` is the honest default. */
export type AttackMethod =
  | 'uav'
  | 'cruise_missile'
  | 'ballistic_missile'
  | 'sabotage'
  | 'shelling'
  | 'naval_drone'
  | 'unknown_means';

export const ATTACK_METHODS: AttackMethod[] = [
  'uav',
  'cruise_missile',
  'ballistic_missile',
  'sabotage',
  'shelling',
  'naval_drone',
  'unknown_means',
];

/** Confidence in the *attack method* specifically, independent of the incident. */
export type MethodConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type OperationalStatus =
  | 'normal_operations'
  | 'operations_reduced'
  | 'partially_restored'
  | 'fully_restored'
  | 'temporarily_suspended'
  | 'long_term_shutdown'
  | 'destroyed'
  | 'unknown';

export const OPERATIONAL_STATUSES: OperationalStatus[] = [
  'normal_operations',
  'operations_reduced',
  'partially_restored',
  'fully_restored',
  'temporarily_suspended',
  'long_term_shutdown',
  'destroyed',
  'unknown',
];

/**
 * Physical damage scale, 0–5. See METHODOLOGY.md §8.
 * Always pick the MOST CONSERVATIVE score the evidence supports.
 */
export type DamageScore = 0 | 1 | 2 | 3 | 4 | 5;

export type VerificationStatus =
  | 'verified'          // meets the high-confidence bar
  | 'corroborated'      // meets the medium bar
  | 'unconfirmed'       // low — hidden from the default map layer
  | 'disputed'          // credible sources conflict
  | 'rejected';         // investigated and found not to have happened / not damage

/** Source reliability tiers. See SOURCES_POLICY.md. */
export type SourceTier = 'A' | 'B' | 'C';

export type SourceKind =
  | 'company_statement'
  | 'government_official'
  | 'emergency_services'
  | 'regulator'
  | 'financial_disclosure'
  | 'court_filing'
  | 'procurement_notice'
  | 'insurance'
  | 'satellite_operator'
  | 'wire_agency'
  | 'newspaper'
  | 'broadcaster'
  | 'trade_press'
  | 'investigative_project'
  | 'osint_project'
  | 'regional_media'
  | 'telegram'
  | 'social_media'
  | 'company_directory'
  | 'encyclopaedia'
  | 'belligerent_statement';

export type ClaimType =
  | 'facility_identity'
  | 'incident_occurred'
  | 'attack_method'
  | 'physical_damage'
  | 'fire'
  | 'casualties'
  | 'production_halt'
  | 'production_resumed'
  | 'capacity_impact'
  | 'financial_damage'
  | 'repair_work'
  | 'insurance_or_state_support'
  | 'geolocation';

export type ClaimStance = 'supports' | 'disputes' | 'partially_supports' | 'context';

export type DamageEstimateType =
  | 'official'
  | 'insurance'
  | 'company_disclosure'
  | 'analyst_estimate'
  | 'model_estimate'
  | 'unknown';

export type CoordinatePrecision =
  | 'exact_public_address'
  | 'facility_centroid'
  | 'industrial_zone_centroid'
  | 'locality_only';

/**
 * Site category. Genuine industrial enterprises are `industrial`.
 * Everything else is a flagged borderline category kept in its own layer and
 * excluded from the headline "damaged industrial enterprises" count.
 */
export type SiteCategory =
  | 'industrial'
  | 'military_depot'
  | 'arsenal'
  | 'repair_base'
  | 'airfield'
  | 'electrical_substation'
  | 'energy_infrastructure';

export type EvidenceType =
  | 'company_statement'
  | 'official_statement'
  | 'satellite_imagery'
  | 'ground_photo_video'
  | 'trade_data'
  | 'exchange_sales_data'
  | 'procurement_record'
  | 'financial_report'
  | 'media_reporting'
  | 'analytical_inference';

/** Territory status flag — Crimea and other occupied areas are rendered apart. */
export type TerritoryStatus =
  | 'internationally_recognised_russia'
  | 'occupied_ukraine_internationally_recognised_as_ukraine';

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface SourceRecord {
  id: string;
  title: string;
  publisher: string;
  url: string;
  /** ISO date (YYYY-MM-DD) of publication, or null if the source is undated. */
  publicationDate: string | null;
  tier: SourceTier;
  kind: SourceKind;
  language: 'ru' | 'uk' | 'en' | 'other';
  /**
   * Set when the item is a republication of another outlet's reporting
   * (e.g. 'Reuters', 'Bloomberg', 'Associated Press').
   *
   * This matters for counting: five outlets republishing one Reuters story are
   * ONE independent source, not five. The QC engine deduplicates on this field.
   */
  syndicatedFrom?: string | null;
  /** Web-archive snapshot, when one could legitimately be created/located. */
  archivedUrl?: string | null;
  notes?: string;
}

export interface ClaimRecord {
  id: string;
  sourceId: string;
  facilityId: string;
  incidentId?: string | null;
  claimType: ClaimType;
  /** Short statement of exactly what this source establishes. */
  claimText: string;
  stance: ClaimStance;
  /** 0–100. How much weight this particular claim carries. */
  confidence: number;
}

export interface MediaRecord {
  id: string;
  facilityId: string;
  incidentId?: string | null;
  mediaType: 'satellite' | 'photo' | 'video' | 'diagram';
  provider: string;
  /** ISO date the imagery was captured (not published). */
  captureDate: string | null;
  /** Link to the ORIGINAL publication. We do not rehost restricted imagery. */
  url: string;
  license: string;
  /** Only set when the licence positively permits a hosted thumbnail. */
  thumbnailUrl?: string | null;
  beforeOrAfter: 'before' | 'after' | 'n/a';
  caption: string;
  /** What a reader can and cannot conclude from this image. */
  interpretationLimits?: string;
  resolutionMetres?: number | null;
}

/**
 * What a financial estimate actually covers. Aggregation depends on this:
 * only `facility`-scoped estimates may be summed across facilities.
 */
export type EstimateScope = 'facility' | 'multi_facility' | 'campaign';

export interface DamageEstimateRecord {
  id: string;
  facilityId: string;
  incidentId?: string | null;
  estimateType: DamageEstimateType;
  /** Defaults to 'facility'. Anything else is excluded from per-facility totals. */
  scope: EstimateScope;
  currency: 'RUB' | 'USD' | 'EUR';
  directDamageMin?: number | null;
  directDamageMax?: number | null;
  lostRevenueMin?: number | null;
  lostRevenueMax?: number | null;
  repairCostMin?: number | null;
  repairCostMax?: number | null;
  downtimeCostMin?: number | null;
  downtimeCostMax?: number | null;
  insuranceCoverage?: number | null;
  /** USD at the exchange rate in force on the incident date. */
  usdAtIncidentDateMin?: number | null;
  usdAtIncidentDateMax?: number | null;
  /** USD deflated to constant prices of the last complete year (see lib/fx.ts). */
  usdConstantMin?: number | null;
  usdConstantMax?: number | null;
  /** ISO date the estimate itself was made. */
  estimateDate: string | null;
  /** Mandatory. Every figure must say how it was arrived at. */
  methodology: string;
  /** Every assumption behind a model estimate, surfaced verbatim in the UI. */
  assumptions?: string[];
  confidence: number;
  sourceIds: string[];
}

export interface StatusChangeRecord {
  id: string;
  facilityId: string;
  incidentId?: string | null;
  status: OperationalStatus;
  /** ISO date the status is asserted to hold from. */
  statusDate: string;
  /** Best estimate of running capacity, 0–100, or null when unknown. */
  capacityEstimatePercent?: number | null;
  evidenceType: EvidenceType;
  /** Whether this is directly attested or inferred by us. */
  determination: 'direct_confirmation' | 'analytical_assessment';
  confidence: number;
  notes: string;
  sourceIds: string[];
}

export interface IncidentRecord {
  id: string;
  facilityId: string;
  /** ISO date (YYYY-MM-DD). Attacks reported "overnight X–Y" use Y. */
  incidentDate: string;
  /** Local 24h time when reported, else null. */
  incidentTimeLocal?: string | null;
  attackMethod: AttackMethod;
  /** Munition type as *claimed* by someone — never asserted by us. */
  weaponModelClaimed?: string | null;
  weaponModelConfidence: MethodConfidence;
  methodConfidence: MethodConfidence;
  casualtiesKilled?: number | null;
  casualtiesInjured?: number | null;
  fireConfirmed: boolean | null;
  physicalDamageScore: DamageScore;
  /** Conservative prose description of the physical result. */
  damageSummary: string;
  /** Named buildings / units / production areas reported damaged. */
  damagedAssets: string[];
  /** Effect on output, in plain language. */
  operationalEffect: string;
  /** Confirmed or estimated downtime in days; null when unknown. */
  downtimeDays?: number | null;
  downtimeIsEstimate: boolean;
  /** 0–100 overall confidence that this incident happened AS DESCRIBED. */
  confidence: number;
  verificationStatus: VerificationStatus;
  /** Attribution claimed by a belligerent, if any. Not treated as proof. */
  claimedBy?: 'ukraine_official' | 'russia_official' | 'none' | 'unclear';
  sourceIds: string[];
  /** Facts we regard as established. */
  established: string[];
  /** Facts we specifically could NOT establish. */
  unresolved: string[];
  lastReviewed: string;
}

export interface FacilityRecord {
  id: string;
  slug: string;
  canonicalName: string;
  canonicalNameRu: string;
  alternativeNames: string[];
  legalEntity: string | null;
  parentCompany: string | null;
  industryId: string;
  subindustry: string | null;
  siteCategory: SiteCategory;
  regionId: string;
  locality: string;
  /** Publicly published address (company site / registry), when one exists. */
  publicAddress: string | null;
  latitude: number;
  longitude: number;
  coordinatePrecision: CoordinatePrecision;
  territoryStatus: TerritoryStatus;
  facilityAreaHectares?: number | null;
  prewarEmployees?: number | null;
  prewarRevenueUsd?: number | null;
  /** Nameplate capacity in the industry's natural unit, as free text. */
  nameplateCapacity?: string | null;
  description: string;
  /** Editorial note on why this record is included at all. */
  inclusionRationale: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IndustryRecord {
  id: string;
  name: string;
  nameRu: string;
  /** Hex colour used for map markers and charts. */
  color: string;
  sortOrder: number;
}

export interface RegionRecord {
  id: string;
  name: string;
  nameRu: string;
  federalDistrict: string;
  territoryStatus: TerritoryStatus;
}

/** A candidate incident awaiting manual review. Never rendered on the map. */
export interface ReviewQueueItem {
  id: string;
  discoveredAt: string;
  headline: string;
  url: string;
  publisher: string;
  detectedFacilityName: string | null;
  matchedFacilityId: string | null;
  detectedDate: string | null;
  detectedMethod: AttackMethod | null;
  stage:
    | 'detected'
    | 'name_normalised'
    | 'facility_matched'
    | 'details_extracted'
    | 'corroboration_sought'
    | 'imagery_checked'
    | 'confidence_assigned'
    | 'awaiting_approval'
    | 'published'
    | 'rejected';
  blockedReason: string | null;
  notes: string;
}

export interface Dataset {
  version: string;
  /** Date of the last complete end-to-end review of every record. */
  lastFullReview: string;
  generatedAt: string;
  license: string;
  industries: IndustryRecord[];
  regions: RegionRecord[];
  facilities: FacilityRecord[];
  incidents: IncidentRecord[];
  sources: SourceRecord[];
  claims: ClaimRecord[];
  media: MediaRecord[];
  damageEstimates: DamageEstimateRecord[];
  statusHistory: StatusChangeRecord[];
  reviewQueue: ReviewQueueItem[];
}
