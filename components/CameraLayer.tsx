'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Conflict } from '@/lib/data/conflicts';
import type { ClientCamera } from '@/lib/cameras/types';
import { deriveFacets } from '@/lib/cameras/queries';
import CameraSearch, { type CameraFilters } from './CameraSearch';

/**
 * Phase 1C — live camera layer. Absolutely positioned inside the map <main>,
 * layered over MapView. Because MapView owns the Mapbox instance privately, this
 * overlay projects camera lng/lat into the conflict bbox itself: pins are a
 * FIXED overlay (they don't pan/zoom with the base map) — a deliberate Phase-1
 * simplification. The list panel + embed modal are the primary interaction.
 *
 * Data comes from GET /api/cameras (RLS-gated). The seeded catalog ships
 * 'unverified' and is hidden from the public anon key until a verification pass
 * activates rows — so an empty state here is expected, not an error.
 */
export default function CameraLayer({ conflict }: { conflict: Conflict }) {
  const [cameras, setCameras] = useState<ClientCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [selected, setSelected] = useState<ClientCamera | null>(null);
  const [filters, setFilters] = useState<CameraFilters>({
    query: '',
    country: '',
    city: '',
    tag: '',
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Fetch cameras for the active conflict.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/cameras?conflict=${encodeURIComponent(conflict.slug)}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setCameras(Array.isArray(body?.cameras) ? body.cameras : []);
      })
      .catch(() => !cancelled && setCameras([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [conflict.slug]);

  // Reset transient UI when the theatre changes.
  useEffect(() => {
    setSelected(null);
    setFilters({ query: '', country: '', city: '', tag: '' });
  }, [conflict.slug]);

  // Track overlay size for marker projection.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () =>
      setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const facets = useMemo(() => deriveFacets(cameras), [cameras]);

  const results = useMemo(
    () => applyFilters(cameras, filters),
    [cameras, filters],
  );

  const bbox = useMemo(() => resolveBbox(conflict, cameras), [conflict, cameras]);

  const pins = useMemo(() => {
    if (!showMarkers || size.w === 0 || size.h === 0) return [];
    return results
      .map((cam) => {
        const p = project(cam.lng, cam.lat, bbox, size.w, size.h);
        return p ? { cam, ...p } : null;
      })
      .filter((x): x is { cam: ClientCamera; left: number; top: number } => !!x);
  }, [results, bbox, size, showMarkers]);

  const patchFilters = (patch: Partial<CameraFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const openCamera = (cam: ClientCamera) => setSelected(cam);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-20">
      {/* Toolbar (top-left of map). */}
      <div className="pointer-events-auto absolute left-3 top-3 flex items-center gap-1 rounded-md border border-edge bg-panel-2/90 p-1 backdrop-blur">
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${
            panelOpen ? 'bg-accent-blue/20 text-accent-blue' : 'text-gray-200 hover:bg-panel'
          }`}
          title="Show camera list"
        >
          <CameraGlyph />
          Cameras
          <span className="font-mono text-[11px] text-gray-500">
            {loading ? '…' : cameras.length}
          </span>
        </button>
        <button
          onClick={() => setShowMarkers((v) => !v)}
          className={`rounded px-2 py-1 text-xs ${
            showMarkers ? 'text-accent-blue' : 'text-gray-500 hover:text-gray-300'
          }`}
          title="Toggle map pins (fixed overlay — approximate positions)"
        >
          Pins
        </button>
      </div>

      {/* Empty-state hint when nothing is publicly visible yet. */}
      {!loading && cameras.length === 0 && (
        <div className="pointer-events-auto absolute left-3 top-16 max-w-xs rounded-md border border-edge bg-panel-2/90 px-3 py-2 text-[11px] leading-snug text-gray-400 backdrop-blur">
          Camera catalog is seeded but every row is <span className="text-accent-amber">unverified</span>{' '}
          and hidden by RLS until a liveness/ToS pass activates it. See docs/camera-tos-review.md.
        </div>
      )}

      {/* Map pins (fixed overlay projection). */}
      {pins.map(({ cam, left, top }) => (
        <button
          key={cam.id}
          onClick={() => openCamera(cam)}
          style={{ left, top }}
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
          title={cam.title}
        >
          <span
            className={`block h-3 w-3 rounded-full border-2 border-panel shadow ${
              cam.category === 'conflict' ? 'bg-accent-red' : 'bg-accent-blue'
            } ${selected?.id === cam.id ? 'ring-2 ring-white' : ''}`}
          />
        </button>
      ))}

      {/* List / search panel. */}
      {panelOpen && (
        <div className="pointer-events-none absolute right-0 top-0 h-full">
          <CameraSearch
            filters={filters}
            onFilterChange={patchFilters}
            facets={facets}
            results={results}
            totalCount={cameras.length}
            selectedId={selected?.id ?? null}
            onSelect={openCamera}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      )}

      {/* Embed modal. */}
      {selected && (
        <CameraModal camera={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CameraModal({
  camera,
  onClose,
}: {
  camera: ClientCamera;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-edge bg-panel-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-edge px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">
              {camera.title}
            </h3>
            <p className="truncate text-[11px] text-gray-500">
              {[camera.locationName, camera.city, camera.country]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-panel hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="bg-black">
          {camera.canEmbed && camera.embedUrl ? (
            <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                key={camera.id}
                src={buildEmbedSrc(camera.embedUrl)}
                title={camera.title}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm text-gray-300">
                {camera.provider === 'youtube'
                  ? 'No embeddable live id resolved yet for this stream.'
                  : 'This is a non-YouTube source pending ToS review; it is not embedded here.'}
              </p>
              <a
                href={camera.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-accent-blue px-3 py-1.5 text-sm font-medium text-black hover:opacity-90"
              >
                {camera.provider === 'youtube' ? 'Find live stream on YouTube ↗' : 'Open source ↗'}
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-edge px-4 py-3 text-[11px] text-gray-500">
          <span className="rounded border border-edge px-1.5 py-0.5">
            {camera.provider === 'youtube' ? 'YouTube-Live embed' : camera.streamType}
          </span>
          <span className="rounded border border-edge px-1.5 py-0.5 capitalize">
            {camera.status}
          </span>
          {camera.tags.slice(0, 5).map((t) => (
            <span key={t} className="text-gray-600">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Ensure autoplay-muted params exist on the embed src for a live stream. */
function buildEmbedSrc(embedUrl: string): string {
  try {
    const u = new URL(embedUrl);
    if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay', '1');
    if (!u.searchParams.has('mute')) u.searchParams.set('mute', '1');
    return u.toString();
  } catch {
    return embedUrl;
  }
}

function applyFilters(
  cameras: ClientCamera[],
  filters: CameraFilters,
): ClientCamera[] {
  const q = filters.query.trim().toLowerCase();
  return cameras.filter((c) => {
    if (filters.country && c.country !== filters.country) return false;
    if (filters.city && c.city !== filters.city) return false;
    if (filters.tag && !c.tags.includes(filters.tag)) return false;
    if (q) {
      const hay = [c.title, c.locationName, c.city, c.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

type Bbox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

function resolveBbox(conflict: Conflict, cameras: ClientCamera[]): Bbox {
  if (conflict.bbox && conflict.bbox.length === 4) {
    return conflict.bbox as Bbox;
  }
  if (cameras.length > 0) {
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    for (const c of cameras) {
      minLng = Math.min(minLng, c.lng);
      maxLng = Math.max(maxLng, c.lng);
      minLat = Math.min(minLat, c.lat);
      maxLat = Math.max(maxLat, c.lat);
    }
    // Pad a touch so edge pins aren't clipped.
    const padX = (maxLng - minLng) * 0.05 || 1;
    const padY = (maxLat - minLat) * 0.05 || 1;
    return [minLng - padX, minLat - padY, maxLng + padX, maxLat + padY];
  }
  // Fallback: whole-world.
  return [-180, -85, 180, 85];
}

const mercY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (clampLat(lat) * Math.PI) / 360));

const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat));

/** Project lng/lat into pixel offsets within the overlay, or null if outside. */
function project(
  lng: number,
  lat: number,
  bbox: Bbox,
  w: number,
  h: number,
): { left: number; top: number } | null {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const spanLng = maxLng - minLng;
  if (spanLng <= 0) return null;
  const fracX = (lng - minLng) / spanLng;

  const yTop = mercY(maxLat);
  const yBot = mercY(minLat);
  const spanY = yTop - yBot;
  if (spanY <= 0) return null;
  const fracY = (yTop - mercY(lat)) / spanY;

  if (fracX < -0.02 || fracX > 1.02 || fracY < -0.02 || fracY > 1.02) return null;
  return { left: fracX * w, top: fracY * h };
}

function CameraGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m23 7-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
