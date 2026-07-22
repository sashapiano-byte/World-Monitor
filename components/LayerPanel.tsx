'use client';

import type { ConflictLayer } from '@/lib/data/conflicts';

interface LayerPanelProps {
  layers: ConflictLayer[];
  visibleLayerIds: Set<string>;
  onToggle: (layerId: string) => void;
}

/**
 * Layer toggle panel. Each row shows the source name + license so credit is
 * always visible in the UI, not just on the map.
 */
export default function LayerPanel({
  layers,
  visibleLayerIds,
  onToggle,
}: LayerPanelProps) {
  return (
    <div className="w-72 shrink-0 overflow-y-auto border-r border-edge bg-panel-2/80 backdrop-blur">
      <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Layers
      </h2>
      <ul>
        {layers.map((layer) => {
          const on = visibleLayerIds.has(layer.id);
          return (
            <li key={layer.id} className="border-t border-edge/50">
              <button
                onClick={() => onToggle(layer.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-panel"
              >
                <span
                  className={`mt-1 h-3 w-3 shrink-0 rounded-sm border ${
                    on ? 'border-accent-red bg-accent-red' : 'border-edge'
                  }`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-gray-100">
                    {layer.name}
                  </span>
                  <span className="block truncate text-[11px] text-gray-500">
                    {layer.source_name} · {layer.license}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {layers.length === 0 && (
          <li className="px-4 py-6 text-sm text-gray-500">
            No layers configured for this conflict.
          </li>
        )}
      </ul>
    </div>
  );
}
