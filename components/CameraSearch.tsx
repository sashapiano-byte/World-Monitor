'use client';

import type { ClientCamera } from '@/lib/cameras/types';

export interface CameraFilters {
  query: string;
  country: string;
  city: string;
  tag: string;
}

interface CameraSearchProps {
  filters: CameraFilters;
  onFilterChange: (patch: Partial<CameraFilters>) => void;
  facets: { countries: string[]; cities: string[]; tags: string[] };
  results: ClientCamera[];
  totalCount: number;
  selectedId: string | null;
  onSelect: (camera: ClientCamera) => void;
  onClose: () => void;
}

/**
 * Searchable / filterable camera list panel. Presentational: all state lives in
 * CameraLayer. Filters by country / city / tag and does a free-text match on
 * title + location. Each row shows a status chip so the (Phase-1) unverified
 * catalog is legible rather than looking broken.
 */
export default function CameraSearch({
  filters,
  onFilterChange,
  facets,
  results,
  totalCount,
  selectedId,
  onSelect,
  onClose,
}: CameraSearchProps) {
  return (
    <div className="pointer-events-auto flex h-full w-80 max-w-[85vw] flex-col border-l border-edge bg-panel-2/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
          Live Cameras
          <span className="ml-2 font-mono text-[11px] text-gray-500">
            {results.length}/{totalCount}
          </span>
        </h2>
        <button
          onClick={onClose}
          aria-label="Close camera panel"
          className="rounded p-1 text-gray-400 hover:bg-panel hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 border-b border-edge/60 p-3">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onFilterChange({ query: e.target.value })}
          placeholder="Search title or location…"
          className="w-full rounded border border-edge bg-panel px-2 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-accent-blue focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Country"
            value={filters.country}
            options={facets.countries}
            onChange={(v) => onFilterChange({ country: v })}
          />
          <Select
            label="City"
            value={filters.city}
            options={facets.cities}
            onChange={(v) => onFilterChange({ city: v })}
          />
        </div>
        <Select
          label="Tag"
          value={filters.tag}
          options={facets.tags}
          onChange={(v) => onFilterChange({ tag: v })}
        />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {results.map((cam) => {
          const active = cam.id === selectedId;
          return (
            <li key={cam.id} className="border-t border-edge/40 first:border-t-0">
              <button
                onClick={() => onSelect(cam)}
                className={`flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-panel ${
                  active ? 'bg-panel' : ''
                }`}
              >
                <StatusDot status={cam.status} category={cam.category} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-100">
                    {cam.title}
                  </span>
                  <span className="block truncate text-[11px] text-gray-500">
                    {[cam.city, cam.country].filter(Boolean).join(', ') || cam.locationName}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Chip>{cam.provider === 'youtube' ? 'YouTube' : cam.streamType}</Chip>
                    <Chip tone={cam.status === 'active' ? 'green' : 'amber'}>
                      {cam.status}
                    </Chip>
                    {cam.category === 'conflict' && <Chip tone="red">conflict</Chip>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {results.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-gray-500">
            {totalCount === 0
              ? 'No verified live cameras yet. The catalog is seeded but hidden until a liveness/ToS verification pass activates rows.'
              : 'No cameras match these filters.'}
          </li>
        )}
      </ul>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-edge bg-panel px-2 py-1.5 text-xs text-gray-200 focus:border-accent-blue focus:outline-none"
    >
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Chip({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode;
  tone?: 'gray' | 'green' | 'amber' | 'red';
}) {
  const tones: Record<string, string> = {
    gray: 'border-edge text-gray-400',
    green: 'border-accent-green/50 text-accent-green',
    amber: 'border-accent-amber/50 text-accent-amber',
    red: 'border-accent-red/50 text-accent-red',
  };
  return (
    <span
      className={`rounded border px-1 py-px text-[9px] uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function StatusDot({
  status,
  category,
}: {
  status: ClientCamera['status'];
  category: ClientCamera['category'];
}) {
  const color =
    status === 'active'
      ? 'bg-accent-green'
      : status === 'offline' || status === 'removed'
        ? 'bg-gray-600'
        : 'bg-accent-amber';
  return (
    <span
      title={`${status} · ${category}`}
      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${color}`}
    />
  );
}
