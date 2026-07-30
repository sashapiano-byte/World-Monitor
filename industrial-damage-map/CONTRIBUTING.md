# Contributing

The dataset in `./data` is the source of truth. Postgres is a query surface
loaded from it. So a data contribution is a pull request against typed
TypeScript files, reviewed like code — which is the point: every change to the
record has an author, a diff and a rationale.

---

## Before you start

Read [SECURITY_AND_ETHICS.md](./SECURITY_AND_ETHICS.md). A contribution
containing anything on the hard-exclusion list is rejected without further
review, regardless of how well sourced it is.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## The loop

```bash
npm run qc          # editorial rules — must report 0 errors
npm test            # 71 unit tests
npm run typecheck
npm run test:e2e    # 22 end-to-end tests (needs a build)
```

`npm run qc` is the gate that matters. It exits non-zero on any error-severity
finding, it runs in CI, and `db/seed.ts` refuses to load a dataset that fails it.
You cannot get a rule-breaking record into the database by going around the app.

## What a good contribution looks like

**Sources first, record second.** Find what the sources support, then write the
record that says exactly that — not the other way round.

**Write the caveats.** Every published incident should fill in `established` and
`unresolved`. If you cannot say what remains unresolved about an OSINT record,
you have probably not finished researching it.

**Use the most cautious wording the evidence supports.** "Struck", "damaged",
"seriously damaged", "disabled" and "destroyed" are different claims with
different evidentiary bars.

**Prefer `unknown` to a guess.** `null` fields, `unknown_means`, and an honest
"not established" are all better than a plausible invention. Placeholder dates
are permitted only in the unconfirmed layer and must say so in `unresolved`.

**Never edit a number without editing its methodology.**

## Adding things

- A facility → [docs/ADDING_A_FACILITY.md](./docs/ADDING_A_FACILITY.md)
- Fixing a wrong record → [docs/CORRECTING_A_RECORD.md](./docs/CORRECTING_A_RECORD.md)
- A source → append to `data/sources.ts` with a stable id
  (`s-<publisher>-<topic>-<date>`), a tier, a `kind`, and a `notes` line saying
  what the item actually establishes. Set `syndicatedFrom` if it republishes
  another outlet's reporting — this is not optional, it changes how the source
  is counted.
- An incident → add to the relevant `data/facilities/*.ts`, cite source ids, and
  run `npm run qc`.

## Duplicates

The QC engine flags any two facilities whose normalised names collide or that
sit within 2 km of each other. **Every flag must be closed** in
`data/duplicate-resolutions.ts` with `merged`, `distinct` or `open` and a
rationale. "We looked and they are different" is a finding worth recording; a
permanent warning nobody reads is not.

## Code conventions

- TypeScript strict mode; no `any` in `data/` or `lib/`.
- Comments explain *why*, not *what*. Several load-bearing decisions in this
  codebase look arbitrary without their comment — the `style.load` handler in
  `MapView.tsx` and the `min-w-0` on the explorer section are both there because
  removing them silently breaks the UI.
- New editorial rules belong in `lib/qc.ts` **and** get a test in
  `tests/unit/quality-control.test.ts` that proves the rule actually fires. A
  rule without a test that trips it is decoration.
- New database invariants belong in the SQL migration as a CHECK constraint as
  well, where the rule is absolute.

## Review

A data pull request is reviewed on:

1. Do the cited sources say what the record claims?
2. Is the damage score the most cautious one the evidence supports?
3. Are the sources genuinely independent, or the same wire report twice?
4. Are `established` and `unresolved` honest?
5. Does the confidence score match the verification status?
6. Does `npm run qc` pass, and are any new warnings intentional and explained?

## Reporting a problem without a pull request

Open an issue with the record id, the specific claim you dispute, and a source.
Records under challenge are marked `disputed` while they are reviewed, not
quietly removed.
