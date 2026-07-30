'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import type { IndustryRecord, RegionRecord } from '@/data/types';
import { ATTACK_METHODS, OPERATIONAL_STATUSES } from '@/data/types';
import { DEFAULT_FILTERS, type Filters } from '@/lib/filter-core';
import { cn } from '@/lib/utils';
import { Button, Field, Separator, Switch } from './ui/primitives';

const METHOD_LABELS: Record<string, string> = {
  uav: 'UAV / drone',
  cruise_missile: 'Cruise missile',
  ballistic_missile: 'Ballistic missile',
  sabotage: 'Sabotage',
  shelling: 'Shelling',
  naval_drone: 'Naval drone',
  unknown_means: 'Means not established',
};

export interface FilterPanelProps {
  filters: Filters;
  onChange: (next: Filters) => void;
  industries: IndustryRecord[];
  regions: RegionRecord[];
  dateBounds: { min: string; max: string };
  resultCount: number;
  incidentCount: number;
}

export function FilterPanel({
  filters,
  onChange,
  industries,
  regions,
  dateBounds,
  resultCount,
  incidentCount,
}: FilterPanelProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const toggleIn = (key: 'regions' | 'industries' | 'methods' | 'statuses', value: string) => {
    const current = filters[key] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    set({ [key]: next.length ? next : undefined } as Partial<Filters>);
  };

  const minMs = Date.parse(dateBounds.min);
  const maxMs = Date.parse(dateBounds.max);
  const dayMs = 86_400_000;
  const totalDays = Math.max(1, Math.round((maxMs - minMs) / dayMs));
  const fromDay = filters.from ? Math.round((Date.parse(filters.from) - minMs) / dayMs) : 0;
  const toDay = filters.to ? Math.round((Date.parse(filters.to) - minMs) / dayMs) : totalDays;
  const dayToIso = (day: number) => new Date(minMs + day * dayMs).toISOString().slice(0, 10);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm lg:max-h-[calc(100vh-3rem)]">
      <div className="space-y-1.5">
        <input
          type="search"
          value={filters.q ?? ''}
          onChange={(e) => set({ q: e.target.value || undefined })}
          placeholder="Search name, owner, town, tag…"
          data-testid="search-input"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          {resultCount} facilities · {incidentCount} incidents
        </p>
      </div>

      <Separator />

      <Field label="Period" hint={`${filters.from ?? dateBounds.min} → ${filters.to ?? dateBounds.max}`}>
        <SliderPrimitive.Root
          className="relative flex h-5 w-full touch-none select-none items-center"
          value={[fromDay, toDay]}
          min={0}
          max={totalDays}
          step={1}
          minStepsBetweenThumbs={1}
          onValueChange={([a, b]) =>
            set({
              from: a <= 0 ? undefined : dayToIso(a),
              to: b >= totalDays ? undefined : dayToIso(b),
            })
          }
          aria-label="Incident date range"
        >
          <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-muted">
            <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
          </SliderPrimitive.Track>
          {[0, 1].map((i) => (
            <SliderPrimitive.Thumb
              key={i}
              className="block h-3.5 w-3.5 rounded-full border-2 border-primary bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ))}
        </SliderPrimitive.Root>
      </Field>

      <Field label="Damage score" hint={`${filters.minDamage ?? 0}–${filters.maxDamage ?? 5}`}>
        <SliderPrimitive.Root
          className="relative flex h-5 w-full touch-none select-none items-center"
          value={[filters.minDamage ?? 0, filters.maxDamage ?? 5]}
          min={0}
          max={5}
          step={1}
          minStepsBetweenThumbs={0}
          onValueChange={([a, b]) =>
            set({ minDamage: a === 0 ? undefined : a, maxDamage: b === 5 ? undefined : b })
          }
          aria-label="Physical damage score range"
        >
          <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-muted">
            <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
          </SliderPrimitive.Track>
          {[0, 1].map((i) => (
            <SliderPrimitive.Thumb
              key={i}
              className="block h-3.5 w-3.5 rounded-full border-2 border-primary bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ))}
        </SliderPrimitive.Root>
      </Field>

      <Field label="Minimum confidence" hint={`${filters.minConfidence ?? 0}/100`}>
        <SliderPrimitive.Root
          className="relative flex h-5 w-full touch-none select-none items-center"
          value={[filters.minConfidence ?? 0]}
          min={0}
          max={100}
          step={5}
          onValueChange={([v]) => set({ minConfidence: v === 0 ? undefined : v })}
          aria-label="Minimum incident confidence"
        >
          <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-muted">
            <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 border-primary bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </SliderPrimitive.Root>
      </Field>

      <Separator />

      <ToggleRow
        label="Show unconfirmed layer"
        description="Low-confidence records that do not meet the corroboration bar. Never counted as findings."
        checked={filters.includeUnconfirmed ?? false}
        onCheckedChange={(v) => set({ includeUnconfirmed: v })}
        testId="toggle-unconfirmed"
      />
      <ToggleRow
        label="Show flagged non-industrial sites"
        description="Airfields, depots, substations and energy infrastructure. Excluded from industrial totals."
        checked={filters.includeBorderline ?? false}
        onCheckedChange={(v) => set({ includeBorderline: v })}
        testId="toggle-borderline"
      />
      <ToggleRow
        label="Include occupied-territory sites"
        description="Crimea and Sevastopol — internationally recognised as Ukraine."
        checked={filters.includeOccupied !== false}
        onCheckedChange={(v) => set({ includeOccupied: v })}
      />
      <ToggleRow
        label="Only with satellite evidence"
        checked={filters.hasSatellite === true}
        onCheckedChange={(v) => set({ hasSatellite: v ? true : undefined })}
      />
      <ToggleRow
        label="Only with a financial estimate"
        checked={filters.hasFinancialEstimate === true}
        onCheckedChange={(v) => set({ hasFinancialEstimate: v ? true : undefined })}
      />
      <ToggleRow
        label="Only recovered sites"
        description="Most recent status asserts partial or full restoration."
        checked={filters.recovered === true}
        onCheckedChange={(v) => set({ recovered: v ? true : undefined })}
      />
      <ToggleRow
        label="Only repeatedly struck (2+)"
        checked={(filters.minIncidents ?? 1) > 1}
        onCheckedChange={(v) => set({ minIncidents: v ? 2 : undefined })}
      />

      <Separator />

      <CheckGroup
        label="Industry"
        options={industries.map((i) => ({ value: i.id, label: i.name, color: i.color }))}
        selected={filters.industries ?? []}
        onToggle={(v) => toggleIn('industries', v)}
      />

      <CheckGroup
        label="Attack method"
        options={ATTACK_METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] ?? m }))}
        selected={filters.methods ?? []}
        onToggle={(v) => toggleIn('methods', v)}
      />

      <CheckGroup
        label="Operational status"
        options={OPERATIONAL_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
        selected={filters.statuses ?? []}
        onToggle={(v) => toggleIn('statuses', v)}
      />

      <CheckGroup
        label="Region"
        options={regions.map((r) => ({ value: r.id, label: r.name }))}
        selected={filters.regions ?? []}
        onToggle={(v) => toggleIn('regions', v)}
        scroll
      />

      <Button variant="outline" size="sm" className="mt-auto" onClick={() => onChange({ ...DEFAULT_FILTERS })}>
        Reset all filters
      </Button>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  testId,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        {description ? <span className="block text-[11px] text-muted-foreground">{description}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} data-testid={testId} className="mt-0.5 shrink-0" />
    </label>
  );
}

function CheckGroup({
  label,
  options,
  selected,
  onToggle,
  scroll,
}: {
  label: string;
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  scroll?: boolean;
}) {
  return (
    <Field label={label} hint={selected.length ? `${selected.length} selected` : 'all'}>
      <div className={cn('space-y-0.5', scroll && 'max-h-44 overflow-y-auto pr-1')}>
        {options.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => onToggle(opt.value)}
              className="h-3 w-3 rounded border-input accent-primary"
            />
            {opt.color ? (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} aria-hidden />
            ) : null}
            <span className="truncate">{opt.label}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}
