import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Drizzle mirror of db/migrations/0000_init.sql.
 *
 * The SQL file is authoritative — it carries the CHECK constraints that encode
 * editorial rules, which an ORM schema cannot express. This module exists so
 * that application queries are typed against the same shape.
 */

export const attackMethodEnum = pgEnum('attack_method', [
  'uav',
  'cruise_missile',
  'ballistic_missile',
  'sabotage',
  'shelling',
  'naval_drone',
  'unknown_means',
]);

export const methodConfidenceEnum = pgEnum('method_confidence', ['high', 'medium', 'low', 'unknown']);

export const operationalStatusEnum = pgEnum('operational_status', [
  'normal_operations',
  'operations_reduced',
  'partially_restored',
  'fully_restored',
  'temporarily_suspended',
  'long_term_shutdown',
  'destroyed',
  'unknown',
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'verified',
  'corroborated',
  'unconfirmed',
  'disputed',
  'rejected',
]);

export const sourceTierEnum = pgEnum('source_tier', ['A', 'B', 'C']);

export const damageEstimateTypeEnum = pgEnum('damage_estimate_type', [
  'official',
  'insurance',
  'company_disclosure',
  'analyst_estimate',
  'model_estimate',
  'unknown',
]);

export const estimateScopeEnum = pgEnum('estimate_scope', ['facility', 'multi_facility', 'campaign']);

export const coordinatePrecisionEnum = pgEnum('coordinate_precision', [
  'exact_public_address',
  'facility_centroid',
  'industrial_zone_centroid',
  'locality_only',
]);

export const siteCategoryEnum = pgEnum('site_category', [
  'industrial',
  'military_depot',
  'arsenal',
  'repair_base',
  'airfield',
  'electrical_substation',
  'energy_infrastructure',
]);

export const territoryStatusEnum = pgEnum('territory_status', [
  'internationally_recognised_russia',
  'occupied_ukraine_internationally_recognised_as_ukraine',
]);

export const claimStanceEnum = pgEnum('claim_stance', ['supports', 'disputes', 'partially_supports', 'context']);

export const reviewStageEnum = pgEnum('review_stage', [
  'detected',
  'name_normalised',
  'facility_matched',
  'details_extracted',
  'corroboration_sought',
  'imagery_checked',
  'confidence_assigned',
  'awaiting_approval',
  'published',
  'rejected',
]);

export const industries = pgTable('industries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameRu: text('name_ru').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const regions = pgTable('regions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameRu: text('name_ru').notNull(),
  federalDistrict: text('federal_district').notNull(),
  territoryStatus: territoryStatusEnum('territory_status').notNull(),
});

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  description: text('description').notNull().default(''),
});

export const facilities = pgTable('facilities', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  canonicalName: text('canonical_name').notNull(),
  canonicalNameRu: text('canonical_name_ru').notNull(),
  alternativeNames: text('alternative_names').array().notNull().default(sql`'{}'`),
  legalEntity: text('legal_entity'),
  parentCompany: text('parent_company'),
  industryId: text('industry_id')
    .notNull()
    .references(() => industries.id),
  subindustry: text('subindustry'),
  siteCategory: siteCategoryEnum('site_category').notNull().default('industrial'),
  regionId: text('region_id')
    .notNull()
    .references(() => regions.id),
  locality: text('locality').notNull(),
  publicAddress: text('public_address'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  coordinatePrecision: coordinatePrecisionEnum('coordinate_precision').notNull(),
  territoryStatus: territoryStatusEnum('territory_status').notNull(),
  facilityAreaHectares: numeric('facility_area_hectares'),
  prewarEmployees: integer('prewar_employees'),
  prewarRevenueUsd: numeric('prewar_revenue_usd'),
  nameplateCapacity: text('nameplate_capacity'),
  description: text('description').notNull(),
  inclusionRationale: text('inclusion_rationale').notNull(),
  tags: text('tags').array().notNull().default(sql`'{}'`),
  createdAt: date('created_at').notNull(),
  updatedAt: date('updated_at').notNull(),
});

export const sources = pgTable('sources', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  publisher: text('publisher').notNull(),
  url: text('url').notNull(),
  publicationDate: date('publication_date'),
  tier: sourceTierEnum('tier').notNull(),
  kind: text('kind').notNull(),
  language: text('language').notNull(),
  archivedUrl: text('archived_url'),
  notes: text('notes'),
});

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  facilityId: text('facility_id')
    .notNull()
    .references(() => facilities.id, { onDelete: 'cascade' }),
  incidentDate: date('incident_date').notNull(),
  incidentTimeLocal: time('incident_time_local'),
  attackMethod: attackMethodEnum('attack_method').notNull(),
  weaponModelClaimed: text('weapon_model_claimed'),
  weaponModelConfidence: methodConfidenceEnum('weapon_model_confidence').notNull().default('unknown'),
  methodConfidence: methodConfidenceEnum('method_confidence').notNull().default('medium'),
  casualtiesKilled: integer('casualties_killed'),
  casualtiesInjured: integer('casualties_injured'),
  fireConfirmed: boolean('fire_confirmed'),
  physicalDamageScore: smallint('physical_damage_score').notNull(),
  damageSummary: text('damage_summary').notNull(),
  damagedAssets: text('damaged_assets').array().notNull().default(sql`'{}'`),
  operationalEffect: text('operational_effect').notNull(),
  downtimeDays: integer('downtime_days'),
  downtimeIsEstimate: boolean('downtime_is_estimate').notNull().default(true),
  confidenceScore: smallint('confidence_score').notNull(),
  verificationStatus: verificationStatusEnum('verification_status').notNull(),
  claimedBy: text('claimed_by'),
  established: text('established').array().notNull().default(sql`'{}'`),
  unresolved: text('unresolved').array().notNull().default(sql`'{}'`),
  lastReviewed: date('last_reviewed').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const incidentSources = pgTable(
  'incident_sources',
  {
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.incidentId, t.sourceId] }) }),
);

