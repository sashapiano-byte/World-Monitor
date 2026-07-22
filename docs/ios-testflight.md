# iOS / TestFlight — automation vs. approval gate

Concise checklist of what the pipeline does automatically vs. what requires
explicit human approval before running. Mirrors Happy Hour Live's flow, adapted
to Frontline's **new** bundle ID under the **reused** Team ID.

Full runbook: [`../ios/README.md`](../ios/README.md).
Native config to apply: [`../ios/AppConfig.notes.md`](../ios/AppConfig.notes.md).
Governing decisions: [`../DECISIONS.md`](../DECISIONS.md) items 2 & 5.

---

## Status at a glance

| Item | Value | State |
|------|-------|-------|
| Apple Team ID | `LMNGCLUC3S` | Reused from Happy Hour Live |
| Bundle ID | `app.frontline.intel` | **PROPOSED — not yet registered** |
| Old bundle ID | `nyc.happyhour.app` | **Must NOT be reused** |
| TestFlight submit | — | **GATED — approval required** |

---

## ✅ Automated (safe — runs in CI, no approval needed)

- [x] Build the web app as a static export (`BUILD_TARGET=capacitor npm run build`).
- [x] Generate / sync the native iOS project (`cap add ios` if missing, then `cap sync ios`).
- [x] Run **EAS Build** for the `preview` profile → produces an installable `.ipa`
      for internal QA. **No store upload.**

These run on push to `main` and via manual `workflow_dispatch`
(`.github/workflows/ios-build.yml`). They never touch TestFlight.

## 🔴 Gated (manual — requires explicit approval)

- [ ] **Register the App ID** `app.frontline.intel` on the Apple Developer portal
      (Team `LMNGCLUC3S`). — *DECISIONS.md item 2, awaiting approval.*
- [ ] Create the App Store Connect app record (`ASC_APP_ID`).
- [ ] Provision signing via `eas credentials` (distribution cert + profiles).
- [ ] Configure submit secrets (see below).
- [ ] **`eas submit --platform ios --profile production`** → TestFlight.
      — *DECISIONS.md item 5. Do not run without approval.*

## Where the gate physically lives

1. **`eas.json`** — `submit.production` exists but references targets by env name
   only (no credentials); running submit is a separate, manual command.
2. **`.github/workflows/ios-build.yml`** — the `submit_testflight` job is fully
   written but double-locked:
   - `if: ${{ false && github.event.inputs.confirm_submit == 'true' }}` — the
     `false &&` backstop makes it unreachable until a human edits the line;
   - `confirm_submit` dispatch input defaults to `"false"`.
   Its first step also `exit 1`s as a refusal. **Nothing submits automatically.**

## Secrets required before any submit (names only — set as CI/EAS secrets)

| Name | Purpose |
|------|---------|
| `EXPO_TOKEN` | EAS auth for CI builds (already used by the build job) |
| `ASC_KEY_ID` | App Store Connect API key ID |
| `ASC_ISSUER_ID` | App Store Connect API issuer ID |
| `ASC_KEY_P8` | App Store Connect API private key (.p8) |
| `APPLE_ID_EMAIL` | Apple ID for submission |
| `ASC_APP_ID` | App Store Connect numeric app id |

No values are stored anywhere in the repo.

## Lifting the gate (only after approval)

1. Get explicit sign-off on the bundle ID (DECISIONS.md item 2) and submission
   (item 5).
2. Register the App ID; create the ASC app record; run `eas credentials`.
3. Add the submit secrets above.
4. To submit once, run `eas submit` locally (preferred first time), **or** to
   enable CI submission edit the workflow: change `false &&` to lift the backstop
   and dispatch with `confirm_submit=true`. Remove the refusal `exit 1` step.
