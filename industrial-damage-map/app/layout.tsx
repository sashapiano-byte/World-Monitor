import type { Metadata } from 'next';
import Link from 'next/link';
import { DATASET_VERSION, LAST_FULL_REVIEW } from '@/data';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Russian Industrial Damage Map — OSINT research database',
    template: '%s · Russian Industrial Damage Map',
  },
  description:
    'A retrospective, source-linked open-source-intelligence record of industrial facilities in the Russian Federation reported physically damaged since 24 February 2022.',
  robots: { index: false, follow: false },
};

const NAV = [
  { href: '/', label: 'Map' },
  { href: '/table', label: 'Table' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/sources', label: 'Sources' },
  { href: '/review-queue', label: 'Review queue' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Russian Industrial Damage Map
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                v{DATASET_VERSION}
              </span>
            </Link>
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <span className="ml-auto hidden text-xs text-muted-foreground lg:block">
              Last full review {LAST_FULL_REVIEW} · retrospective research only
            </span>
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>

        <footer className="no-print border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <p className="max-w-4xl">
            Open-source research. Every record carries a confidence score and a verification status; a figure
            separated from those is not a finding. Model estimates produced by this project are never official
            figures and must not be aggregated with them. See{' '}
            <Link href="/methodology" className="underline">
              methodology
            </Link>{' '}
            and the security &amp; ethics policy in the repository.
          </p>
        </footer>
      </body>
    </html>
  );
}
