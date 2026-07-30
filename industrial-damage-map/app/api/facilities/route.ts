import { NextResponse } from 'next/server';
import { applyFilters, buildFacilityViews, getDataset, toGeoJson } from '@/lib/dataset';
import { provenance } from '@/lib/export';
import { filterQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/facilities
 *
 * Query parameters are validated by lib/schemas.ts; anything unrecognised is a
 * 400 rather than a silent default, so a caller can never think a filter
 * applied when it did not.
 *
 *   ?format=geojson   FeatureCollection for mapping (default)
 *   ?format=json      full facility views
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const format = params.format ?? 'geojson';
  delete params.format;

  const parsed = filterQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_query', issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 400 },
    );
  }

  const dataset = getDataset();
  const views = applyFilters(buildFacilityViews(dataset), parsed.data);

  if (format === 'json') {
    return NextResponse.json({
      provenance: provenance(process.env.NEXT_PUBLIC_SITE_URL ?? ''),
      count: views.length,
      facilities: views,
    });
  }

  if (format !== 'geojson') {
    return NextResponse.json({ error: 'unsupported_format', supported: ['geojson', 'json'] }, { status: 400 });
  }

  const fc = toGeoJson(views, dataset);
  return NextResponse.json({ ...fc, provenance: provenance(process.env.NEXT_PUBLIC_SITE_URL ?? '') });
}
