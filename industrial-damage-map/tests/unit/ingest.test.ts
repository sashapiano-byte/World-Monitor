import { describe, expect, it } from 'vitest';
import { DATASET } from '@/data';
import { parseCsv, parseFeed } from '@/ingest/feeds';
import { detectDate, detectMethod, matchFacility, normaliseFacilityName, similarity } from '@/ingest/normalize';
import { EMBARGO_HOURS_FLOOR, recheckSchedule, runPipeline } from '@/ingest/pipeline';

describe('name normalisation', () => {
  it('strips legal forms and generic industrial nouns', () => {
    expect(normaliseFacilityName('OOO «Ilsky NPZ» refinery')).toBe('ilsky');
    expect(normaliseFacilityName('AO «Saratovsky NPZ»')).toBe('saratovsky');
  });

  it('scores identical names as a perfect match', () => {
    expect(similarity('Ryazan Oil Refining Company', 'Ryazan Oil Refining Company')).toBe(1);
  });

  it('scores unrelated names near zero', () => {
    expect(similarity('Ryazan refinery', 'Zaliv shipyard')).toBeLessThan(0.3);
  });
});

describe('facility matching', () => {
  it('matches a well-known plant to its card', () => {
    const result = matchFacility('Ryazan Oil Refining Company', DATASET.facilities);
    expect(result.facilityId).toBe('f-ryazan-refinery');
  });

  it('refuses to match an unknown name', () => {
    const result = matchFacility('Completely Fictional Widget Works', DATASET.facilities);
    expect(result.facilityId).toBeNull();
  });

  it('refuses to guess between two equally good candidates', () => {
    // Two distinct enterprises that public reporting would call the same thing.
    // Guessing here would silently attach damage to the wrong company.
    const facilities = [
      { ...DATASET.facilities[0], id: 'f-a', canonicalName: 'Northern Chemical Works', alternativeNames: [] },
      { ...DATASET.facilities[0], id: 'f-b', canonicalName: 'Northern Chemical Works', alternativeNames: [] },
    ];
    const result = matchFacility('Northern Chemical Works', facilities);
    expect(result.facilityId).toBeNull();
    expect(result.runnersUp.length).toBeGreaterThan(1);
  });

  it('still resolves an exact match over a near-miss', () => {
    const facilities = [
      { ...DATASET.facilities[0], id: 'f-a', canonicalName: 'Northern Alpha', alternativeNames: [] },
      { ...DATASET.facilities[0], id: 'f-b', canonicalName: 'Northern Alpha Beta Gamma', alternativeNames: [] },
    ];
    expect(matchFacility('Northern Alpha', facilities).facilityId).toBe('f-a');
  });
});

describe('detail extraction', () => {
  it('detects the attack method from English and Russian text', () => {
    expect(detectMethod('a drone attack on the refinery')).toBe('uav');
    expect(detectMethod('атака БПЛА по заводу')).toBe('uav');
    expect(detectMethod('a cruise missile strike')).toBe('cruise_missile');
    expect(detectMethod('a diversion at the plant')).toBe('sabotage');
  });

  it('returns null rather than guessing an unknown method', () => {
    expect(detectMethod('the plant caught fire')).toBeNull();
  });

  it('reads an ISO date', () => {
    expect(detectDate('the strike on 2026-05-05 caused a fire')).toBe('2026-05-05');
  });

  it('returns null rather than inventing a date', () => {
    expect(detectDate('a plant was struck last week')).toBeNull();
  });
});

describe('feed and CSV readers', () => {
  it('parses an RSS item', () => {
    const xml = `<rss><channel><item>
      <title>Fire at the Example refinery</title>
      <link>https://example.org/1</link>
      <pubDate>Tue, 01 Jul 2026 08:00:00 GMT</pubDate>
      <description><![CDATA[The refinery was damaged.]]></description>
    </item></channel></rss>`;
    const items = parseFeed(xml, 'example.org');
    expect(items).toHaveLength(1);
    expect(items[0].headline).toBe('Fire at the Example refinery');
    expect(items[0].publishedAt).toBe('2026-07-01');
  });

  it('skips malformed entries instead of guessing', () => {
    const xml = `<rss><channel><item><title>No link here</title></item></channel></rss>`;
    expect(parseFeed(xml, 'example.org')).toHaveLength(0);
  });

  it('parses quoted CSV cells', () => {
    const csv = 'headline,url,publisher,published_at,summary\n"A, with comma",https://example.org/x,Wire,2026-01-01,"He said ""hi"""';
    const rows = parseCsv(csv);
    expect(rows[0].headline).toBe('A, with comma');
    expect(rows[0].summary).toBe('He said "hi"');
  });
});

describe('intake pipeline', () => {
  const facilities = DATASET.facilities;

  it('discards items with no industrial or damage terms', () => {
    const { accepted, discarded } = runPipeline(
      [
        {
          headline: 'Football results round-up',
          url: 'https://example.org/sport',
          publisher: 'Wire',
          publishedAt: '2026-01-01',
          summary: 'Nothing to do with industry.',
        },
      ],
      { asOf: '2026-07-30', facilities },
    );
    expect(accepted).toHaveLength(0);
    expect(discarded).toHaveLength(1);
  });

  it('blocks anything inside the 72-hour embargo', () => {
    const { accepted } = runPipeline(
      [
        {
          headline: 'Fire at the Example refinery after a drone attack',
          url: 'https://example.org/fresh',
          publisher: 'Wire',
          publishedAt: '2026-07-29',
          summary: 'A fire broke out at the refinery; operations were suspended.',
        },
      ],
      { asOf: '2026-07-30', facilities },
    );
    expect(accepted).toHaveLength(1);
    expect(accepted[0].blockedReason).toMatch(/EMBARGOED/);
  });

  it('refuses to lower the embargo below the 72-hour floor', () => {
    const { accepted } = runPipeline(
      [
        {
          headline: 'Fire at the Example refinery after a drone attack',
          url: 'https://example.org/fresh2',
          publisher: 'Wire',
          publishedAt: '2026-07-29',
          summary: 'A fire broke out at the refinery; operations were suspended.',
        },
      ],
      { asOf: '2026-07-30', facilities, minAgeHours: 1 },
    );
    expect(accepted[0].blockedReason).toMatch(new RegExp(String(EMBARGO_HOURS_FLOOR)));
  });

  it('never marks anything as published', () => {
    const { accepted } = runPipeline(
      [
        {
          headline: 'Ryazan refinery damaged in drone attack',
          url: 'https://example.org/ryazan-new',
          publisher: 'Wire',
          publishedAt: '2026-06-01',
          summary: 'The refinery was struck and a fire broke out; operations halted.',
        },
      ],
      { asOf: '2026-07-30', facilities },
    );
    for (const item of accepted) {
      expect(item.stage).not.toBe('published');
      expect(item.blockedReason).toBeTruthy();
    }
  });

  it('skips URLs already in the queue', () => {
    const known = new Set([DATASET.reviewQueue[0].url]);
    const { discarded } = runPipeline(
      [
        {
          headline: 'A refinery was damaged by fire',
          url: DATASET.reviewQueue[0].url,
          publisher: 'Wire',
          publishedAt: '2026-01-01',
          summary: 'damage',
        },
      ],
      { asOf: '2026-07-30', facilities, knownUrls: known },
    );
    expect(discarded[0].reason).toBe('already known');
  });

  it('schedules re-checks at 7, 30, 90 and 180 days', () => {
    expect(recheckSchedule('2026-01-01')).toEqual(['2026-01-08', '2026-01-31', '2026-04-01', '2026-06-30']);
  });
});
