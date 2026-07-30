# Data dictionary

Every field in the dataset, what it means, and what is enforced about it.

Types live in [`data/types.ts`](./data/types.ts); runtime validation in
[`lib/schemas.ts`](./lib/schemas.ts); the SQL schema with its CHECK constraints
in [`db/migrations/0000_init.sql`](./db/migrations/0000_init.sql). Where a rule
appears in more than one place it is enforced in all of them — the constraints
are the backstop, not the documentation.

---

## facilities

A permanent card for a physical site. **A new attack never creates a second
card.**

| Field | Type | Notes |
|---|---|---|
| `id` | text, PK | Stable, `f-`-prefixed. |
| `slug` | text, unique | Lowercase kebab-case; the URL segment. |
| `canonicalName` | text | Name used in the interface. |
| `canonicalNameRu` | text | Russian name, as the operator writes it. |
| `alternativeNames` | text[] | Transliterations, abbreviations, former names. Fed into duplicate detection. |
| `legalEntity` | text? | Registered entity, or `null` where not established. |
| `parentCompany` | text? | Group owner, or `null`. |
| `industryId` | text, FK | See `industries`. |
| `subindustry` | text? | Free text. |
| `siteCategory` | enum | `industrial` or a flagged category (below). Only `industrial` enters headline totals. |
| `regionId` | text, FK | See `regions`. |
| `locality` | text | Town or settlement. |
| `publicAddress` | text? | Only where the company or a registry publishes one. |
| `latitude` / `longitude` | float | CHECK: lat 41–82, lon 19–191. Stored alongside a PostGIS `geometry(Point,4326)` with a GiST index. |
| `coordinatePrecision` | enum | See below. `exact_public_address` requires `publicAddress`. |
| `territoryStatus` | enum | Must match the region's. |
| `facilityAreaHectares` | numeric? | Rarely available. |
| `prewarEmployees` | int? | Rarely available. |
| `prewarRevenueUsd` | numeric? | Rarely available. |
| `nameplateCapacity` | text? | Free text in the industry's natural unit. |
| `description` | text | What the site is. |
| `inclusionRationale` | text | **Why this record exists at all.** Shown to readers. |
| `tags` | text[] | Editorial flags, e.g. `satellite-confirmed`, `merged-record`. |
| `createdAt` / `updatedAt` | date | |

**`siteCategory`** — `industrial` · `military_depot` · `arsenal` ·
`repair_base` · `airfield` · `electrical_substation` · `energy_infrastructure`.
Everything except `industrial` is hidden by default and excluded from every
"damaged industrial enterprise" figure.

