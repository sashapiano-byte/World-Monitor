#!/usr/bin/env node
/**
 * Rebuilds public/basemap/eurasia-50m.json from Natural Earth downloads.
 *
 * The output is committed, so a build never depends on fetching from a third
 * party. Run this only when the extent or the simplification tolerance changes.
 *
 *   node scripts/build-basemap.mjs <countries.geojson> <lakes.geojson>
 *
 * Inputs (public domain, https://www.naturalearthdata.com/):
 *   - 1:50m Cultural  — Admin 0 Countries
 *   - 1:50m Physical  — Lakes + Reservoirs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'public', 'basemap', 'eurasia-50m.json');

/**
 * The window the dataset occupies, padded so coastlines run off-canvas rather
 * than stopping in mid-air.
 */
const BB = { lonMin: 16, lonMax: 88, latMin: 34, latMax: 73 };

/**
 * Natural Earth's default view places Crimea inside the Russia polygon. This
 * project's position is that Crimea is internationally recognised as Ukraine
 * and under Russian occupation, so the peninsula is pulled out and published as
 * occupied territory instead of as Russian land. It is its own polygon in the
 * MultiPolygon because it does not touch the Russian mainland, so a bounding
 * box is enough to identify it.
 */
const CRIMEA_BOX = [32.0, 43.9, 37.0, 46.4];

const bbox = (ring) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
};

const intersectsExtent = (ring) => {
  const [x0, y0, x1, y1] = bbox(ring);
  return !(x1 < BB.lonMin || x0 > BB.lonMax || y1 < BB.latMin || y0 > BB.latMax);
};

/**
 * Douglas–Peucker in degrees. The tolerance is set from the target render
 * scale: at roughly 20 px per degree of longitude, 0.025° is about half a
 * pixel, which is below the threshold of visibility.
 */
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;

    let farthest = -1;
    let maxDistance = 0;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i];
      let distance;
      if (len2 === 0) {
        distance = Math.hypot(px - ax, py - ay);
      } else {
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = i;
      }
    }

    if (maxDistance > tolerance && farthest > 0) {
      keep[farthest] = 1;
      stack.push([a, farthest], [farthest, b]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

const round3 = (ring) => ring.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);

/** Shoelace area in deg². Only used to drop specks, so sign does not matter. */
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
};

const polygonsOf = (geometry) => {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
};

function main() {
  const [countriesPath, lakesPath] = process.argv.slice(2);
  if (!countriesPath || !lakesPath) {
    console.error('usage: node scripts/build-basemap.mjs <countries.geojson> <lakes.geojson>');
    process.exit(2);
  }

  const countries = JSON.parse(readFileSync(countriesPath, 'utf8'));
  const land = [];
  const occupiedCrimea = [];

  for (const feature of countries.features) {
    const isRussia = feature.properties?.ADM0_A3 === 'RUS';
    for (const polygon of polygonsOf(feature.geometry)) {
      for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
        const ring = polygon[ringIndex];
        if (!intersectsExtent(ring)) continue;
        const simplified = round3(simplify(ring, 0.025));
        if (simplified.length < 4) continue;
        if (ringArea(simplified) < 0.02) continue;

        const [x0, y0, x1, y1] = bbox(simplified);
        const isCrimea =
          isRussia &&
          ringIndex === 0 &&
          x0 >= CRIMEA_BOX[0] &&
          y0 >= CRIMEA_BOX[1] &&
          x1 <= CRIMEA_BOX[2] &&
          y1 <= CRIMEA_BOX[3];

        (isCrimea ? occupiedCrimea : land).push(simplified);
      }
    }
  }

  if (occupiedCrimea.length === 0) {
    // Failing loudly beats silently shipping Crimea as Russian land.
    console.error('error: Crimea was not separated from the Russia polygon — check CRIMEA_BOX against the input.');
    process.exit(1);
  }

  const lakesRaw = JSON.parse(readFileSync(lakesPath, 'utf8'));
  const lakes = [];
  for (const feature of lakesRaw.features) {
    for (const polygon of polygonsOf(feature.geometry)) {
      const ring = polygon[0];
      if (!intersectsExtent(ring)) continue;
      const simplified = round3(simplify(ring, 0.03));
      // Only lakes large enough to read at continental scale.
      if (simplified.length < 5 || ringArea(simplified) < 0.25) continue;
      lakes.push(simplified);
    }
  }

  const out = {
    attribution: 'Natural Earth 1:50m (public domain)',
    bbox: [BB.lonMin, BB.latMin, BB.lonMax, BB.latMax],
    land,
    lakes,
    occupiedCrimea,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(OUT, json);

  const points = (rings) => rings.reduce((n, r) => n + r.length, 0);
  console.log(`land   ${land.length} rings, ${points(land)} points`);
  console.log(`lakes  ${lakes.length} rings, ${points(lakes)} points`);
  console.log(`crimea ${occupiedCrimea.length} rings, ${points(occupiedCrimea)} points`);
  console.log(`wrote  ${OUT} (${(json.length / 1024).toFixed(0)} KB)`);
}

main();
