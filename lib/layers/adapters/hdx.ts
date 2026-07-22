import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { registerLayerAdapter } from '../registry';
import type {
  LayerAdapter,
  LayerContext,
  LayerFetchResult,
  NormalizedFeature,
} from '../types';

/**
 * Adapter: HDX — Humanitarian Data Exchange (OCHA) pre-aggregated datasets.
 * Source:  https://data.humdata.org/ (CKAN API under /api/3/action/...)
 *
 * LICENSING — PER-DATASET, PRESERVED PER FEATURE:
 * HDX is a catalogue, not a license. Every dataset carries its own license
 * (CC BY, CC BY-IGO, ODbL, PDDL, "HDX by request", ...). This adapter reads
 * each dataset's `license_title` / `license_id` / `dataset_source` from
 * package_show and stamps them onto EVERY emitted feature
 * (`hdx_license`, `hdx_license_id`, `hdx_dataset_source`, `hdx_organization`)
 * so downstream display can credit each dataset individually. Datasets whose
 * license CKAN reports as unknown/not-specified are SKIPPED (fail closed).
 *
 * What it ingests: GeoJSON resources only (admin boundaries, displacement
 * aggregates published as GeoJSON). CSV/SHP/XLSX resources are skipped with a
 * note — parsing those is a follow-up, not silently guessed at.
 *
 * config (conflict_layers.config):
 *   {
 *     "group": "sdn",                     // HDX country group (ISO3, lowercase)
 *     "datasets"?: ["cod-ab-sdn", ...],   // explicit CKAN dataset names
 *     "max_features_per_dataset"?: 2000,
 *     "max_datasets"?: 4
 *   }
 * If `datasets` is omitted, a curated default list for the group is used —
 * deliberate: package_search over a whole country group returns thousands of
 * heterogeneous datasets, which is not a map layer.
 */

const HDX_BASE = 'https://data.humdata.org';

/**
 * Curated defaults per HDX group. Chosen for stable, well-known names.
 * VERIFY: exact CKAN dataset names on data.humdata.org —
 *   - 'cod-ab-sdn' is the standard Common Operational Dataset name for Sudan
 *     admin boundaries (OCHA COD-AB naming convention).
 *   - IOM DTM displacement dataset name to confirm; commonly
 *     'sudan-displacement-data-idps-iom-dtm'.
 */
const DEFAULT_DATASETS: Record<string, string[]> = {
  sdn: ['cod-ab-sdn', 'sudan-displacement-data-idps-iom-dtm'],
};

// --- CKAN response shapes (documented CKAN 2.x action API) ------------------

interface CkanResource {
  id: string;
  name?: string;
  format?: string; // 'GeoJSON', 'SHP', 'CSV', ...
  url?: string;
  download_url?: string;
  last_modified?: string;
  size?: number;
}

interface CkanPackage {
  id: string;
  name: string;
  title?: string;
  license_id?: string;
  license_title?: string;
  dataset_source?: string; // HDX extra: originating org, e.g. 'IOM DTM'
  organization?: { name?: string; title?: string };
  resources?: CkanResource[];
}

interface CkanEnvelope<T> {
  success: boolean;
  result?: T;
  error?: unknown;
}

const GEOJSON_FORMATS = new Set(['geojson', 'json']);

function pickGeojsonResource(pkg: CkanPackage): CkanResource | undefined {
  const resources = pkg.resources ?? [];
  // Prefer explicit GeoJSON; fall back to JSON (some COD-AB exports use it).
  return (
    resources.find((r) => r.format?.toLowerCase() === 'geojson') ??
    resources.find(
      (r) =>
        GEOJSON_FORMATS.has(r.format?.toLowerCase() ?? '') &&
        /geo/i.test(`${r.name ?? ''}${r.url ?? ''}`),
    )
  );
}

/** Stable-ish per-feature id: prefer p-codes / ids over array index. */
function featureExternalId(
  pkg: CkanPackage,
  resource: CkanResource,
  feature: Feature,
  index: number,
): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const candidate =
    feature.id ??
    props['ADM2_PCODE'] ??
    props['ADM1_PCODE'] ??
    props['admin2Pcode'] ??
    props['admin1Pcode'] ??
    props['pcode'] ??
    props['id'];
  const suffix =
    candidate !== undefined && candidate !== null && `${candidate}`.length > 0
      ? `${candidate}`
      : `i${index}`;
  return `hdx:${pkg.name}:${resource.id}:${suffix}`;
}

function featureTitle(pkg: CkanPackage, feature: Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const name =
    props['ADM2_EN'] ??
    props['ADM1_EN'] ??
    props['admin2Name_en'] ??
    props['admin1Name_en'] ??
    props['name'] ??
    props['Name'];
  return name ? `${name} — ${pkg.title ?? pkg.name}` : (pkg.title ?? pkg.name);
}