**`coordinatePrecision`** — `exact_public_address` · `facility_centroid` ·
`industrial_zone_centroid` · `locality_only`. See
[SECURITY_AND_ETHICS.md §2](./SECURITY_AND_ETHICS.md#2-geolocation).

**`territoryStatus`** — `internationally_recognised_russia` ·
`occupied_ukraine_internationally_recognised_as_ukraine`.

---

## incidents

One attack or damage event against one facility.

| Field | Type | Notes |
|---|---|---|
| `id` | text, PK | `i-`-prefixed. |
| `facilityId` | text, FK | |
| `incidentDate` | date | **CHECK: ≥ 2022-02-24.** Attacks reported "overnight X–Y" use Y. |
| `incidentTimeLocal` | time? | Only when reported. |
| `attackMethod` | enum | `uav` · `cruise_missile` · `ballistic_missile` · `sabotage` · `shelling` · `naval_drone` · `unknown_means`. |
| `methodConfidence` | enum | `high` · `medium` · `low` · `unknown`. Independent of overall confidence. |
| `weaponModelClaimed` | text? | A munition type **claimed by someone**. Never asserted by the project. |
| `weaponModelConfidence` | enum | Almost always `low` — munition attribution is the least reliable claim in this space. |
| `casualtiesKilled` / `casualtiesInjured` | int? | `null` = not reported, which is not the same as zero. |
| `fireConfirmed` | boolean? | Three-valued: `true` / `false` / `null` = not established. |
| `physicalDamageScore` | 0–5 | See the scale below. |
| `damageSummary` | text | Conservative prose. |
| `damagedAssets` | text[] | Named buildings, units or areas reported damaged. |
| `operationalEffect` | text | Effect on output, in plain language. |
| `downtimeDays` | int? | |
| `downtimeIsEstimate` | boolean | **Only `false` values enter the median-downtime statistic.** |
| `confidence` | 0–100 | |
| `verificationStatus` | enum | `verified` · `corroborated` · `unconfirmed` · `disputed` · `rejected`. |
| `claimedBy` | enum? | `ukraine_official` · `russia_official` · `none` · `unclear`. |
| `sourceIds` | text[] | At least one; the counting rule adds more. |
| `established` | text[] | What the project regards as established. |
| `unresolved` | text[] | What it specifically could not establish. |
| `lastReviewed` | date | |

**Damage scale** — 0 attack nearby, no confirmed damage · 1 minor (glazing,
roofing, local fire) · 2 a building or ancillary infrastructure · 3 serious
damage to a production building or unit · 4 a key process unit or several shops
disabled · 5 main production site destroyed.

**Constraints.** `verification_status <> 'unconfirmed' OR
physical_damage_score = 0`. `physical_damage_score < 5 OR verification_status =
'verified'`.

Only `verified`, `corroborated` and `disputed` incidents appear on the main map
and in headline counts. `unconfirmed` sits in an opt-in layer; `rejected` is
retained as a visible correction.

---

## operational_status_history

| Field | Type | Notes |
|---|---|---|
| `id` | text, PK | |
| `facilityId` / `incidentId` | FK / FK? | |
| `status` | enum | `normal_operations` · `operations_reduced` · `partially_restored` · `fully_restored` · `temporarily_suspended` · `long_term_shutdown` · `destroyed` · `unknown`. |
| `statusDate` | date | |
| `capacityEstimatePercent` | 0–100? | `null` where unknown. |
| `evidenceType` | text | `company_statement` · `official_statement` · `satellite_imagery` · `ground_photo_video` · `trade_data` · `exchange_sales_data` · `procurement_record` · `financial_report` · `media_reporting` · `analytical_inference`. |
| `determination` | enum | `direct_confirmation` or `analytical_assessment` — whether this is attested or inferred by us. |
| `confidence` | 0–100 | |
| `notes` | text | |
| `sourceIds` | text[] | At least one. |

**Constraint.** `status <> 'destroyed' OR determination =
'direct_confirmation'`.

The most recent row by `statusDate` is the facility's current status.

---

## damage_estimates

| Field | Type | Notes |
|---|---|---|
| `estimateType` | enum | `official` · `insurance` · `company_disclosure` · `analyst_estimate` · `model_estimate` · `unknown`. |
| `scope` | enum | `facility` · `multi_facility` · `campaign`. **Only `facility` is aggregated.** |
| `currency` | enum | `RUB` · `USD` · `EUR`. |
| `directDamage{Min,Max}` | numeric? | Physical damage. |
| `lostRevenue{Min,Max}` | numeric? | Forgone output. |
| `repairCost{Min,Max}` | numeric? | |
| `downtimeCost{Min,Max}` | numeric? | |
| `insuranceCoverage` | numeric? | |
| `usdAtIncidentDate{Min,Max}` | numeric? | When set, these are the **source's own** USD figures and are preferred over re-deriving one. |
| `usdConstant{Min,Max}` | numeric? | Deflated to 2025 prices. |
| `estimateDate` | date? | |
| `methodology` | text | **CHECK: ≥ 20 characters.** No figure without a stated method. |
| `assumptions` | text[] | **CHECK: non-empty for `model_estimate`.** Rendered in full to readers. |
| `confidence` | 0–100 | |
| `sourceIds` | text[] | |

Attested types (`official`, `insurance`, `company_disclosure`) and modelled types
(`analyst_estimate`, `model_estimate`) are totalled **separately** and never
summed. `unknown` enters neither total; the exclusion and its reason are shown.

---

## sources

| Field | Type | Notes |
|---|---|---|
| `tier` | enum | `A` · `B` · `C`. Graded at item level — see [SOURCES_POLICY.md](./SOURCES_POLICY.md). |
| `kind` | text | `company_statement`, `government_official`, `wire_agency`, `osint_project`, `belligerent_statement`, … |
| `language` | enum | `ru` · `uk` · `en` · `other`. |
| `syndicatedFrom` | text? | The outlet whose reporting this reproduces. **Sources sharing a value count as one independent voice.** |
| `publicationDate` | date? | `null` where it could not be established. |
| `archivedUrl` | text? | Web-archive snapshot. Currently `null` throughout — reported by QC. |
| `notes` | text? | What this item actually establishes. |

---

## claims

What a specific source asserts about a specific record.

| Field | Notes |
|---|---|
| `claimType` | `facility_identity` · `incident_occurred` · `attack_method` · `physical_damage` · `fire` · `casualties` · `production_halt` · `production_resumed` · `capacity_impact` · `financial_damage` · `repair_work` · `insurance_or_state_support` · `geolocation`. |
| `stance` | `supports` · `disputes` · `partially_supports` · `context`. |
| `claimText` | The assertion, in the source's terms. |
| `confidence` | Weight carried by this particular claim. |

Disagreements are stored, not resolved.

---

## media

| Field | Notes |
|---|---|
| `mediaType` | `satellite` · `photo` · `video` · `diagram`. |
| `provider` | Named imagery provider. |
| `captureDate` | **CHECK: required for `satellite`.** When the image was taken, not published. |
| `url` | Link to the **original publication**. |
| `license` | Verbatim licence terms. |
| `thumbnailUrl` | Opt-in. QC errors unless the licence positively permits redistribution. |
| `beforeOrAfter` | `before` · `after` · `n/a`. |
| `interpretationLimits` | What a reader can and cannot conclude. |
| `resolutionMetres` | Where published. |

---

## review_queue

Candidates awaiting manual review. **Never published data.**

`stage` — `detected` · `name_normalised` · `facility_matched` ·
`details_extracted` · `corroboration_sought` · `imagery_checked` ·
`confidence_assigned` · `awaiting_approval` · `published` · `rejected`.

**Constraint.** `stage <> 'published' OR (approved_by IS NOT NULL AND approved_at
IS NOT NULL)`.

---

## Supporting tables

| Table | Purpose |
|---|---|
| `industries`, `regions`, `tags` | Reference data. |
| `editors` | Named contributors, editors and maintainers. |
| `revisions` | Full before/after JSON per change, with editor and rationale. |
| `moderation_log` | Actions taken on records, with rationale. |
| `facility_duplicates` | Resolution of every duplicate flag: `merged`, `distinct` or `open`. |
| `incident_sources`, `status_sources`, `estimate_sources` | Join tables. |
| `facility_summary` (view) | Per-facility derived headline attributes. |

---

## Derived fields (read model only, not stored)

Computed in `lib/filter-core.ts`:

`maxDamageScore` · `maxConfidence` (published incidents only) ·
`firstIncidentDate` / `lastIncidentDate` · `incidentCount` ·
`hasSatelliteEvidence` · `hasFinancialEstimate` · `isRecovered` ·
`confirmedDowntimeDays` · `isSingleSourceOnly` (no published incident on the
facility meets the corroboration bar — surfaced as a warning badge).
