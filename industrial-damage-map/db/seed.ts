/**
 * Loads the version-controlled dataset in ./data into Postgres.
 *
 * The seed is a full replace inside one transaction: the file tree is the
 * source of truth for content, the database is the query surface. Quality
 * control runs FIRST and refuses to seed if any error-severity finding exists,
 * so a database can never end up holding records the editorial rules reject.
 */
import { Pool } from 'pg';
import { DATASET, DUPLICATE_RESOLUTIONS } from '../data/index';
import { runQualityControl, summariseFindings } from '../lib/qc';

const TABLES_IN_DELETE_ORDER = [
  'facility_duplicates',
  'moderation_log',
  'revisions',
  'review_queue',
  'media',
  'claims',
  'estimate_sources',
  'damage_estimates',
  'status_sources',
  'operational_status_history',
  'incident_sources',
  'incidents',
  'facilities',
  'sources',
  'tags',
  'regions',
  'industries',
  'editors',
];

export async function runSeed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const findings = runQualityControl(DATASET, { duplicateResolutions: DUPLICATE_RESOLUTIONS });
  const summary = summariseFindings(findings);
  console.log(
    `[seed] quality control: ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.info} info`,
  );
  if (summary.errors > 0) {
    for (const f of findings.filter((f) => f.severity === 'error').slice(0, 40)) {
      console.error(`  [${f.rule}] ${f.entity}: ${f.message}`);
    }
    throw new Error('Refusing to seed: the dataset has quality-control errors.');
  }

  const pool = new Pool({ connectionString: url, max: 2 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const table of TABLES_IN_DELETE_ORDER) {
      await client.query(`DELETE FROM ${table}`);
    }

    for (const i of DATASET.industries) {
      await client.query(
        `INSERT INTO industries (id, name, name_ru, color, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [i.id, i.name, i.nameRu, i.color, i.sortOrder],
      );
    }

    for (const r of DATASET.regions) {
      await client.query(
        `INSERT INTO regions (id, name, name_ru, federal_district, territory_status) VALUES ($1,$2,$3,$4,$5)`,
        [r.id, r.name, r.nameRu, r.federalDistrict, r.territoryStatus],
      );
    }

    const allTags = new Set(DATASET.facilities.flatMap((f) => f.tags));
    for (const tag of allTags) {
      await client.query(`INSERT INTO tags (id, description) VALUES ($1,$2)`, [tag, '']);
    }

    for (const s of DATASET.sources) {
      await client.query(
        `INSERT INTO sources (id, title, publisher, url, publication_date, tier, kind, language, archived_url, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [s.id, s.title, s.publisher, s.url, s.publicationDate, s.tier, s.kind, s.language, s.archivedUrl ?? null, s.notes ?? null],
      );
    }

    for (const f of DATASET.facilities) {
      await client.query(
        `INSERT INTO facilities (
           id, slug, canonical_name, canonical_name_ru, alternative_names, legal_entity, parent_company,
           industry_id, subindustry, site_category, region_id, locality, public_address,
           latitude, longitude, geom, coordinate_precision, territory_status,
           facility_area_hectares, prewar_employees, prewar_revenue_usd, nameplate_capacity,
           description, inclusion_rationale, tags, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                 ST_SetSRID(ST_MakePoint($15,$14), 4326),
                 $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          f.id,
          f.slug,
          f.canonicalName,
          f.canonicalNameRu,
          f.alternativeNames,
          f.legalEntity,
          f.parentCompany,
          f.industryId,
          f.subindustry,
          f.siteCategory,
          f.regionId,
          f.locality,
          f.publicAddress,
          f.latitude,
          f.longitude,
          f.coordinatePrecision,
          f.territoryStatus,
          f.facilityAreaHectares ?? null,
          f.prewarEmployees ?? null,
          f.prewarRevenueUsd ?? null,
          f.nameplateCapacity ?? null,
          f.description,
          f.inclusionRationale,
          f.tags,
          f.createdAt,
          f.updatedAt,
        ],
      );
    }

    for (const i of DATASET.incidents) {
      await client.query(
        `INSERT INTO incidents (
           id, facility_id, incident_date, incident_time_local, attack_method,
           weapon_model_claimed, weapon_model_confidence, method_confidence,
           casualties_killed, casualties_injured, fire_confirmed,
           physical_damage_score, damage_summary, damaged_assets, operational_effect,
           downtime_days, downtime_is_estimate, confidence_score, verification_status,
           claimed_by, established, unresolved, last_reviewed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          i.id,
          i.facilityId,
          i.incidentDate,
          i.incidentTimeLocal ?? null,
          i.attackMethod,
          i.weaponModelClaimed ?? null,
          i.weaponModelConfidence,
          i.methodConfidence,
          i.casualtiesKilled ?? null,
          i.casualtiesInjured ?? null,
          i.fireConfirmed,
          i.physicalDamageScore,
          i.damageSummary,
          i.damagedAssets,
          i.operationalEffect,
          i.downtimeDays ?? null,
          i.downtimeIsEstimate,
          i.confidence,
          i.verificationStatus,
          i.claimedBy ?? null,
          i.established,
          i.unresolved,
          i.lastReviewed,
        ],
      );
      for (const sourceId of i.sourceIds) {
        await client.query(
          `INSERT INTO incident_sources (incident_id, source_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [i.id, sourceId],
        );
      }
    }

    for (const s of DATASET.statusHistory) {
      await client.query(
        `INSERT INTO operational_status_history (
           id, facility_id, incident_id, status, status_date, capacity_estimate_percent,
           evidence_type, determination, confidence_score, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          s.id,
          s.facilityId,
          s.incidentId ?? null,
          s.status,
          s.statusDate,
          s.capacityEstimatePercent ?? null,
          s.evidenceType,
          s.determination,
          s.confidence,
          s.notes,
        ],
      );
      for (const sourceId of s.sourceIds) {
        await client.query(
          `INSERT INTO status_sources (status_id, source_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [s.id, sourceId],
        );
      }
    }

    for (const d of DATASET.damageEstimates) {
      await client.query(
        `INSERT INTO damage_estimates (
           id, facility_id, incident_id, estimate_type, scope, currency,
           direct_damage_min, direct_damage_max, lost_revenue_min, lost_revenue_max,
           repair_cost_min, repair_cost_max, downtime_cost_min, downtime_cost_max,
           insurance_coverage, usd_at_incident_date_min, usd_at_incident_date_max,
           usd_constant_min, usd_constant_max, estimate_date, methodology, assumptions, confidence_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          d.id,
          d.facilityId,
          d.incidentId ?? null,
          d.estimateType,
          d.scope,
          d.currency,
          d.directDamageMin ?? null,
          d.directDamageMax ?? null,
          d.lostRevenueMin ?? null,
          d.lostRevenueMax ?? null,
          d.repairCostMin ?? null,
          d.repairCostMax ?? null,
          d.downtimeCostMin ?? null,
          d.downtimeCostMax ?? null,
          d.insuranceCoverage ?? null,
          d.usdAtIncidentDateMin ?? null,
          d.usdAtIncidentDateMax ?? null,
          d.usdConstantMin ?? null,
          d.usdConstantMax ?? null,
          d.estimateDate,
          d.methodology,
          d.assumptions,
          d.confidence,
        ],
      );
      for (const sourceId of d.sourceIds) {
        await client.query(
          `INSERT INTO estimate_sources (estimate_id, source_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [d.id, sourceId],
        );
      }
    }

    for (const c of DATASET.claims) {
      await client.query(
        `INSERT INTO claims (id, source_id, facility_id, incident_id, claim_type, claim_text, stance, confidence_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [c.id, c.sourceId, c.facilityId, c.incidentId ?? null, c.claimType, c.claimText, c.stance, c.confidence],
      );
    }

    for (const m of DATASET.media) {
      await client.query(
        `INSERT INTO media (
           id, facility_id, incident_id, media_type, provider, capture_date, url, license,
           thumbnail_url, before_or_after, caption, interpretation_limits, resolution_metres)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          m.id,
          m.facilityId,
          m.incidentId ?? null,
          m.mediaType,
          m.provider,
          m.captureDate,
          m.url,
          m.license,
          m.thumbnailUrl ?? null,
          m.beforeOrAfter,
          m.caption,
          m.interpretationLimits ?? null,
          m.resolutionMetres ?? null,
        ],
      );
    }

    // The review queue is loaded but nothing in it is ever published by code.
    for (const q of DATASET.reviewQueue) {
      await client.query(
        `INSERT INTO review_queue (
           id, discovered_at, headline, url, publisher, detected_facility_name,
           matched_facility_id, detected_date, detected_method, stage, blocked_reason, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          q.id,
          q.discoveredAt,
          q.headline,
          q.url,
          q.publisher,
          q.detectedFacilityName,
          q.matchedFacilityId,
          q.detectedDate,
          q.detectedMethod,
          q.stage,
          q.blockedReason,
          q.notes,
        ],
      );
    }

    // Duplicate-candidate decisions: the audit trail for "we looked at these
    // two records and concluded X".
    for (const r of DUPLICATE_RESOLUTIONS) {
      await client.query(
        `INSERT INTO facility_duplicates (facility_id, duplicate_of, candidate_name, resolution, rationale, resolved_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          r.facilityId,
          r.resolution === 'merged' ? null : r.otherFacilityId,
          r.otherFacilityId,
          r.resolution,
          r.rationale,
          r.resolvedAt,
        ],
      );
    }

    await client.query('COMMIT');
    console.log(
      `[seed] loaded ${DATASET.facilities.length} facilities, ${DATASET.incidents.length} incidents, ` +
        `${DATASET.sources.length} sources, ${DATASET.reviewQueue.length} queued candidates`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Allow direct execution: `tsx db/seed.ts`
const invokedDirectly = process.argv[1]?.includes('seed');
if (invokedDirectly) {
  runSeed().catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
}