export const hdxAdapter: LayerAdapter = {
  key: 'hdx',
  label: 'HDX humanitarian datasets',
  licenseNote:
    'Per-dataset licenses (CC BY, CC BY-IGO, ODbL, ...) read from CKAN and ' +
    'stamped onto every feature. Datasets with unspecified licenses are skipped.',

  async fetch(ctx: LayerContext): Promise<LayerFetchResult> {
    const config = ctx.layer.config;
    const group =
      typeof config['group'] === 'string' ? (config['group'] as string) : 'sdn';
    const datasetNames = Array.isArray(config['datasets'])
      ? (config['datasets'] as unknown[]).filter(
          (d): d is string => typeof d === 'string',
        )
      : (DEFAULT_DATASETS[group] ?? []);
    const maxDatasets =
      typeof config['max_datasets'] === 'number'
        ? (config['max_datasets'] as number)
        : 4;
    const maxFeaturesPerDataset =
      typeof config['max_features_per_dataset'] === 'number'
        ? (config['max_features_per_dataset'] as number)
        : 2000;

    const features: NormalizedFeature[] = [];
    const notes: string[] = [];
    let anyFailure = false;

    if (datasetNames.length === 0) {
      return {
        features: [],
        attribution: ctx.layer.attribution,
        fetchedAt: new Date().toISOString(),
        status: 'partial',
        message: `HDX: no curated datasets configured for group "${group}" — set config.datasets to CKAN dataset names.`,
      };
    }

    for (const name of datasetNames.slice(0, maxDatasets)) {
      try {
        // 1. Dataset metadata (license lives here).
        const showRes = await fetch(
          `${HDX_BASE}/api/3/action/package_show?id=${encodeURIComponent(name)}`,
          { signal: ctx.signal, headers: { accept: 'application/json' } },
        );
        if (!showRes.ok) {
          anyFailure = true;
          notes.push(`${name}: package_show HTTP ${showRes.status}`);
          continue;
        }
        const envelope = (await showRes.json()) as CkanEnvelope<CkanPackage>;
        const pkg = envelope.success ? envelope.result : undefined;
        if (!pkg) {
          anyFailure = true;
          notes.push(`${name}: package_show returned no result`);
          continue;
        }

        // Fail closed on unlicensed datasets — HDX licenses are per-dataset
        // and we refuse to republish data whose terms we can't name.
        const licenseTitle = pkg.license_title?.trim();
        if (
          !licenseTitle ||
          /^(not\s*specified|other|unknown)/i.test(licenseTitle)
        ) {
          notes.push(
            `${name}: skipped — license "${licenseTitle ?? '(none)'}" not clearly specified`,
          );
          continue;
        }

        // 2. Pick a GeoJSON resource.
        const resource = pickGeojsonResource(pkg);
        if (!resource?.url) {
          notes.push(
            `${name} (${licenseTitle}): no GeoJSON resource — CSV/SHP parsing not implemented, skipped`,
          );
          continue;
        }

        // 3. Download + normalize.
        // VERIFY: some HDX resources front large files or redirect through
        // the HDX file proxy; confirm size before enabling in cron (size cap
        // below guards runaway payloads).
        if (typeof resource.size === 'number' && resource.size > 50_000_000) {
          notes.push(`${name}: resource >50MB, skipped for cron budget`);
          continue;
        }
        const dataRes = await fetch(resource.url, {
          signal: ctx.signal,
          headers: { accept: 'application/geo+json, application/json' },
        });
        if (!dataRes.ok) {
          anyFailure = true;
          notes.push(`${name}: resource fetch HTTP ${dataRes.status}`);
          continue;
        }
        const geojson = (await dataRes.json()) as FeatureCollection;
        if (geojson?.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
          anyFailure = true;
          notes.push(`${name}: resource is not a GeoJSON FeatureCollection`);
          continue;
        }

        let taken = 0;
        for (const [i, f] of geojson.features.entries()) {
          if (taken >= maxFeaturesPerDataset) break;
          if (!f?.geometry) continue;
          features.push({
            externalId: featureExternalId(pkg, resource, f, i),
            geometry: f.geometry as Geometry,
            eventDate: resource.last_modified ?? null,
            title: featureTitle(pkg, f),
            properties: {
              ...(f.properties ?? {}),
              // Per-dataset license/credit — preserved on every feature.
              hdx_dataset: pkg.name,
              hdx_dataset_title: pkg.title,
              hdx_license: licenseTitle,
              hdx_license_id: pkg.license_id,
              hdx_dataset_source: pkg.dataset_source,
              hdx_organization: pkg.organization?.title ?? pkg.organization?.name,
              hdx_resource_id: resource.id,
              hdx_resource_format: resource.format,
            },
          });
          taken += 1;
        }
        notes.push(
          `${name}: ${taken} features (license: ${licenseTitle}${pkg.dataset_source ? `, source: ${pkg.dataset_source}` : ''})` +
            (geojson.features.length > taken
              ? `, capped from ${geojson.features.length}`
              : ''),
        );
      } catch (err) {
        if (ctx.signal?.aborted) throw err;
        anyFailure = true;
        notes.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      features,
      attribution: ctx.layer.attribution,
      fetchedAt: new Date().toISOString(),
      status: anyFailure || features.length === 0 ? 'partial' : 'ok',
      message: `HDX group "${group}": ${notes.join(' | ')}`,
    };
  },
};

registerLayerAdapter(hdxAdapter);
