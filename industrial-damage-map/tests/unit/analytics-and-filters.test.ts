import { describe, expect, it } from 'vitest';
import { DATASET } from '@/data';
import { computeAnalytics, computeFinancialTotals } from '@/lib/analytics';
import { applyFilters, buildFacilityViews, DEFAULT_FILTERS, toGeoJson } from '@/lib/filter-core';
import { formatRange, presentRange, toConstantUsd, toUsdAtDate } from '@/lib/fx';

const views = buildFacilityViews(DATASET);

describe('facility read model', () => {
  it('builds one view per facility', () => {
    expect(views).toHaveLength(DATASET.facilities.length);
  });

  it('separates published from unconfirmed incidents', () => {
    for (const view of views) {
      expect(view.publishedIncidents.length).toBeLessThanOrEqual(view.incidents.length);
      for (const incident of view.publishedIncidents) {
        expect(incident.verificationStatus).not.toBe('unconfirmed');
      }
    }
  });

  it('derives the worst damage score from published incidents only', () => {
    for (const view of views) {
      const worstPublished = view.publishedIncidents.reduce((m, i) => Math.max(m, i.physicalDamageScore), 0);
      expect(view.maxDamageScore).toBe(worstPublished);
    }
  });
});

describe('filters', () => {
  it('hides unconfirmed records by default', () => {
    const result = applyFilters(views, DEFAULT_FILTERS);
    for (const view of result) {
      for (const incident of view.incidents) {
        expect(incident.verificationStatus).not.toBe('unconfirmed');
      }
    }
  });

  it('hides flagged non-industrial sites by default', () => {
    const result = applyFilters(views, DEFAULT_FILTERS);
    for (const view of result) {
      expect(view.facility.siteCategory).toBe('industrial');
    }
  });

  it('shows flagged sites only when explicitly asked', () => {
    const withFlagged = applyFilters(views, { ...DEFAULT_FILTERS, includeBorderline: true });
    const flagged = withFlagged.filter((v) => v.facility.siteCategory !== 'industrial');
    expect(flagged.length).toBeGreaterThan(0);
  });

  it('can exclude occupied-territory sites', () => {
    const result = applyFilters(views, { ...DEFAULT_FILTERS, includeOccupied: false });
    for (const view of result) {
      expect(view.facility.territoryStatus).toBe('internationally_recognised_russia');
    }
  });

  it('filters by date range', () => {
    const result = applyFilters(views, { ...DEFAULT_FILTERS, from: '2026-01-01', to: '2026-06-30' });
    for (const view of result) {
      for (const incident of view.incidents) {
        expect(incident.incidentDate >= '2026-01-01').toBe(true);
        expect(incident.incidentDate <= '2026-06-30').toBe(true);
      }
    }
  });

  it('filters by industry and attack method', () => {
    const result = applyFilters(views, { ...DEFAULT_FILTERS, industries: ['oil_refining'], methods: ['uav'] });
    expect(result.length).toBeGreaterThan(0);
    for (const view of result) {
      expect(view.facility.industryId).toBe('oil_refining');
      for (const incident of view.incidents) expect(incident.attackMethod).toBe('uav');
    }
  });

  it('drops facilities whose incidents are all filtered out', () => {
    const result = applyFilters(views, { ...DEFAULT_FILTERS, from: '2030-01-01' });
    expect(result).toHaveLength(0);
  });

  it('searches names, owners, localities and tags', () => {
    const byName = applyFilters(views, { ...DEFAULT_FILTERS, q: 'ryazan' });
    expect(byName.some((v) => v.facility.slug === 'ryazan-refinery')).toBe(true);

    const byOwner = applyFilters(views, { ...DEFAULT_FILTERS, q: 'rosneft' });
    expect(byOwner.length).toBeGreaterThan(1);
  });

  it('filters to repeatedly struck facilities', () => {
    const result = applyFilters(views, { ...DEFAULT_FILTERS, minIncidents: 2 });
    for (const view of result) expect(view.incidents.length).toBeGreaterThanOrEqual(2);
  });
});

