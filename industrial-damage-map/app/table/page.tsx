import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/primitives';
import { buildFacilityViews, getDataset } from '@/lib/dataset';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Full record table' };
export const dynamic = 'force-static';

/**
 * The complete published record set as one table — every incident, not just a
 * facility roll-up. This is the view for reading the evidence rather than
 * browsing the map, so nothing is collapsed or hidden behind a click.
 */
export default function TablePage() {
  const dataset = getDataset();
  const views = buildFacilityViews(dataset);
  const sourceById = new Map(dataset.sources.map((s) => [s.id, s]));
  const industryById = new Map(dataset.industries.map((i) => [i.id, i.name]));
  const regionById = new Map(dataset.regions.map((r) => [r.id, r.name]));

  const rows = views
    .flatMap((v) => v.incidents.map((i) => ({ view: v, incident: i })))
    .sort((a, b) => b.incident.incidentDate.localeCompare(a.incident.incidentDate));

  return (
    <div className="w-full space-y-3 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Full record table</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every incident in the dataset, newest first — including unconfirmed records and flagged non-industrial
          sites, which are labelled inline. {rows.length} rows across {views.length} facilities.
        </p>
        <p className="text-xs">
          <Link href="/api/export/incidents.csv" className="underline">
            Download as CSV
          </Link>{' '}
          ·{' '}
          <Link href="/api/export/dataset.json" className="underline">
            JSON
          </Link>{' '}
          ·{' '}
          <Link href="/api/export/geojson" className="underline">
            GeoJSON
          </Link>
        </p>
      </header>

      <div className="scroll-x rounded-lg border border-border">
        <table className="w-full min-w-[80rem] border-collapse text-xs">
          <thead className="bg-muted/70 text-left uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2.5 py-2 font-medium">Date</th>
              <th className="px-2.5 py-2 font-medium">Facility</th>
              <th className="px-2.5 py-2 font-medium">Industry</th>
              <th className="px-2.5 py-2 font-medium">Region</th>
              <th className="px-2.5 py-2 font-medium">Method</th>
              <th className="px-2.5 py-2 font-medium">Damage</th>
              <th className="px-2.5 py-2 font-medium">Fire</th>
              <th className="px-2.5 py-2 font-medium">Killed</th>
              <th className="px-2.5 py-2 font-medium">Injured</th>
              <th className="px-2.5 py-2 font-medium">Downtime</th>
              <th className="px-2.5 py-2 font-medium">Confidence</th>
              <th className="px-2.5 py-2 font-medium">Verification</th>
              <th className="px-2.5 py-2 font-medium">Sources</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ view, incident }) => (
              <tr key={incident.id} className="border-t border-border/60 align-top">
                <td className="whitespace-nowrap px-2.5 py-2 tabular-nums">{formatDate(incident.incidentDate)}</td>
                <td className="px-2.5 py-2">
                  <Link href={`/facility/${view.facility.slug}`} className="underline underline-offset-2">
                    {view.facility.canonicalName}
                  </Link>
                  {view.facility.siteCategory !== 'industrial' ? (
                    <Badge variant="outline" className="ml-1.5">
                      flagged
                    </Badge>
                  ) : null}
                  {view.facility.territoryStatus !== 'internationally_recognised_russia' ? (
                    <Badge variant="outline" className="ml-1.5">
                      occupied territory
                    </Badge>
                  ) : null}
                </td>
                <td className="px-2.5 py-2 text-muted-foreground">
                  {industryById.get(view.facility.industryId) ?? view.facility.industryId}
                </td>
                <td className="px-2.5 py-2 text-muted-foreground">
                  {regionById.get(view.facility.regionId) ?? view.facility.regionId}
                </td>
                <td className="px-2.5 py-2 text-muted-foreground">
                  {incident.attackMethod.replace(/_/g, ' ')}
                  <span className="block text-[10px]">confidence: {incident.methodConfidence}</span>
                </td>
                <td className="px-2.5 py-2 tabular-nums">{incident.physicalDamageScore}/5</td>
                <td className="px-2.5 py-2 text-muted-foreground">
                  {incident.fireConfirmed === null ? '—' : incident.fireConfirmed ? 'yes' : 'no'}
                </td>
                <td className="px-2.5 py-2 tabular-nums">{incident.casualtiesKilled ?? '—'}</td>
                <td className="px-2.5 py-2 tabular-nums">{incident.casualtiesInjured ?? '—'}</td>
                <td className="px-2.5 py-2 tabular-nums">
                  {incident.downtimeDays != null
                    ? `${incident.downtimeDays}d ${incident.downtimeIsEstimate ? '(est.)' : '(conf.)'}`
                    : '—'}
                </td>
                <td className="px-2.5 py-2 tabular-nums">{incident.confidence}</td>
                <td className="px-2.5 py-2">
                  {incident.verificationStatus === 'unconfirmed' ? (
                    <Badge variant="warning">unconfirmed</Badge>
                  ) : incident.verificationStatus === 'disputed' ? (
                    <Badge variant="warning">disputed</Badge>
                  ) : (
                    <span className="text-muted-foreground">{incident.verificationStatus}</span>
                  )}
                </td>
                <td className="px-2.5 py-2">
                  {incident.sourceIds.map((id, idx) => {
                    const s = sourceById.get(id);
                    if (!s) return null;
                    return (
                      <span key={id}>
                        {idx > 0 ? ', ' : ''}
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                          {s.publisher}
                        </a>
                      </span>
                    );
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
