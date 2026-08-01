import { expect, test } from '@playwright/test';

test.describe('map explorer', () => {
  test('renders the map, legend and filter panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('map-canvas')).toBeVisible();
    await expect(page.getByText('Legend')).toBeVisible();
    await expect(page.getByTestId('search-input')).toBeVisible();
    await expect(page.getByTestId('result-summary')).toContainText('facilities');
  });

  test('paints markers even when basemap tiles are unavailable', async ({ page }) => {
    // Regression guard. Sources and layers must be attached on `style.load`,
    // not `load`: `load` waits for basemap tiles, so on a restricted network
    // the map would initialise and then stay permanently empty.
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
    await page.goto('/');
    const canvas = page.getByTestId('map-canvas');
    await expect(canvas).toHaveAttribute('data-map-state', 'ready');
    await expect
      .poll(async () => Number((await canvas.getAttribute('data-rendered-markers')) ?? '0'), { timeout: 20_000 })
      .toBeGreaterThan(0);
  });

  test('still draws a coastline when basemap tiles are unavailable', async ({ page }) => {
    // Markers alone are not a map. With third-party tiles blocked the bundled
    // Natural Earth geography must still be there, so a reader has a coastline
    // to place a marker against instead of an empty rectangle.
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
    await page.goto('/');
    const canvas = page.getByTestId('map-canvas');
    await expect
      .poll(async () => Number((await canvas.getAttribute('data-basemap-rings')) ?? '0'), { timeout: 20_000 })
      .toBeGreaterThan(100);

    // Polled, not sampled once: the first frame after the source is set can
    // still report nothing painted.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const map = (window as unknown as { __map?: { queryRenderedFeatures: (o: unknown) => unknown[] } }).__map;
            if (!map) return -1;
            return map.queryRenderedFeatures({ layers: ['base-land-fill'] }).length;
          }),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
  });

  test('labels clusters without depending on a font server', async ({ page }) => {
    // Regression guard: the style has no `glyphs` URL, so a symbol layer using
    // `text-field` renders nothing at all. Counts are canvas-rendered icons.
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
    await page.goto('/');
    const canvas = page.getByTestId('map-canvas');
    await expect(canvas).toHaveAttribute('data-map-state', 'ready');

    type Probe = {
      hasImage: (id: string) => boolean;
      getLayer: (id: string) => unknown;
      queryRenderedFeatures: (o: unknown) => unknown[];
    };
    const read = () =>
      page.evaluate(() => {
        const map = (window as unknown as { __map?: Probe }).__map;
        if (!map) return null;
        return {
          hasIcons: map.hasImage('cluster-2') && map.hasImage('cluster-99'),
          hasLayer: Boolean(map.getLayer('cluster-count')),
          clusters: map.queryRenderedFeatures({ layers: ['clusters'] }).length,
        };
      });

    // Clustering settles a frame or two after the style is ready.
    await expect.poll(async () => (await read())?.clusters ?? 0, { timeout: 20_000 }).toBeGreaterThan(0);
    const state = await read();
    expect(state?.hasIcons).toBe(true);
    expect(state?.hasLayer).toBe(true);
  });

  test('serves the bundled basemap as a same-origin asset', async ({ request }) => {
    const res = await request.get('/basemap/eurasia-50m.json');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.attribution).toContain('Natural Earth');
    expect(body.land.length).toBeGreaterThan(50);
    // Crimea must never ship inside the Russian land rings.
    expect(body.occupiedCrimea.length).toBe(1);
  });

  test('search narrows the result set', async ({ page }) => {
    await page.goto('/');
    const summary = page.getByTestId('result-summary');
    const before = Number((await summary.innerText()).match(/^(\d+)/)?.[1] ?? '0');
    expect(before).toBeGreaterThan(10);

    await page.getByTestId('search-input').fill('ryazan');
    await expect(summary).toContainText('1 facilities');
  });

  test('hides unconfirmed records until they are switched on', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Unconfirmed layer ON')).toHaveCount(0);

    await page.getByTestId('toggle-unconfirmed').click();
    await expect(page.getByText('Unconfirmed layer ON')).toBeVisible();
  });

  test('hides flagged non-industrial sites until they are switched on', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('view-table').click();
    await expect(page.getByRole('cell', { name: /Engels-2 air base/ })).toHaveCount(0);

    await page.getByTestId('toggle-borderline').click();
    await expect(page.getByRole('link', { name: /Engels-2 air base/ })).toBeVisible();
  });

  test('table view lists facilities and links to the full record', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('view-table').click();
    const link = page.getByRole('link', { name: 'Ryazan Oil Refining Company' }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole('heading', { name: 'Ryazan Oil Refining Company' })).toBeVisible();
  });
});

