# Bundled fallback basemap

`eurasia-50m.json` is a small vector basemap shipped with the application so the
map is **never** an empty grey rectangle. Raster tiles are fetched from
`tile.openstreetmap.org`; on a restricted network, behind a corporate proxy, or
offline they simply do not arrive. This file is drawn underneath them, so the
geography is always present and markers always sit on a recognisable coastline.

## Provenance

| | |
|---|---|
| Source | [Natural Earth](https://www.naturalearthdata.com/) 1:50m Cultural — Admin 0 Countries, and 1:50m Physical — Lakes |
| Licence | Public domain. Natural Earth imposes no restrictions on use. |
| Retrieved | 2026-08-01 |
| Extent | 16–88°E, 34–73°N — the window the dataset occupies, padded so coastlines run off-canvas rather than stopping mid-air |
| Processing | Ring-level bounding-box filter to the extent, Douglas–Peucker simplification at 0.025° (land) / 0.03° (lakes), coordinates rounded to 3 decimals, rings under 0.02 deg² dropped |

## Crimea

Natural Earth's default view places Crimea inside the Russia polygon. This
project's stated position is that Crimea is internationally recognised as
Ukraine and under Russian occupation, so the peninsula is extracted into a
separate `occupiedCrimea` array and drawn hatched with a dashed outline — never
shipped as Russian land, never folded into a Russian total. See
`METHODOLOGY.md`.

## Shape

```jsonc
{
  "attribution": "Natural Earth 1:50m (public domain)",
  "bbox": [16, 34, 88, 73],
  "land":          [ [ [lon, lat], ... ], ... ],  // 106 rings
  "lakes":         [ [ [lon, lat], ... ], ... ],  //  24 rings
  "occupiedCrimea":[ [ [lon, lat], ... ] ]        //   1 ring
}
```

Rings are closed linear rings in WGS 84 decimal degrees. `components/MapView.tsx`
converts them to GeoJSON polygons at runtime.

## Regenerating

`scripts/build-basemap.mjs` rebuilds this file from the two Natural Earth
GeoJSON downloads. It takes their paths as arguments and is not run during the
normal build — the output is committed, so a build never depends on a network
fetch from a third party.

```bash
node scripts/build-basemap.mjs ne_50m_admin_0_countries.geojson ne_50m_lakes.geojson
```
