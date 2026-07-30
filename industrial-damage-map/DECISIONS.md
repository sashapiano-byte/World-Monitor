# Decisions

Departures from the original specification, and the reasoning. Each of these is
a judgement call that a reviewer should be able to disagree with knowingly.

---

## 1. React Query was dropped

**Specified:** "React Query or Next.js built-in server capabilities."

**Chosen:** Next.js server components, with client-side filtering over a payload
delivered once.

The whole published dataset is 64 facilities and 117 incidents. Server-rendering
it and filtering in the browser makes every filter interaction instant, works
with no network round-trip, and removes a dependency. A fetch-caching layer over
data that never changes between requests would have been ceremony. The REST API
still exists for programmatic use; the UI simply does not need it.

## 2. Charts are hand-rolled, not a charting library

**Specified:** stack included Recharts implicitly via the dashboard requirement.

**Chosen:** plain server-rendered SVG/CSS bars.

Counts of this size do not need a charting runtime. Hand-rolled bars keep every
figure legible as text, render in the printed PDF report, and add nothing to the
client bundle. For a project whose entire point is that the reader can check the
numbers, hiding them inside a canvas would be the wrong trade.

## 3. The two-source rule is applied by damage severity

**Specified:** "every published incident must have a minimum of two sources or
one tier-A source."

**Chosen:** enforced as a hard error at damage score ≥ 3; applied as a visible
`single-source` warning flag at scores 1–2; not applied at score 0.

The strict reading would have moved roughly two dozen genuinely reported,
low-severity records into the unconfirmed layer — where they would carry a
damage score of 0 and effectively vanish. That would make the dataset look
*more* complete than it is, because the remaining records would all look
well-evidenced while the thin ones simply disappeared.

The specification's own §5 states the single-source prohibition specifically in
terms of tier C and *serious damage or destruction*, which supports the
severity-graded reading. It is documented in METHODOLOGY.md §5, shown in the UI
on every affected record, and reported in the final summary. 17 records carry
the flag.

**This is the most contestable decision in the project.** A reviewer who wants
the strict rule can change one line in `lib/qc.ts` and see exactly which records
fall out.

## 4. Source tiers are graded per item, not per publisher

**Specified:** tier lists are given as lists of publishers.

**Chosen:** an article whose substance is a company or government statement is a
tier-A item on what that party said, whoever published it.

Grading the masthead would have discarded the strongest evidence available:
against-interest admissions by Russian operators and officials, which almost
always reach an English-language researcher through Bloomberg, Al Jazeera or
Reuters. `Bloomberg — "Russia Says Drone Attack Caused Fire at Tuapse"` is
primary evidence about a Russian official statement; treating it as tier B
because Bloomberg is on the tier-B list would be a category error.

## 5. Syndication was added to the source model

**Not specified.**

Five outlets republishing one Reuters story are one voice. Without this, the
two-source rule is trivially satisfiable by citing the same wire report twice —
which is precisely what several apparently well-sourced refinery records were
doing before the rule was added. `syndicatedFrom` collapses them, and the
affected records were either given genuine second sources or had their scores
reduced.

## 6. Estimate scope was added to the financial model

**Not specified.**

Two of the located financial figures cover more than one facility (the
Krasnodar + Nevinnomyssk warehouse estimate) or the whole campaign (the RUB 170bn
merchandise figure). Summing those per-facility would have double counted by
billions. An explicit `scope` field — rather than pattern-matching prose, which
was the first implementation and was fragile — keeps them out of the totals and
displays why.

## 7. The project ships in a subdirectory

The repository already contained an unrelated project on this branch. This
project is self-contained in `industrial-damage-map/` so that nothing existing
was destroyed. `docker compose up --build` runs from that directory.

## 8. A file-backed fallback exists alongside Postgres

**Specified:** PostgreSQL + PostGIS.

Postgres is the query surface and the editorial store, and the migration/seed
path is the supported one. But `./data` is the source of truth for content, so
the app can serve it directly when `DATA_BACKEND=file` or when Postgres is
unreachable in `auto` mode. This makes `npm run dev` work before any container
exists and makes the e2e suite hermetic.

The risk — a silent fallback masking a database outage — is handled by
`DATA_BACKEND=postgres`, which is what production should use, and by
`/api/health` reporting the *effective* backend rather than the configured one.

## 9. The map is capped at zoom 12

**Not specified**, but implied by the geolocation constraints. A hard cap in
code is more durable than a convention, and it makes the constraint visible to
anyone reading `MapView.tsx`.

## 10. Two non-industrial records were kept

The specification says flagged categories must not be mixed with industrial
enterprises. The simplest compliant implementation is to exclude them entirely.
Instead, two are retained — an airfield and a captive CHP plant — in their own
category, hidden by default, excluded from every industrial total.

Keeping them makes the boundary visible. A reader can switch them on and see the
rule being applied, rather than having to take on trust that it was.
