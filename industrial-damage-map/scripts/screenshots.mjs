#!/usr/bin/env node
/**
 * Regenerates the screenshots in screenshots/ — a deliverable, so it is
 * committed rather than produced on demand.
 *
 *   npx next start -p 3100
 *   node scripts/screenshots.mjs [baseUrl]
 *
 * Third-party tile requests are blocked on purpose. The map has to be legible
 * from the bundled Natural Earth geography alone; if a screenshot only looks
 * right because tile.openstreetmap.org happened to be reachable, it is not
 * documenting what most readers will see.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');

const SHOTS = [
  { file: '01-map.png', path: '/', wait: mapReady },
  {
    file: '02-facility-panel.png',
    path: '/',
    wait: mapReady,
    async act(page) {
      // Select through the table, then switch back to the map: clicking a
      // marker means guessing a projected pixel, which is brittle.
      await page.getByTestId('search-input').fill('ryazan');
      await page.getByTestId('view-table').click();
      // The row selects; the link inside it navigates. Click a plain cell.
      await page.getByRole('row', { name: /Ryazan Oil Refining/ }).first().getByRole('cell').nth(2).click();
      await page.getByTestId('view-map').click();
      await mapReady(page);
    },
  },
  { file: '03-facility-record.png', path: '/facility/kinef-kirishi' },
  { file: '04-dashboard.png', path: '/dashboard' },
  { file: '05-table.png', path: '/table' },
  { file: '06-methodology.png', path: '/methodology' },
  { file: '07-review-queue.png', path: '/review-queue' },
  { file: '08-sources.png', path: '/sources' },
  {
    file: '09-unconfirmed-and-flagged-layers.png',
    path: '/',
    wait: mapReady,
    async act(page) {
      await page.getByTestId('toggle-unconfirmed').click();
      await page.getByTestId('toggle-borderline').click();
      await page.waitForTimeout(900);
    },
  },
];

async function mapReady(page) {
  const canvas = page.getByTestId('map-canvas');
  await canvas.waitFor({ state: 'visible' });
  for (let i = 0; i < 60; i += 1) {
    const rings = Number((await canvas.getAttribute('data-basemap-rings')) ?? '0');
    const markers = Number((await canvas.getAttribute('data-rendered-markers')) ?? '0');
    if (rings > 0 && markers > 0) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(700); // let the fitBounds ease settle
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await context.route('https://tile.openstreetmap.org/**', (route) => route.abort());

  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', (error) => failures.push(String(error)));

  for (const shot of SHOTS) {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'domcontentloaded' });
    if (shot.wait) await shot.wait(page);
    else await page.waitForTimeout(500);
    if (shot.act) await shot.act(page);
    await page.screenshot({ path: resolve(OUT, shot.file) });
    console.log(`wrote screenshots/${shot.file}`);
  }

  await browser.close();
  if (failures.length > 0) {
    console.error('page errors:\n  ' + failures.join('\n  '));
    process.exit(1);
  }
}

main();
