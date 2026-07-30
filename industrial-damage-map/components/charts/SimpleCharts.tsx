import { formatMonth } from '@/lib/utils';

/**
 * Deliberately plain, server-rendered charts.
 *
 * A dependency-free bar is enough for counts of this size, it renders in the
 * printed PDF report, and it keeps every number legible as text rather than
 * hiding it inside a canvas — which matters for a dataset whose whole point is
 * that the reader can check the figures.
 */

export function BarRow({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 text-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {color ? (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          ) : null}
          <span className="truncate" title={label}>
            {label}
          </span>
        </div>
        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%`, backgroundColor: color ?? 'hsl(var(--primary))' }}
          />
        </div>
      </div>
      <span className="text-right tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

export function MonthlyBars({ data }: { data: { month: string; count: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-muted-foreground">No incidents in range.</p>;
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="scroll-x">
      {/* Each column must be full height: a percentage height on the bar
          resolves against its parent, and an `items-end` parent sizes to
          content, which collapses every bar to zero. */}
      <div className="flex h-36 min-w-[36rem] items-stretch gap-[3px]">
        {data.map((d) => (
          <div key={d.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[9px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {d.count}
            </span>
            <div
              className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max((d.count / max) * 100, 3)}%` }}
              title={`${formatMonth(d.month)}: ${d.count} incident(s)`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex min-w-[36rem] justify-between text-[10px] text-muted-foreground">
        <span>{formatMonth(data[0].month)}</span>
        <span>{formatMonth(data[data.length - 1].month)}</span>
      </div>
    </div>
  );
}
