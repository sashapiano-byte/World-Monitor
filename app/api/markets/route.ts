import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { UiMarket } from '@/lib/markets/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/markets?conflict=:slug
 *
 * Returns merged, normalized prediction-market odds for a conflict as
 * `UiMarket[]`, read from the `markets` + `market_snapshots` tables (populated
 * by the seed migration and, later, live ingestion via lib/markets). Odds
 * movement is derived from the two most-recent snapshots per market.
 *
 * On any error this returns an empty list (never 500) so the overlay degrades
 * to "No linked markets" rather than breaking the dashboard.
 */

interface MarketDbRow {
  id: string;
  provider: 'polymarket' | 'kalshi';
  external_id: string;
  question: string;
  url: string | null;
  status: 'open' | 'closed' | 'resolved';
  metadata: Record<string, unknown> | null;
}

interface SnapshotDbRow {
  market_id: string;
  outcome: string;
  probability: number;
  volume: number | null;
  captured_at: string;
}

const empty = { markets: [] as UiMarket[] };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('conflict');
  if (!slug) return NextResponse.json(empty);

  try {
    const supabase = createSupabaseServerClient();

    const { data: conflict } = await supabase
      .from('conflicts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle<{ id: string }>();
    if (!conflict) return NextResponse.json(empty);

    const { data: marketRows } = await supabase
      .from('markets')
      .select('id, provider, external_id, question, url, status, metadata')
      .eq('conflict_id', conflict.id)
      .neq('status', 'closed')
      .returns<MarketDbRow[]>();

    const markets = marketRows ?? [];
    if (markets.length === 0) return NextResponse.json(empty);

    const ids = markets.map((m) => m.id);
    const { data: snapRows } = await supabase
      .from('market_snapshots')
      .select('market_id, outcome, probability, volume, captured_at')
      .in('market_id', ids)
      .order('captured_at', { ascending: false })
      .limit(2000)
      .returns<SnapshotDbRow[]>();

    // Group snapshots by market, newest first (query already ordered desc).
    const byMarket = new Map<string, SnapshotDbRow[]>();
    for (const s of snapRows ?? []) {
      const arr = byMarket.get(s.market_id);
      if (arr) arr.push(s);
      else byMarket.set(s.market_id, [s]);
    }

    const ui: UiMarket[] = markets.map((m) => {
      const snaps = byMarket.get(m.id) ?? [];
      // Latest snapshot per outcome for the full outcome set.
      const latestByOutcome = new Map<string, SnapshotDbRow>();
      for (const s of snaps) {
        if (!latestByOutcome.has(s.outcome)) latestByOutcome.set(s.outcome, s);
      }
      const outcomes = [...latestByOutcome.values()].map((s) => ({
        label: s.outcome,
        probability: s.probability,
        price: s.probability,
      }));

      // Representative outcome: 'Yes' if present, else highest probability.
      const rep =
        outcomes.find((o) => o.label.toLowerCase() === 'yes') ??
        outcomes.reduce<(typeof outcomes)[number] | null>(
          (best, o) => (!best || o.probability > best.probability ? o : best),
          null,
        );

      const latest = snaps[0] ?? null;
      // Prior reading for the representative outcome (for movement).
      const priorForRep = rep
        ? snaps.find(
            (s) => s.outcome === rep.label && s !== latestByOutcome.get(rep.label),
          )
        : undefined;

      return {
        id: m.id,
        provider: m.provider,
        externalId: m.external_id,
        question: m.question,
        url: m.url,
        status: m.status,
        outcome: rep?.label ?? 'Yes',
        probability: rep?.probability ?? 0,
        outcomes,
        volume: latest?.volume ?? null,
        previousProbability: priorForRep?.probability ?? null,
        capturedAt: latest?.captured_at ?? null,
        endDate:
          (m.metadata?.endDate as string | undefined) ??
          (m.metadata?.end_date as string | undefined) ??
          null,
      };
    });

    ui.sort((a, b) => {
      const dv = (b.volume ?? 0) - (a.volume ?? 0);
      if (dv !== 0) return dv;
      return b.probability - a.probability;
    });

    return NextResponse.json(
      { markets: ui },
      {
        headers: {
          'cache-control': 's-maxage=120, stale-while-revalidate=600',
        },
      },
    );
  } catch (err) {
    console.error('[api/markets] error', err);
    return NextResponse.json(empty);
  }
}
