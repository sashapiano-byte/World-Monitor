/**
 * Writes the full export set to ./exports without needing a running server.
 *
 *   npm run export:all
 *
 * Useful for archiving a dataset version, and for diffing two versions of the
 * published record set outside the application.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATASET } from '../data/index';
import { buildFacilityViews } from '../lib/filter-core';
import { facilitiesCsv, fullJson, geoJsonExport, incidentsCsv, provenance, sourcesCsv } from '../lib/export';
import { runQualityControl, summariseFindings } from '../lib/qc';
import { DUPLICATE_RESOLUTIONS } from '../data/index';

const summary = summariseFindings(runQualityControl(DATASET, { duplicateResolutions: DUPLICATE_RESOLUTIONS }));
if (summary.errors > 0) {
  console.error(`[export] refusing to export: ${summary.errors} quality-control error(s). Run \`npm run qc\`.`);
  process.exit(1);
}

const outDir = join(process.cwd(), 'exports', DATASET.version);
mkdirSync(outDir, { recursive: true });

const views = buildFacilityViews(DATASET);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

const files: [string, string][] = [
  ['facilities.csv', facilitiesCsv(views, DATASET, siteUrl)],
  ['incidents.csv', incidentsCsv(views, DATASET, siteUrl)],
  ['sources.csv', sourcesCsv(DATASET, siteUrl)],
  ['dataset.json', JSON.stringify(fullJson(views, DATASET, siteUrl), null, 2)],
  ['facilities.geojson', JSON.stringify(geoJsonExport(views, DATASET, siteUrl), null, 2)],
  ['provenance.json', JSON.stringify(provenance(siteUrl), null, 2)],
];

for (const [name, contents] of files) {
  writeFileSync(join(outDir, name), contents);
  console.log(`[export] ${join('exports', DATASET.version, name)}`);
}

console.log(
  `[export] ${views.length} facilities, ${DATASET.incidents.length} incidents, ${DATASET.sources.length} sources`,
);
