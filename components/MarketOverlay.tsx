'use client';

import type { Conflict } from '@/lib/data/conflicts';

/**
 * Phase 1E mount point — Polymarket/Kalshi odds overlay. Scaffold stub; the
 * markets subagent replaces this with the panel that reads `markets` +
 * `market_snapshots` for the active conflict and shows live odds next to
 * relevant events.
 */
export default function MarketOverlay(_props: { conflict: Conflict }) {
  return null;
}
