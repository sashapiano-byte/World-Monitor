import { describe, expect, it } from 'vitest';
import { DATASET, DUPLICATE_RESOLUTIONS } from '@/data';
import type { Dataset } from '@/data/types';
import { runQualityControl, summariseFindings, WAR_START } from '@/lib/qc';
import { datasetSchema } from '@/lib/schemas';

const opts = { duplicateResolutions: DUPLICATE_RESOLUTIONS };

function clone(): Dataset {
  return structuredClone(DATASET);
}

describe('the shipped dataset', () => {
  it('satisfies the structural schema', () => {
    const result = datasetSchema.safeParse(DATASET);
    if (!result.success) {
      throw new Error(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    }
    expect(result.success).toBe(true);
  });

  it('passes quality control with no errors', () => {
    const findings = runQualityControl(DATASET, opts);
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors, errors.map((e) => `[${e.rule}] ${e.entity}: ${e.message}`).join('\n')).toHaveLength(0);
  });

  it('contains no incident before the start of the full-scale invasion', () => {
    for (const incident of DATASET.incidents) {
      expect(incident.incidentDate >= WAR_START).toBe(true);
    }
  });

  it('honours the 72-hour embargo for every published incident', () => {
    const cutoff = new Date(Date.parse(DATASET.generatedAt) - 3 * 86_400_000).toISOString().slice(0, 10);
    const published = DATASET.incidents.filter((i) =>
      ['verified', 'corroborated', 'disputed'].includes(i.verificationStatus),
    );
    for (const incident of published) {
      expect(incident.incidentDate <= cutoff).toBe(true);
    }
  });

  it('never assigns a damage score to an unconfirmed record', () => {
    for (const incident of DATASET.incidents.filter((i) => i.verificationStatus === 'unconfirmed')) {
      expect(incident.physicalDamageScore).toBe(0);
    }
  });

  it('gives every facility at least one incident', () => {
    const withIncidents = new Set(DATASET.incidents.map((i) => i.facilityId));
    for (const facility of DATASET.facilities) {
      expect(withIncidents.has(facility.id), `${facility.id} has no incidents`).toBe(true);
    }
  });

  it('resolves every source reference', () => {
    const ids = new Set(DATASET.sources.map((s) => s.id));
    for (const incident of DATASET.incidents) {
      for (const sourceId of incident.sourceIds) {
        expect(ids.has(sourceId), `${incident.id} cites unknown source ${sourceId}`).toBe(true);
      }
    }
  });

  it('gives every financial estimate a methodology', () => {
    for (const estimate of DATASET.damageEstimates) {
      expect(estimate.methodology.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('lists assumptions for every model estimate', () => {
    for (const estimate of DATASET.damageEstimates.filter((d) => d.estimateType === 'model_estimate')) {
      expect(estimate.assumptions?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('quality-control rules actually fire', () => {
  const errorRules = (dataset: Dataset) =>
    runQualityControl(dataset, opts)
      .filter((f) => f.severity === 'error')
      .map((f) => f.rule);

  it('rejects an incident dated before 24 February 2022', () => {
    const dataset = clone();
    dataset.incidents[0].incidentDate = '2021-12-01';
    expect(errorRules(dataset)).toContain('war-start-boundary');
  });

  it('rejects a published incident inside the 72-hour embargo', () => {
    const dataset = clone();
    dataset.incidents[0].incidentDate = dataset.generatedAt;
    dataset.incidents[0].verificationStatus = 'verified';
    expect(errorRules(dataset)).toContain('embargo-72h');
  });

  it('rejects a damage claim of 3+ resting on one non-tier-A source', () => {
    const dataset = clone();
    const incident = dataset.incidents.find((i) => i.physicalDamageScore >= 3)!;
    const tierC = dataset.sources.find((s) => s.tier === 'C')!;
    incident.sourceIds = [tierC.id];
    // Remove any imagery that would otherwise satisfy the bar.
    dataset.media = dataset.media.filter((m) => m.incidentId !== incident.id);
    expect(errorRules(dataset)).toContain('source-rule');
  });

  it('treats republications of one wire as a single voice', () => {
    const dataset = clone();
    const incident = dataset.incidents.find((i) => i.physicalDamageScore >= 3)!;
    dataset.media = dataset.media.filter((m) => m.incidentId !== incident.id);

    // Two different outlets, both republishing Reuters, both tier B.
    dataset.sources.push(
      {
        id: 's-test-wire-a',
        title: 'A',
        publisher: 'Outlet A',
        url: 'https://example.org/a',
        publicationDate: '2026-01-01',
        tier: 'B',
        kind: 'wire_agency',
        language: 'en',
        syndicatedFrom: 'Reuters',
      },
      {
        id: 's-test-wire-b',
        title: 'B',
        publisher: 'Outlet B',
        url: 'https://example.org/b',
        publicationDate: '2026-01-01',
        tier: 'B',
        kind: 'wire_agency',
        language: 'en',
        syndicatedFrom: 'Reuters',
      },
    );
    incident.sourceIds = ['s-test-wire-a', 's-test-wire-b'];
    expect(errorRules(dataset)).toContain('source-rule');
  });

  it('accepts two genuinely independent sources', () => {
    const dataset = clone();
    const incident = dataset.incidents.find((i) => i.physicalDamageScore >= 3)!;
    dataset.sources.push(
      {
        id: 's-test-indep-a',
        title: 'A',
        publisher: 'Outlet A',
        url: 'https://example.org/a',
        publicationDate: '2026-01-01',
        tier: 'B',
        kind: 'newspaper',
        language: 'en',
      },
      {
        id: 's-test-indep-b',
        title: 'B',
        publisher: 'Outlet B',
        url: 'https://example.org/b',
        publicationDate: '2026-01-01',
        tier: 'B',
        kind: 'newspaper',
        language: 'en',
      },
    );
    incident.sourceIds = ['s-test-indep-a', 's-test-indep-b'];
    const findings = runQualityControl(dataset, opts).filter(
      (f) => f.severity === 'error' && f.entity === `incident:${incident.id}`,
    );
    expect(findings).toHaveLength(0);
  });

  it('rejects a destruction claim that is not fully verified', () => {
    const dataset = clone();
    const incident = dataset.incidents.find((i) => i.verificationStatus === 'corroborated')!;
    incident.physicalDamageScore = 5;
    expect(errorRules(dataset)).toContain('destroyed-evidence-bar');
  });

  it('rejects a severe-damage claim resting only on tier-C sources', () => {
    const dataset = clone();
    const incident = dataset.incidents.find((i) => i.verificationStatus === 'verified')!;
    incident.physicalDamageScore = 4;
    const tierC = dataset.sources.filter((s) => s.tier === 'C').slice(0, 2);
    incident.sourceIds = tierC.map((s) => s.id);
    expect(errorRules(dataset)).toContain('tier-c-severe-damage');
  });

  it('rejects a financial estimate with no methodology', () => {
    const dataset = clone();
    dataset.damageEstimates[0].methodology = 'because';
    expect(errorRules(dataset)).toContain('estimate-methodology');
  });

  it('rejects a model estimate with no listed assumptions', () => {
    const dataset = clone();
    const model = dataset.damageEstimates.find((d) => d.estimateType === 'model_estimate')!;
    model.assumptions = [];
    expect(errorRules(dataset)).toContain('estimate-assumptions');
  });

  it('rejects an unconfirmed record that asserts damage', () => {
    const dataset = clone();
    const incident = dataset.incidents.find((i) => i.verificationStatus === 'unconfirmed')!;
    incident.physicalDamageScore = 3;
    expect(errorRules(dataset)).toContain('unconfirmed-damage-score');
  });

  it('rejects a territory-status mismatch between facility and region', () => {
    const dataset = clone();
    const crimean = dataset.facilities.find((f) => f.regionId === 'ua-crimea')!;
    crimean.territoryStatus = 'internationally_recognised_russia';
    expect(errorRules(dataset)).toContain('territory-consistency');
  });

  it('rejects a hosted thumbnail whose licence does not permit redistribution', () => {
    const dataset = clone();
    dataset.media[0].thumbnailUrl = 'https://example.org/thumb.jpg';
    dataset.media[0].license = 'All rights reserved.';
    expect(errorRules(dataset)).toContain('media-licence');
  });

  it('flags a possible duplicate facility that has not been resolved', () => {
    const dataset = clone();
    const first = dataset.facilities[0];
    dataset.facilities.push({ ...first, id: 'f-dupe-test', slug: 'dupe-test' });
    dataset.incidents.push({ ...dataset.incidents[0], id: 'i-dupe-test', facilityId: 'f-dupe-test' });
    const warnings = runQualityControl(dataset, opts).filter((f) => f.rule === 'possible-duplicate');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('summarises findings by severity', () => {
    const summary = summariseFindings(runQualityControl(DATASET, opts));
    expect(summary.errors).toBe(0);
    expect(summary.total).toBe(summary.errors + summary.warnings + summary.info);
  });
});
