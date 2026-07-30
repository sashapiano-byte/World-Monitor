import type { Metadata } from 'next';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { getDataset } from '@/lib/dataset';

export const metadata: Metadata = { title: 'Review queue' };
export const dynamic = 'force-static';

const STAGES = [
  'detected',
  'name_normalised',
  'facility_matched',
  'details_extracted',
  'corroboration_sought',
  'imagery_checked',
  'confidence_assigned',
  'awaiting_approval',
  'published',
  'rejected',
] as const;

export default function ReviewQueuePage() {
  const dataset = getDataset();
  const queue = dataset.reviewQueue;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Review queue</h1>
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Nothing on this page is published data.</p>
          <p className="mt-1 text-muted-foreground">
            These are candidate incidents detected by the ingestion module or noted during research. They are not on
            the map, not in the dashboard totals, and not in any export of published records. An item leaves this
            queue only when a named editor approves it — the database enforces that with a constraint, not a
            convention. There is deliberately no live attack tracker: an incident may not even be reviewed until 72
            hours have passed.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STAGES.map((stage) => (
          <div key={stage} className="rounded border border-border p-2 text-center">
            <p className="text-lg font-semibold tabular-nums">{queue.filter((q) => q.stage === stage).length}</p>
            <p className="text-[10px] leading-tight text-muted-foreground">{stage.replace(/_/g, ' ')}</p>
          </div>
        ))}
      </section>

      <div className="space-y-2">
        {queue.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-1.5">
                <CardTitle>{item.headline}</CardTitle>
                <Badge variant="outline">{item.stage.replace(/_/g, ' ')}</Badge>
                {item.blockedReason?.startsWith('EMBARGOED') ? <Badge variant="warning">72h embargo</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p className="text-muted-foreground">
                {item.publisher} · discovered {item.discoveredAt}
                {item.detectedDate ? ` · incident date detected: ${item.detectedDate}` : ' · no date extracted'}
                {item.detectedMethod ? ` · method: ${item.detectedMethod}` : ''}
              </p>
              <p>
                <span className="text-muted-foreground">Facility name detected: </span>
                {item.detectedFacilityName ?? 'none'}
                {item.matchedFacilityId ? ` → matched ${item.matchedFacilityId}` : ' → no match to an existing card'}
              </p>
              {item.blockedReason ? (
                <p className="rounded bg-muted/60 p-1.5">
                  <span className="font-medium">Blocked: </span>
                  {item.blockedReason}
                </p>
              ) : null}
              <p className="text-muted-foreground">{item.notes}</p>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-block underline">
                Open the candidate source →
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
