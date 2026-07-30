import { DATASET_VERSION, LAST_FULL_REVIEW } from '@/data';
import type { Dataset } from '@/data/types';
import type { FacilityView } from './dataset';
import { getDataset, toGeoJson } from './dataset';

/**
 * Export builders.
 *
 * Every export carries the same provenance block, because a CSV that escapes
 * into a spreadsheet with no version, no licence and no confidence column is
 * exactly how OSINT data gets laundered into false certainty.
 */

export interface ExportProvenance {
  exportedAt: string;
  datasetVersion: string;
  lastFullReview: string;
  license: string;
  methodologyUrl: string;
  warning: string;
}

export function provenance(siteUrl = ''): ExportProvenance {
  return {
    exportedAt: new Date().toISOString(),
    datasetVersion: DATASET_VERSION,
    lastFullReview: LAST_FULL_REVIEW,
    license: getDataset().license,
    methodologyUrl: `${siteUrl}/methodology`,
    warning:
      'Open-source research. Confidence scores are integral to every record — a row without its confidence and verification status is not a finding. Model estimates are NOT official figures and must never be aggregated with them.',
  };
}

function csvCell(value: unknown): string {
  if (value == null) return '';
  const s = Array.isArray(value) ? value.join('; ') : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(row[c])).join(','));
  return [header, ...body].join('\n');
}

/** Provenance emitted as leading CSV comment lines, so it survives a copy-paste. */
function csvPreamble(siteUrl: string): string {
  const p = provenance(siteUrl);
  return [
    `# Russian Industrial Damage Map — data export`,
    `# exported_at,${p.exportedAt}`,
    `# dataset_version,${p.datasetVersion}`,
    `# last_full_review,${p.lastFullReview}`,
    `# license,"${p.license}"`,
    `# methodology,${p.methodologyUrl}`,
    `# warning,"${p.warning}"`,
  ].join('\n');
}

const FACILITY_COLUMNS = [
  'facility_id',
  'slug',
  'name',
  'name_ru',
  'legal_entity',
  'parent_company',
  'industry',
  'site_category',
  'region',
  'locality',
  'latitude',
  'longitude',
  'coordinate_precision',
  'territory_status',
  'incident_count',
  'first_incident',
  'last_incident',
  'max_damage_score',
  'max_confidence',
  'current_status',
  'current_status_date',
  'is_recovered',
  'has_satellite_evidence',
  'has_financial_estimate',
  'last_updated',
];

export function facilitiesCsv(views: FacilityView[], dataset: Dataset, siteUrl = ''): string {
  const industryById = new Map(dataset.industries.map((i) => [i.id, i.name]));
  const regionById = new Map(dataset.regions.map((r) => [r.id, r.name]));

  const rows = views.map((v) => ({
    facility_id: v.facility.id,
    slug: v.facility.slug,
    name: v.facility.canonicalName,
    name_ru: v.facility.canonicalNameRu,
    legal_entity: v.facility.legalEntity,
    parent_company: v.facility.parentCompany,
    industry: industryById.get(v.facility.industryId) ?? v.facility.industryId,
    site_category: v.facility.siteCategory,
    region: regionById.get(v.facility.regionId) ?? v.facility.regionId,
    locality: v.facility.locality,
    latitude: v.facility.latitude,
    longitude: v.facility.longitude,
    coordinate_precision: v.facility.coordinatePrecision,
    territory_status: v.facility.territoryStatus,
    incident_count: v.incidents.length,
    first_incident: v.firstIncidentDate,
    last_incident: v.lastIncidentDate,
    max_damage_score: v.maxDamageScore,
    max_confidence: v.maxConfidence,
    current_status: v.currentStatus?.status ?? 'unknown',
    current_status_date: v.currentStatus?.statusDate ?? '',
    is_recovered: v.isRecovered,
    has_satellite_evidence: v.hasSatelliteEvidence,
    has_financial_estimate: v.hasFinancialEstimate,
    last_updated: v.facility.updatedAt,
  }));

  return `${csvPreamble(siteUrl)}\n${toCsv(rows, FACILITY_COLUMNS)}\n`;
}

