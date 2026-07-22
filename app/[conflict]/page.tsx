import { notFound } from 'next/navigation';
import {
  getConflicts,
  getConflictBySlug,
  getConflictLayers,
} from '@/lib/data/conflicts';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function ConflictPage({
  params,
}: {
  params: { conflict: string };
}) {
  const [conflicts, conflict] = await Promise.all([
    getConflicts(),
    getConflictBySlug(params.conflict),
  ]);

  if (!conflict) notFound();

  const layers = await getConflictLayers(conflict.id);

  return <Dashboard conflicts={conflicts} conflict={conflict} layers={layers} />;
}
