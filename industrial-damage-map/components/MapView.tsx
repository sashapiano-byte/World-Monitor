'use client';

import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapFeatureProperties {
  id: string;
  slug: string;
  name: string;
  industryColor: string;
  status: string;
  maxDamageScore: number;
  incidentCount: number;
  territoryStatus: string;
  hasUnconfirmed: boolean;
}

export interface MapViewProps {
  geojson: GeoJSON.FeatureCollection;
  selectedId: string | null;
  onSelect: (facilityId: string | null) => void;
}

/**
 * OpenStreetMap raster basemap built locally — no API key, no vendor account,
 * no Google Maps dependency. Set NEXT_PUBLIC_BASEMAP_STYLE_URL to point at your
 * own vector style instead.
 */
function osmRasterStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#eef1f4' } },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        paint: { 'raster-saturation': -0.55, 'raster-contrast': -0.08, 'raster-opacity': 0.9 },
      },
    ],
  };
}

const STATUS_OUTLINE: Record<string, string> = {
  normal_operations: '#3fb950',
  operations_reduced: '#d29922',
  partially_restored: '#58a6ff',
  fully_restored: '#3fb950',
  temporarily_suspended: '#f85149',
  long_term_shutdown: '#a40e26',
  destroyed: '#111111',
  unknown: '#8b949e',
};

