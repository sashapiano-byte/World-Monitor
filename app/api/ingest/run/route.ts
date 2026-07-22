import { NextResponse } from 'next/server';
import { runIngestion } from '@/lib/ingest/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Ingestion trigger. Called by Vercel cron (see vercel.json) or manually.
 * Auth: `Authorization: Bearer $INGEST_SECRET` header, or `?secret=` for cron.
 * Vercel cron requests are also accepted via the `x-vercel-cron` header.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = (searchParams.get('scope') ?? 'all') as 'fast' | 'slow' | 'all';

  if (!isAuthorized(request, searchParams)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const results = await runIngestion(scope);
    const ok = results.filter((r) => r.status !== 'error').length;
    return NextResponse.json({
      scope,
      layers: results.length,
      ok,
      errored: results.length - ok,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isAuthorized(request: Request, searchParams: URLSearchParams): boolean {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return false; // fail closed if unconfigured
  if (request.headers.get('x-vercel-cron')) return true;
  const bearer = request.headers.get('authorization');
  if (bearer === `Bearer ${secret}`) return true;
  return searchParams.get('secret') === secret;
}
