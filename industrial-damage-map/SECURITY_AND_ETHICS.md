# Security and ethics

This project documents damage that has already happened and has already been
publicly reported. It is built so that it cannot be repurposed as an operational
aid, and several of the constraints below are enforced in code rather than
stated as good intentions.

---

## 1. Hard exclusions

The project does not contain, and will not accept:

- facilities that have not been subject to a reported attack;
- predictions or assessments about possible future targets;
- vulnerability analysis of operating enterprises;
- targeting recommendations of any kind;
- route, approach or weapon-effect calculations;
- information about air defence, site security, guard posts or access control;
- the position of specific critical installations **inside** an operating plant;
- operational information about attacks less than 72 hours old;
- anything sourced only from closed databases, leaks or unlawfully obtained
  material.

A contribution containing any of the above is rejected without further review.

## 2. Geolocation

Coordinates are the **publicly known centre of an industrial site** or its
published address. Every facility records how precise its coordinate actually
is:

| Precision | Meaning |
|---|---|
| `exact_public_address` | An address the company itself publishes. Requires `publicAddress` to be set — the QC engine errors otherwise. |
| `facility_centroid` | Centre of the site as visible on OpenStreetMap. |
| `industrial_zone_centroid` | Centre of a wider industrial zone, used where the specific enterprise cannot be resolved or where the site is sensitive. |
| `locality_only` | Town-level only. Used for every marketplace warehouse and every food-industry site in the dataset — these are ordinary civilian workplaces. |

No internal layout is recorded anywhere. Satellite imagery is never annotated
with equipment positions. The map is capped at **zoom level 12** in code, which
is coarse enough to place a site in its town and too coarse to resolve
individual installations.

Where a plant could be resolved more precisely than it is here, it deliberately
has not been.

## 3. The 72-hour embargo

Nothing is published until at least 72 hours after the incident.

- `lib/qc.ts` returns an **error** for any published incident younger than 72
  hours, which blocks the build and the database seed.
- `ingest/pipeline.ts` clamps the configurable minimum age to a floor of 72
  hours; setting `INGEST_MIN_AGE_HOURS=1` has no effect.
- The review queue currently holds two items blocked on exactly this ground.

The purpose is to remove any operational value from freshness. This is a
research archive, not a feed.

## 4. Nothing publishes itself

The ingestion module discovers candidates. It cannot publish them:

- `runPipeline()` has no code path that produces a `published` stage;
- `POST /api/ingest/run` writes nothing at all — it returns a draft;
- the `review_queue` table carries a CHECK constraint requiring both
  `approved_by` and `approved_at` before `stage` may be `published`.

A person, named in the record, has to decide.

## 5. Territory

Crimea and Sevastopol are **internationally recognised as Ukraine** and have
been under Russian occupation since 2014. Facilities there:

- are stored with `territoryStatus: 'occupied_ukraine_internationally_recognised_as_ukraine'`;
- are drawn on the map with a distinct blue halo;
- are counted separately in the dashboard and never folded into a "Russian
  Federation" total;
- carry an explicit label on the facility card.

The QC engine errors if a facility's territory status disagrees with its
region's. Five records are affected.

## 6. People

- Casualty figures are recorded when reported, as aggregate counts only.
- No private individual is named anywhere in the dataset.
- No employee, contractor or witness is identified.
- Eyewitness social-media material is used for corroboration of physical facts
  only, never to identify the person who posted it.
- Where casualties occurred among responders or civilians — 49 injured
  firefighters at Proletarsk, 13 injured students at Alabuga, deaths at Tuapse
  and in the July 2026 warehouse strikes — they are recorded because the human
  cost is part of the factual record, not as a rhetorical device.

## 7. Dual-use characterisations

Several facilities are described in reporting as supplying the Russian military.
Where that characterisation comes from a party to the conflict, it is recorded
as a **claim** attributed to that party, not as a finding. Wildberries denies the
allegations made against it; that denial is recorded alongside the allegation and
the project takes no position on it.

The project documents physical damage. It does not adjudicate the legitimacy of
any target.

## 8. Licensing and third-party material

- Imagery whose licence forbids redistribution is linked, never rehosted.
- A hosted thumbnail requires a licence that positively permits redistribution;
  the QC engine refuses one otherwise.
- No article text is reproduced beyond what is needed to state what a source
  establishes.
- Company logos are not used.

## 9. Data licence and downstream use

The dataset is CC BY 4.0. Every export carries the dataset version, review date,
licence, methodology link and this warning:

> Confidence scores are integral to every record — a row without its confidence
> and verification status is not a finding. Model estimates are NOT official
> figures and must never be aggregated with them.

If you republish figures from this project, republish the confidence and
verification columns with them. A number from this dataset without its
uncertainty is a misrepresentation of the research.

## 10. Reporting a problem

Open an issue describing the record and the concern. For anything that touches
the exclusions in §1 or the safety of a named person, do not open a public
issue — contact the maintainers privately. Records under challenge are marked
`disputed` while they are reviewed, not quietly removed.
