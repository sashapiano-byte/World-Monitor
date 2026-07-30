import type { Dataset } from '@/data/types';
import type { FacilityView } from './dataset';
import { getDataset } from './dataset';
import { presentRange } from './fx';

/**
 * Analytics.
 *
 * Two rules are enforced here rather than left to the UI:
 *
 *  1. FLAGGED NON-INDUSTRIAL SITES are excluded from every "industrial
 *     enterprise" headline. They are counted separately.
 *  2. OFFICIAL / INSURANCE / COMPANY figures are never summed together with
 *     ANALYST or MODEL figures. The two totals are returned separately and the
 *     UI is expected to display them apart.
 */

export interface Bucket {
  key: string;
  label: string;
  count: number;
  color?: string;
}

export interface FinancialTotals {
  /** Sum of official, insurance and company-disclosed figures only. */
  attested: { min: number; max: number; recordCount: number };
  /** Sum of analyst and project-model figures only. NEVER add to `attested`. */
  modelled: { min: number; max: number; recordCount: number };
  currency: 'USD';
  /** Estimates deliberately excluded from both totals, with the reason. */
  excluded: { estimateId: string; reason: string }[];
}

export interface Analytics {
  totals: {
    industrialFacilities: number;
    borderlineFacilities: number;
    occupiedTerritoryFacilities: number;
    publishedIncidents: number;
    unconfirmedIncidents: number;
    facilitiesWithMultipleIncidents: number;
    facilitiesCurrentlySuspended: number;
    facilitiesRecovered: number;
    fatalitiesReported: number;
    injuriesReported: number;
  };
  byIndustry: Bucket[];
  byRegion: Bucket[];
  byMethod: Bucket[];
  byStatus: Bucket[];
  byDamageScore: Bucket[];
  byConfidenceBand: Bucket[];
  incidentsByMonth: { month: string; count: number }[];
  medianDowntimeDays: number | null;
  downtimeSampleSize: number;
  mostRepeatedlyStruck: { slug: string; name: string; incidents: number }[];
  evidence: {
    withSatellite: number;
    withFinancialEstimate: number;
    satelliteSharePercent: number;
  };
  financial: FinancialTotals;
}

const CONFIDENCE_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: 'very-high', label: '90–100 · official + visual', min: 90, max: 100 },
  { key: 'high', label: '75–89 · multiple independent + visual', min: 75, max: 89 },
  { key: 'moderate', label: '60–74 · reliable, partial visual', min: 60, max: 74 },
  { key: 'low', label: '40–59 · plausible, incomplete', min: 40, max: 59 },
  { key: 'unconfirmed', label: '<40 · unconfirmed', min: 0, max: 39 },
];

const METHOD_LABELS: Record<string, string> = {
  uav: 'UAV / drone',
  cruise_missile: 'Cruise missile',
  ballistic_missile: 'Ballistic missile',
  sabotage: 'Sabotage',
  shelling: 'Shelling',
  naval_drone: 'Naval drone',
  unknown_means: 'Means not established',
};

const STATUS_LABELS: Record<string, string> = {
  normal_operations: 'Normal operations',
  operations_reduced: 'Operations reduced',
  partially_restored: 'Partially restored',
  fully_restored: 'Fully restored',
  temporarily_suspended: 'Temporarily suspended',
  long_term_shutdown: 'Long-term shutdown',
  destroyed: 'Destroyed',
  unknown: 'Status unknown',
};

const DAMAGE_LABELS: Record<number, string> = {
  0: '0 · attack nearby, no confirmed damage',
  1: '1 · minor (glazing, roofing, local fire)',
  2: '2 · a building or ancillary infrastructure',
  3: '3 · serious damage to a production building or unit',
  4: '4 · a key process unit or several shops disabled',
  5: '5 · main production site destroyed',
};

