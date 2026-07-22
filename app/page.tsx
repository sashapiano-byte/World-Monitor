import { redirect } from 'next/navigation';
import { getConflicts } from '@/lib/data/conflicts';

export const dynamic = 'force-dynamic';

/** Land on the featured conflict (or first available). */
export default async function Home() {
  const conflicts = await getConflicts();
  const featured = conflicts.find((c) => c.is_featured) ?? conflicts[0];
  if (featured) redirect(`/${featured.slug}`);

  return (
    <main className="flex h-screen items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <h1 className="mb-2 text-xl font-bold text-white">Frontline</h1>
        <p className="text-sm text-gray-400">
          No conflicts configured yet. Run the Supabase migrations and seed to
          load Ukraine and Sudan, then set{' '}
          <code className="text-accent-blue">NEXT_PUBLIC_SUPABASE_URL</code>.
        </p>
      </div>
    </main>
  );
}
