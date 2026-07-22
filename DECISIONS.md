# DECISIONS — awaiting approval

Nothing in this list has been acted on. No accounts created, no terms accepted,
no paid tiers purchased, no deploys, no TestFlight submissions. Each item is a
decision for you to make; the scaffold ships with a safe default and a clearly
marked place to change it.

---

## 1. Product name / brand  🟡 pick one

Working name used throughout the scaffold: **Frontline**
(package `frontline-intel`, app name `Frontline`, bundle `app.frontline.intel`).

It's a placeholder chosen so the scaffold is coherent — trivially renamed with a
find-and-replace on `Frontline` / `frontline`. Candidates (all appear
domain-plausible; none checked/registered):

| Name | Angle | Notes |
|------|-------|-------|
| **Frontline** *(current)* | Direct, conflict-forward | Common word; trademark crowded |
| **Bellwether** | Bridges conflict + markets (leading indicator) | Good fit given trader angle |
| **Vantage** | Neutral, observational | Clean, brandable |
| **Theater** / **Theatre** | "theater of war" | Ambiguous with entertainment |
| **Aegis** | Shield / defense | Heavily used in defense-tech |
| **Sentinel** | Watch / monitoring | Common in security products |

**Recommendation:** **Bellwether** if the eventual audience is traders (ties the
conflict feed to the market-odds overlay narratively); **Frontline** if the
positioning stays news/OSINT-forward. Tell me which and I'll rename + check
domain/trademark availability.

## 2. iOS bundle identifier  🟡 approve before registration

- Team ID **LMNGCLUC3S** reused (as instructed).
- Bundle ID **cannot** be `nyc.happyhour.app` again.
- Proposed: **`app.frontline.intel`** (matches the working name; changes with the
  name decision above).
- **Not yet registered** on the Apple Developer portal. Nothing submitted.
- On approval I'll register the App ID, create the provisioning profile, and wire
  EAS credentials — see `ios/README.md`.

## 3. ACLED license (Sudan layer B)  🔴 real cost decision

- ACLED's **free tier is non-commercial only** and requires *substantially
  reworked* output — you may not re-plot raw ACLED events on a commercial map.
- This product "may eventually charge traders" → that's a **commercial** use, so
  the free tier would not cover launch.
- The ACLED layer ships **disabled** (`enabled=false` in `0003_seed_conflicts.sql`)
  and its adapter returns nothing until this is resolved.
- **Recommendation: DEFER the paid Commercial License, don't buy it now.**
  Rationale: (a) there's no revenue yet, so you'd pay for a commercial license
  before charging anyone; (b) **UCDP GED (CC BY 4.0)** and **HDX** already give
  Sudan strong, cleanly-licensed coverage for the MVP — ACLED is additive, not
  required; (c) ACLED commercial pricing is quote-based and worth negotiating
  once you have usage numbers. Revisit the moment you turn on monetization.
- Full analysis: `docs/sudan-acled-license.md`. **No ACLED registration has been
  done and none will be without your go-ahead.**

## 4. Non-YouTube camera sources (layer C)  🟡 ToS review before enabling

- YouTube-Live streams are catalogued and enabled (worldmonitor.app relays theirs
  the same way).
- Any non-YouTube source (direct HLS/MJPEG/RTSP, traffic-cam portals, webcam
  aggregators) ships with `tos_reviewed=false` and is **hidden by RLS** until
  individually cleared. List + per-source ToS notes: `docs/camera-tos-review.md`.

## 5. Deploy / TestFlight gating  🔴 hard-gated

- **No `vercel --prod`** without approval (preview deploys are fine).
- **No TestFlight submission** without approval.
- Both pipelines are configured but stop short of the gated step.

## 6. New Supabase project  🟡 create when ready

- Requires a **new** Supabase project (do not reuse Happy Hour Live's).
- Migrations + seed are ready in `supabase/migrations/`. On project creation:
  `supabase link` → `supabase db push`. Keys go in `.env.local` (never committed).