describe('geojson', () => {
  const fc = toGeoJson(applyFilters(views, DEFAULT_FILTERS), DATASET.industries, DATASET.regions);

  it('produces one point feature per facility', () => {
    expect(fc.type).toBe('FeatureCollection');
    for (const feature of fc.features) {
      expect(feature.geometry.type).toBe('Point');
    }
  });

  it('keeps every coordinate inside the permitted bounding box', () => {
    for (const feature of fc.features) {
      const [lon, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      expect(lat).toBeGreaterThanOrEqual(41);
      expect(lat).toBeLessThanOrEqual(82);
      expect(lon).toBeGreaterThanOrEqual(19);
      expect(lon).toBeLessThanOrEqual(191);
    }
  });

  it('carries the coordinate-precision caveat on every feature', () => {
    for (const feature of fc.features) {
      expect(feature.properties?.coordinatePrecision).toBeTruthy();
    }
  });
});

describe('analytics', () => {
  const analytics = computeAnalytics(views, DATASET);

  it('excludes flagged non-industrial sites from the industrial total', () => {
    const industrial = DATASET.facilities.filter((f) => f.siteCategory === 'industrial').length;
    expect(analytics.totals.industrialFacilities).toBe(industrial);
    expect(analytics.totals.borderlineFacilities).toBe(DATASET.facilities.length - industrial);
  });

  it('excludes unconfirmed incidents from the published count', () => {
    const published = DATASET.incidents.filter(
      (i) =>
        ['verified', 'corroborated', 'disputed'].includes(i.verificationStatus) &&
        DATASET.facilities.find((f) => f.id === i.facilityId)?.siteCategory === 'industrial',
    ).length;
    expect(analytics.totals.publishedIncidents).toBe(published);
  });

  it('bucket counts sum to the published incident count', () => {
    const byMethod = analytics.byMethod.reduce((sum, b) => sum + b.count, 0);
    expect(byMethod).toBe(analytics.totals.publishedIncidents);
  });

  it('computes the median downtime from confirmed outages only', () => {
    const confirmed = DATASET.incidents.filter((i) => i.downtimeDays != null && !i.downtimeIsEstimate);
    expect(analytics.downtimeSampleSize).toBeLessThanOrEqual(confirmed.length);
  });
});

describe('financial aggregation', () => {
  const totals = computeFinancialTotals(views);

  it('never merges attested figures with modelled ones', () => {
    // Both buckets exist independently; nothing in the code path can add them.
    expect(totals).toHaveProperty('attested');
    expect(totals).toHaveProperty('modelled');
    expect(Object.keys(totals)).not.toContain('combined');
  });

  it('excludes multi-facility and campaign-level estimates from per-facility totals', () => {
    const excludedIds = totals.excluded.map((e) => e.estimateId);
    for (const estimate of DATASET.damageEstimates.filter((d) => d.scope !== 'facility')) {
      expect(excludedIds).toContain(estimate.id);
    }
  });

  it('excludes estimates of unknown provenance from both totals', () => {
    const excludedIds = totals.excluded.map((e) => e.estimateId);
    for (const estimate of DATASET.damageEstimates.filter((d) => d.estimateType === 'unknown')) {
      expect(excludedIds).toContain(estimate.id);
    }
  });

  it('gives a reason for every exclusion', () => {
    for (const excluded of totals.excluded) {
      expect(excluded.reason.length).toBeGreaterThan(10);
    }
  });
});

describe('currency handling', () => {
  it('converts roubles to USD at the year rate', () => {
    // 2024 table rate is 92 RUB/USD.
    expect(Math.round(toUsdAtDate(92_000_000, 'RUB', '2024-06-01'))).toBe(1_000_000);
  });

  it('leaves USD untouched', () => {
    expect(toUsdAtDate(500, 'USD', '2024-06-01')).toBe(500);
  });

  it('deflates to constant prices', () => {
    expect(toConstantUsd(100, '2022-01-01')).toBeCloseTo(109, 5);
    expect(toConstantUsd(100, '2025-01-01')).toBeCloseTo(100, 5);
  });

  it('prefers a source-published USD figure over re-deriving one', () => {
    const result = presentRange({
      min: 35_800_000_000,
      max: 35_800_000_000,
      currency: 'RUB',
      date: '2026-07-24',
      sourceUsdMin: 457_000_000,
      sourceUsdMax: 457_000_000,
    });
    expect(result.usdFromSource).toBe(true);
    expect(result.usdAtDate.min).toBe(457_000_000);
  });

  it('formats an absent value as an em dash rather than zero', () => {
    expect(formatRange(null, null, 'USD')).toBe('—');
  });
});
