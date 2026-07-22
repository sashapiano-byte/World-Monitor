'use client';

import Link from 'next/link';
import type { Conflict } from '@/lib/data/conflicts';

interface ConflictSwitcherProps {
  conflicts: Conflict[];
  activeSlug: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-accent-red',
  frozen: 'bg-accent-blue',
  monitoring: 'bg-accent-amber',
  archived: 'bg-gray-500',
};

export default function ConflictSwitcher({
  conflicts,
  activeSlug,
}: ConflictSwitcherProps) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {conflicts.map((c) => {
        const active = c.slug === activeSlug;
        return (
          <Link
            key={c.id}
            href={`/${c.slug}`}
            className={`flex items-center gap-2 whitespace-nowrap rounded px-3 py-1.5 text-sm ${
              active
                ? 'bg-panel text-white'
                : 'text-gray-400 hover:bg-panel-2 hover:text-gray-200'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${STATUS_COLOR[c.status] ?? 'bg-gray-500'}`}
            />
            {c.name}
          </Link>
        );
      })}
    </nav>
  );
}
