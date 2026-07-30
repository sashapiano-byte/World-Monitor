# Satellite imagery

## The rule

**This repository stores links and metadata. It does not store imagery.**

Imagery whose licence forbids redistribution is linked to its original
publication and never rehosted. A hosted thumbnail is opt-in per record, and
`lib/qc.ts` returns an error unless the licence text positively permits
redistribution — the default is no thumbnail, and the default is right for
almost every commercial image.

## What every image record must carry

| Field | Why |
|---|---|
| `provider` | Named operator or the analysis group that published it. |
| `captureDate` | **When the image was taken**, not published. A CHECK constraint requires it for `satellite`. |
| `resolutionMetres` | Where published. |
| `license` | Verbatim terms. |
| `url` | The original publication. |
| `caption` | What is visible. |
| `beforeOrAfter` | `before` · `after` · `n/a`. |
| `interpretationLimits` | **What a reader must not conclude from it.** |

`interpretationLimits` is the field that stops imagery being over-read. Optical
imagery shows exterior structural change and fire scarring. It does not show
whether internal equipment is repairable, whether a plant is running, or when
the damage occurred if there is no matching "before" frame. Say so, per image.

## What is never done

- Annotating critical equipment, process units or internal layout.
- Publishing anything that would resolve a site more finely than the
  facility-centroid precision described in
  [SECURITY_AND_ETHICS.md §2](../SECURITY_AND_ETHICS.md#2-geolocation).
- Inferring a strike date from an image alone without saying that is what
  happened. Where this project does infer a date that way — the Armavir record —
  it is stated in the incident's `unresolved` block.

## Before/after comparison

The data model supports paired `before` and `after` records for the same
incident, which the facility card renders side by side with both capture dates
shown. Where only an `after` frame exists, that is stated rather than implied:
a single post-strike image is weaker evidence than a pair, and the interface
should not make them look alike.

## Connecting Copernicus / Sentinel Hub

Sentinel-2 is free, lawfully redistributable under the Copernicus licence, and
adequate for detecting large fires, tank-farm losses and major structural
change at 10 m resolution. It is not adequate for assessing damage to a
particular process unit — do not try.

1. Register at <https://dataspace.copernicus.eu/> and create an OAuth client.
2. Put the credentials in `.env` — **never in the repository**:

```dotenv
SENTINEL_HUB_CLIENT_ID=
SENTINEL_HUB_CLIENT_SECRET=
SENTINEL_HUB_INSTANCE_ID=
```

3. Obtain a token:

```bash
curl -s -X POST https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token \
  -d grant_type=client_credentials \
  -d client_id="$SENTINEL_HUB_CLIENT_ID" \
  -d client_secret="$SENTINEL_HUB_CLIENT_SECRET"
```

4. Request a scene through the Process API, bounding the request to the
   **facility centroid plus a coarse buffer** — not a tight crop on a specific
   installation.

5. Record the result as a `media` entry with the capture date the API returns,
   the Copernicus licence, and the interpretation limits.

`.env` is git-ignored. If a credential is ever committed, rotate it in the
Copernicus console; removing the commit is not sufficient.

## Fire detection as corroboration

NASA FIRMS thermal anomaly data is free and useful for confirming that a fire
occurred at a location at a time — which is exactly the kind of narrow,
checkable fact this project wants. It confirms heat, not damage: a large fire
detected from orbit says nothing about which installation burned or how badly.

The dataset uses it in that spirit for the Proletarsk depot and the Ust-Luga
complex, where fire detection corroborates duration rather than severity.

## Cost

Everything above is free at research volumes. Commercial high-resolution imagery
(Planet, Maxar) is not, and this project does not purchase it. Where such
imagery appears in the dataset it is because a publisher analysed and published
it, and the record links to that publication.
