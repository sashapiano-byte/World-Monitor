import { buildFacilityViews, findFacilityBySlug, getDataset } from '@/lib/dataset';
import { facilityReportHtml } from '@/lib/export';

export const dynamic = 'force-dynamic';

/**
 * A single facility as a self-contained, printable document.
 *
 * The browser's own "print to PDF" turns this into the PDF deliverable, so the
 * project does not impose a headless-Chrome dependency on anyone who just wants
 * a report.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dataset = getDataset();
  const view = findFacilityBySlug(slug, buildFacilityViews(dataset));
  if (!view) return new Response('Not found', { status: 404 });

  const html = facilityReportHtml(view, dataset, process.env.NEXT_PUBLIC_SITE_URL ?? '');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
