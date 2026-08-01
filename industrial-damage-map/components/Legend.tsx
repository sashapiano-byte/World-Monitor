'use client';

import { useState } from 'react';
import type { IndustryRecord } from '@/data/types';
import { STATUS_OUTLINE } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  normal_operations: 'Normal operations',
  operations_reduced: 'Operations reduced',
  partially_restored: 'Partially restored',
  fully_restored: 'Fully restored',
  temporarily_suspended: 'Temporarily suspended',
  long_term_shutdown: 'Long-term shutdown',
  destroyed: 'Destroyed',
  unknown: 'Status unknown',
};

export function Legend({ industries, className }: { industries: IndustryRecord[]; className?: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      // Read by MapView when framing the data, so records do not end up
      // permanently hidden underneath this panel.
      data-map-overlay="legend"
      className={cn(
        // The legend is absolutely positioned inside the map. Without a height
        // cap it grows upward past the map container and swallows clicks meant
        // for the toolbar above it, so the cap and inner scroll are load-bearing.
        'flex max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-background/95 p-2.5 text-[11px] shadow-lg backdrop-blur',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full shrink-0 items-center justify-between gap-3 font-semibold"
      >
        Legend
        <span className="text-muted-foreground">{open ? '−' : '+'}</span>
      </button>

      {open ? (
        <div className="mt-2 min-h-0 space-y-2.5 overflow-y-auto pr-1">
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Fill colour — industry</p>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {industries.map((i) => (
                <li key={i.id} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: i.color }}
                    aria-hidden
                  />
                  <span className="truncate" title={i.name}>
                    {i.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 font-medium text-muted-foreground">Outline — operational status</p>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <li key={key} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full border-2 bg-transparent"
                    style={{ borderColor: STATUS_OUTLINE[key] }}
                    aria-hidden
                  />
                  <span className="truncate" title={label}>
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Size</span> grows with the worst physical-damage score at the
            site (0–5) plus a small increment per repeat strike. A{' '}
            <span className="font-medium text-foreground">blue halo</span> marks a site in territory internationally
            recognised as Ukraine and under Russian occupation; those are counted separately.
          </p>
        </div>
      ) : null}
    </div>
  );
}
