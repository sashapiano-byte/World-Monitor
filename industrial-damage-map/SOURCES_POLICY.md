# Sources policy

How sources are graded, counted, cited and archived.

---

## 1. Grading is at item level, not publisher level

A source's tier describes **the item**, not the masthead. An article whose
substance is a company or government statement is a tier-A item *on the question
of what that party said* — even when the outlet publishing it is a wire agency
or a newspaper.

This matters in practice. `Bloomberg — "Russia Says Drone Attack Caused Fire at
Tuapse Oil Refinery"` is tier A: its content is a Russian official
acknowledgement. `Al Jazeera — "Russian oil refinery near Ukraine says it was hit
by drone attack"` is tier A: the operator itself said it. A general Bloomberg
news report with no primary statement inside it is tier B.

Grading the masthead instead of the item would have thrown away the strongest
evidence in the dataset — against-interest admissions by Russian operators and
officials, which almost always reach us through Western outlets.

## 2. The tiers

### Tier A — primary

Enterprise statements · owner or parent-company publications · governors and
regional authorities · emergency services (MChS) · sector regulators
(Rosaviatsiya, Rosmorrechflot and equivalents) · exchange disclosures · official
financial reporting · insurer statements · court documents · state procurement
and repair tenders · commercial satellite operators · Sentinel-2 and other
lawfully available satellite data.

Ukrainian state statements are tier A **as a statement by a party to the
conflict**. They establish that a claim was made. They are never treated as
automatic proof that an effect occurred, and every such record says so in its
`unresolved` block.

Russian state media (TASS and equivalents) are used **only where they concede
something against interest** — for example acknowledging that a plant was
attacked. They are never used to support a Russian-favourable claim.

### Tier B — high-quality independent

Reuters · Associated Press · BBC · Financial Times · The New York Times · The
Washington Post · Bloomberg · RFE/RL · Meduza · Kommersant · RBC · Vedomosti ·
sector trade press (S&P Global Commodity Insights, Upstream, Kpler, Maritime
Executive) · investigative projects with transparent methodology · satellite-
OSINT projects that publish imagery **with capture dates**.

### Tier C — supporting only

Regional media · Telegram channels · eyewitness posts · social-media photo and
video · company aggregators and directories · general-purpose encyclopaedias.

**A tier-C source may never be the sole basis for a conclusion of serious damage
or destruction.** The QC engine enforces this at damage score 4 and above and
returns an error.

## 3. Syndication is not corroboration

Five outlets republishing one Reuters report are **one voice**, not five.

Every source record carries an optional `syndicatedFrom` field naming the outlet
whose reporting it reproduces. When counting independent sources, the QC engine
collapses all sources sharing a `syndicatedFrom` value into a single voice.

This is not a theoretical refinement. On the first review pass it demoted
several refinery records that appeared to have three or four sources but in fact
had one Reuters story reprinted by Ukrainska Pravda, Ukrinform and a trade
aggregator. Those records were either given genuine second sources or had their
damage scores reduced.

## 4. The counting rule

For a **published** incident:

| Damage score | Requirement | Severity if unmet |
|---|---|---|
| ≥ 3 | two independent sources, **or** one tier-A source, **or** dated satellite imagery | error — blocks the build |
| 1–2 | same, but a single credible source is accepted with a visible `single-source` flag | warning |
| 0 | none — the record asserts no damage | — |
| ≥ 4 | additionally: must not rest entirely on tier-C sources | error |

The reasoning behind the 1–2 carve-out is set out in
[METHODOLOGY.md §5](./METHODOLOGY.md#how-the-two-source-rule-is-applied). It is
a deliberate deviation and is flagged wherever it applies.

## 5. What each source is cited *for*

Every source record carries a `notes` field stating what the item actually
establishes — not a summary of the article, but the specific thing it can carry.
An editor revisiting a record two years later must be able to tell at a glance
whether the citation supports the claim attached to it.

Where a source disagrees with the record, that disagreement is stored as a
`claim` with `stance: 'disputes'` and rendered on the facility card. The TANECO
2024 record is the worked example: Reuters image analysis established a strike
on a named primary unit, while the head of Tatarstan said there was no serious
damage and no disruption. Both are recorded; the incident is marked `disputed`
and is not resolved in either direction.

## 6. Archiving

Sources should be archived through a permitted web archive wherever the
publisher's terms and the archive service both allow it, and the snapshot URL
recorded in `archivedUrl`.

**Current state: no snapshots are recorded.** The QC engine reports this as an
informational finding on all 194 sources rather than silently accepting it. This
is the largest known gap in the project's durability: link rot will degrade this
dataset, and the first maintenance task for any operator running it in earnest
is to work through the register and archive what can lawfully be archived.

Archiving is not performed automatically by this repository because doing so
programmatically against 194 URLs would place load on a free public service
without its operator's consent, and because some publishers' terms forbid it.
It is an editorial task with a human in the loop.

## 7. What is never used

- Material available only in closed databases, leaks, or unlawfully obtained
  collections. This is a hard exclusion, not a preference.
- Paywalled content reproduced in full. Links only.
- Imagery whose licence forbids redistribution. Links and metadata only; never a
  rehosted copy. The QC engine refuses a hosted thumbnail unless the licence
  text positively permits redistribution.
- Any source that would require identifying a private individual.

## 8. Adding a source

Add to `data/sources.ts` with a stable semantic id (`s-<publisher>-<topic>-<date>`),
then cite it by id. `npm run qc` will fail the build if a cited id does not
exist, if the URL is malformed, or if the resulting record no longer meets the
counting rule. See [CONTRIBUTING.md](./CONTRIBUTING.md).
