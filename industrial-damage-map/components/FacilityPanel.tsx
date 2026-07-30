'use client';

import Link from 'next/link';
import type { DamageEstimateRecord, IndustryRecord, RegionRecord } from '@/data/types';
import type { FacilityView } from '@/lib/filter-core';
import { isPublishedIncident } from '@/lib/filter-core';
import { formatRange, presentRange } from '@/lib/fx';
import { confidenceBand, formatDate } from '@/lib/utils';
import { Badge, Button, ConfidenceMeter, Separator } from './ui/primitives';

const DAMAGE_LABELS: Record<number, string> = {
  0: 'attack in the area, no confirmed damage',
  1: 'minor damage (glazing, roofing, local fire)',
  2: 'damage to a building or ancillary infrastructure',
  3: 'serious damage to a production building or unit',
  4: 'a key process unit or several shops disabled',
  5: 'main production site destroyed',
};

const METHOD_LABELS: Record<string, string> = {
  uav: 'UAV / drone',
  cruise_missile: 'Cruise missile',
  ballistic_missile: 'Ballistic missile',
  sabotage: 'Sabotage',
  shelling: 'Shelling',
  naval_drone: 'Naval drone',
  unknown_means: 'Means not established',
};

export interface FacilityPanelProps {
  view: FacilityView;
  industries: IndustryRecord[];
  regions: RegionRecord[];
  onClose?: () => void;
  standalone?: boolean;
}

