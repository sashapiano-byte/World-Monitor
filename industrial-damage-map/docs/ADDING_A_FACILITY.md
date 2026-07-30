# Adding a facility

A facility card exists **because damage to it was reported**. If you cannot cite
reported damage, there is no card to add — that is the inclusion rule, and
`npm run qc` enforces it by erroring on any facility with no incidents.

---

## 0. Check it is not already there

```bash
npm run qc
```

The duplicate detector flags name collisions and any two sites within 2 km. But
check first by hand — search the map for transliterations, the Russian name, the
legal entity, and the town. Adding a second card for a plant that already has one
is the most damaging mistake available here: it inflates the facility count and
splits the incident history.

If the site genuinely is a different enterprise from one that looks similar,
record that decision in `data/duplicate-resolutions.ts`.

## 1. Decide the category

Is it an industrial enterprise, or one of the flagged borderline categories?

`military_depot` · `arsenal` · `repair_base` · `airfield` ·
`electrical_substation` · `energy_infrastructure`

Flagged sites are hidden by default and excluded from every industrial total.
Getting this wrong quietly corrupts the headline numbers. When in doubt, flag it
and say why in `inclusionRationale`.

## 2. Establish coordinates

Use the publicly known **centre of the site** or its published address:
OpenStreetMap, Wikidata, the company's own contact page, or lawfully accessible
cadastral records.

Then choose the honest precision:

| Precision | Use when |
|---|---|
| `exact_public_address` | The company itself publishes the address. Requires `publicAddress`. |
| `facility_centroid` | The site outline is identifiable on OSM. |
| `industrial_zone_centroid` | The specific enterprise cannot be resolved within a zone, **or** the site is sensitive. |
| `locality_only` | Town-level only. Use for civilian workplaces — every warehouse and food-industry site in this dataset is here. |

**Never record the position of a shop, unit or piece of equipment.** If your
source gives you that, do not use it.

## 3. Write the facility record

Add to the appropriate file in `data/facilities/`. The `facility()` helper
supplies sensible defaults.

```ts
facility({
  id: 'f-example-refinery',
  slug: 'example-refinery',
  canonicalName: 'Example Refinery',
  canonicalNameRu: 'ООО «Примерный НПЗ»',
  alternativeNames: ['Примерный нефтеперерабатывающий завод'],
  legalEntity: 'OOO «Primerny NPZ»',        // null if not established
  parentCompany: null,                       // null if not established
  industryId: 'oil_refining',
  subindustry: 'Fuels refining',
  regionId: 'ru-sam',
  locality: 'Example',
  publicAddress: 'Example, Samara Oblast',
  latitude: 53.0,
  longitude: 50.0,
  coordinatePrecision: 'facility_centroid',
  nameplateCapacity: '~5 Mt/yr',
  description: 'What this plant is.',
  inclusionRationale: 'Why this record exists — the evidence that justifies it.',
  tags: ['repeatedly-struck'],
}),
```

`inclusionRationale` is shown to readers. Write it for someone who is sceptical
that the record belongs in the dataset at all.

Leave a field `null` rather than guessing. "Not established" is a finding.

## 4. Add the sources

Append to `data/sources.ts`:

```ts
{
  id: 's-reuters-example-2026-03-01',
  title: 'Exact headline',
  publisher: 'Reuters',
  url: 'https://…',
  publicationDate: '2026-03-01',     // null if genuinely not establishable
  tier: 'B',
  kind: 'wire_agency',
  language: 'en',
  syndicatedFrom: null,              // set if this republishes another outlet
  notes: 'What this item actually establishes.',
},
```

Grade the **item**, not the masthead — see
[SOURCES_POLICY.md](../SOURCES_POLICY.md). And set `syndicatedFrom` honestly: two
republications of one wire story count as a single independent source, and the
QC engine will catch you if they do not add up.

## 5. Add at least one incident

```ts
incident({
  id: 'i-example-2026-03-01',
  facilityId: 'f-example-refinery',
  incidentDate: '2026-03-01',        // overnight X–Y uses Y
  attackMethod: 'uav',
  methodConfidence: 'high',
  fireConfirmed: true,               // null = not established, not false
  physicalDamageScore: 3,
  damageSummary: 'The most cautious accurate description.',
  damagedAssets: ['CDU-1 primary unit'],
  operationalEffect: 'Processing halted.',
  downtimeDays: null,
  confidence: 72,
  verificationStatus: 'corroborated',
  claimedBy: 'ukraine_official',
  sourceIds: ['s-reuters-example-2026-03-01', 's-other-outlet-2026-03-02'],
  established: ['What you regard as established.'],
  unresolved: ['What you specifically could not establish.'],
}),
```

Rules that will bite you:

- date must be ≥ 2022-02-24 and at least 72 hours old;
- score ≥ 3 needs two **independent** sources, one tier-A source, or dated
  satellite imagery;
- score ≥ 4 cannot rest entirely on tier-C sources;
- score 5 needs `verified` and confidence ≥ 75;
- an `unconfirmed` record must have score 0.

## 6. Optionally: status, estimates, imagery

Status changes go in the same file's `*_STATUS` array — every one needs a date, a
source, and whether it is a `direct_confirmation` or your own
`analytical_assessment`.

Financial estimates need a `methodology` of at least 20 characters, and a
`model_estimate` needs its `assumptions` listed. Set `scope` to `multi_facility`
or `campaign` if the figure covers more than this site — otherwise it will be
double counted.

Imagery needs a capture date, licence text, and `interpretationLimits`. Link to
the original publication; do not rehost.

## 7. Verify

```bash
npm run qc          # must be 0 errors
npm test
npm run typecheck
npm run dev         # look at the record on the map and its facility page
```

If `qc` reports a new **warning**, decide whether it is intentional. A
`single-source` warning is acceptable and is surfaced to readers; an unresolved
`possible-duplicate` is not.

## 8. Update the changelog

Record what you added and any editorial judgement you made — especially a
conservative damage score, an unresolved identity, or a deliberate merge.
