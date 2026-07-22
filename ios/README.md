# Frontline — iOS Shell Operator Runbook

Capacitor + EAS Build pipeline for the Frontline iOS app. This directory
**intentionally does not contain a generated native Xcode project** — CocoaPods
and Xcode are not available in the scaffold environment, and the native project
is best generated on an operator's Mac. Everything needed to generate and ship
it is documented here as code + steps.

> **Status gates (read first):**
> - Bundle ID **`app.frontline.intel`** is **PROPOSED, NOT yet registered** on
>   the Apple Developer portal. See `DECISIONS.md` item 2.
> - **No TestFlight submission** happens without explicit approval. See
>   `DECISIONS.md` item 5 and `docs/ios-testflight.md`.
> - The bundle ID **cannot** be `nyc.happyhour.app` (that's Happy Hour Live's).
>   Only the **Team ID `LMNGCLUC3S`** is reused.

---

## 1. Generate the native iOS project (local, one-time)

Run on macOS with Xcode + CocoaPods installed:

```bash
npm i                                 # install JS deps
npx cap add ios                       # generate ios/App (native Xcode project)
BUILD_TARGET=capacitor npm run build  # Next static export -> out/
npx cap sync ios                      # copy web build + plugins into the shell
npx cap open ios                      # open the project in Xcode
```

Notes:
- `npm run cap:sync` is a shortcut for `next build && cap sync ios`. To be safe
  set `BUILD_TARGET=capacitor` so Next produces the static `out/` export the
  shell packages (`next.config.mjs` switches to `output: 'export'` on that flag).
- After `npx cap add ios`, apply the Info.plist / capability changes described in
  [`AppConfig.notes.md`](./AppConfig.notes.md) before the first build.
- Commit the generated `ios/App` project (minus `Pods/` and build artifacts) if
  you want reproducible EAS builds; otherwise CI regenerates it via `cap add ios`.

---

## 2. Apple Developer setup

Team: **`LMNGCLUC3S`** (reused). Everything below is **pending approval** — do
not perform these steps until the bundle ID decision is signed off
(`DECISIONS.md` item 2).

1. **Register the App ID** in the Apple Developer portal
   (Certificates, Identifiers & Profiles → Identifiers → +):
   - Bundle ID: **`app.frontline.intel`** (Explicit).
   - **MUST NOT** be `nyc.happyhour.app` — that identifier belongs to Happy Hour
     Live and cannot be reused for this app.
   - This App ID is **not yet registered**. Nothing has been submitted.
2. **Capabilities** to enable on the App ID (only what the app actually uses):
   - **Associated Domains** — only if universal links / deep links are added
     later. Not required for the MVP.
   - **Push Notifications** — only if/when push is added. Not in MVP; enable
     later and add the APNs key then.
   - No background modes, HealthKit, etc. are required for the current scope.
3. **App Store Connect record**: create the app (`ascAppId` / `ASC_APP_ID`) only
   when moving toward TestFlight — this is part of the gated flow, not setup.
4. **Provisioning**: prefer letting EAS manage certificates & profiles
   (see §3). Manual profiles are possible in Xcode but not recommended.

---

## 3. EAS credentials & signing

EAS can generate and store the distribution certificate and provisioning profile
for you. Run on the operator machine (interactive, one-time):

```bash
npm i -g eas-cli        # or use npx eas-cli
eas login               # authenticate (or set EXPO_TOKEN in CI)
eas credentials         # manage iOS signing: choose "Build Credentials" -> iOS
```

During `eas credentials`:
- Let EAS create a **Distribution Certificate** and an **Ad Hoc** (preview) and
  **App Store** (production) provisioning profile for `app.frontline.intel`.
- This requires the App ID to already be registered (§2) — so it is **blocked
  until approval**.
- Team ID is **`LMNGCLUC3S`**; confirm EAS targets that team.

Build profiles are defined in [`../eas.json`](../eas.json):
- `development` — simulator/dev-client debug build.
- `preview` — internal ad-hoc `.ipa` for on-device QA (**this is what CI builds**).
- `production` — App Store / TestFlight-eligible build (building is fine;
  submitting is gated).

Build commands:

```bash
eas build --platform ios --profile preview      # QA build, no submission
eas build --platform ios --profile production   # store-eligible artifact (no submit)
```

---

## 4. TestFlight submission — GATED

> **DO NOT run `eas submit` without explicit approval.** See `DECISIONS.md`
> item 5 and the checklist in [`../docs/ios-testflight.md`](../docs/ios-testflight.md).

When (and only when) approval is granted and the App ID is registered:

```bash
# GATED — requires approval:
eas submit --platform ios --profile production
```

The CI workflow (`.github/workflows/ios-build.yml`) contains a fully-written
`submit_testflight` job, but it is guarded by **two** independent locks
(`if: false` backstop **and** a `confirm_submit` dispatch input that defaults to
`false`). A human must deliberately lift both. Nothing submits automatically.

---

## 5. Required env / secrets (by NAME only — no values here)

Configure these as GitHub Actions secrets and/or EAS secrets. **Never commit
values.**

| Name | Purpose | Used by |
|------|---------|---------|
| `EXPO_TOKEN` | Expo/EAS auth for CI (non-interactive builds) | CI build job |
| `ASC_KEY_ID` | App Store Connect API key ID | `eas submit` (gated) |
| `ASC_ISSUER_ID` | App Store Connect API issuer ID | `eas submit` (gated) |
| `ASC_KEY_P8` | App Store Connect API private key (.p8 contents) | `eas submit` (gated) |
| `APPLE_ID_EMAIL` | Apple ID used for submission | `eas submit` (gated) |
| `ASC_APP_ID` | App Store Connect numeric app id | `eas submit` (gated) |

Fixed, non-secret references (safe to keep in config):
- Apple **Team ID**: `LMNGCLUC3S`
- **Bundle ID**: `app.frontline.intel` (pending registration)

---

## 6. Troubleshooting

- **`cap sync` fails: no `out/` directory** — run
  `BUILD_TARGET=capacitor npm run build` first; without the flag Next does a
  server build and never emits the static `out/` export.
- **EAS build fails: no credentials** — the App ID isn't registered or
  `eas credentials` hasn't been run. Both are gated on approval (§2/§3).
- **Wrong team** — confirm EAS/Xcode targets `LMNGCLUC3S`, not Happy Hour Live's
  signing identity.