test.describe('facility record', () => {
  test('shows evidence, caveats and sources', async ({ page }) => {
    await page.goto('/facility/kinef-kirishi');
    await expect(page.getByTestId('facility-panel')).toBeVisible();
    await expect(page.getByText('What is established')).toBeVisible();
    await expect(page.getByText('What remains unresolved')).toBeVisible();
    await expect(page.getByText('Why this record exists.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Meduza/ }).first()).toBeVisible();
  });

  test('labels occupied-territory sites explicitly', async ({ page }) => {
    await page.goto('/facility/feodosia-oil-terminal');
    await expect(page.getByText('occupied territory · internationally recognised as Ukraine')).toBeVisible();
  });

  test('marks a model estimate as not an official figure', async ({ page }) => {
    await page.goto('/facility/moscow-refinery');
    await expect(page.getByText('model estimate').first()).toBeVisible();
    await expect(page.getByText(/must not be added to official/)).toBeVisible();
    await expect(page.getByText('Assumptions').first()).toBeVisible();
  });
});

test.describe('dashboard', () => {
  test('separates attested from modelled financial totals', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Attested figures (official / insurance / company)')).toBeVisible();
    await expect(page.getByText('Analyst and project-model figures')).toBeVisible();
    await expect(page.getByText(/never added to the attested total/)).toBeVisible();
  });

  test('draws the monthly incident chart with visible bars', async ({ page }) => {
    // Regression guard: a percentage-height bar inside an auto-height flex
    // parent collapses to zero, which rendered the chart as an empty box.
    await page.goto('/dashboard');
    const bars = page.locator('div[title*="incident(s)"]');
    await expect(bars.first()).toBeVisible();
    const box = await bars.first().boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(2);
  });

  test('reports flagged and unconfirmed counts separately', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Flagged non-industrial sites', { exact: true })).toBeVisible();
    await expect(page.getByText('excluded from the totals above')).toBeVisible();
    await expect(page.getByText('held out of every finding')).toBeVisible();
  });
});

test.describe('methodology and provenance', () => {
  test('methodology page states the exclusions', async ({ page }) => {
    await page.goto('/methodology');
    await expect(page.getByRole('heading', { name: 'Methodology' })).toBeVisible();
    await expect(page.getByText('predictions about future targets')).toBeVisible();
    await expect(page.getByText('vulnerability analysis of operating enterprises')).toBeVisible();
    await expect(page.getByText(/Syndication is not corroboration/)).toBeVisible();
  });

  test('review queue makes clear nothing there is published', async ({ page }) => {
    await page.goto('/review-queue');
    await expect(page.getByText('Nothing on this page is published data.')).toBeVisible();
    await expect(page.getByText('72h embargo').first()).toBeVisible();
  });

  test('source register groups by tier', async ({ page }) => {
    await page.goto('/sources');
    await expect(page.getByRole('heading', { name: /^Tier A/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Tier C/ })).toBeVisible();
    await expect(page.getByText(/never be the sole basis/i)).toBeVisible();
  });
});

test.describe('api', () => {
  test('serves GeoJSON with provenance', async ({ request }) => {
    const res = await request.get('/api/facilities?format=geojson');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.type).toBe('FeatureCollection');
    expect(body.features.length).toBeGreaterThan(10);
    expect(body.provenance.datasetVersion).toBeTruthy();
    expect(body.provenance.warning).toContain('Confidence scores');
  });

  test('rejects an invalid filter rather than ignoring it', async ({ request }) => {
    const res = await request.get('/api/facilities?minDamage=99');
    expect(res.status()).toBe(400);
  });

  test('excludes unconfirmed records from the default API response', async ({ request }) => {
    const res = await request.get('/api/facilities?format=json');
    const body = await res.json();
    for (const facility of body.facilities) {
      for (const incident of facility.incidents) {
        expect(incident.verificationStatus).not.toBe('unconfirmed');
      }
    }
  });

  test('CSV export carries the provenance preamble', async ({ request }) => {
    const res = await request.get('/api/export/facilities.csv');
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('# dataset_version');
    expect(text).toContain('# license');
    expect(text.split('\n').some((l) => l.startsWith('facility_id,'))).toBe(true);
  });

  test('quality control endpoint reports zero errors', async ({ request }) => {
    const res = await request.get('/api/qc');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.summary.errors).toBe(0);
  });

  test('health endpoint reports the effective backend', async ({ request }) => {
    const res = await request.get('/api/health');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(['postgres', 'file']).toContain(body.effectiveBackend);
  });

  test('ingestion endpoint is closed unless a secret is configured', async ({ request }) => {
    const res = await request.post('/api/ingest/run', { data: {} });
    expect([401, 503]).toContain(res.status());
  });

  test('facility report renders a printable document', async ({ request }) => {
    const res = await request.get('/api/facility/ryazan-refinery/report');
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain('Ryazan Oil Refining Company');
    expect(html).toContain('Provenance.');
  });
});