export const operationalStatusHistory = pgTable('operational_status_history', {
  id: text('id').primaryKey(),
  facilityId: text('facility_id')
    .notNull()
    .references(() => facilities.id, { onDelete: 'cascade' }),
  incidentId: text('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
  status: operationalStatusEnum('status').notNull(),
  statusDate: date('status_date').notNull(),
  capacityEstimatePercent: numeric('capacity_estimate_percent'),
  evidenceType: text('evidence_type').notNull(),
  determination: text('determination').notNull(),
  confidenceScore: smallint('confidence_score').notNull(),
  notes: text('notes').notNull().default(''),
});

export const statusSources = pgTable(
  'status_sources',
  {
    statusId: text('status_id')
      .notNull()
      .references(() => operationalStatusHistory.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.statusId, t.sourceId] }) }),
);

export const damageEstimates = pgTable('damage_estimates', {
  id: text('id').primaryKey(),
  facilityId: text('facility_id')
    .notNull()
    .references(() => facilities.id, { onDelete: 'cascade' }),
  incidentId: text('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
  estimateType: damageEstimateTypeEnum('estimate_type').notNull(),
  scope: estimateScopeEnum('scope').notNull().default('facility'),
  currency: text('currency').notNull(),
  directDamageMin: numeric('direct_damage_min'),
  directDamageMax: numeric('direct_damage_max'),
  lostRevenueMin: numeric('lost_revenue_min'),
  lostRevenueMax: numeric('lost_revenue_max'),
  repairCostMin: numeric('repair_cost_min'),
  repairCostMax: numeric('repair_cost_max'),
  downtimeCostMin: numeric('downtime_cost_min'),
  downtimeCostMax: numeric('downtime_cost_max'),
  insuranceCoverage: numeric('insurance_coverage'),
  usdAtIncidentDateMin: numeric('usd_at_incident_date_min'),
  usdAtIncidentDateMax: numeric('usd_at_incident_date_max'),
  usdConstantMin: numeric('usd_constant_min'),
  usdConstantMax: numeric('usd_constant_max'),
  estimateDate: date('estimate_date'),
  methodology: text('methodology').notNull(),
  assumptions: text('assumptions').array().notNull().default(sql`'{}'`),
  confidenceScore: smallint('confidence_score').notNull(),
});

export const estimateSources = pgTable(
  'estimate_sources',
  {
    estimateId: text('estimate_id')
      .notNull()
      .references(() => damageEstimates.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.estimateId, t.sourceId] }) }),
);

export const claims = pgTable('claims', {
  id: text('id').primaryKey(),
  sourceId: text('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  facilityId: text('facility_id')
    .notNull()
    .references(() => facilities.id, { onDelete: 'cascade' }),
  incidentId: text('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
  claimType: text('claim_type').notNull(),
  claimText: text('claim_text').notNull(),
  stance: claimStanceEnum('stance').notNull(),
  confidenceScore: smallint('confidence_score').notNull(),
});

export const media = pgTable('media', {
  id: text('id').primaryKey(),
  facilityId: text('facility_id')
    .notNull()
    .references(() => facilities.id, { onDelete: 'cascade' }),
  incidentId: text('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
  mediaType: text('media_type').notNull(),
  provider: text('provider').notNull(),
  captureDate: date('capture_date'),
  url: text('url').notNull(),
  license: text('license').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  beforeOrAfter: text('before_or_after').notNull(),
  caption: text('caption').notNull(),
  interpretationLimits: text('interpretation_limits'),
  resolutionMetres: numeric('resolution_metres'),
});

export const editors = pgTable('editors', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviewQueue = pgTable('review_queue', {
  id: text('id').primaryKey(),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull(),
  headline: text('headline').notNull(),
  url: text('url').notNull(),
  publisher: text('publisher').notNull(),
  detectedFacilityName: text('detected_facility_name'),
  matchedFacilityId: text('matched_facility_id').references(() => facilities.id, { onDelete: 'set null' }),
  detectedDate: date('detected_date'),
  detectedMethod: attackMethodEnum('detected_method'),
  stage: reviewStageEnum('stage').notNull().default('detected'),
  blockedReason: text('blocked_reason'),
  notes: text('notes').notNull().default(''),
  approvedBy: text('approved_by').references(() => editors.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
});

export const facilityDuplicates = pgTable('facility_duplicates', {
  facilityId: text('facility_id')
    .notNull()
    .references(() => facilities.id, { onDelete: 'cascade' }),
  duplicateOf: text('duplicate_of').references(() => facilities.id, { onDelete: 'set null' }),
  candidateName: text('candidate_name').notNull(),
  resolution: text('resolution').notNull(),
  rationale: text('rationale').notNull(),
  resolvedBy: text('resolved_by').references(() => editors.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});