const INCIDENT_COLUMNS = [
  'incident_id',
  'facility_id',
  'facility_name',
  'incident_date',
  'attack_method',
  'method_confidence',
  'physical_damage_score',
  'fire_confirmed',
  'casualties_killed',
  'casualties_injured',
  'downtime_days',
  'downtime_is_estimate',
  'confidence',
  'verification_status',
  'damage_summary',
  'damaged_assets',
  'operational_effect',
  'established',
  'unresolved',
  'source_urls',
  'last_reviewed',
];

export function incidentsCsv(views: FacilityView[], dataset: Dataset, siteUrl = ''): string {
  const sourceById = new Map(dataset.sources.map((s) => [s.id, s]));
  const rows = views.flatMap((v) =>
    v.incidents.map((i) => ({
      incident_id: i.id,
      facility_id: v.facility.id,
      facility_name: v.facility.canonicalName,
      incident_date: i.incidentDate,
      attack_method: i.attackMethod,
      method_confidence: i.methodConfidence,
      physical_damage_score: i.physicalDamageScore,
      fire_confirmed: i.fireConfirmed,
      casualties_killed: i.casualtiesKilled,
      casualties_injured: i.casualtiesInjured,
      downtime_days: i.downtimeDays,
      downtime_is_estimate: i.downtimeIsEstimate,
      confidence: i.confidence,
      verification_status: i.verificationStatus,
      damage_summary: i.damageSummary,
      damaged_assets: i.damagedAssets,
      operational_effect: i.operationalEffect,
      established: i.established,
      unresolved: i.unresolved,
      source_urls: i.sourceIds.map((id) => sourceById.get(id)?.url ?? id),
      last_reviewed: i.lastReviewed,
    })),
  );
  return `${csvPreamble(siteUrl)}\n${toCsv(rows, INCIDENT_COLUMNS)}\n`;
}

const SOURCE_COLUMNS = [
  'source_id',
  'title',
  'publisher',
  'url',
  'archived_url',
  'publication_date',
  'tier',
  'kind',
  'language',
  'notes',
];

export function sourcesCsv(dataset: Dataset, siteUrl = ''): string {
  const rows = dataset.sources.map((s) => ({
    source_id: s.id,
    title: s.title,
    publisher: s.publisher,
    url: s.url,
    archived_url: s.archivedUrl ?? '',
    publication_date: s.publicationDate ?? '',
    tier: s.tier,
    kind: s.kind,
    language: s.language,
    notes: s.notes ?? '',
  }));
  return `${csvPreamble(siteUrl)}\n${toCsv(rows, SOURCE_COLUMNS)}\n`;
}

export function fullJson(views: FacilityView[], dataset: Dataset, siteUrl = '') {
  return {
    provenance: provenance(siteUrl),
    reference: { industries: dataset.industries, regions: dataset.regions },
    facilities: views.map((v) => ({
      ...v.facility,
      incidents: v.incidents,
      statusHistory: v.statusHistory,
      damageEstimates: v.estimates,
      media: v.media,
      claims: v.claims,
      currentStatus: v.currentStatus,
    })),
    sources: dataset.sources,
  };
}

export function geoJsonExport(views: FacilityView[], dataset: Dataset, siteUrl = '') {
  const fc = toGeoJson(views, dataset);
  return { ...fc, provenance: provenance(siteUrl) };
}

/**
 * A single facility as a self-contained, printable HTML document.
 * The browser's own "print to PDF" turns this into the PDF report deliverable —
 * no headless-Chrome dependency is imposed on anyone running the project.
 */
