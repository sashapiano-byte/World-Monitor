import { NextResponse } from 'next/server';
import { buildFacilityViews, findFacilityBySlug, getDataset } from '@/lib/dataset';
import { provenance } from '@/lib/export';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dataset = getDataset();
  const view = findFacilityBySlug(slug, buildFacilityViews(dataset));
  if (!view) return NextResponse.json({ error: 'not_found', slug }, { status: 404 });

  return NextResponse.json({
    provenance: provenance(process.env.NEXT_PUBLIC_SITE_URL ?? ''),
    facility: view.facility,
    incidents: view.incidents,
    statusHistory: view.statusHistory,
    damageEstimates: view.estimates,
    media: view.media,
    claims: view.claims,
    sources: view.sources,
    derived: {
      maxDamageScore: view.maxDamageScore,
      maxConfidence: view.maxConfidence,
      incidentCount: view.incidentCount,
      isRecovered: view.isRecovered,
      isSingleSourceOnly: view.isSingleSourceOnly,
      hasSatelliteEvidence: view.hasSatelliteEvidence,
    },
  });
}