/** Estimate types that represent an attested figure rather than a model. */
const ATTESTED_TYPES = new Set(['official', 'insurance', 'company_disclosure']);
const MODELLED_TYPES = new Set(['analyst_estimate', 'model_estimate']);

export function computeAnalytics(views: FacilityView[], dataset: Dataset = getDataset()): Analytics {
  const industryById = new Map(dataset.industries.map((i) => [i.id, i]));
  const regionById = new Map(dataset.regions.map((r) => [r.id, r]));

  const industrial = views.filter((v) => v.facility.siteCategory === 'industrial');
  const borderline = views.filter((v) => v.facility.siteCategory !== 'industrial');

  const publishedIncidents = industrial.flatMap((v) => v.publishedIncidents);
  const allIncidents = industrial.flatMap((v) => v.incidents);
  const unconfirmed = allIncidents.length - publishedIncidents.length;

  const tally = (items: string[]) => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
    return map;
  };

  const industryCounts = tally(industrial.map((v) => v.facility.industryId));
  const regionCounts = tally(industrial.map((v) => v.facility.regionId));
  const methodCounts = tally(publishedIncidents.map((i) => i.attackMethod));
  const statusCounts = tally(industrial.map((v) => v.currentStatus?.status ?? 'unknown'));
  const damageCounts = tally(publishedIncidents.map((i) => String(i.physicalDamageScore)));

  const monthCounts = new Map<string, number>();
  for (const i of publishedIncidents) {
    const month = i.incidentDate.slice(0, 7);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }

  // Downtime: confirmed values only. Estimated downtimes are excluded from the
  // median so the figure means "how long plants were actually known to be down".
  const downtimes = publishedIncidents
    .filter((i) => i.downtimeDays != null && !i.downtimeIsEstimate)
    .map((i) => i.downtimeDays as number)
    .sort((a, b) => a - b);
  const medianDowntimeDays = downtimes.length
    ? downtimes.length % 2 === 1
      ? downtimes[(downtimes.length - 1) / 2]
      : (downtimes[downtimes.length / 2 - 1] + downtimes[downtimes.length / 2]) / 2
    : null;

  const withSatellite = industrial.filter((v) => v.hasSatelliteEvidence).length;

  return {
    totals: {
      industrialFacilities: industrial.length,
      borderlineFacilities: borderline.length,
      occupiedTerritoryFacilities: views.filter(
        (v) => v.facility.territoryStatus !== 'internationally_recognised_russia',
      ).length,
      publishedIncidents: publishedIncidents.length,
      unconfirmedIncidents: unconfirmed,
      facilitiesWithMultipleIncidents: industrial.filter((v) => v.publishedIncidents.length > 1).length,
      facilitiesCurrentlySuspended: industrial.filter((v) =>
        ['temporarily_suspended', 'long_term_shutdown'].includes(v.currentStatus?.status ?? ''),
      ).length,
      facilitiesRecovered: industrial.filter((v) => v.isRecovered).length,
      fatalitiesReported: publishedIncidents.reduce((sum, i) => sum + (i.casualtiesKilled ?? 0), 0),
      injuriesReported: publishedIncidents.reduce((sum, i) => sum + (i.casualtiesInjured ?? 0), 0),
    },
    byIndustry: [...industryCounts.entries()]
      .map(([key, count]) => ({
        key,
        label: industryById.get(key)?.name ?? key,
        color: industryById.get(key)?.color,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    byRegion: [...regionCounts.entries()]
      .map(([key, count]) => ({ key, label: regionById.get(key)?.name ?? key, count }))
      .sort((a, b) => b.count - a.count),
    byMethod: [...methodCounts.entries()]
      .map(([key, count]) => ({ key, label: METHOD_LABELS[key] ?? key, count }))
      .sort((a, b) => b.count - a.count),
    byStatus: [...statusCounts.entries()]
      .map(([key, count]) => ({ key, label: STATUS_LABELS[key] ?? key, count }))
      .sort((a, b) => b.count - a.count),
    byDamageScore: [0, 1, 2, 3, 4, 5].map((score) => ({
      key: String(score),
      label: DAMAGE_LABELS[score],
      count: damageCounts.get(String(score)) ?? 0,
    })),
    byConfidenceBand: CONFIDENCE_BANDS.map((band) => ({
      key: band.key,
      label: band.label,
      count: allIncidents.filter((i) => i.confidence >= band.min && i.confidence <= band.max).length,
    })),
    incidentsByMonth: [...monthCounts.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    medianDowntimeDays,
    downtimeSampleSize: downtimes.length,
    mostRepeatedlyStruck: industrial
      .slice()
      .sort((a, b) => b.publishedIncidents.length - a.publishedIncidents.length)
      .slice(0, 10)
      .map((v) => ({
        slug: v.facility.slug,
        name: v.facility.canonicalName,
        incidents: v.publishedIncidents.length,
      })),
    evidence: {
      withSatellite,
      withFinancialEstimate: industrial.filter((v) => v.hasFinancialEstimate).length,
      satelliteSharePercent: industrial.length ? Math.round((withSatellite / industrial.length) * 100) : 0,
    },
    financial: computeFinancialTotals(views),
  };
}

/**
 * Financial aggregation.
 *
 * Estimates that cover more than one facility, or that are campaign-level, are
 * EXCLUDED with an explicit reason rather than silently dropped — otherwise a
 * reader cannot tell the difference between "nothing found" and "found but not
 * summable".
 */
export function computeFinancialTotals(views: FacilityView[]): FinancialTotals {
  const attested = { min: 0, max: 0, recordCount: 0 };
  const modelled = { min: 0, max: 0, recordCount: 0 };
  const excluded: { estimateId: string; reason: string }[] = [];

  for (const view of views) {
    for (const estimate of view.estimates) {
      if (estimate.scope !== 'facility') {
        excluded.push({
          estimateId: estimate.id,
          reason:
            estimate.scope === 'campaign'
              ? 'Campaign-level total. Summing it alongside per-facility figures would double count.'
              : 'Covers more than one facility. Summing it per-facility would double count.',
        });
        continue;
      }
      if (estimate.estimateType === 'unknown') {
        excluded.push({
          estimateId: estimate.id,
          reason: 'Provenance of the figure is not established, so it belongs to neither total.',
        });
        continue;
      }

      // Take the widest USD band the record offers across all cost components.
      const components: [number | null | undefined, number | null | undefined][] = [
        [estimate.directDamageMin, estimate.directDamageMax],
        [estimate.repairCostMin, estimate.repairCostMax],
        [estimate.lostRevenueMin, estimate.lostRevenueMax],
        [estimate.downtimeCostMin, estimate.downtimeCostMax],
      ];
      let min = 0;
      let max = 0;
      for (const [cMin, cMax] of components) {
        if (cMin == null && cMax == null) continue;
        const range = presentRange({
          min: cMin,
          max: cMax,
          currency: estimate.currency,
          date: estimate.estimateDate,
          sourceUsdMin: estimate.usdAtIncidentDateMin,
          sourceUsdMax: estimate.usdAtIncidentDateMax,
        });
        min += range.usdAtDate.min ?? range.usdAtDate.max ?? 0;
        max += range.usdAtDate.max ?? range.usdAtDate.min ?? 0;
      }

      const target = ATTESTED_TYPES.has(estimate.estimateType)
        ? attested
        : MODELLED_TYPES.has(estimate.estimateType)
          ? modelled
          : null;
      if (!target) {
        excluded.push({ estimateId: estimate.id, reason: `Unhandled estimate type "${estimate.estimateType}".` });
        continue;
      }
      target.min += min;
      target.max += max;
      target.recordCount += 1;
    }
  }

  return { attested, modelled, currency: 'USD', excluded };
}

export { METHOD_LABELS, STATUS_LABELS, DAMAGE_LABELS, CONFIDENCE_BANDS };
