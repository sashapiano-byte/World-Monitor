'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Conflict, ConflictLayer } from '@/lib/data/conflicts';

interface MapViewProps {
  conflict: Conflict;
  layers: ConflictLayer[];
  /** Layer ids currently toggled on. */
  visibleLayerIds: Set<string>;
  children?: React.ReactNode;
}

/**
 * Mapbox GL dashboard map. Attribution is load-bearing: every layer's credit
 * line is registered with the map's AttributionControl and can never be
 * toggled off. Feature geometry is fetched per-layer from the API.
 */
export default function MapView({
  conflict,
  layers,
  visibleLayerIds,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // Init once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn('[map] NEXT_PUBLIC_MAPBOX_TOKEN missing — map disabled');
      return;
    }
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [conflict.center_lng, conflict.center_lat],
      zoom: conflict.default_zoom,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    // Persistent, non-removable attribution for every source credit line.
    map.addControl(
      new mapboxgl.AttributionControl({
        customAttribution: layers.map((l) => l.attribution),
      }),
    );
    map.on('load', () => setReady(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflict.id]);

  // Load / toggle feature layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    layers.forEach(async (layer) => {
      const sourceId = `layer-${layer.id}`;
      const visible = visibleLayerIds.has(layer.id);

      if (!map.getSource(sourceId)) {
        if (!visible) return;
        try {
          const res = await fetch(
            `/api/conflicts/${conflict.slug}/features?layer=${layer.key}`,
          );
          const geojson = await res.json();
          map.addSource(sourceId, { type: 'geojson', data: geojson });
          addRenderLayers(map, layer, sourceId);
        } catch (err) {
          console.error(`[map] failed loading layer ${layer.key}`, err);
        }
      } else {
        setLayerVisibility(map, layer, visible);
      }
    });
  }, [ready, layers, visibleLayerIds, conflict.slug]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

/** Render mapbox layers for a normalized feature source, keyed off layer_type. */
function addRenderLayers(
  map: mapboxgl.Map,
  layer: ConflictLayer,
  sourceId: string,
) {
  const style = (layer.style ?? {}) as Record<string, unknown>;
  const base = { id: `render-${layer.id}`, source: sourceId };
  switch (layer.layer_type) {
    case 'heatmap':
      map.addLayer({ ...base, type: 'heatmap', paint: (style.paint as object) ?? {} });
      break;
    case 'fill':
      map.addLayer({
        ...base,
        type: 'fill',
        paint: (style.paint as object) ?? { 'fill-color': '#f85149', 'fill-opacity': 0.25 },
      });
      break;
    case 'line':
      map.addLayer({ ...base, type: 'line', paint: (style.paint as object) ?? { 'line-color': '#f85149' } });
      break;
    default:
      map.addLayer({
        ...base,
        type: 'circle',
        paint: (style.paint as object) ?? {
          'circle-radius': 4,
          'circle-color': '#f85149',
          'circle-opacity': 0.8,
        },
      });
  }
}

function setLayerVisibility(
  map: mapboxgl.Map,
  layer: ConflictLayer,
  visible: boolean,
) {
  const id = `render-${layer.id}`;
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}
