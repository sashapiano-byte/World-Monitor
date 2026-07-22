# ACLED License — Decision Memo (Sudan layer B)

**Status: RECOMMENDATION ONLY. No ACLED account created, no terms accepted, no
quote requested. Nothing here is actionable without your explicit go-ahead.**
(Cross-referenced from DECISIONS.md item 3.)

## 1. What ACLED's free tier allows — and what it forbids

ACLED (Armed Conflict Location & Event Data Project, acleddata.com) distributes
its event data under its own Terms of Use, not an open license. The free
access tier:

- Is **non-commercial only**. Use "in connection with any commercial purposes"
  — including inside a product that charges users, directly or indirectly —
  requires a separate paid agreement.
- Requires **registration and acceptance of ACLED's Terms of Use** to obtain
  an access key (we have deliberately not done this).
- Restricts **redistribution**: you may not republish the dataset or
  substantial extracts of it. Public-facing outputs must be
  **"substantially reworked"** — derived analysis, aggregation, or
  transformation — not a re-serving of ACLED's rows. Concretely for a map
  product: **re-plotting raw ACLED events as points on our map is not
  permitted**, even in a free/non-commercial product. Admin-level intensity
  aggregates, trend indices, or similar derived summaries are the kind of
  output the terms contemplate.
- Requires the attribution line
  *"Armed Conflict Location & Event Data Project (ACLED); acleddata.com."*
  on any output that draws on the data.

> VERIFY before any signing: the exact current text at
> https://acleddata.com/terms-of-use/ — ACLED revised its access model in
> 2025 (new developer portal, tiered access). The above reflects the
> long-standing published terms; counsel should read the live version.

## 2. Why this bites us

Frontline "may eventually charge traders." A subscription paywall — or even
ancillary monetization around the feed — is squarely commercial use. So:

- The free tier **cannot cover a monetized launch**, full stop.
- Even pre-monetization, the free tier would (a) require accepting terms,
  (b) forbid raw-event plotting, and (c) create a migration cliff the day
  billing turns on.

ACLED's **Commercial License** exists for exactly this case, but pricing is
**quote-based** (negotiated per use case, audience size, and product) — there
is no public price list, and quotes are typically annual commitments.

## 3. Options considered

| Option | Cost now | Risk | Notes |
|---|---|---|---|
| A. Buy Commercial License now | Unknown (quote-based, likely $$$$/yr) | Paying before any revenue; weak negotiating position (no usage data) | Fastest path to ACLED-on-map |
| B. Use free tier now, upgrade at monetization | $0 | Terms acceptance + "substantially reworked" burden anyway; migration cliff; arguable "commercial intent" gray zone for a product built to be sold | Not clean; reputational/legal risk for an intelligence product |
| C. **DEFER: ship without ACLED, keep adapter gated** | $0 | Slightly less event coverage for Sudan in MVP | UCDP GED + HDX + FIRMS already cover Sudan cleanly |

## 4. Recommendation: **C — DEFER. Do not buy now; do not register for the free tier.**

Rationale:

1. **No revenue yet.** A quote-based annual commercial license is a real,
   recurring cost incurred before a single paying user exists. Negotiating
   with zero usage numbers also means paying rack rate.
2. **The MVP does not need ACLED.** For Sudan we already have:
   - **UCDP GED (CC BY 4.0)** — georeferenced organized-violence events with
     fatality estimates, *cleanly licensed for commercial use with
     attribution*. This is the closest like-for-like substitute for ACLED's
     event layer.
   - **HDX** — displacement and admin-boundary datasets with per-dataset open
     licenses (preserved per feature by our adapter).
   - **NASA FIRMS** — near-real-time thermal anomalies (open data).
   That is strong, defensible Sudan coverage with zero license exposure.
3. **Deferring improves the eventual deal.** When monetization turns on, we
   will have concrete audience/usage numbers and a defined product surface —
   exactly the inputs ACLED prices against — and a working alternative
   (UCDP) as negotiating leverage.
4. **The codebase is already built for the flip.** The ACLED layer ships
   `enabled=false`; the adapter fails closed (empty output + explanatory
   message) unless `config.commercial_licensed=true` **and** credentials
   exist, and even then emits only **derived admin-1 aggregates**, never raw
   event re-plots. Turning ACLED on after a signed license is a config flip,
   not an engineering project.

**Revisit trigger:** the moment monetization is scheduled (or a design
partner asks for ACLED specifically), request a commercial quote. Budget
placeholder until then: unknown/quote-based — expect an annual contract.

## 5. Guardrails already in code (regardless of decision)

- `lib/layers/adapters/acled.ts` — fail-closed gating; derived-output-only;
  attribution echoed and enforced by the registry's fail-closed guard.
- `supabase/migrations/0003_seed_conflicts.sql` — `acled_events` row is
  `enabled=false`, config `{"gated":true,"reason":"license_pending"}`.
- Attribution string on the layer row:
  *"Armed Conflict Location & Event Data Project (ACLED); acleddata.com."* —
  never stripped; ingestion refuses results without it.
