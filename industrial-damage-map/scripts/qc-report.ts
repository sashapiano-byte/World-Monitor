/**
 * Prints the quality-control report for the version-controlled dataset.
 *
 *   npm run qc            human-readable report
 *   npm run qc -- --json  machine-readable
 *
 * Exits non-zero when any error-severity finding exists, so it can gate CI.
 */
import { DATASET, DUPLICATE_RESOLUTIONS } from '../data/index';
import { runQualityControl, summariseFindings } from '../lib/qc';

const findings = runQualityControl(DATASET, { duplicateResolutions: DUPLICATE_RESOLUTIONS });
const summary = summariseFindings(findings);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, findings }, null, 2));
} else {
  const order = { error: 0, warning: 1, info: 2 } as const;
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
  for (const f of sorted) {
    const badge = f.severity === 'error' ? 'ERROR  ' : f.severity === 'warning' ? 'WARN   ' : 'INFO   ';
    console.log(`${badge} [${f.rule}] ${f.entity}\n        ${f.message}`);
  }
  console.log('\n--- summary ---');
  console.log(`facilities         ${DATASET.facilities.length}`);
  console.log(`incidents          ${DATASET.incidents.length}`);
  console.log(`sources            ${DATASET.sources.length}`);
  console.log(`claims             ${DATASET.claims.length}`);
  console.log(`status changes     ${DATASET.statusHistory.length}`);
  console.log(`damage estimates   ${DATASET.damageEstimates.length}`);
  console.log(`media records      ${DATASET.media.length}`);
  console.log(`review queue       ${DATASET.reviewQueue.length}`);
  console.log(`errors ${summary.errors} · warnings ${summary.warnings} · info ${summary.info}`);
}

process.exit(summary.errors > 0 ? 1 : 0);