export default function MapView({ geojson, selectedId, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const styleUrl = process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl && styleUrl.length > 0 ? styleUrl : osmRasterStyle(),
      center: [58, 55],
      zoom: 3,
      minZoom: 2,
      maxZoom: 12, // Deliberate cap: this project never publishes site-interior detail.
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.getContainer().dataset.mapState = 'loading';

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // Bottom-right, because the legend sits bottom-left.
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    // Tile fetches can fail on restricted networks; that must degrade to a
    // blank basemap with markers still drawn, never to a dead map.
    map.on('error', (event) => {
      const message = (event as unknown as { error?: Error }).error?.message ?? 'unknown map error';
      if (/tile|fetch|network/i.test(message)) return;
      map.getContainer().dataset.mapState = 'error';
      console.error('[map]', message);
    });

    // IMPORTANT: sources and layers are added on `style.load`, NOT on `load`.
    // MapLibre's `load` waits for "all necessary resources", which includes the
    // first basemap tiles — so on a restricted or offline network it never
    // fires and the map would stay permanently empty. `style.load` needs only
    // the style JSON, which is built locally, so markers always render even
    // when the basemap does not.
    const initialiseLayers = () => {
      map.addSource('facilities', {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterRadius: 42,
        clusterMaxZoom: 7,
        clusterProperties: {
          // Cluster colour follows the worst damage inside it.
          maxDamage: ['max', ['get', 'maxDamageScore']],
        },
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'facilities',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'maxDamage'], '#94a3b8', 3, '#f59e0b', 4, '#ef4444', 5, '#7f1d1d'],
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 14, 5, 19, 12, 25],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'facilities',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11 },
        paint: { 'text-color': '#0b1220' },
      });

      // Occupied-territory sites are drawn as a visually distinct halo so a
      // reader can never mistake them for undisputed Russian territory.
      map.addLayer({
        id: 'occupied-halo',
        type: 'circle',
        source: 'facilities',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['==', ['get', 'territoryStatus'], 'occupied_ukraine_internationally_recognised_as_ukraine'],
        ],
        paint: {
          'circle-radius': ['+', ['*', ['get', 'maxDamageScore'], 2.4], 12],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0ea5e9',
          'circle-stroke-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'facility-points',
        type: 'circle',
        source: 'facilities',
        filter: ['!', ['has', 'point_count']],
        paint: {
          // Colour = industry. Size = worst damage score + repeat strikes.
          'circle-color': ['get', 'industryColor'],
          'circle-radius': [
            '+',
            ['+', 6, ['*', ['get', 'maxDamageScore'], 2.2]],
            ['min', ['*', ['-', ['get', 'incidentCount'], 1], 0.9], 5],
          ],
          'circle-opacity': 0.92,
          // Outline = operational status.
          'circle-stroke-width': ['case', ['==', ['get', 'hasUnconfirmed'], true], 2.5, 2],
          // Built as a `match` expression over the status→colour table. Typed
          // loosely because MapLibre's expression types cannot describe a
          // variadic match built from a runtime object.
          'circle-stroke-color': [
            'match',
            ['get', 'status'],
            ...Object.entries(STATUS_OUTLINE).flat(),
            '#8b949e',
          ] as unknown as maplibregl.ExpressionSpecification,
        },
      });

      map.addLayer({
        id: 'facility-selected',
        type: 'circle',
        source: 'facilities',
        filter: ['==', ['get', 'id'], '__none__'],
        paint: {
          'circle-radius': ['+', ['*', ['get', 'maxDamageScore'], 2.2], 15],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#0f172a',
        },
      });

      readyRef.current = true;
      map.getContainer().dataset.mapState = 'ready';

      map.on('click', 'facility-points', (e) => {
        const feature = e.features?.[0];
        if (feature) onSelectRef.current(String(feature.properties?.id));
      });

      map.on('click', 'clusters', async (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
        if (!feature) return;
        const source = map.getSource('facilities') as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(feature.properties?.cluster_id as number);
        map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });

      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['facility-points', 'clusters'] });
        if (hits.length === 0) onSelectRef.current(null);
      });

      for (const layer of ['facility-points', 'clusters']) {
        map.on('mouseenter', layer, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      map.on('mousemove', 'facility-points', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as unknown as MapFeatureProperties;
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div class="px-2.5 py-1.5 text-xs"><div class="font-medium">${escapeHtml(p.name)}</div>` +
              `<div class="text-muted-foreground">${p.incidentCount} incident(s) · worst damage ${p.maxDamageScore}/5</div></div>`,
          )
          .addTo(map);
      });
      map.on('mouseleave', 'facility-points', () => popup.remove());

      // Publish how many markers are actually painted. WebGL output is opaque
      // to the DOM, so without this an end-to-end test can only assert that a
      // canvas exists — not that anything was drawn on it.
      //
      // Counted on `sourcedata` rather than `idle` for the same reason layers
      // are added on `style.load`: `idle` waits for basemap tiles to settle and
      // never arrives when they are unreachable.
      const publishMarkerCount = () => {
        requestAnimationFrame(() => {
          if (!mapRef.current) return;
          const painted = map.queryRenderedFeatures({ layers: ['facility-points', 'clusters'] }).length;
          map.getContainer().dataset.renderedMarkers = String(painted);
        });
      };
      map.on('sourcedata', (event) => {
        if (event.sourceId === 'facilities' && event.isSourceLoaded) publishMarkerCount();
      });
      map.on('moveend', publishMarkerCount);
      publishMarkerCount();

      // Frame the data rather than the whole federation: almost every record
      // sits west of the Urals, so the default world view wastes most of the
      // canvas on empty ocean and Siberia.
      fitToData(map, geojson);
    };

    if (map.isStyleLoaded()) initialiseLayers();
    else map.once('style.load', initialiseLayers);

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // The map is created once; data and selection are pushed in by the effects
    // below. Re-creating it on every filter change would be visibly janky.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource('facilities') as GeoJSONSource | undefined;
      if (source) source.setData(geojson);
    };
    if (readyRef.current) apply();
    else map.once('style.load', apply);
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (!map.getLayer('facility-selected')) return;
    map.setFilter('facility-selected', ['==', ['get', 'id'], selectedId ?? '__none__']);

    if (selectedId) {
      const feature = geojson.features.find((f) => f.properties?.id === selectedId);
      if (feature && feature.geometry.type === 'Point') {
        map.easeTo({
          center: feature.geometry.coordinates as [number, number],
          zoom: Math.max(map.getZoom(), 6),
          duration: 600,
        });
      }
    }
  }, [selectedId, geojson]);

  return <div ref={containerRef} className="h-full w-full" data-testid="map-canvas" />;
}

/** Zoom to the extent of the visible records, with a sane zoom ceiling. */
function fitToData(map: MapLibreMap, geojson: GeoJSON.FeatureCollection): void {
  const points = geojson.features
    .filter((f) => f.geometry.type === 'Point')
    .map((f) => (f.geometry as GeoJSON.Point).coordinates as [number, number]);
  if (points.length === 0) return;

  const bounds = points.reduce(
    (acc, [lon, lat]) => acc.extend([lon, lat]),
    new maplibregl.LngLatBounds(points[0], points[0]),
  );
  map.fitBounds(bounds, { padding: { top: 48, right: 48, bottom: 48, left: 48 }, maxZoom: 6, duration: 0 });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
