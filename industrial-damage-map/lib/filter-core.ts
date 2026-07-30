import type {
  ClaimRecord,
  DamageEstimateRecord,
  Dataset,
  FacilityRecord,
  IncidentRecord,
  IndustryRecord,
  MediaRecord,
  OperationalStatus,
  RegionRecord,
  SourceRecord,
  StatusChangeRecord,
} from '@/data/types';

/**
 * Pure read-model and filtering logic.
 *
 * This module deliberately imports NO dataset. It is shared by the server
 * (which reads from Postgres or the file dataset) and the browser (which
 * filters an already-delivered payload), so the two can never diverge — and so
 * the whole dataset is not dragged into the client bundle twice.
 */

export interface FacilityView {
  facility: FacilityRecord;
  incidents: IncidentRecord[];
  publishedIncidents: IncidentRecord[];
  statusHistory: StatusChangeRecord[];
  currentStatus: StatusChangeRecord | null;
  estimates: DamageEstimateRecord[];
  media: MediaRecord[];
  claims: ClaimRecord[];
  sources: SourceRecord[];
  maxDamageScore: number;
  maxConfidence: number;
  firstIncidentDate: string | null;
  lastIncidentDate: string | null;
  incidentCount: number;
  hasSatelliteEvidence: boolean;
  hasFinancialEstimate: boolean;
  isRecovered: boolean;
  confirmedDowntimeDays: number | null;
  /** True when no incident on this facility meets the corroboration bar. */
  isSingleSourceOnly: boolean;
}

/** Verification states that appear on the main map. */
export const PUBLISHED_VERIFICATION = new Set(['verified', 'corroborated', 'disputed']);

export function isPublishedIncident(incident: IncidentRecord): boolean {
  return PUBLISHED_VERIFICATION.has(incident.verificationStatus);
}

const RECOVERED_STATUSES: OperationalStatus[] = ['partially_restored', 'fully_restored', 'normal_operations'];

export interface Filters {
  from?: string;
  to?: string;
  regions?: string[];
  industries?: string[];
  methods?: string[];
  statuses?: string[];
  minDamage?: number;
  maxDamage?: number;
  minConfidence?: number;
  includeUnconfirmed?: boolean;
  includeBorderline?: boolean;
  includeOccupied?: boolean;
  hasSatellite?: boolean;
  hasFinancialEstimate?: boolean;
  recovered?: boolean;
  minIncidents?: number;
  q?: string;
}

export const DEFAULT_FILTERS: Filters = {
  includeUnconfirmed: false,
  includeBorderline: false,
  includeOccupied: true,
};

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k) ?? [];
    bucket.push(item);
    map.set(k, bucket);
  }
  return map;
}

const byDate = (a: { [k: string]: unknown }, b: { [k: string]: unknown }, key: string) =>
  String(a[key]).localeCompare(String(b[key]));

export function buildFacilityViews(dataset: Dataset): FacilityView[] {
  const sourceById = new Map(dataset.sources.map((s) => [s.id, s]));
  const incidentsByFacility = groupBy(dataset.incidents, (i) => i.facilityId);
  const statusByFacility = groupBy(dataset.statusHistory, (s) => s.facilityId);
  const estimatesByFacility = groupBy(dataset.damageEstimates, (d) => d.facilityId);
  const mediaByFacility = groupBy(dataset.media, (m) => m.facilityId);
  const claimsByFacility = groupBy(dataset.claims, (c) => c.facilityId);

  const satelliteIncidents = new Set(
    dataset.media.filter((m) => m.mediaType === 'satellite' && m.captureDate && m.incidentId).map((m) => m.incidentId),
  );

  return dataset.facilities.map((facility) => {
    const incidents = (incidentsByFacility.get(facility.id) ?? [])
      .slice()
      .sort((a, b) => byDate(a as never, b as never, 'incidentDate'));
    const publishedIncidents = incidents.filter(isPublishedIncident);
    const statusHistory = (statusByFacility.get(facility.id) ?? [])
      .slice()
      .sort((a, b) => byDate(a as never, b as never, 'statusDate'));
    const estimates = estimatesByFacility.get(facility.id) ?? [];
    const mediaItems = mediaByFacility.get(facility.id) ?? [];
    const claims = claimsByFacility.get(facility.id) ?? [];

    const sourceIds = new Set<string>();
    for (const i of incidents) i.sourceIds.forEach((id) => sourceIds.add(id));
    for (const s of statusHistory) s.sourceIds.forEach((id) => sourceIds.add(id));
    for (const d of estimates) d.sourceIds.forEach((id) => sourceIds.add(id));
    for (const c of claims) sourceIds.add(c.sourceId);

    const currentStatus = statusHistory.length ? statusHistory[statusHistory.length - 1] : null;
    const downtimes = publishedIncidents
      .filter((i) => i.downtimeDays != null && !i.downtimeIsEstimate)
      .map((i) => i.downtimeDays as number);

    // A record is "single-source only" when no published incident on it reaches
    // the corroboration bar. Surfaced in the UI so the caveat travels with it.
    const meetsBar = (i: IncidentRecord) => {
      const sources = i.sourceIds.map((id) => sourceById.get(id)).filter((s): s is SourceRecord => !!s);
      const voices = new Set(sources.map((s) => s.syndicatedFrom ?? s.id));
      return voices.size >= 2 || sources.some((s) => s.tier === 'A') || satelliteIncidents.has(i.id);
    };

    return {
      facility,
      incidents,
      publishedIncidents,
      statusHistory,
      currentStatus,
      estimates,
      media: mediaItems,
      claims,
      sources: [...sourceIds].map((id) => sourceById.get(id)).filter((s): s is SourceRecord => !!s),
      maxDamageScore: publishedIncidents.reduce((m, i) => Math.max(m, i.physicalDamageScore), 0),
      maxConfidence: publishedIncidents.reduce((m, i) => Math.max(m, i.confidence), 0),
      firstIncidentDate: incidents[0]?.incidentDate ?? null,
      lastIncidentDate: incidents[incidents.length - 1]?.incidentDate ?? null,
      incidentCount: publishedIncidents.length,
      hasSatelliteEvidence: mediaItems.some((m) => m.mediaType === 'satellite'),
      hasFinancialEstimate: estimates.length > 0,
      isRecovered: currentStatus ? RECOVERED_STATUSES.includes(currentStatus.status) : false,
      confirmedDowntimeDays: downtimes.length ? downtimes.reduce((a, b) => a + b, 0) : null,
      isSingleSourceOnly: publishedIncidents.length > 0 && !publishedIncidents.some(meetsBar),
    };
  });
}

