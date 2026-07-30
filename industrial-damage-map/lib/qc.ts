import type {
  Dataset,
  FacilityRecord,
  IncidentRecord,
  SourceRecord,
  SourceTier,
} from '@/data/types';
import { datasetSchema } from './schemas';

/**
 * Editorial quality-control engine.
 *
 * Structural validity is Zod's job (lib/schemas.ts). This module enforces the
 * *editorial* rules from METHODOLOGY.md §23 — the ones that encode judgement,
 * not shape. Every rule returns findings rather than throwing, so a report can
 * show all problems at once.
 */

export const WAR_START = '2022-02-24';
export const EMBARGO_HOURS = 72;

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  rule: string;
  severity: Severity;
  entity: string;
  message: string;
}

/** Statuses that assert a recovery and therefore need a date and a source. */
const RECOVERY_STATUSES = new Set(['partially_restored', 'fully_restored', 'normal_operations']);

/** Verification statuses that are allowed into headline totals. */
export const PUBLISHED_VERIFICATION = new Set(['verified', 'corroborated', 'disputed']);

export function isPublished(incident: IncidentRecord): boolean {
  return PUBLISHED_VERIFICATION.has(incident.verificationStatus);
}

function bestTier(sources: SourceRecord[]): SourceTier | null {
  if (sources.some((s) => s.tier === 'A')) return 'A';
  if (sources.some((s) => s.tier === 'B')) return 'B';
  if (sources.some((s) => s.tier === 'C')) return 'C';
  return null;
}

/** Normalise a facility name for duplicate detection. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[«»"'’(),.]/g, '')
    .replace(/\b(ooo|oao|zao|pao|ao|fkp|llc|jsc|plc|inc)\b/g, '')
    .replace(/\b(refinery|npz|plant|zavod|works|complex|combine|kombinat)\b/g, '')
    .replace(/[^a-z0-9а-яё ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export interface QcOptions {
  /** Build date used for the 72-hour embargo check. Defaults to dataset.generatedAt. */
  asOf?: string;
  /**
   * Duplicate-candidate pairs already investigated. Pairs marked `distinct` or
   * `merged` stop being reported; `open` pairs keep their warning.
   */
  duplicateResolutions?: { facilityId: string; otherFacilityId: string; resolution: string }[];
}

