'use client';

import { useState } from 'react';
import type { Conflict, ConflictLayer } from '@/lib/data/conflicts';
import MapView from './MapView';
import LayerPanel from './LayerPanel';
import ConflictSwitcher from './ConflictSwitcher';
import CameraLayer from './CameraLayer';
import MarketOverlay from './MarketOverlay';

interface DashboardProps {
  conflicts: Conflict[];
  conflict: Conflict;
  layers: ConflictLayer[];
}

/**
 * Client shell composing the switcher, layer panel, map, camera layer (Phase
 * 1C) and prediction-market overlay (Phase 1E). Mount points for C and E are
 * wired now; those subagents fill in the components.
 */
export default function Dashboard({
  conflicts,
  conflict,
  layers,
}: DashboardProps) {
  const [visibleLayerIds, setVisibleLayerIds] = useState<Set<string>>(
    () => new Set(layers.filter((l) => l.default_visible).map((l) => l.id)),
  );

  const toggle = (id: string) =>
    setVisibleLayerIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-edge bg-panel-2 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-tight text-white">
            FRONTLINE
          </span>
          <ConflictSwitcher conflicts={conflicts} activeSlug={conflict.slug} />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <LayerPanel
          layers={layers}
          visibleLayerIds={visibleLayerIds}
          onToggle={toggle}
        />
        <main className="relative min-w-0 flex-1">
          <MapView
            conflict={conflict}
            layers={layers}
            visibleLayerIds={visibleLayerIds}
          />
          {/* Phase 1C */}
          <CameraLayer conflict={conflict} />
          {/* Phase 1E */}
          <MarketOverlay conflict={conflict} />
        </main>
      </div>
    </div>
  );
}
