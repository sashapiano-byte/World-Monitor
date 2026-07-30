import { applyFilters, buildFacilityViews, getDataset } from '@/lib/dataset';
import { facilitiesCsv, fullJson, geoJsonExport, incidentsCsv, sourcesCsv } from '@/lib/export';
import { filterQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * Exports. Every format carries the same provenance block — dataset version,
 * review date, licence, methodology link and the confidence warning — because a
 * CSV that escapes into a spreadsheet without them is how OSINT data gets
 * laundered into false certainty.
 *
 *   /api/export/facilities.csv
 *   /api/export/incidents.csv
 *   /api/export/sources.csv
 *   /api/export/dataset.json
 *   /api/export/geojson
 *
 * The same filter parameters as /api/facilities apply.
 */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const url = new URL(request.url);
  const parsed = filterQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const dataset = getDataset();
  const views = applyFilters(buildFacilityViews(dataset), parsed.data);
  const stamp = dataset.generatedAt;

  const attachment = (name: string) => `attachment; filename="${name}"`;

  switch (file) {
    case 'facilities.csv':
      return new Response(facilitiesCsv(views, dataset, siteUrl), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': attachment(`facilities-${stamp}.csv`),
        },
      });

    case 'incidents.csv':
      return new Response(incidentsCsv(views, dataset, siteUrl), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': attachment(`incidents-${stamp}.csv`),
        },
      });

    case 'sources.csv':
      return new Response(sourcesCsv(dataset, siteUrl), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': attachment(`sources-${stamp}.csv`),
        },
      });

    case 'dataset.json':
      return Response.json(fullJson(views, dataset, siteUrl), {
        headers: { 'content-disposition': attachment(`dataset-${stamp}.json`) },
      });

    case 'geojson':
    case 'facilities.geojson':
      return Response.json(geoJsonExport(views, dataset, siteUrl), {
        headers: { 'content-disposition': attachment(`facilities-${stamp}.geojson`) },
      });

    default:
      return Response.json(
        {
          error: 'unknown_export',
          supported: ['facilities.csv', 'incidents.csv', 'sources.csv', 'dataset.json', 'geojson'],
        },
        { status: 404 },
      );
  }
}
