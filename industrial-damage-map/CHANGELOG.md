# Changelog

All notable changes to the dataset and the application.
Dataset versions and application versions move independently; both are recorded
here. Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [0.1.0] — 2026-07-30

First research pass and initial public build.

### Dataset

- **64 facilities** — 62 industrial enterprises, 2 flagged non-industrial sites
  retained as worked examples of the exclusion rule.
- **117 incidents** — 105 published, 12 held in the unconfirmed layer, 1 marked
  `disputed`.
- **194 sources** — 11 tier A, 91 tier B, 92 tier C.
- Period covered 22 June 2022 → 27 July 2026, across 32 federal subjects plus
  occupied Crimea and Sevastopol on a separate layer.
- 31 claims, 47 operational-status changes, 7 financial estimates, 6 imagery
  records, 10 candidates in the review queue.
- Last full end-to-end review: 2026-07-30.

### Editorial decisions taken during this pass

- **Source grading moved to item level.** An article whose substance is a
  company or government statement is a tier-A item on what that party said.
  Grading the masthead instead would have discarded the strongest evidence in
  the set — against-interest admissions by Russian operators and officials,
  which almost always reach us through Western outlets.
- **Syndication is not corroboration.** Sources carry `syndicatedFrom`, and
  republications of one wire report count as a single independent voice. This
  demoted several refinery records that appeared to have three or four sources
  but in fact had one Reuters story reprinted three times. Those records were
  either given genuine second sources or had their damage scores reduced.
- **The two-source rule is enforced as an error at damage score ≥ 3**, and as a
  visible `single-source` warning flag at scores 1–2. Documented as a deliberate
  deviation in METHODOLOGY.md §5; 17 records carry the flag.
- **11 records had their damage score reduced** during review because the
  available corroboration did not support the stronger wording used in
  reporting. Each carries an explicit note saying so.
- **5 records were moved to the unconfirmed layer** and their damage scores set
  to 0, because they rested on a single tier-C source.
- **The Ufa refining cluster is a deliberately merged record.** Reporting says
  only "the Ufa oil refinery" and cannot be resolved to one of the three
  adjacent Bashneft plants. One card at industrial-zone precision, with the
  ambiguity recorded as an open data gap, rather than three cards and a guess.
- **The "Engels oil refinery" record is kept deliberately unidentified** rather
  than merged into the Saratov refinery card, which would have manufactured an
  attribution the sources do not support.
- **No official, insurance or company-disclosed facility-level damage figure was
  located.** Every financial number in the dataset is an analyst figure, a
  project model, or of unestablished provenance. This is reported as a finding
  on the dashboard rather than papered over.

### Application

- Interactive MapLibre map: clustering, colour by industry, outline by
  operational status, marker size by damage score and repeat strikes, occupied
  territory on a distinct halo layer, time slider, 12 filters, legend, map/table
  toggle.
- Facility records with incident history, status timeline, financial estimates
  showing every assumption, imagery with interpretation limits, source lists,
  and separate "what is established" / "what remains unresolved" blocks.
- Analytics dashboard reporting attested and modelled financial totals
  separately, and never summing them.
- `/methodology`, `/sources` and `/review-queue` pages.
- REST API with Zod-validated filters, CSV/JSON/GeoJSON exports carrying a
  provenance preamble, and per-facility printable reports.
- Quality-control engine with 20 editorial rules, served live at `/api/qc` and
  gating the database seed.
- Ingestion module with feed and CSV readers, conservative facility matching
  that refuses ambiguous matches, and a 72-hour embargo floor that cannot be
  configured below 72 hours.
- PostgreSQL 16 + PostGIS 3.4 schema with editorial rules expressed as CHECK
  constraints, spatial index, and an editorial-workflow schema (editors,
  revisions, moderation log, duplicate resolutions).
- 71 unit tests, 22 end-to-end tests.

### Fixed during initial development

- **Map never initialised on restricted networks.** Sources and layers were
  attached on MapLibre's `load` event, which waits for basemap tiles; where
  tiles are unreachable the map initialised and then stayed permanently empty.
  Moved to `style.load`, which needs only the locally built style. Covered by an
  end-to-end regression test that aborts all tile requests.
- **Legend swallowed toolbar clicks.** Absolutely positioned inside the map with
  no height cap, it grew past its container and intercepted pointer events.
- **Facility panel pushed off-screen.** Flexbox `min-width: auto` let the wide
  data table refuse to shrink.
- **Cyrillic attack-method detection never matched.** JavaScript's `\b` is
  ASCII-only, so `\bбпла` cannot match. Found by a unit test.

### Known gaps

- No web-archive snapshots recorded for any of the 194 sources.
- Research pass was predominantly English-language; Russian- and
  Ukrainian-language primary sources are under-used.
- Strong coverage bias towards oil refining.
- No record reaches the 90–100 confidence band.

[0.1.0]: #010--2026-07-30
