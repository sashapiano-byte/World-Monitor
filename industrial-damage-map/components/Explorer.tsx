'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { IndustryRecord, RegionRecord } from '@/data/types';
import { applyFilters, DEFAULT_FILTERS, type FacilityView, type Filters, toGeoJson } from '@/lib/filter-core';
import { cn, formatDate } from '@/lib/utils';
import { FacilityPanel } from './FacilityPanel';
import { FilterPanel } from './FilterPanel';
import { Legend } from './Legend';
import { Badge, Button } from './ui/primitives';

// MapLibre touches `window` at import time, so it must not be server-rendered.
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

export interface ExplorerProps {
  views: FacilityView[];
  industries: IndustryRecord[];
  regions: RegionRecord[];
  dateBounds: { min: string; max: string };
}

export function Explorer({ views, industries, regions, dateBounds }: ExplorerProps) {
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'map' | 'table'>('map');

  const filtered = useMemo(() => applyFilters(views, filters), [views, filters]);
  const geojson = useMemo(() => toGeoJson(filtered, industries, regions), [filtered, industries, regions]);
  const selected = useMemo(
    () => filtered.find((v) => v.facility.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const incidentTotal = filtered.reduce((sum, v) => sum + v.incidents.length, 0);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="no-print w-full shrink-0 border-b border-border lg:w-80 lg:border-b-0 lg:border-r">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          industries={industries}
          regions={regions}
          dateBounds={dateBounds}
          resultCount={filtered.length}
          incidentCount={incidentTotal}
        />
      </aside>

      {/* `min-w-0` is load-bearing: flexbox defaults to min-width:auto, so the
          wide data table below would otherwise refuse to shrink and push the
          facility detail panel off the right edge of the viewport. */}
      <section className="relative flex min-h-[36rem] min-w-0 flex-1 flex-col">
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <div className="inline-flex rounded-md bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setMode('map')}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                mode === 'map' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setMode('table')}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                mode === 'table' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
              data-testid="view-table"
            >
              Table
            </button>
          </div>
          <span className="text-xs text-muted-foreground" data-testid="result-summary">
            {filtered.length} facilities · {incidentTotal} incidents shown
          </span>
          {filters.includeUnconfirmed ? (
            <Badge variant="warning">Unconfirmed layer ON — these records are not findings</Badge>
          ) : null}
          {filters.includeBorderline ? (
            <Badge variant="outline">Flagged non-industrial sites shown separately</Badge>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Print
            </Button>
            <Link
              href="/api/export/geojson"
              className="inline-flex h-7 items-center rounded border border-input px-2 text-xs hover:bg-accent"
            >
              GeoJSON
            </Link>
            <Link
              href="/api/export/facilities.csv"
              className="inline-flex h-7 items-center rounded border border-input px-2 text-xs hover:bg-accent"
            >
              CSV
            </Link>
          </div>
        </div>

        {mode === 'map' ? (
          <div className="relative flex-1">
            <MapView geojson={geojson} selectedId={selectedId} onSelect={setSelectedId} />
            <Legend industries={industries} className="absolute bottom-3 left-3 z-10 w-[22rem] max-w-[calc(100%-1.5rem)]" />
          </div>
        ) : (
          <FacilityTable views={filtered} onSelect={setSelectedId} />
        )}
      </section>

      {selected ? (
        <aside className="w-full shrink-0 overflow-y-auto border-t border-border lg:max-h-[calc(100vh-3rem)] lg:w-[28rem] lg:border-l lg:border-t-0">
          <FacilityPanel view={selected} industries={industries} regions={regions} onClose={() => setSelectedId(null)} />
        </aside>
      ) : null}
    </div>
  );
}

function FacilityTable({ views, onSelect }: { views: FacilityView[]; onSelect: (id: string) => void }) {
  return (
    <div className="scroll-x flex-1">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <thead className="sticky top-0 bg-muted/90 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
          <tr>
            <th className="px-3 py-2 font-medium">Facility</th>
            <th className="px-3 py-2 font-medium">Industry</th>
            <th className="px-3 py-2 font-medium">Locality</th>
            <th className="px-3 py-2 font-medium">Incidents</th>
            <th className="px-3 py-2 font-medium">Worst damage</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">First</th>
            <th className="px-3 py-2 font-medium">Last</th>
            <th className="px-3 py-2 font-medium">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => (
            <tr
              key={v.facility.id}
              className="cursor-pointer border-b border-border/60 hover:bg-accent/50"
              onClick={() => onSelect(v.facility.id)}
            >
              <td className="px-3 py-2">
                <Link href={`/facility/${v.facility.slug}`} className="font-medium underline-offset-2 hover:underline">
                  {v.facility.canonicalName}
                </Link>
                {v.facility.siteCategory !== 'industrial' ? (
                  <Badge variant="outline" className="ml-2">
                    flagged: {v.facility.siteCategory.replace(/_/g, ' ')}
                  </Badge>
                ) : null}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{v.facility.industryId.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2 text-muted-foreground">{v.facility.locality}</td>
              <td className="px-3 py-2 tabular-nums">{v.incidents.length}</td>
              <td className="px-3 py-2 tabular-nums">{v.maxDamageScore}/5</td>
              <td className="px-3 py-2 text-muted-foreground">
                {(v.currentStatus?.status ?? 'unknown').replace(/_/g, ' ')}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(v.firstIncidentDate)}</td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(v.lastIncidentDate)}</td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap gap-1">
                  {v.hasSatelliteEvidence ? <Badge variant="success">satellite</Badge> : null}
                  {v.hasFinancialEstimate ? <Badge>financial</Badge> : null}
                  {v.isSingleSourceOnly ? <Badge variant="warning">single-source</Badge> : null}
                </span>
              </td>
            </tr>
          ))}
          {views.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                No facilities match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