export function FacilityPanel({ view, industries, regions, onClose, standalone }: FacilityPanelProps) {
  const { facility: f } = view;
  const industry = industries.find((i) => i.id === f.industryId);
  const region = regions.find((r) => r.id === f.regionId);

  const established = view.incidents.flatMap((i) => i.established);
  const unresolved = view.incidents.flatMap((i) => i.unresolved);

  return (
    <div className="space-y-4 p-4 text-sm" data-testid="facility-panel">
      <header className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-snug">{f.canonicalName}</h2>
            <p className="text-xs text-muted-foreground">{f.canonicalNameRu}</p>
          </div>
          {onClose ? (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
              ×
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {industry ? (
            <Badge className="gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: industry.color }} aria-hidden />
              {industry.name}
            </Badge>
          ) : null}
          {f.siteCategory !== 'industrial' ? (
            <Badge variant="warning">flagged: {f.siteCategory.replace(/_/g, ' ')} — not counted as industrial</Badge>
          ) : null}
          {f.territoryStatus !== 'internationally_recognised_russia' ? (
            <Badge variant="outline">occupied territory · internationally recognised as Ukraine</Badge>
          ) : null}
          {view.isSingleSourceOnly ? <Badge variant="warning">single-source</Badge> : null}
          {view.hasSatelliteEvidence ? <Badge variant="success">satellite evidence</Badge> : null}
        </div>

        {!standalone ? (
          <Link href={`/facility/${f.slug}`} className="inline-block text-xs underline underline-offset-2">
            Open full record →
          </Link>
        ) : null}
      </header>

      <p className="text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>

      <Section title="Identification">
        <Dl
          rows={[
            ['Legal entity', f.legalEntity ?? 'not established'],
            ['Parent company', f.parentCompany ?? 'not established'],
            ['Subindustry', f.subindustry ?? '—'],
            ['Region', region?.name ?? f.regionId],
            ['Locality', f.locality],
            ['Public address', f.publicAddress ?? 'not published'],
            [
              'Coordinates',
              `${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)} · ${f.coordinatePrecision.replace(/_/g, ' ')}`,
            ],
            ['Nameplate capacity', f.nameplateCapacity ?? 'not published'],
            ['Site area', f.facilityAreaHectares ? `${f.facilityAreaHectares} ha` : 'not established'],
            ['Pre-war employees', f.prewarEmployees ? String(f.prewarEmployees) : 'not established'],
            [
              'Pre-war revenue',
              f.prewarRevenueUsd ? `$${(f.prewarRevenueUsd / 1e6).toFixed(0)}m` : 'not established',
            ],
            ['Record last updated', f.updatedAt],
          ]}
        />
        <p className="mt-2 rounded border border-border bg-muted/40 p-2 text-[11px] leading-relaxed">
          <strong className="font-medium">Why this record exists.</strong> {f.inclusionRationale}
        </p>
      </Section>

      <Section title={`Operational status — ${(view.currentStatus?.status ?? 'unknown').replace(/_/g, ' ')}`}>
        {view.statusHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground">No status changes recorded.</p>
        ) : (
          <>
            <StatusStrip view={view} />
            <ol className="mt-2 space-y-1.5">
              {view.statusHistory.map((s) => (
                <li key={s.id} className="text-xs">
                  <span className="tabular-nums text-muted-foreground">{formatDate(s.statusDate)}</span>{' '}
                  <span className="font-medium">{s.status.replace(/_/g, ' ')}</span>
                  {s.capacityEstimatePercent != null ? (
                    <span className="text-muted-foreground"> · ~{s.capacityEstimatePercent}% capacity</span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {' '}
                    · {s.determination === 'direct_confirmation' ? 'directly confirmed' : 'analytical assessment'} ·{' '}
                    {s.evidenceType.replace(/_/g, ' ')}
                  </span>
                  {s.notes ? <p className="mt-0.5 text-muted-foreground">{s.notes}</p> : null}
                </li>
              ))}
            </ol>
          </>
        )}
      </Section>

      <Section title={`Incidents (${view.incidents.length})`}>
        <ol className="space-y-3">
          {view.incidents.map((i) => {
            const band = confidenceBand(i.confidence);
            return (
              <li key={i.id} className="rounded-md border border-border p-2.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs font-semibold tabular-nums">{formatDate(i.incidentDate)}</span>
                  {i.incidentTimeLocal ? (
                    <span className="text-[11px] text-muted-foreground">{i.incidentTimeLocal} local</span>
                  ) : null}
                  <Badge variant="outline">{METHOD_LABELS[i.attackMethod] ?? i.attackMethod}</Badge>
                  <Badge variant="outline">method confidence: {i.methodConfidence}</Badge>
                  {!isPublishedIncident(i) ? <Badge variant="warning">unconfirmed — not a finding</Badge> : null}
                  {i.verificationStatus === 'disputed' ? <Badge variant="warning">disputed</Badge> : null}
                </div>

                <p className="mt-1.5 text-xs">
                  <strong className="font-medium">Damage {i.physicalDamageScore}/5</strong> —{' '}
                  {DAMAGE_LABELS[i.physicalDamageScore]}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{i.damageSummary}</p>

                {i.damagedAssets.length ? (
                  <p className="mt-1 text-xs">
                    <span className="text-muted-foreground">Assets reported damaged: </span>
                    {i.damagedAssets.join('; ')}
                  </p>
                ) : null}

                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <li>Fire: {i.fireConfirmed === null ? 'not established' : i.fireConfirmed ? 'confirmed' : 'no'}</li>
                  <li>Killed: {i.casualtiesKilled ?? 'not reported'}</li>
                  <li>Injured: {i.casualtiesInjured ?? 'not reported'}</li>
                  <li>
                    Downtime:{' '}
                    {i.downtimeDays != null
                      ? `${i.downtimeDays} days (${i.downtimeIsEstimate ? 'estimated' : 'confirmed'})`
                      : 'not established'}
                  </li>
                  <li>Last reviewed: {i.lastReviewed}</li>
                </ul>

                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Operational effect:</span> {i.operationalEffect}
                </p>

                <div className="mt-1.5 flex items-center gap-2">
                  <ConfidenceMeter score={i.confidence} />
                  <span className="text-[11px] text-muted-foreground">
                    {band.label} · {i.verificationStatus}
                  </span>
                </div>

                {i.sourceIds.length ? (
                  <p className="mt-1.5 text-[11px]">
                    <span className="text-muted-foreground">Sources: </span>
                    {i.sourceIds.map((id, idx) => {
                      const s = view.sources.find((src) => src.id === id);
                      if (!s) return null;
                      return (
                        <span key={id}>
                          {idx > 0 ? ', ' : ''}
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2"
                          >
                            {s.publisher}
                          </a>
                          <span className="text-muted-foreground"> (tier {s.tier}</span>
                          {s.syndicatedFrom ? (
                            <span className="text-muted-foreground">, via {s.syndicatedFrom}</span>
                          ) : null}
                          <span className="text-muted-foreground">)</span>
                        </span>
                      );
                    })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2.5">
          <h4 className="mb-1 text-xs font-semibold">What is established</h4>
          {established.length ? (
            <ul className="list-inside list-disc space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {established.map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">Nothing recorded as established for this facility.</p>
          )}
        </div>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5">
          <h4 className="mb-1 text-xs font-semibold">What remains unresolved</h4>
          {unresolved.length ? (
            <ul className="list-inside list-disc space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {unresolved.map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">No open questions recorded.</p>
          )}
        </div>
      </div>

      {view.estimates.length ? (
        <Section title="Financial damage">
          <p className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] leading-relaxed">
            Estimate types are never mixed. A <strong>model estimate</strong> is produced by this project and is not an
            official figure; it must not be added to official, insurance or company-disclosed amounts.
          </p>
          <ul className="space-y-2.5">
            {view.estimates.map((e) => (
              <EstimateBlock key={e.id} estimate={e} sources={view.sources} />
            ))}
          </ul>
        </Section>
      ) : null}

      {view.media.length ? (
        <Section title="Imagery">
          <ul className="space-y-2">
            {view.media.map((m) => (
              <li key={m.id} className="rounded-md border border-border p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{m.mediaType}</Badge>
                  <Badge variant="outline">{m.beforeOrAfter}</Badge>
                  <span className="text-muted-foreground">
                    captured {m.captureDate ?? 'date not published'}
                    {m.resolutionMetres ? ` · ~${m.resolutionMetres} m/px` : ''}
                  </span>
                </div>
                <p className="mt-1">{m.caption}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span className="font-medium">Provider:</span> {m.provider}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium">Licence:</span> {m.license}
                </p>
                {m.interpretationLimits ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    <span className="font-medium">Interpretation limits:</span> {m.interpretationLimits}
                  </p>
                ) : null}
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block underline underline-offset-2"
                >
                  View at the original publication →
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {view.claims.length ? (
        <Section title="Claims by source">
          <ul className="space-y-1.5">
            {view.claims.map((c) => {
              const s = view.sources.find((src) => src.id === c.sourceId);
              return (
                <li key={c.id} className="text-[11px] leading-relaxed">
                  <Badge
                    variant={c.stance === 'disputes' ? 'warning' : c.stance === 'context' ? 'outline' : 'default'}
                    className="mr-1.5"
                  >
                    {c.stance.replace(/_/g, ' ')}
                  </Badge>
                  {c.claimText}
                  {s ? (
                    <>
                      {' '}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                        {s.publisher}
                      </a>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <Section title={`All sources (${view.sources.length})`}>
        <ul className="space-y-1 text-[11px]">
          {view.sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {s.title}
              </a>{' '}
              <span className="text-muted-foreground">
                — {s.publisher}, {s.publicationDate ?? 'undated'}, tier {s.tier}
                {s.syndicatedFrom ? `, via ${s.syndicatedFrom}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="text-[11px] text-muted-foreground">
        Data last checked {f.updatedAt}. Export this record:{' '}
        <a className="underline" href={`/api/facility/${f.slug}/report`}>
          printable report
        </a>{' '}
        ·{' '}
        <a className="underline" href={`/api/facility/${f.slug}`}>
          JSON
        </a>
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <Separator />
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-0.5 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Compact horizontal timeline of operational status over the record's life. */
function StatusStrip({ view }: { view: FacilityView }) {
  const colors: Record<string, string> = {
    normal_operations: 'bg-emerald-500',
    operations_reduced: 'bg-amber-500',
    partially_restored: 'bg-sky-500',
    fully_restored: 'bg-emerald-600',
    temporarily_suspended: 'bg-red-500',
    long_term_shutdown: 'bg-red-800',
    destroyed: 'bg-zinc-900',
    unknown: 'bg-zinc-400',
  };
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full" role="img" aria-label="Operational status over time">
      {view.statusHistory.map((s) => (
        <span
          key={s.id}
          className={`${colors[s.status] ?? 'bg-zinc-400'} flex-1`}
          title={`${s.statusDate}: ${s.status.replace(/_/g, ' ')}`}
        />
      ))}
    </div>
  );
}

function EstimateBlock({
  estimate,
  sources,
}: {
  estimate: DamageEstimateRecord;
  sources: { id: string; publisher: string; url: string }[];
}) {
  const components = (
    [
      ['Direct physical damage', estimate.directDamageMin ?? null, estimate.directDamageMax ?? null],
      ['Repair cost', estimate.repairCostMin ?? null, estimate.repairCostMax ?? null],
      ['Lost revenue', estimate.lostRevenueMin ?? null, estimate.lostRevenueMax ?? null],
      ['Downtime cost', estimate.downtimeCostMin ?? null, estimate.downtimeCostMax ?? null],
    ] satisfies [string, number | null, number | null][]
  ).filter(([, a, b]) => a != null || b != null);

  const assumptions = estimate.assumptions ?? [];

  const isModel = estimate.estimateType === 'model_estimate';

  return (
    <li className={`rounded-md border p-2.5 text-xs ${isModel ? 'border-amber-500/50 bg-amber-500/5' : 'border-border'}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={isModel ? 'warning' : 'default'}>{estimate.estimateType.replace(/_/g, ' ')}</Badge>
        <Badge variant="outline">scope: {estimate.scope.replace(/_/g, ' ')}</Badge>
        <span className="text-muted-foreground">as of {estimate.estimateDate ?? 'undated'}</span>
      </div>

      <table className="mt-1.5 w-full text-[11px]">
        <tbody>
          {components.map(([label, min, max]) => {
            const converted = presentRange({
              min,
              max,
              currency: estimate.currency,
              date: estimate.estimateDate,
              sourceUsdMin: estimate.usdAtIncidentDateMin,
              sourceUsdMax: estimate.usdAtIncidentDateMax,
            });
            return (
              <tr key={label} className="align-top">
                <td className="pr-2 text-muted-foreground">{label}</td>
                <td className="pr-2 tabular-nums">{formatRange(min, max, estimate.currency)}</td>
                <td className="pr-2 tabular-nums text-muted-foreground">
                  {formatRange(converted.usdAtDate.min, converted.usdAtDate.max, 'USD')} at the date
                </td>
                <td className="tabular-nums text-muted-foreground">
                  {formatRange(converted.usdConstant.min, converted.usdConstant.max, 'USD')} in{' '}
                  {converted.usdConstant.baseYear} prices
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-1.5 leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Method:</span> {estimate.methodology}
      </p>

      {assumptions.length ? (
        <>
          <p className="mt-1 font-medium">Assumptions</p>
          <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
            {assumptions.map((a, idx) => (
              <li key={idx}>{a}</li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-1.5 flex items-center gap-2">
        <ConfidenceMeter score={estimate.confidence} />
        <span className="text-[11px] text-muted-foreground">
          {estimate.sourceIds
            .map((id) => sources.find((s) => s.id === id))
            .filter(Boolean)
            .map((s) => s!.publisher)
            .join(', ')}
        </span>
      </div>
    </li>
  );
}
