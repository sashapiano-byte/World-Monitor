# Methodology

Dataset version **0.1.0** · last full end-to-end review **2026-07-30** ·
publication cut-off **2026-07-27**

This document is rendered for readers at [`/methodology`](http://localhost:3000/methodology).
It is the authoritative statement of how records in this project are made,
scored and retired.

---

## 1. What this project is

A record of damage to industrial facilities in the Russian Federation that has
**already happened and has already been publicly reported**, from 24 February
2022 onward.

It is not a targeting aid, not a live tracker, and not a source of operational
information. See [SECURITY_AND_ETHICS.md](./SECURITY_AND_ETHICS.md) for the
exclusion list, which is enforced in code and not merely stated here.

## 2. Units of record

Five things are kept apart, because conflating them is how OSINT datasets go
wrong:

| Unit | Meaning |
|---|---|
| **Facility** | A permanent card for a physical site. A new attack never creates a second card. |
| **Incident** | One attack or damage event. |
| **Damage** | What an incident physically did — fields on the incident. |
| **Source** | A publication, document, image or statement. |
| **Status change** | A resumption, unit restart or completed repair. |

A sixth, **claim**, records what a specific source asserts and whether it
supports or disputes the record — so a disagreement between an operator and a
news report is preserved rather than silently resolved.

## 3. Inclusion and exclusion

**Included:** refineries; oil depots and large terminals; gas processing and
petrochemical complexes; metallurgy; chemicals; machine building; aviation and
shipbuilding; rail machine building; defence plants *where damage is already
publicly confirmed*; power-engineering equipment makers; large industrial
warehouses; building-materials plants; food industry; pulp and paper; large
logistics and production-warehouse complexes; industrial ports and export
terminals.

**Excluded:** residential buildings, administrative offices, small shops,
vehicles, and military objects with no industrial function.

**Flagged borderline categories** — `military_depot`, `arsenal`, `repair_base`,
`airfield`, `electrical_substation`, `energy_infrastructure` — are kept in their
own category, hidden by default, and excluded from every "damaged industrial
enterprise" total. Two such records are retained so a reader can watch the
boundary being applied rather than having to trust that it was.

**Marketplace fulfilment complexes** are included only where the site performs
an industrial-logistics function at scale *and* confirmed physical damage is
documented.

## 4. Source hierarchy

Sources are graded at **item** level, not publisher level: an article whose
substance is a company or government statement is a tier-A item on what that
party said. Full rules in [SOURCES_POLICY.md](./SOURCES_POLICY.md).

- **Tier A** — enterprise statements; owner/parent-company publications;
  governors and regional authorities; emergency services; sector regulators;
  exchange disclosures; financial reports; insurers; court documents; state
  procurement and repair tenders; commercial satellite operators; Sentinel-2 and
  other lawfully available satellite data. Ukrainian state statements sit in
  tier A **as a party's statement only**, never as automatic proof of an effect.
- **Tier B** — Reuters, AP, BBC, FT, NYT, Washington Post, Bloomberg, RFE/RL,
  Meduza, Kommersant, RBC, Vedomosti, trade press, investigative projects with
  transparent methodology, satellite-OSINT projects publishing imagery with
  capture dates.
- **Tier C** — regional media, Telegram, eyewitness posts, social-media photo
  and video, company aggregators and directories.

**A tier-C source may never be the sole basis for a conclusion of serious damage
or destruction.**

**Syndication is not corroboration.** Five outlets republishing one Reuters
report are one voice. Every source records `syndicatedFrom`, and the QC engine
collapses republications before counting independent sources. This rule alone
demoted several records during the first review pass.

## 5. Verification

An incident reaches the main map when at least one of these holds:

- official confirmation of physical damage;
- before/after satellite imagery from a named provider with capture dates;
- several independent outlets with photographs;
- a confirmed repair or production stoppage following the attack.

Medium confidence requires two independent sources, geolocated photo or video,
indirect indications of a production stop, or authority statements combined with
sector data.

Low-confidence cases — one party's claim, uncorroborated Telegram reports, no
visual or production evidence — are **not shown on the main map by default**.
They sit in a separate unconfirmed layer, they carry a physical-damage score of
0, and they are excluded from every headline figure.

### How the two-source rule is applied

The rule is: **two independent sources, or one tier-A source, or dated satellite
imagery.** It is enforced as a hard error for any record asserting a damage score
of 3 or above.

Records at score 1–2 backed by a single credible outlet are published but carry
a visible **single-source** flag on the map, in the table and on the facility
card, rather than being suppressed. Records at score 0 assert no damage and
carry no corroboration requirement.

This is a deliberate editorial reading and a deviation from the strictest
possible construction of the rule. It is flagged here, in the UI, and in the
final report because suppressing thin-but-genuine reporting would make the
dataset look more complete than it is, while publishing it unmarked would make
it look better evidenced than it is. 17 records currently carry the flag.

## 6. Physical damage scale

| Score | Meaning |
|---|---|
| 0 | attack in the area of the facility, no confirmed damage |
| 1 | minor damage: glazing, roofing, a local fire |
| 2 | damage to an individual building or ancillary infrastructure |
| 3 | serious damage to a production building or process unit |
| 4 | a key technological installation or several shops put out of action |
| 5 | destruction of the main production site, or the enterprise effectively ceasing to operate |

"Hit", "damaged", "seriously damaged", "disabled" and "destroyed" are not
interchangeable. The most cautious wording the evidence supports is the one
used. A score of 5 additionally requires verification status `verified` and
confidence ≥ 75; a database CHECK constraint refuses the row otherwise.

## 7. Operational status

`normal_operations` · `operations_reduced` · `partially_restored` ·
`fully_restored` · `temporarily_suspended` · `long_term_shutdown` · `destroyed` ·
`unknown`

Every change records a date, a supporting source, whether it is a direct
confirmation or our own analytical assessment, and a confidence score.

Status is checked against company statements, process-unit loading, sector
statistics, **aggregated retrospective** rail and port shipment data, procurement
and repair notices, annual reports, and reports of output resuming. Job
advertisements are never treated as evidence of full operation on their own.

Where a company or regional authority asserts that operations were unaffected,
that assertion is recorded as a tier-A statement and its confidence is
deliberately held low, because it comes from an interested party.

## 8. Financial damage

Estimate types are never mixed:

`official` · `insurance` · `company_disclosure` — attested figures
`analyst_estimate` — a third party's calculation
`model_estimate` — produced by this project
`unknown` — provenance not established

**A model estimate is never presented as an official figure**, and the dashboard
never adds the two together. Every figure must carry a methodology, and the
database rejects one that does not. Every model estimate must list its
assumptions, and those assumptions are shown to the reader in full.

Estimates are scoped `facility`, `multi_facility` or `campaign`; anything other
than `facility` is excluded from per-facility aggregation so it cannot be
double counted, with the exclusion and its reason displayed on the dashboard.

Amounts are presented three ways: original currency; USD at the rate on the
incident date; USD in constant prices of the last complete year (2025). The
conversion table is published in `lib/fx.ts` and rendered on `/methodology`.
It is coarse and deliberately visible; this project is not a financial source.

Where a model estimate is produced, it is built from a documented combination of
damaged-building area, known equipment cost, outage duration, published revenue,
sector margin, comparable repair cost and observed output reduction — with each
input, and each thing it ignores, listed on the record.

## 9. Satellite imagery

Only lawfully available material. Each image records provider, capture date,
resolution, licence, a link to the original publication, what is visible, and
the limits of interpretation.

Imagery whose licence forbids redistribution is **linked, never rehosted**. A
hosted thumbnail is opt-in and the QC engine refuses one unless the licence text
positively permits it. Critical equipment is never annotated. Optical imagery
shows exterior structural change and fire scarring; it cannot show whether
internal equipment is repairable or whether a plant is running.

Connecting Sentinel Hub or the Copernicus Data Space is documented in
[docs/SATELLITE_IMAGERY.md](./docs/SATELLITE_IMAGERY.md). No credentials are held
in this repository.

## 10. Confidence scale

Every incident, status change and financial estimate carries a 0–100 score.

| Band | Meaning |
|---|---|
| 90–100 | official confirmation plus visual evidence |
| 75–89 | multiple independent sources and visual confirmation |
| 60–74 | reliable sources without full visual confirmation |
| 40–59 | plausible but incomplete |
| < 40 | unconfirmed |

Current distribution across all 117 incidents: 90–100 → 0 · 75–89 → 29 ·
60–74 → 54 · 40–59 → 22 · <40 → 12.

**No record reaches the top band.** That is the single most important number in
this project: not one incident is supported by both official confirmation of
physical damage and independent visual evidence. Russian operators do not
disclose damage, and imagery corroboration exists for only a handful of sites.

## 11. Automated quality control

Run with `npm run qc`; served live at `/api/qc`; enforced in CI and as a gate on
the database seed. An error blocks the seed outright.

- no incident may precede 24 February 2022 *(also a database CHECK)*
- no published incident may be less than 72 hours old
- the corroboration rule in §5
- tier-C sources alone cannot carry a score of 4 or 5
- a score of 5 requires `verified` status and confidence ≥ 75 *(also a CHECK)*
- a recovery status requires a date and a source
- "destroyed" may not rest on an analytical assessment *(also a CHECK)*
- every financial estimate needs a methodology *(also a CHECK)*; model estimates
  need listed assumptions *(also a CHECK)*
- coordinates must fall inside the permitted bounding box *(also a CHECK)* and
  match the region's territory status
- source URLs must be well formed
- duplicate facilities are detected by name normalisation and 2 km proximity,
  and every flag must be resolved in `data/duplicate-resolutions.ts`
- unconfirmed records may not assert a damage score above 0 *(also a CHECK)*
- satellite imagery must carry a capture date *(also a CHECK)*
- every published incident should state what is established and what is not
- sources without a web-archive snapshot are reported as an informational
  finding rather than silently accepted

Current state: **0 errors, 17 warnings, 194 informational findings.** The
warnings are the single-source flags described in §5 and are intentional; the
informational findings are the missing archive snapshots described in
[SOURCES_POLICY.md](./SOURCES_POLICY.md).

## 12. Editorial process

Automatically discovered candidates never publish themselves. They enter the
review queue and advance through: detection → name normalisation → facility
matching → detail extraction → corroboration → imagery check → confidence
assignment → **manual approval** → publication. The database enforces the
approval requirement with a CHECK constraint requiring a named approver; the
ingestion code has no path that can set `published`.

Published records are re-checked at 7, 30, 90 and 180 days.

Corrections are made in the open: the record is amended, the change is logged
with a rationale in `revisions`, and [CHANGELOG.md](./CHANGELOG.md) records what
changed and why. A record found not to meet the inclusion criteria is marked
`rejected` rather than deleted, so the correction stays visible. See
[docs/CORRECTING_A_RECORD.md](./docs/CORRECTING_A_RECORD.md).

## 13. Known limitations

- **This is an incomplete sample, not a census.** It is biased towards
  facilities that English-language media cover, and heavily towards oil
  refining, which is reported far more closely than any other sector. 24 of 62
  industrial records are refineries; that reflects coverage, not necessarily the
  distribution of damage.
- Russian operators rarely disclose damage. **Absence of a reported effect is
  not evidence that there was none.**
- Wire reporting frequently rests on unnamed "industry sources". Such reports
  are recorded as what they are.
- Ukrainian official statements are a party's claims. They establish that a
  claim was made, not that an effect occurred.
- Russian state media are used only where they concede something against
  interest.
- **Not one official, insurance or company-disclosed facility-level damage
  figure was located.** Every financial number here is an analyst figure, a
  project model, or of unestablished provenance.
- Coordinates at `locality_only` precision may be off by kilometres. The
  precision field says which records those are.
- Some dates could only be fixed to a month. Those records carry an explicit
  placeholder warning and sit in the unconfirmed layer.
- The research pass was conducted predominantly in English. Russian- and
  Ukrainian-language primary sources — regional press, procurement registers,
  arbitration filings — are under-used and are the largest single opportunity
  to improve the dataset.
