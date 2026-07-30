import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FacilityPanel } from '@/components/FacilityPanel';
import { buildFacilityViews, getDataset } from '@/lib/dataset';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return getDataset().facilities.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const facility = getDataset().facilities.find((f) => f.slug === slug);
  return { title: facility ? facility.canonicalName : 'Facility not found' };
}

export default async function FacilityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dataset = getDataset();
  const view = buildFacilityViews(dataset).find((v) => v.facility.slug === slug);
  if (!view) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="no-print px-4 pt-4">
        <Link href="/" className="text-xs underline underline-offset-2">
          ← Back to the map
        </Link>
      </div>
      <FacilityPanel view={view} industries={dataset.industries} regions={dataset.regions} standalone />
    </div>
  );
}