export function runQualityControl(dataset: Dataset, options: QcOptions = {}): Finding[] {
  const findings: Finding[] = [];
  const push = (rule: string, severity: Severity, entity: string, message: string) =>
    findings.push({ rule, severity, entity, message });

  // -- 0. Structural validation -------------------------------------------
  const parsed = datasetSchema.safeParse(dataset);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 100)) {
      push('schema', 'error', issue.path.join('.') || '(root)', issue.message);
    }
  }

  const sourceById = new Map(dataset.sources.map((s) => [s.id, s]));
  const facilityById = new Map(dataset.facilities.map((f) => [f.id, f]));
  const incidentById = new Map(dataset.incidents.map((i) => [i.id, i]));
  const industryIds = new Set(dataset.industries.map((i) => i.id));
  const regionById = new Map(dataset.regions.map((r) => [r.id, r]));

  // -- 1. Unique identifiers ----------------------------------------------
  for (const [label, ids] of [
    ['facility', dataset.facilities.map((f) => f.id)],
    ['facility-slug', dataset.facilities.map((f) => f.slug)],
    ['incident', dataset.incidents.map((i) => i.id)],
    ['source', dataset.sources.map((s) => s.id)],
    ['claim', dataset.claims.map((c) => c.id)],
    ['media', dataset.media.map((m) => m.id)],
    ['estimate', dataset.damageEstimates.map((d) => d.id)],
    ['status', dataset.statusHistory.map((s) => s.id)],
  ] as const) {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) push('unique-id', 'error', `${label}:${id}`, `Duplicate ${label} identifier.`);
      seen.add(id);
    }
  }

  // -- 2. Referential integrity -------------------------------------------
  const checkSources = (entity: string, ids: string[]) => {
    for (const id of ids) {
      if (!sourceById.has(id)) push('referential-integrity', 'error', entity, `Unknown source id "${id}".`);
    }
  };

  for (const f of dataset.facilities) {
    if (!industryIds.has(f.industryId))
      push('referential-integrity', 'error', `facility:${f.id}`, `Unknown industry "${f.industryId}".`);
    if (!regionById.has(f.regionId))
      push('referential-integrity', 'error', `facility:${f.id}`, `Unknown region "${f.regionId}".`);
  }

  for (const i of dataset.incidents) {
    if (!facilityById.has(i.facilityId))
      push('referential-integrity', 'error', `incident:${i.id}`, `Unknown facility "${i.facilityId}".`);
    checkSources(`incident:${i.id}`, i.sourceIds);
  }
  for (const s of dataset.statusHistory) {
    if (!facilityById.has(s.facilityId))
      push('referential-integrity', 'error', `status:${s.id}`, `Unknown facility "${s.facilityId}".`);
    if (s.incidentId && !incidentById.has(s.incidentId))
      push('referential-integrity', 'error', `status:${s.id}`, `Unknown incident "${s.incidentId}".`);
    checkSources(`status:${s.id}`, s.sourceIds);
  }
  for (const d of dataset.damageEstimates) {
    if (!facilityById.has(d.facilityId))
      push('referential-integrity', 'error', `estimate:${d.id}`, `Unknown facility "${d.facilityId}".`);
    if (d.incidentId && !incidentById.has(d.incidentId))
      push('referential-integrity', 'error', `estimate:${d.id}`, `Unknown incident "${d.incidentId}".`);
    checkSources(`estimate:${d.id}`, d.sourceIds);
  }
  for (const c of dataset.claims) {
    if (!sourceById.has(c.sourceId))
      push('referential-integrity', 'error', `claim:${c.id}`, `Unknown source "${c.sourceId}".`);
    if (!facilityById.has(c.facilityId))
      push('referential-integrity', 'error', `claim:${c.id}`, `Unknown facility "${c.facilityId}".`);
    if (c.incidentId && !incidentById.has(c.incidentId))
      push('referential-integrity', 'error', `claim:${c.id}`, `Unknown incident "${c.incidentId}".`);
  }
  for (const m of dataset.media) {
    if (!facilityById.has(m.facilityId))
      push('referential-integrity', 'error', `media:${m.id}`, `Unknown facility "${m.facilityId}".`);
    if (m.incidentId && !incidentById.has(m.incidentId))
      push('referential-integrity', 'error', `media:${m.id}`, `Unknown incident "${m.incidentId}".`);
  }

  // -- 3. No incident may precede 24 February 2022 ------------------------
  for (const i of dataset.incidents) {
    if (i.incidentDate < WAR_START)
      push(
        'war-start-boundary',
        'error',
        `incident:${i.id}`,
        `Incident date ${i.incidentDate} precedes ${WAR_START}; out of scope.`,
      );
  }

  // -- 4. 72-hour embargo --------------------------------------------------
  const asOf = options.asOf ?? dataset.generatedAt;
  const embargoDays = EMBARGO_HOURS / 24;
  for (const i of dataset.incidents) {
    if (!isPublished(i)) continue;
    const age = daysBetween(i.incidentDate, asOf);
    if (age < embargoDays)
      push(
        'embargo-72h',
        'error',
        `incident:${i.id}`,
        `Published incident dated ${i.incidentDate} is only ${age} day(s) before the build date ${asOf}; the 72-hour embargo requires ${embargoDays}.`,
      );
  }

  // -- 5. Corroboration rules ---------------------------------------------
  //
  // METHODOLOGY.md §23 states: a published incident needs two sources, or one
  // tier-A source. Two refinements are applied, both documented there:
  //
  //  (a) INDEPENDENCE. Outlets republishing the same wire report are ONE
  //      source, not several. `syndicatedFrom` collapses them.
  //  (b) SCOPE. The bar applies to records that actually assert damage
  //      (score >= 3). A score-0 record asserts no damage, and a score 1–2
  //      record backed by a single credible outlet is published with a
  //      visible single-source flag rather than suppressed.
  //
  // Dated satellite imagery from a named provider independently satisfies the
  // bar — METHODOLOGY.md §7 treats before/after imagery as high-confidence
  // evidence in its own right.
  const satelliteByIncident = new Set(
    dataset.media.filter((m) => m.mediaType === 'satellite' && m.captureDate && m.incidentId).map((m) => m.incidentId),
  );

  for (const i of dataset.incidents) {
    if (!isPublished(i)) continue;
    const sources = i.sourceIds.map((id) => sourceById.get(id)).filter((s): s is SourceRecord => !!s);
    const tier = bestTier(sources);

    // Collapse syndicated republications of the same wire into one voice.
    const voices = new Set(sources.map((s) => s.syndicatedFrom ?? s.id));
    const independentCount = voices.size;
    const hasSatellite = satelliteByIncident.has(i.id);
    const meetsBar = independentCount >= 2 || tier === 'A' || hasSatellite;

    if (i.physicalDamageScore >= 3 && !meetsBar)
      push(
        'source-rule',
        'error',
        `incident:${i.id}`,
        `Damage score ${i.physicalDamageScore} rests on ${independentCount} independent source(s) (best tier ${tier ?? 'none'}) with no dated satellite imagery. Needs two independent sources, one tier-A source, or imagery.`,
      );

    if (i.physicalDamageScore > 0 && i.physicalDamageScore < 3 && !meetsBar)
      push(
        'single-source',
        'warning',
        `incident:${i.id}`,
        `Single-source record (best tier ${tier ?? 'none'}). Publishable at damage score ${i.physicalDamageScore}, but flagged in the UI as uncorroborated.`,
      );

    // Tier C alone can never carry a serious-damage or destruction claim.
    if (i.physicalDamageScore >= 4 && sources.every((s) => s.tier === 'C'))
      push(
        'tier-c-severe-damage',
        'error',
        `incident:${i.id}`,
        `Damage score ${i.physicalDamageScore} rests entirely on tier-C sources.`,
      );
  }

  // -- 6. "Destroyed" needs a high evidentiary bar ------------------------
  for (const i of dataset.incidents) {
    if (i.physicalDamageScore !== 5) continue;
    if (i.verificationStatus !== 'verified')
      push(
        'destroyed-evidence-bar',
        'error',
        `incident:${i.id}`,
        'A damage score of 5 (destruction of the main production site) requires verification status "verified".',
      );
    if (i.confidence < 75)
      push(
        'destroyed-evidence-bar',
        'error',
        `incident:${i.id}`,
        `A damage score of 5 requires confidence >= 75; found ${i.confidence}.`,
      );
  }
  for (const s of dataset.statusHistory) {
    if (s.status === 'destroyed' && s.determination !== 'direct_confirmation')
      push(
        'destroyed-evidence-bar',
        'error',
        `status:${s.id}`,
        'Status "destroyed" may not rest on an analytical assessment.',
      );
  }

  // -- 7. Recovery claims need a date and a source ------------------------
  for (const s of dataset.statusHistory) {
    if (!RECOVERY_STATUSES.has(s.status)) continue;
    if (!s.statusDate)
      push('recovery-evidence', 'error', `status:${s.id}`, 'A recovery status must carry a date.');
    if (s.sourceIds.length === 0)
      push('recovery-evidence', 'error', `status:${s.id}`, 'A recovery status must cite at least one source.');
  }

  // -- 8. Financial estimates need a methodology --------------------------
  for (const d of dataset.damageEstimates) {
    if (!d.methodology || d.methodology.trim().length < 20)
      push('estimate-methodology', 'error', `estimate:${d.id}`, 'Financial estimate lacks a usable methodology note.');
    if (d.estimateType === 'model_estimate' && (d.assumptions?.length ?? 0) === 0)
      push(
        'estimate-assumptions',
        'error',
        `estimate:${d.id}`,
        'A model estimate must list its assumptions so a reader can see them.',
      );
    const pairs: [string, number | null | undefined, number | null | undefined][] = [
      ['directDamage', d.directDamageMin, d.directDamageMax],
      ['lostRevenue', d.lostRevenueMin, d.lostRevenueMax],
      ['repairCost', d.repairCostMin, d.repairCostMax],
      ['downtimeCost', d.downtimeCostMin, d.downtimeCostMax],
      ['usdAtIncidentDate', d.usdAtIncidentDateMin, d.usdAtIncidentDateMax],
      ['usdConstant', d.usdConstantMin, d.usdConstantMax],
    ];
    for (const [label, min, max] of pairs) {
      if (min != null && max != null && min > max)
        push('estimate-range', 'error', `estimate:${d.id}`, `${label}: min exceeds max.`);
    }
  }

  // -- 9. Coordinates and precision ---------------------------------------
  for (const f of dataset.facilities) {
    const region = regionById.get(f.regionId);
    if (region && region.territoryStatus !== f.territoryStatus)
      push(
        'territory-consistency',
        'error',
        `facility:${f.id}`,
        `Facility territory status "${f.territoryStatus}" disagrees with region "${f.regionId}" (${region.territoryStatus}).`,
      );
    // Precision must never be finer than what the sourcing supports.
    if (f.coordinatePrecision === 'exact_public_address' && !f.publicAddress)
      push(
        'coordinate-precision',
        'error',
        `facility:${f.id}`,
        'Precision "exact_public_address" requires a publicAddress to be recorded.',
      );
  }

  // -- 10. URL validity ----------------------------------------------------
  for (const s of dataset.sources) {
    try {
      const url = new URL(s.url);
      if (url.protocol !== 'https:' && url.protocol !== 'http:')
        push('source-url', 'error', `source:${s.id}`, `Unsupported URL scheme "${url.protocol}".`);
    } catch {
      push('source-url', 'error', `source:${s.id}`, `Malformed URL "${s.url}".`);
    }
    if (!s.archivedUrl)
      push(
        'source-archive',
        'info',
        `source:${s.id}`,
        'No web-archive snapshot recorded. Archive where the publisher and the archive service both permit it.',
      );
  }

  // -- 11. Duplicate facility detection -----------------------------------
  const byNormalised = new Map<string, FacilityRecord[]>();
  for (const f of dataset.facilities) {
    for (const name of [f.canonicalName, ...f.alternativeNames]) {
      const key = normaliseName(name);
      if (!key) continue;
      const bucket = byNormalised.get(key) ?? [];
      if (!bucket.includes(f)) bucket.push(f);
      byNormalised.set(key, bucket);
    }
  }
  // Pairs already investigated and closed do not need to keep shouting.
  const reportedPairs = new Set<string>(
    (options.duplicateResolutions ?? [])
      .filter((r) => r.resolution !== 'open')
      .map((r) => [r.facilityId, r.otherFacilityId].sort().join('|')),
  );
  for (const [key, group] of byNormalised) {
    if (group.length < 2) continue;
    for (let a = 0; a < group.length; a += 1) {
      for (let b = a + 1; b < group.length; b += 1) {
        const pair = [group[a].id, group[b].id].sort().join('|');
        if (reportedPairs.has(pair)) continue;
        reportedPairs.add(pair);
        push(
          'possible-duplicate',
          'warning',
          `facility:${group[a].id}`,
          `Name "${key}" also matches facility ${group[b].id}. Confirm these are distinct sites or merge them.`,
        );
      }
    }
  }
  // Geographic near-duplicates: same region, within ~2 km.
  for (let a = 0; a < dataset.facilities.length; a += 1) {
    for (let b = a + 1; b < dataset.facilities.length; b += 1) {
      const x = dataset.facilities[a];
      const y = dataset.facilities[b];
      if (x.regionId !== y.regionId) continue;
      const dLat = (x.latitude - y.latitude) * 111;
      const dLon = (x.longitude - y.longitude) * 111 * Math.cos((x.latitude * Math.PI) / 180);
      const km = Math.hypot(dLat, dLon);
      if (km < 2) {
        const pair = [x.id, y.id].sort().join('|');
        if (reportedPairs.has(pair)) continue;
        reportedPairs.add(pair);
        push(
          'possible-duplicate',
          'warning',
          `facility:${x.id}`,
          `Sits ${km.toFixed(2)} km from ${y.id}. Confirm these are separate enterprises.`,
        );
      }
    }
  }

  // -- 12. Every facility must carry at least one incident ----------------
  const incidentsByFacility = new Map<string, IncidentRecord[]>();
  for (const i of dataset.incidents) {
    const bucket = incidentsByFacility.get(i.facilityId) ?? [];
    bucket.push(i);
    incidentsByFacility.set(i.facilityId, bucket);
  }
  for (const f of dataset.facilities) {
    if (!incidentsByFacility.has(f.id))
      push(
        'orphan-facility',
        'error',
        `facility:${f.id}`,
        'Facility has no incidents. A facility exists only because damage was reported.',
      );
  }

  // -- 13. Unconfirmed records must not be mistaken for findings ----------
  for (const i of dataset.incidents) {
    if (i.verificationStatus !== 'unconfirmed') continue;
    if (i.physicalDamageScore > 0)
      push(
        'unconfirmed-damage-score',
        'error',
        `incident:${i.id}`,
        'An unconfirmed incident may not assert a damage score above 0.',
      );
    if (i.confidence >= 40)
      push(
        'unconfirmed-confidence',
        'warning',
        `incident:${i.id}`,
        `Confidence ${i.confidence} is at or above the 40-point threshold but the record is marked unconfirmed. Reconcile the two.`,
      );
  }

  // -- 14. Confidence bands must match verification status ----------------
  for (const i of dataset.incidents) {
    const c = i.confidence;
    if (i.verificationStatus === 'verified' && c < 60)
      push(
        'confidence-band',
        'warning',
        `incident:${i.id}`,
        `Marked verified but confidence is ${c}. The verified band starts at 60.`,
      );
    if (i.verificationStatus === 'corroborated' && (c < 40 || c > 89))
      push(
        'confidence-band',
        'warning',
        `incident:${i.id}`,
        `Marked corroborated but confidence is ${c}; expected 40–89.`,
      );
  }

  // -- 15. Every published incident must state what is established --------
  for (const i of dataset.incidents) {
    if (!isPublished(i)) continue;
    if (i.established.length === 0)
      push(
        'established-facts',
        'warning',
        `incident:${i.id}`,
        'No "what is established" entries. Readers cannot tell what the record actually asserts.',
      );
    if (i.unresolved.length === 0)
      push(
        'unresolved-facts',
        'info',
        `incident:${i.id}`,
        'No "what remains unresolved" entries. Almost every OSINT record has open questions.',
      );
  }

  // -- 16. Media licensing -------------------------------------------------
  for (const m of dataset.media) {
    if (m.thumbnailUrl && !/permit|cc |public domain|open|licen[cs]e granted/i.test(m.license))
      push(
        'media-licence',
        'error',
        `media:${m.id}`,
        'A hosted thumbnail is set but the licence text does not positively permit redistribution.',
      );
    if (m.mediaType === 'satellite' && !m.captureDate)
      push('media-capture-date', 'error', `media:${m.id}`, 'Satellite imagery must record a capture date.');
    if (m.mediaType === 'satellite' && !m.interpretationLimits)
      push(
        'media-interpretation',
        'warning',
        `media:${m.id}`,
        'Satellite imagery should state what a reader can and cannot conclude from it.',
      );
  }

  return findings;
}

export function summariseFindings(findings: Finding[]) {
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
    total: findings.length,
  };
}