export function facilityReportHtml(view: FacilityView, dataset: Dataset, siteUrl = ''): string {
  const p = provenance(siteUrl);
  const industry = dataset.industries.find((i) => i.id === view.facility.industryId)?.name ?? view.facility.industryId;
  const region = dataset.regions.find((r) => r.id === view.facility.regionId)?.name ?? view.facility.regionId;
  const sourceById = new Map(dataset.sources.map((s) => [s.id, s]));

  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

  const incidents = view.incidents
    .map(
      (i) => `
    <section class="incident">
      <h3>${esc(i.incidentDate)} — ${esc(i.attackMethod)} — damage score ${i.physicalDamageScore}/5</h3>
      <p class="meta">Verification: <strong>${esc(i.verificationStatus)}</strong> · Confidence: <strong>${i.confidence}/100</strong>${
        i.downtimeDays != null
          ? ` · Downtime: ${i.downtimeDays} days${i.downtimeIsEstimate ? ' (estimated)' : ' (confirmed)'}`
          : ''
      }</p>
      <p>${esc(i.damageSummary)}</p>
      ${i.damagedAssets.length ? `<p><em>Assets reported damaged:</em> ${esc(i.damagedAssets.join('; '))}</p>` : ''}
      <p><em>Operational effect:</em> ${esc(i.operationalEffect)}</p>
      ${i.established.length ? `<p><strong>Established:</strong></p><ul>${i.established.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      ${i.unresolved.length ? `<p><strong>Unresolved:</strong></p><ul>${i.unresolved.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      <p class="sources">Sources: ${i.sourceIds
        .map((id) => {
          const s = sourceById.get(id);
          return s ? `<a href="${esc(s.url)}">${esc(s.publisher)} (tier ${esc(s.tier)})</a>` : esc(id);
        })
        .join(', ')}</p>
    </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(view.facility.canonicalName)} — facility report</title>
<style>
  body{font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#111}
  h1{font-size:1.6rem;margin-bottom:.25rem} h2{margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:.25rem}
  h3{font-size:1rem;margin-bottom:.25rem}
  .meta{color:#555;font-size:.85rem} .sources{font-size:.8rem;color:#444}
  .incident{border-left:3px solid #ccc;padding-left:1rem;margin:1.25rem 0}
  .provenance{margin-top:2.5rem;font-size:.75rem;color:#555;border-top:1px solid #ddd;padding-top:1rem}
  dt{font-weight:600;float:left;width:12rem;clear:left} dd{margin-left:12rem}
  @media print{body{margin:0}}
</style></head><body>
<h1>${esc(view.facility.canonicalName)}</h1>
<p class="meta">${esc(view.facility.canonicalNameRu)}</p>
<h2>Facility</h2>
<dl>
  <dt>Industry</dt><dd>${esc(industry)}</dd>
  <dt>Legal entity</dt><dd>${esc(view.facility.legalEntity ?? 'not established')}</dd>
  <dt>Parent company</dt><dd>${esc(view.facility.parentCompany ?? 'not established')}</dd>
  <dt>Region</dt><dd>${esc(region)}</dd>
  <dt>Locality</dt><dd>${esc(view.facility.locality)}</dd>
  <dt>Coordinates</dt><dd>${view.facility.latitude.toFixed(4)}, ${view.facility.longitude.toFixed(4)} (${esc(view.facility.coordinatePrecision)})</dd>
  <dt>Capacity</dt><dd>${esc(view.facility.nameplateCapacity ?? 'not published')}</dd>
  <dt>Current status</dt><dd>${esc(view.currentStatus?.status ?? 'unknown')}${view.currentStatus ? ` (as of ${esc(view.currentStatus.statusDate)})` : ''}</dd>
  <dt>Incidents recorded</dt><dd>${view.incidents.length}</dd>
</dl>
<p>${esc(view.facility.description)}</p>
<p><strong>Why this record exists:</strong> ${esc(view.facility.inclusionRationale)}</p>
<h2>Incidents</h2>
${incidents || '<p>None recorded.</p>'}
<div class="provenance">
  <p><strong>Provenance.</strong> Exported ${esc(p.exportedAt)} · dataset ${esc(p.datasetVersion)} · last full review ${esc(p.lastFullReview)}</p>
  <p>${esc(p.license)}</p>
  <p>${esc(p.warning)}</p>
</div>
</body></html>`;
}