/**
 * Apply the filter set.
 *
 * Two defaults are editorial positions, not UI convenience:
 *   - unconfirmed incidents are HIDDEN unless explicitly requested;
 *   - flagged non-industrial sites are HIDDEN unless explicitly requested.
 */
export function applyFilters(views: FacilityView[], filter: Filters): FacilityView[] {
  const q = filter.q?.trim().toLowerCase();

  return views
    .map((view) => {
      let incidents = filter.includeUnconfirmed ? view.incidents : view.publishedIncidents;
      if (filter.from) incidents = incidents.filter((i) => i.incidentDate >= filter.from!);
      if (filter.to) incidents = incidents.filter((i) => i.incidentDate <= filter.to!);
      if (filter.methods?.length) incidents = incidents.filter((i) => filter.methods!.includes(i.attackMethod));
      if (filter.minDamage != null) incidents = incidents.filter((i) => i.physicalDamageScore >= filter.minDamage!);
      if (filter.maxDamage != null) incidents = incidents.filter((i) => i.physicalDamageScore <= filter.maxDamage!);
      if (filter.minConfidence != null) incidents = incidents.filter((i) => i.confidence >= filter.minConfidence!);
      return { ...view, incidents };
    })
    .filter((view) => {
      if (view.incidents.length === 0) return false;

      const f = view.facility;
      if (!filter.includeBorderline && f.siteCategory !== 'industrial') return false;
      if (filter.includeOccupied === false && f.territoryStatus !== 'internationally_recognised_russia') return false;
      if (filter.regions?.length && !filter.regions.includes(f.regionId)) return false;
      if (filter.industries?.length && !filter.industries.includes(f.industryId)) return false;
      if (filter.statuses?.length && !filter.statuses.includes(view.currentStatus?.status ?? 'unknown')) return false;
      if (filter.hasSatellite != null && view.hasSatelliteEvidence !== filter.hasSatellite) return false;
      if (filter.hasFinancialEstimate != null && view.hasFinancialEstimate !== filter.hasFinancialEstimate) return false;
      if (filter.recovered != null && view.isRecovered !== filter.recovered) return false;
      if (filter.minIncidents != null && view.incidents.length < filter.minIncidents) return false;

      if (q) {
        const haystack = [
          f.canonicalName,
          f.canonicalNameRu,
          ...f.alternativeNames,
          f.locality,
          f.legalEntity ?? '',
          f.parentCompany ?? '',
          f.description,
          ...f.tags,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
}

export function toGeoJson(
  views: FacilityView[],
  industries: IndustryRecord[],
  regions: RegionRecord[],
): GeoJSON.FeatureCollection {
  const industryById = new Map(industries.map((i) => [i.id, i]));
  const regionById = new Map(regions.map((r) => [r.id, r]));

  return {
    type: 'FeatureCollection',
    features: views.map((view) => {
      const f = view.facility;
      return {
        type: 'Feature',
        id: f.id,
        geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] },
        properties: {
          id: f.id,
          slug: f.slug,
          name: f.canonicalName,
          nameRu: f.canonicalNameRu,
          industryId: f.industryId,
          industry: industryById.get(f.industryId)?.name ?? f.industryId,
          industryColor: industryById.get(f.industryId)?.color ?? '#888888',
          regionId: f.regionId,
          region: regionById.get(f.regionId)?.name ?? f.regionId,
          locality: f.locality,
          siteCategory: f.siteCategory,
          territoryStatus: f.territoryStatus,
          coordinatePrecision: f.coordinatePrecision,
          status: view.currentStatus?.status ?? 'unknown',
          maxDamageScore: view.maxDamageScore,
          maxConfidence: view.maxConfidence,
          incidentCount: view.incidents.length,
          firstIncidentDate: view.firstIncidentDate,
          lastIncidentDate: view.lastIncidentDate,
          hasSatelliteEvidence: view.hasSatelliteEvidence,
          hasFinancialEstimate: view.hasFinancialEstimate,
          isRecovered: view.isRecovered,
          hasUnconfirmed: view.incidents.some((i) => !isPublishedIncident(i)),
        },
      };
    }),
  };
}
