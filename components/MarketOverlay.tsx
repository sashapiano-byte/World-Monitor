'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { formatDistanceToNowStrict } from 'date-fns';
import type { Conflict } from '@/lib/data/conflicts';
import type { UiMarket } from '@/lib/markets/types';

/**
 * Phase 1E — prediction-market odds overlay.
 *
 * Collapsible card pinned to the bottom-right of the map <main>. Fetches
 * /api/markets?conflict=:slug and renders a volume-ranked list of relevant
 * Polymarket / Kalshi markets: question, current % odds with a bar, provider
 * badge, volume, optional movement arrow, and a link out. Degrades to a
 * "No linked markets" line when nothing is linked yet.
 */

const PROVIDER_LABEL: Record<UiMarket['provider'], string> = {
  polymarket: 'Polymarket',
  kalshi: 'Kalshi',
};

function formatVolume(v: number | null): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function MovementArrow({ market }: { market: UiMarket }) {
  if (market.previousProbability == null) return null;
  const delta = market.probability - market.previousProbability;
  if (Math.abs(delta) < 0.005) return null;
  const up = delta > 0;
  return (
    <span
      className={clsx(
        'ml-1 tabular-nums text-[10px] font-medium',
        up ? 'text-accent-green' : 'text-accent-red',
      )}
      title="Change since previous snapshot"
    >
      {up ? '▲' : '▼'}
      {Math.abs(Math.round(delta * 100))}
    </span>
  );
}

function MarketRow({ m }: { m: UiMarket }) {
  const volume = formatVolume(m.volume);
  const body = (
    <div className="group flex flex-col gap-1 rounded-md border border-edge bg-panel px-2.5 py-2 transition-colors hover:border-accent-blue/60">
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-[11px] leading-snug text-[#e6edf3]">
          {m.question}
        </span>
        <span className="shrink-0 tabular-nums text-sm font-semibold text-white">
          {pct(m.probability)}
          <MovementArrow market={m} />
        </span>
      </div>

      {/* Probability bar. */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-edge">
        <div
          className="h-full rounded-full bg-accent-blue"
          style={{ width: `${Math.min(100, Math.max(2, m.probability * 100))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#8b949e]">
        <span className="flex items-center gap-1.5">
          <span
            className={clsx(
              'rounded px-1 py-px font-medium',
              m.provider === 'polymarket'
                ? 'bg-accent-blue/15 text-accent-blue'
                : 'bg-accent-green/15 text-accent-green',
            )}
          >
            {PROVIDER_LABEL[m.provider]}
          </span>
          <span className="truncate">{m.outcome}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {volume && <span className="tabular-nums">{volume}</span>}
          {m.url && (
            <span className="text-accent-blue opacity-0 transition-opacity group-hover:opacity-100">
              open ↗
            </span>
          )}
        </span>
      </div>
    </div>
  );

  return m.url ? (
    <a href={m.url} target="_blank" rel="noopener noreferrer" className="block">
      {body}
    </a>
  ) : (
    body
  );
}

export default function MarketOverlay({ conflict }: { conflict: Conflict }) {
  const [markets, setMarkets] = useState<UiMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/markets?conflict=${encodeURIComponent(conflict.slug)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { markets: [] }))
      .then((data: { markets?: UiMarket[] }) => {
        if (cancelled) return;
        setMarkets(Array.isArray(data.markets) ? data.markets : []);
        setFetchedAt(new Date());
      })
      .catch(() => {
        if (!cancelled) setMarkets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [conflict.slug]);

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex w-[300px] max-w-[calc(100%-1.5rem)] flex-col">
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-lg border border-edge bg-panel-2/95 shadow-xl backdrop-blur">
        {/* Header / toggle. */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-between gap-2 border-b border-edge px-3 py-2 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white">
              Prediction Markets
            </span>
            {!loading && (
              <span className="tabular-nums text-[10px] text-[#8b949e]">
                {markets.length}
              </span>
            )}
          </span>
          <span className="text-[10px] text-[#8b949e]">
            {collapsed ? '▲' : '▼'}
          </span>
        </button>

        {!collapsed && (
          <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto p-2">
            {loading ? (
              <p className="px-1 py-4 text-center text-[11px] text-[#8b949e]">
                Loading odds…
              </p>
            ) : markets.length === 0 ? (
              <p className="px-1 py-4 text-center text-[11px] text-[#8b949e]">
                No linked markets for {conflict.name} yet.
              </p>
            ) : (
              markets.map((m) => <MarketRow key={m.id} m={m} />)
            )}
          </div>
        )}

        {!collapsed && !loading && markets.length > 0 && (
          <div className="border-t border-edge px-3 py-1.5 text-[9px] text-[#8b949e]">
            Odds via Polymarket &amp; Kalshi
            {fetchedAt &&
              ` · updated ${formatDistanceToNowStrict(fetchedAt, {
                addSuffix: true,
              })}`}
          </div>
        )}
      </div>
    </div>
  );
}
