# Frontline — iOS native config notes (Info.plist & capabilities)

Apply these after `npx cap add ios` generates `ios/App`, **before** the first
build. This file documents the required `Info.plist` keys and capability posture
so whoever generates the native project applies them consistently. We do **not**
ship a fabricated `project.pbxproj` / full `Info.plist` — Capacitor generates
those; this is the diff to apply on top.

Target file: `ios/App/App/Info.plist`
Bundle ID: `app.frontline.intel` (pending registration — see DECISIONS.md item 2)

---

## 1. App Transport Security (ATS) — YouTube / HLS embeds

Frontline embeds YouTube-Live players and (later) HLS camera streams. All first-
party and YouTube traffic is HTTPS/TLS, so **do NOT set
`NSAllowsArbitraryLoads = true`** — that would weaken the whole app and can draw
App Review scrutiny. Keep ATS on and scope any exception narrowly.

Recommended posture:
- **Default:** rely on standard ATS (HTTPS everywhere). YouTube embeds and
  Supabase are all HTTPS and need no exception.
- **Only if** a specific non-YouTube camera source requires cleartext or a
  non-forward-secret TLS config (see `docs/camera-tos-review.md`; those sources
  ship disabled), add a **per-domain** exception, e.g.:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <!-- Keep arbitrary loads OFF. Add narrow, per-domain exceptions only. -->
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  <key>NSExceptionDomains</key>
  <dict>
    <!-- Example ONLY — add per-source when a stream host demands it. -->
    <!--
    <key>example-camera-host.tld</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key><true/>
      <key>NSIncludesSubdomains</key><true/>
    </dict>
    -->
  </dict>
</dict>
```

Media playback also needs (Capacitor WebView usually sets this, verify):
```xml
<key>NSAppTransportSecurity</key>
<!-- ... as above ... -->
<!-- Inline media so embedded players don't force fullscreen: handled by WKWebView
     config (allowsInlineMediaPlayback); no Info.plist key, but verify the
     Capacitor WebView is configured for inline playback. -->
```

---

## 2. Usage-description strings (privacy)

Add **only** the keys for capabilities actually used. iOS rejects builds that
access a resource without the matching usage string; conversely, do not add
strings for things the app doesn't use (App Review flags unused prompts).

| Key | When needed | Suggested string |
|-----|-------------|------------------|
| `NSLocationWhenInUseUsageDescription` | Only if the map centers on / uses device location | "Frontline uses your location to center the map on nearby events." |
| `NSCameraUsageDescription` | Only if in-app camera capture is added (not in MVP) | "Frontline needs camera access to capture and submit imagery." |
| `NSPhotoLibraryUsageDescription` | Only if saving/sharing snapshots | "Frontline needs photo access to save map and stream snapshots." |

**MVP reality:** the app displays remote maps and video embeds and needs **none**
of these. Add them lazily when the corresponding feature lands. Location is the
most likely first addition (map "center on me").

---

## 3. Orientation

Frontline is a map/dashboard app; support portrait + landscape on iPhone and all
orientations on iPad.

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
  <string>UIInterfaceOrientationPortraitUpsideDown</string>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

---

## 4. Status bar

`capacitor.config.ts` sets `ios.contentInset: 'always'`; pair it with a status
bar that reads over a dark map UI. Using the `@capacitor/status-bar` plugin
(already a dependency), set style at runtime; in Info.plist:

```xml
<!-- Let the app control the status bar via the StatusBar plugin. -->
<key>UIViewControllerBasedStatusBarAppearance</key>
<true/>
<!-- Dark UI: default to light content over the dark dashboard. -->
<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleLightContent</string>
```

Also ensure the launch storyboard background matches the app's dark theme to
avoid a white flash on cold start.

---

## 5. Misc

- **Display name:** `CFBundleDisplayName` = `Frontline` (matches
  `capacitor.config.ts` `appName`).
- **Bundle identifier:** `CFBundleIdentifier` must resolve to
  `app.frontline.intel` (set via the Xcode target / EAS, not hand-edited).
- **Encryption declaration:** set
  `ITSAppUsesNonExemptEncryption = false` in Info.plist if the app only uses
  standard HTTPS (avoids the per-upload compliance prompt). Confirm this is
  accurate before enabling.
- **Background modes:** none required for MVP. Do not enable audio/VoIP/location
  background modes unless a feature needs them (App Review scrutiny).

---

## Capabilities summary (Xcode "Signing & Capabilities")

| Capability | MVP? | Notes |
|------------|------|-------|
| Associated Domains | No | Add only if universal/deep links are introduced |
| Push Notifications | No | Add with APNs key when push lands |
| Background Modes | No | Not needed |
| Maps | No | Mapbox GL runs in the WebView; no native Maps entitlement |

Keep the entitlement set minimal — it must match the capabilities enabled on the
registered App ID (which is still pending, per DECISIONS.md item 2).
