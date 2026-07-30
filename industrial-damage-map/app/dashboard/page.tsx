import type { Metadata } from 'next';
import Link from 'next/link';
import { BarRow, MonthlyBars } from '@/components/charts/SimpleCharts';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { computeAnalytics } from '@/lib/analytics';
import { buildFacilityViews, getDataset } from '@/lib/dataset';
import { formatRange } from '@/lib/fx';

export const metadata: Metadata = { title: 'Analytical dashboard' };
export const dynamic = 'force-static';

export default function DashboardPage() {
  const dataset = getDataset();
  const views = buildFacilityViews(dataset);
  const a = computeAnalytics(views, dataset);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Analytical dashboard</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every figure below counts <strong>industrial enterprises only</strong>. Flagged non-industrial sites
          (airfields, depots, substations, energy infrastructure) are excluded from these totals and reported
          separately. Unconfirmed incidents are excluded from all counts except where explicitly labelled.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Industrial facilities with confirmed damage" value={a.totals.industrialFacilities} />
        <Stat label="Published incidents" value={a.totals.publishedIncidents} />
        <Stat label="Facilities struck more than once" value={a.totals.facilitiesWithMultipleIncidents} />
        <Stat label="Currently suspended or shut down" value={a.totals.facilitiesCurrentlySuspended} />
        <Stat label="Facilities with a recovery on record" value={a.totals.facilitiesRecovered} />
        <Stat
          label="Median confirmed downtime"
          value={a.medianDowntimeDays != null ? `${a.medianDowntimeDays} days` : '—'}
          hint={`n = ${a.downtimeSampleSize} confirmed outages`}
        />
        <Stat label="Deaths reported" value={a.totals.fatalitiesReported} hint="across published incidents" />
        <Stat label="Injuries reported" value={a.totals.injuriesReported} hint="across published incidents" />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Flagged non-industrial sites"
          value={a.totals.borderlineFacilities}
          hint="excluded from the totals above"
          muted
        />
        <Stat
          label="Sites in occupied territory"
          value={a.totals.occupiedTerritoryFacilities}
          hint="internationally recognised as Ukraine"
          muted
        />
        <Stat
          label="Unconfirmed incidents"
          value={a.totals.unconfirmedIncidents}
          hint="held out of every finding"
          muted
        />
        <Stat
          label="Share with satellite corroboration"
          value={`${a.evidence.satelliteSharePercent}%`}
          hint={`${a.evidence.withSatellite} of ${a.totals.industrialFacilities} facilities`}
          muted
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Financial damage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Attested figures (official / insurance / company)
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {a.financial.attested.recordCount === 0
                  ? 'none located'
                  : formatRange(a.financial.attested.min, a.financial.attested.max, 'USD')}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.financial.attested.recordCount} record(s). Not one official, insurance or company-disclosed
                facility-level damage figure was located in this research pass — a finding in its own right.
              </p>
            </div>
            <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Analyst and project-model figures
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatRange(a.financial.modelled.min, a.financial.modelled.max, 'USD')}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.financial.modelled.recordCount} record(s). These are estimates, not measurements, and are
                deliberately never added to the attested total.
              </p>
            </div>
          </div>
          {a.financial.excluded.length ? (
            <div>
              <p className="text-xs font-medium">Excluded from both totals</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {a.financial.excluded.map((e) => (
                  <li key={e.estimateId}>
                    <code className="text-[11px]">{e.estimateId}</code> — {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incidents by month</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyBars data={a.incidentsByMonth} />
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="Facilities by industry" rows={a.byIndustry} />
        <ChartCard title="Facilities by region" rows={a.byRegion.slice(0, 15)} />
        <ChartCard title="Incidents by attack method" rows={a.byMethod} />
        <ChartCard title="Facilities by current status" rows={a.byStatus} />
        <ChartCard title="Incidents by physical damage score" rows={a.byDamageScore} />
        <ChartCard
          title="Incidents by confidence band"
          rows={a.byConfidenceBand}
          note="Includes unconfirmed records so the shape of the evidence base is visible."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Most repeatedly struck facilities</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1 text-sm">
            {a.mostRepeatedlyStruck.map((f, i) => (
              <li key={f.slug} className="flex items-baseline gap-2">
                <span className="w-5 tabular-nums text-muted-foreground">{i + 1}.</span>
                <Link href={`/facility/${f.slug}`} className="underline underline-offset-2">
                  {f.name}
                </Link>
                <Badge variant="outline">{f.incidents} incidents</Badge>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string | number;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${muted ? 'border-dashed border-border bg-muted/30' : 'border-border'}`}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

function ChartCard({
  title,
  rows,
  note,
}: {
  title: string;
  rows: { key: string; label: string; count: number; color?: string }[];
  note?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((r) => (
          <BarRow key={r.key} label={r.label} count={r.count} max={max} color={r.color} />
        ))}
      </CardContent>
    </Card>
  );
}
