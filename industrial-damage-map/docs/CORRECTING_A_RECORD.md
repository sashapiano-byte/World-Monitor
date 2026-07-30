# Correcting a record

Corrections are made **in the open**. A record that turns out to be wrong is
amended or marked rejected — never quietly deleted. The audit trail is part of
the evidence.

---

## Decide what kind of correction it is

| Situation | Action |
|---|---|
| A detail is wrong (date, unit name, casualty count, score) | Amend the record. |
| The record is contested by a credible source | Set `verificationStatus: 'disputed'` and add the opposing `claim`. Do not pick a winner. |
| The evidence no longer supports publication | Downgrade to `unconfirmed`, set `physicalDamageScore: 0`. |
| The event did not happen, or is not damage | Set `verificationStatus: 'rejected'`. **Keep the record.** |
| Two facilities are the same site | Merge — see below. |
| The facility should never have been included | Reclassify to a flagged `siteCategory`, or reject its incidents. |

**`rejected` is not delete.** A reader who saw the claim needs to be able to
find out that it was withdrawn.

## Amending

1. Edit the record in `data/facilities/*.ts`.
2. Update `lastReviewed` on the incident and `updatedAt` on the facility.
3. Add a line to `unresolved` if the correction opened a new question.
4. If the change alters a number, update its `methodology` in the same commit.
   A figure and its method move together.
5. `npm run qc && npm test`.
6. Record it in [CHANGELOG.md](../CHANGELOG.md) with the reason.

The git diff is the primary record. Write a commit message that says what
changed in the *world's* knowledge, not just in the file.

## Downgrading to unconfirmed

```ts
verificationStatus: 'unconfirmed',
physicalDamageScore: 0,          // enforced by QC and by a database CHECK
confidence: 35,                  // must be < 40
unresolved: [
  'Downgraded 2026-08-14: the only source supporting the damage claim was a '
  + 'tier-C aggregator and no corroboration could be found.',
],
```

Keep `damageSummary` — it still describes what was *reported*, which remains
true even when the underlying claim is not established.

## Rejecting

```ts
verificationStatus: 'rejected',
physicalDamageScore: 0,
confidence: 0,
unresolved: [
  'REJECTED 2026-08-14: the reported fire was an industrial accident '
  + 'unconnected to any attack, per the operator’s statement of 2026-08-10.',
],
sourceIds: [...existing, 's-operator-statement-2026-08-10'],
```

Rejected incidents are excluded from every count and from the map, including the
unconfirmed layer. They remain in the repository and in the full JSON export.

If a facility's only incidents are rejected, the facility is no longer eligible
for inclusion; remove it in the same change and say so in the changelog.

## Merging duplicate facilities

1. Pick the surviving card — usually the better-sourced one, or the one whose
   slug is already linked externally.
2. Move the other card's incidents, status changes, estimates, media and claims
   to the survivor's `facilityId`, keeping their own ids.
3. Add the removed card's name to the survivor's `alternativeNames`.
4. Delete the removed card.
5. Record the decision in `data/duplicate-resolutions.ts`:

```ts
{
  facilityId: 'f-survivor',
  otherFacilityId: 'f-survivor',   // self-reference for a completed merge
  resolution: 'merged',
  rationale: 'Both cards described the same site; reporting used two names.',
  resolvedAt: '2026-08-14',
}
```

6. `npm run qc` — the duplicate flag should stop firing.

Where two sites are genuinely separate but keep tripping the detector, record
`resolution: 'distinct'` with the reasoning. That is a finding worth keeping:
it stops the next editor re-investigating the same pair.

## Corrections that change published totals

If a correction moves a headline figure — the facility count, the published
incident count, a financial total — say so explicitly in the changelog entry,
with the before and after. People quote these numbers.

## After a correction

- Rebuild and redeploy: the map, table, dashboard and facility pages are
  prerendered, so a database change alone does not update them.
- Bump the dataset version if the change is material.
- Update `lastFullReview` in `data/index.ts` only after a **complete**
  end-to-end review, not after a single correction.
