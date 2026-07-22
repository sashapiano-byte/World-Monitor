# Camera sources — ToS / permission review (Phase 1C)

Frontline's camera layer relays **public live streams**. This document records
the terms-of-service posture for every source class we ship, and lists every
**non-YouTube** source that must be individually reviewed before it is allowed
to go live (`tos_reviewed = true`).

## How the gate works

RLS (`supabase/migrations/0002_rls.sql`) only exposes a camera to the public
anon key when:

```
status = 'active' AND (provider = 'youtube' OR tos_reviewed = true)
```

Consequences, by design:

- **YouTube** rows need only to become `status = 'active'` (via the liveness
  verification pass) to be public — embedding via YouTube's official player is a
  sanctioned use (see below).
- **Non-YouTube** (`provider = 'other'`) rows are **hidden until a human sets
  `tos_reviewed = true`** for that specific source, in addition to going
  `active`. They ship `tos_reviewed = false`.
- The entire seeded catalog (`0004_seed_cameras.sql`) ships `status =
  'unverified'`, so **nothing is public until reviewed** — YouTube included.
  This is intentional honesty: live video ids rotate and cannot be verified from
  the build environment.

## YouTube-Live embedding — ToS posture (permitted)

We surface YouTube streams **only** through YouTube's official IFrame player
(`https://www.youtube.com/embed/...`), built in `lib/cameras/youtube.ts`. We do
**not** download, re-host, proxy, transcode, or scrape the video bytes. The
stream is served by YouTube directly to the viewer's browser, exactly as on
youtube.com, so YouTube's ads, branding, and creator attribution are preserved.

This is the use YouTube's Terms of Service and the YouTube IFrame Player API
explicitly contemplate ("embeddable player"). Uploaders can disable embedding
per-video; when they do, the IFrame returns an error and our liveness pass
should mark the row `offline` rather than showing a broken frame. We honor
creator control by never attempting to bypass an embed restriction.

Two embed shapes are used:

- **Video id** — `/embed/<videoId>`. Precise but the id rotates whenever the
  operator restarts the stream.
- **Channel id** — `/embed/live_stream?channel=<channelId>`. Follows whatever a
  channel is currently live-streaming; preferred for 24/7 webcam operators
  because it survives id rotation.

Because ids rotate and can't be confirmed offline, the seed stores a **stable
discovery URL** (a YouTube search or a channel `/live` URL) and leaves
`embed_url` empty until a real embeddable id is resolved. The UI then offers an
"open on YouTube" link instead of an empty frame.

### Verification pass (what flips YouTube rows to `active`)

`verifyCameraLiveness()` in `lib/cameras/youtube.ts` is a documented **stub** (no
network in this environment). A production run from a trusted server would:

1. Resolve the current live video for channel-form rows (follow the channel
   `/live` redirect to `watch?v=<id>`), persist that id.
2. Hit YouTube **oEmbed** (`/oembed?url=<watchUrl>&format=json`): `200` ⇒ exists
   & embeddable; `401/404` ⇒ private/removed.
3. Optionally confirm it is a *live* broadcast (not an upload).
4. `UPDATE cameras SET is_live, status='active', last_checked_at=now()` via the
   service role. Only then does the row become public.

## Non-YouTube sources — REQUIRE INDIVIDUAL REVIEW

All rows below ship `provider='other'`, `tos_reviewed=false`, and stay hidden
until each line item is cleared. None should be enabled without confirming the
specific point noted.

| Source (seed title) | Type | URL | ToS status | Must review before enabling |
| --- | --- | --- | --- | --- |
| Rome — Colosseum (Skyline Webcams) | webpage | skylinewebcams.com | **Not cleared.** Skyline Webcams offers an official embed widget but its terms restrict reuse; some feeds are also mirrored to their own YouTube channel. | Obtain/confirm their embed permission, or switch to their YouTube channel (then treat as a `youtube` row). Preserve their attribution. |
| Venice — St Marks (Skyline Webcams) | webpage | skylinewebcams.com | **Not cleared.** Same as above. | Same as above. |
| New York — Times Square (EarthCam) | webpage | earthcam.com | **Not cleared / likely prohibited.** EarthCam's ToS forbids hotlinking/embedding without a commercial license. | Do **not** embed. Either license from EarthCam or drop; prefer the independent Times Square YouTube cam instead. |
| Reykjavik — Windy Webcam | webpage | windy.com/webcams | **Not cleared.** Windy aggregates third-party webcams under the owners' terms; Windy's API/embed has its own attribution + key requirements. | Per-cam owner licensing + Windy attribution/API-key terms. |
| Rio — Copacabana (WebcamTaxi) | webpage | webcamtaxi.com | **Not cleared.** WebcamTaxi is an aggregator; most feeds are actually third-party YouTube streams re-listed. | Trace to the original operator; if it is a YouTube stream, add it as a `youtube` row and skip the aggregator entirely. |
| New York — DOT Traffic Cam | mjpeg | webcams.nyctmc.org | **Not cleared.** NYC DOT/511 still-image cams are public but carry usage terms and rate limits; images are low-frequency, not true live video. | Confirm NYC DOT/511 redistribution terms + acceptable polling rate; add attribution. |
| Los Angeles — Caltrans Traffic (HLS) | hls | cwwp2.dot.ca.gov | **Not cleared.** Caltrans District feeds are public but redistribution terms and stream stability vary by district. | Confirm Caltrans redistribution terms; pin a stable per-camera HLS URL; add attribution. |

### General policy for adding non-YouTube sources

- Prefer routing any operator who *also* streams to YouTube through the YouTube
  path — it moves them out of this review queue entirely.
- Never embed a source whose ToS forbids hotlinking/embedding (e.g. EarthCam)
  without a written license.
- Government traffic cams (DOT/511/Caltrans): usually permissible with
  attribution and polite polling, but verify per-agency and keep attribution
  visible, mirroring the layer-attribution rule in the rest of the app.
- When cleared, set `tos_reviewed = true` **and** record the clearing decision
  (who/when/terms) in `metadata`.

## Positioning vs. worldmonitor.app

worldmonitor.app relays public YouTube-Live streams. Frontline takes the same
YouTube-first, official-embed approach (the low-risk, creator-respecting path)
and additionally treats every non-YouTube feed as a gated source requiring
explicit ToS clearance — so coverage never outruns permission.
