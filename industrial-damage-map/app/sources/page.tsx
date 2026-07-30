import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/primitives';
import { getDataset } from '@/lib/dataset';

export const metadata: Metadata = { title: 'Source register' };
export const dynamic = 'force-static';

export default function SourcesPage() {
  const dataset = getDataset();
  const byTier = { A: [] as typeof dataset.sources, B: [] as typeof dataset.sources, C: [] as typeof dataset.sources };
  for (const s of dataset.sources) byTier[s.tier].push(s);

  const TIER_NOTES: Record<'A' | 'B' | 'C', string> = {
    A: 'Primary and most reliable: company and owner statements, regional government and emergency services, sector regulators, exchange filings, financial reports, insurers, courts, state procurement, and commercial satellite operators. Ukrainian state statements sit here as a party’s statement only — never as automatic proof of an effect. Grading is at ITEM level: an article whose substance is a company or official statement is a tier-A item on what that party said.',
    B: 'High-quality independent reporting: wire agencies, national quality press, trade press, investigative projects and satellite-OSINT projects that publish imagery with capture dates.',
    C: 'Supporting only: regional media, Telegram, eyewitness posts, aggregators and company directories. A tier-C source may NEVER be the sole basis for a claim of serious damage or destruction.',
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Source register</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every source cited anywhere in the dataset, with its tier and what it is actually good for.{' '}
          {dataset.sources.length} items. Items marked <em>via</em> are republications of another outlet&apos;s
          reporting — the quality-control engine counts them as one voice, not several.
        </p>
        <p className="text-xs">
          <Link href="/api/export/sources.csv" className="underline">
            Download the register as CSV
          </Link>
        </p>
      </header>

      {(['A', 'B', 'C'] as const).map((tier) => (
        <section key={tier} className="space-y-2">
          <h2 className="text-sm font-semibold">
            Tier {tier} <span className="font-normal text-muted-foreground">({byTier[tier].length} items)</span>
          </h2>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{TIER_NOTES[tier]}</p>
          <ul className="space-y-2">
            {byTier[tier]
              .slice()
              .sort((a, b) => (b.publicationDate ?? '').localeCompare(a.publicationDate ?? ''))
              .map((s) => (
                <li key={s.id} className="rounded-md border border-border p-2.5 text-xs">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                      {s.title}
                    </a>
                    <span className="text-muted-foreground">
                      {s.publisher} · {s.publicationDate ?? 'date not established'} · {s.language}
                    </span>
                    <Badge variant="outline">{s.kind.replace(/_/g, ' ')}</Badge>
                    {s.syndicatedFrom ? <Badge variant="outline">via {s.syndicatedFrom}</Badge> : null}
                    {s.archivedUrl ? (
                      <a href={s.archivedUrl} className="underline" target="_blank" rel="noopener noreferrer">
                        archived copy
                      </a>
                    ) : (
                      <Badge variant="warning">no archive snapshot</Badge>
                    )}
                  </div>
                  {s.notes ? <p className="mt-1 leading-relaxed text-muted-foreground">{s.notes}</p> : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
