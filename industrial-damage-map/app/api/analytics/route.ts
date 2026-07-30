import { NextResponse } from 'next/server';
import { computeAnalytics } from '@/lib/analytics';
import { applyFilters, buildFacilityViews, getDataset } from '@/lib/dataset';
import { provenance } from '@/lib/export';
import { filterQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = filterQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  }

  const dataset = getDataset();
  const views = applyFilters(buildFacilityViews(dataset), parsed.data);

  return NextResponse.json({
    provenance: provenance(process.env.NEXT_PUBLIC_SITE_URL ?? ''),
    note: 'Attested and modelled financial totals are reported separately and must never be added together.',
    analytics: computeAnalytics(views, dataset),
  });
}
