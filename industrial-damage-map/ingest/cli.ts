/**
 * Candidate-discovery CLI.
 *
 *   npm run ingest:demo                     run against the bundled demo CSV
 *   tsx ingest/cli.ts --csv path/to.csv     import a manual CSV
 *   tsx ingest/cli.ts --feeds               read INGEST_FEEDS
 *
 * Output is a review-queue draft printed to stdout. Nothing is written to the
 * published dataset, and nothing can be: publication requires a named editor.
 */
import { readFileSync } from 'node:fs';
import { DATASET } from '../data/index';
import { type Candidate, parseCsv, parseFeed } from './feeds';
import { runPipeline } from './pipeline';

const DEMO_CSV = `headline,url,publisher,published_at,summary
"Fire reported at the Example refinery after drone attack","https://example.org/a","Example Wire","2026-07-01","Local authorities said a fire broke out at the refinery following a drone attack. Operations were suspended."
"Wildberries warehouse damaged in overnight strike","https://example.org/b","Example Wire","2026-07-29","A logistics warehouse was hit and caught fire overnight."
"Football results round-up","https://example.org/c","Example Wire","2026-07-01","Nothing to do with industry."
"Unknown plant struck, no date given","https://example.org/d","Example Wire","","A plant was reportedly struck and damaged."
`;

async function collect(): Promise<Candidate[]> {
  const csvArg = process.argv.indexOf('--csv');
  if (csvArg !== -1 && process.argv[csvArg + 1]) {
    return parseCsv(readFileSync(process.argv[csvArg + 1], 'utf8'));
  }

  if (process.argv.includes('--feeds')) {
    const feeds = (process.env.INGEST_FEEDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (feeds.length === 0) {
      console.error('[ingest] --feeds given but INGEST_FEEDS is empty.');
      process.exit(1);
    }
    const all: Candidate[] = [];
    for (const feed of feeds) {
      try {
        const res = await fetch(feed, { headers: { 'user-agent': 'industrial-damage-map/0.1 (research)' } });
        if (!res.ok) {
          console.error(`[ingest] ${feed} → HTTP ${res.status}`);
          continue;
        }
        all.push(...parseFeed(await res.text(), new URL(feed).hostname));
      } catch (err) {
        console.error(`[ingest] ${feed} failed:`, err instanceof Error ? err.message : err);
      }
    }
    return all;
  }

  console.log('[ingest] no --csv or --feeds given; running the bundled demo input\n');
  return parseCsv(DEMO_CSV);
}

async function main() {
  const candidates = await collect();
  const asOf = process.env.INGEST_AS_OF ?? DATASET.generatedAt;

  const { accepted, discarded } = runPipeline(candidates, {
    asOf,
    facilities: DATASET.facilities,
    minAgeHours: Number(process.env.INGEST_MIN_AGE_HOURS ?? 72),
    knownUrls: new Set(DATASET.reviewQueue.map((q) => q.url)),
  });

  console.log(`Scanned ${candidates.length} candidate(s) as of ${asOf}\n`);
  console.log(`--- queued for manual review: ${accepted.length} ---`);
  for (const item of accepted) {
    console.log(`\n• ${item.headline}`);
    console.log(`  ${item.url}`);
    console.log(`  stage: ${item.stage}`);
    console.log(`  facility: ${item.detectedFacilityName ?? '(none detected)'} → ${item.matchedFacilityId ?? 'no match'}`);
    console.log(`  date: ${item.detectedDate ?? '(none)'} · method: ${item.detectedMethod ?? '(none)'}`);
    if (item.blockedReason) console.log(`  BLOCKED: ${item.blockedReason}`);
  }

  console.log(`\n--- discarded before the queue: ${discarded.length} ---`);
  for (const d of discarded) console.log(`• ${d.candidate.headline} — ${d.reason}`);

  console.log('\nNothing above is published. Publication requires a named editor (METHODOLOGY.md §12).');
}

main().catch((err) => {
  console.error('[ingest] failed:', err);
  process.exit(1);
});
