import { NextResponse } from 'next/server';
import { configuredBackend, pingDatabase } from '@/db/client';
import { getDataset } from '@/lib/dataset';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backend = configuredBackend();
  let databaseReachable = false;
  let databaseError: string | null = null;

  try {
    databaseReachable = await pingDatabase();
  } catch (err) {
    databaseError = err instanceof Error ? err.message : String(err);
  }

  const dataset = getDataset();

  return NextResponse.json({
    ok: backend === 'postgres' ? databaseReachable : true,
    backend,
    effectiveBackend: databaseReachable ? 'postgres' : 'file',
    databaseReachable,
    databaseError,
    dataset: {
      version: dataset.version,
      lastFullReview: dataset.lastFullReview,
      facilities: dataset.facilities.length,
      incidents: dataset.incidents.length,
    },
  });
}
