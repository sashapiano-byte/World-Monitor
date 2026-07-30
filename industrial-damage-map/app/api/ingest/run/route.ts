import { NextResponse } from 'next/server';
import { getDataset } from '@/lib/dataset';
import { type Candidate, parseCsv, parseFeed } from '@/ingest/feeds';
import { runPipeline } from '@/ingest/pipeline';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/run
 *
 * Runs candidate discovery and returns a review-queue draft. It writes nothing
 * and publishes nothing — by design there is no code path from this endpoint to
 * the published dataset. Requires INGEST_SECRET.
 *
 * Body (optional): { "csv": "headline,url,..." }
 * Otherwise reads INGEST_FEEDS.
 */
export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'ingest_disabled', detail: 'INGEST_SECRET is not configured on this deployment.' },
      { status: 503 },
    );
  }
  const provided = request.headers.get('x-ingest-secret') ?? new URL(request.url).searchParams.get('secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const dataset = getDataset();
  let candidates: Candidate[] = [];

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  if (typeof body?.csv === 'string') {
    candidates = parseCsv(body.csv);
  } else {
    const feeds = (process.env.INGEST_FEEDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const feed of feeds) {
      try {
        const res = await fetch(feed, { headers: { 'user-agent': 'industrial-damage-map/0.1 (research)' } });
        if (res.ok) candidates.push(...parseFeed(await res.text(), new URL(feed).hostname));
      } catch {
        // A failing feed must not fail the whole run.
      }
    }
  }

  const { accepted, discarded } = runPipeline(candidates, {
    asOf: new Date().toISOString().slice(0, 10),
    facilities: dataset.facilities,
    minAgeHours: Number(process.env.INGEST_MIN_AGE_HOURS ?? 72),
    knownUrls: new Set(dataset.reviewQueue.map((q) => q.url)),
  });

  return NextResponse.json({
    note: 'Draft review-queue entries only. Nothing has been published or written. Publication requires a named editor.',
    scanned: candidates.length,
    queued: accepted.length,
    discarded: discarded.length,
    items: accepted,
    discardedItems: discarded.map((d) => ({ headline: d.candidate.headline, reason: d.reason })),
  });
}
