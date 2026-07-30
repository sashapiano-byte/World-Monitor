import { NextResponse } from 'next/server';
import { DUPLICATE_RESOLUTIONS } from '@/data';
import { getDataset } from '@/lib/dataset';
import { runQualityControl, summariseFindings } from '@/lib/qc';

export const dynamic = 'force-dynamic';

/**
 * The quality-control report, served live.
 *
 * Publishing the project's own failing checks is the point: a reader can see
 * exactly which records the editorial rules flag and why, rather than taking
 * "verified" on trust.
 */
export async function GET() {
  const dataset = getDataset();
  const findings = runQualityControl(dataset, { duplicateResolutions: DUPLICATE_RESOLUTIONS });
  const summary = summariseFindings(findings);

  return NextResponse.json(
    {
      datasetVersion: dataset.version,
      lastFullReview: dataset.lastFullReview,
      summary,
      counts: {
        facilities: dataset.facilities.length,
        incidents: dataset.incidents.length,
        sources: dataset.sources.length,
        claims: dataset.claims.length,
        statusChanges: dataset.statusHistory.length,
        damageEstimates: dataset.damageEstimates.length,
        media: dataset.media.length,
        reviewQueue: dataset.reviewQueue.length,
      },
      findings,
    },
    { status: summary.errors > 0 ? 500 : 200 },
  );
}
