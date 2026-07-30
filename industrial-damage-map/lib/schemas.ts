import { z } from 'zod';

/**
 * Runtime validation for every record type. These are the single source of
 * truth for what a valid record looks like; the QC engine (lib/qc.ts) layers
 * *editorial* rules on top of these *structural* rules.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date, YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a real calendar date');

const confidence = z.number().int().min(0).max(100);

export const attackMethodSchema = z.enum([
  'uav',
  'cruise_missile',
  'ballistic_missile',
  'sabotage',
  'shelling',
  'naval_drone',
  'unknown_means',
]);

export const methodConfidenceSchema = z.enum(['high', 'medium', 'low', 'unknown']);

export const operationalStatusSchema = z.enum([
  'normal_operations',
  'operations_reduced',
  'partially_restored',
  'fully_restored',
  'temporarily_suspended',
  'long_term_shutdown',
  'destroyed',
  'unknown',
]);

export const verificationStatusSchema = z.enum([
  'verified',
  'corroborated',
  'unconfirmed',
  'disputed',
  'rejected',
]);

export const sourceTierSchema = z.enum(['A', 'B', 'C']);

export const coordinatePrecisionSchema = z.enum([
  'exact_public_address',
  'facility_centroid',
  'industrial_zone_centroid',
  'locality_only',
]);

export const siteCategorySchema = z.enum([
  'industrial',
  'military_depot',
  'arsenal',
  'repair_base',
  'airfield',
  'electrical_substation',
  'energy_infrastructure',
]);

export const territoryStatusSchema = z.enum([
  'internationally_recognised_russia',
  'occupied_ukraine_internationally_recognised_as_ukraine',
]);

export const damageEstimateTypeSchema = z.enum([
  'official',
  'insurance',
  'company_disclosure',
  'analyst_estimate',
  'model_estimate',
  'unknown',
]);

export const sourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  publicationDate: isoDate.nullable(),
  tier: sourceTierSchema,
  kind: z.string().min(1),
  language: z.enum(['ru', 'uk', 'en', 'other']),
  syndicatedFrom: z.string().min(1).nullable().optional(),
  archivedUrl: z.string().url().nullable().optional(),
  notes: z.string().optional(),
});

export const facilitySchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase kebab-case'),
  canonicalName: z.string().min(1),
  canonicalNameRu: z.string().min(1),
  alternativeNames: z.array(z.string()),
  legalEntity: z.string().nullable(),
  parentCompany: z.string().nullable(),
  industryId: z.string().min(1),
  subindustry: z.string().nullable(),
  siteCategory: siteCategorySchema,
  regionId: z.string().min(1),
  locality: z.string().min(1),
  publicAddress: z.string().nullable(),
  // Bounding box covering the Russian Federation plus occupied Crimea, with a
  // margin. A coordinate outside this box is a data-entry error.
  latitude: z.number().min(41).max(82),
  longitude: z.number().min(19).max(191),
  coordinatePrecision: coordinatePrecisionSchema,
  territoryStatus: territoryStatusSchema,
  facilityAreaHectares: z.number().positive().nullable().optional(),
  prewarEmployees: z.number().int().positive().nullable().optional(),
  prewarRevenueUsd: z.number().positive().nullable().optional(),
  nameplateCapacity: z.string().nullable().optional(),
  description: z.string().min(1),
  inclusionRationale: z.string().min(1),
  tags: z.array(z.string()),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const incidentSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  incidentDate: isoDate,
  incidentTimeLocal: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  attackMethod: attackMethodSchema,
  weaponModelClaimed: z.string().nullable().optional(),
  weaponModelConfidence: methodConfidenceSchema,
  methodConfidence: methodConfidenceSchema,
  casualtiesKilled: z.number().int().min(0).nullable().optional(),
  casualtiesInjured: z.number().int().min(0).nullable().optional(),
  fireConfirmed: z.boolean().nullable(),
  physicalDamageScore: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  damageSummary: z.string().min(1),
  damagedAssets: z.array(z.string()),
  operationalEffect: z.string().min(1),
  downtimeDays: z.number().int().min(0).nullable().optional(),
  downtimeIsEstimate: z.boolean(),
  confidence,
  verificationStatus: verificationStatusSchema,
  claimedBy: z.enum(['ukraine_official', 'russia_official', 'none', 'unclear']).optional(),
  sourceIds: z.array(z.string().min(1)).min(1, 'every incident must cite at least one source'),
  established: z.array(z.string()),
  unresolved: z.array(z.string()),
  lastReviewed: isoDate,
});

export const statusChangeSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  incidentId: z.string().nullable().optional(),
  status: operationalStatusSchema,
  statusDate: isoDate,
  capacityEstimatePercent: z.number().min(0).max(100).nullable().optional(),
  evidenceType: z.string().min(1),
  determination: z.enum(['direct_confirmation', 'analytical_assessment']),
  confidence,
  notes: z.string(),
  sourceIds: z.array(z.string().min(1)).min(1),
});

export const damageEstimateSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  incidentId: z.string().nullable().optional(),
  estimateType: damageEstimateTypeSchema,
  scope: z.enum(['facility', 'multi_facility', 'campaign']),
  currency: z.enum(['RUB', 'USD', 'EUR']),
  directDamageMin: z.number().nonnegative().nullable().optional(),
  directDamageMax: z.number().nonnegative().nullable().optional(),
  lostRevenueMin: z.number().nonnegative().nullable().optional(),
  lostRevenueMax: z.number().nonnegative().nullable().optional(),
  repairCostMin: z.number().nonnegative().nullable().optional(),
  repairCostMax: z.number().nonnegative().nullable().optional(),
  downtimeCostMin: z.number().nonnegative().nullable().optional(),
  downtimeCostMax: z.number().nonnegative().nullable().optional(),
  insuranceCoverage: z.number().nonnegative().nullable().optional(),
  usdAtIncidentDateMin: z.number().nonnegative().nullable().optional(),
  usdAtIncidentDateMax: z.number().nonnegative().nullable().optional(),
  usdConstantMin: z.number().nonnegative().nullable().optional(),
  usdConstantMax: z.number().nonnegative().nullable().optional(),
  estimateDate: isoDate.nullable(),
  methodology: z.string().min(20, 'a financial estimate must explain how it was produced'),
  assumptions: z.array(z.string()),
  confidence,
  sourceIds: z.array(z.string().min(1)).min(1),
});

export const claimSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  facilityId: z.string().min(1),
  incidentId: z.string().nullable().optional(),
  claimType: z.string().min(1),
  claimText: z.string().min(1),
  stance: z.enum(['supports', 'disputes', 'partially_supports', 'context']),
  confidence,
});

export const mediaSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  incidentId: z.string().nullable().optional(),
  mediaType: z.enum(['satellite', 'photo', 'video', 'diagram']),
  provider: z.string().min(1),
  captureDate: isoDate.nullable(),
  url: z.string().url(),
  license: z.string().min(1),
  thumbnailUrl: z.string().url().nullable().optional(),
  beforeOrAfter: z.enum(['before', 'after', 'n/a']),
  caption: z.string().min(1),
  interpretationLimits: z.string().optional(),
  resolutionMetres: z.number().positive().nullable().optional(),
});

export const datasetSchema = z.object({
  version: z.string().min(1),
  lastFullReview: isoDate,
  generatedAt: isoDate,
  license: z.string().min(1),
  industries: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      nameRu: z.string().min(1),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      sortOrder: z.number().int(),
    }),
  ),
  regions: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      nameRu: z.string().min(1),
      federalDistrict: z.string().min(1),
      territoryStatus: territoryStatusSchema,
    }),
  ),
  facilities: z.array(facilitySchema),
  incidents: z.array(incidentSchema),
  sources: z.array(sourceSchema),
  claims: z.array(claimSchema),
  media: z.array(mediaSchema),
  damageEstimates: z.array(damageEstimateSchema),
  statusHistory: z.array(statusChangeSchema),
  reviewQueue: z.array(z.object({ id: z.string().min(1) }).passthrough()),
});

// ---------------------------------------------------------------------------
// API query validation
// ---------------------------------------------------------------------------

const csv = (schema: z.ZodTypeAny) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : undefined))
    .pipe(z.array(schema).optional());

export const filterQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  regions: csv(z.string()),
  industries: csv(z.string()),
  methods: csv(attackMethodSchema),
  statuses: csv(operationalStatusSchema),
  minDamage: z.coerce.number().int().min(0).max(5).optional(),
  maxDamage: z.coerce.number().int().min(0).max(5).optional(),
  minConfidence: z.coerce.number().int().min(0).max(100).optional(),
  /** Include the low-confidence layer. Default: OFF. */
  includeUnconfirmed: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  /** Include flagged non-industrial categories. Default: OFF. */
  includeBorderline: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  /** Include occupied-territory sites. Default: ON, but on a distinct layer. */
  includeOccupied: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
  hasSatellite: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  hasFinancialEstimate: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  recovered: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  minIncidents: z.coerce.number().int().min(1).optional(),
  q: z.string().max(200).optional(),
});

export type FilterQuery = z.infer<typeof filterQuerySchema>;
