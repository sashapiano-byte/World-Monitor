-- ===========================================================================
-- Frontline — core schema (migration 0001)
--
-- Design principle (load-bearing): the platform is CONFLICT-AGNOSTIC and
-- CAMERA-AGNOSTIC. There is no Ukraine or Sudan table, no hard-coded conflict
-- anywhere. A conflict is a row in `conflicts`; a data layer is a row in
-- `conflict_layers` bound to a registered adapter by `adapter_key`; a camera
-- is a row in `cameras`. Adding a new war = inserting rows, not editing code.
-- ===========================================================================

create extension if not exists "postgis";
create extension if not exists "pgcrypto";

-- Keep updated_at fresh on any row touch.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- conflicts — one row per theatre (ukraine, sudan, ...).
-- ---------------------------------------------------------------------------
create table conflicts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,                       -- 'ukraine', 'sudan'
  name          text not null,
  summary       text,
  status        text not null default 'active'
                  check (status in ('active','frozen','monitoring','archived')),
  start_date    date,
  -- Map framing.
  center_lng    double precision not null,
  center_lat    double precision not null,
  default_zoom  double precision not null default 5,
  bbox          double precision[],                         -- [minLng,minLat,maxLng,maxLat]
  region        text,                                       -- 'Europe', 'Africa'
  display_order integer not null default 100,
  is_featured   boolean not null default false,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index conflicts_status_idx on conflicts (status);
create trigger conflicts_set_updated_at
  before update on conflicts for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- conflict_layers — a data source rendered on a conflict's map.
-- `adapter_key` binds to a LayerAdapter registered in lib/layers/registry.ts.
-- Attribution / license are FIRST-CLASS columns and NOT NULL for a reason:
-- credit lines (ISW Fair Use, VIINA ODbL, etc.) must never be stripped.
-- ---------------------------------------------------------------------------
create table conflict_layers (
  id            uuid primary key default gen_random_uuid(),
  conflict_id   uuid not null references conflicts(id) on delete cascade,
  key           text not null,                              -- 'isw_control', 'firms_fires'
  name          text not null,
  description   text,
  -- Registry binding.
  adapter_key   text not null,                              -- resolves to a LayerAdapter
  layer_type    text not null default 'geojson'
                  check (layer_type in
                    ('geojson','point','heatmap','line','fill','raster','vector','symbol')),
  -- Sourcing + attribution (required).
  source_name   text not null,                              -- 'Institute for the Study of War'
  source_url    text,
  attribution   text not null,                              -- full credit line, rendered on map
  license       text not null,                              -- 'ISW Fair Use', 'ODbL 1.0', 'CC BY 4.0'
  license_url   text,
  -- Rendering + refresh.
  style         jsonb not null default '{}'::jsonb,         -- mapbox paint/layout
  config        jsonb not null default '{}'::jsonb,         -- adapter-specific (service urls, etc.)
  refresh_interval_seconds integer not null default 3600,
  z_index       integer not null default 0,
  enabled       boolean not null default true,
  default_visible boolean not null default true,
  last_ingested_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (conflict_id, key)
);
create index conflict_layers_conflict_idx on conflict_layers (conflict_id);
create index conflict_layers_adapter_idx on conflict_layers (adapter_key);
create trigger conflict_layers_set_updated_at
  before update on conflict_layers for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- layer_features — normalized geo features ingested from any layer's source.
-- This is the shared ingestion target for VIINA events, ACLED/UCDP events,
-- FIRMS fire pixels, Oryx loss points, ISW control polygons, etc.
-- Dedupe via (layer_id, external_id).
-- ---------------------------------------------------------------------------
create table layer_features (
  id            uuid primary key default gen_random_uuid(),
  layer_id      uuid not null references conflict_layers(id) on delete cascade,
  external_id   text not null,                              -- stable id from the source
  geom          geometry(Geometry, 4326),                  -- derived from properties.__geometry
  event_date    timestamptz,
  title         text,
  properties    jsonb not null default '{}'::jsonb,
  ingested_at   timestamptz not null default now(),
  unique (layer_id, external_id)
);
create index layer_features_layer_idx on layer_features (layer_id);
create index layer_features_geom_idx on layer_features using gist (geom);
create index layer_features_date_idx on layer_features (event_date desc);

-- Derive geom from the GeoJSON that adapters stash at properties->'__geometry'.
-- Lets the ingestion pipeline upsert plain JSON without a PostGIS round-trip in
-- application code, while keeping a real indexed geometry column for queries.
create or replace function layer_features_set_geom()
returns trigger language plpgsql as $$
begin
  if new.properties ? '__geometry' then
    new.geom = st_setsrid(
      st_geomfromgeojson(new.properties->>'__geometry'), 4326);
  end if;
  return new;
end;
$$;
create trigger layer_features_geom_sync
  before insert or update on layer_features
  for each row execute function layer_features_set_geom();

-- ---------------------------------------------------------------------------
-- cameras — public live streams. conflict_id is NULLABLE: many are city
-- cameras not tied to a war. `tos_reviewed` gates non-YouTube sources that
-- need separate terms-of-service review before going live.
-- ---------------------------------------------------------------------------
create table cameras (
  id            uuid primary key default gen_random_uuid(),
  conflict_id   uuid references conflicts(id) on delete set null,
  title         text not null,
  description   text,
  provider      text not null default 'youtube'
                  check (provider in ('youtube','other')),
  stream_type   text not null default 'youtube_live'
                  check (stream_type in ('youtube_live','hls','mjpeg','rtsp','webpage')),
  external_id   text,                                       -- youtube video/channel id
  url           text not null,
  embed_url     text,
  lng           double precision not null,
  lat           double precision not null,
  geom          geometry(Point, 4326)
                  generated always as (st_setsrid(st_makepoint(lng, lat), 4326)) stored,
  location_name text,
  city          text,
  country       text,
  tags          text[] not null default '{}',
  is_live       boolean not null default true,
  status        text not null default 'unverified'
                  check (status in ('active','offline','unverified','removed')),
  tos_reviewed  boolean not null default false,             -- non-YT sources gated on this
  last_checked_at timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index cameras_conflict_idx on cameras (conflict_id);
create index cameras_geom_idx on cameras using gist (geom);
create index cameras_provider_idx on cameras (provider);
create index cameras_tags_idx on cameras using gin (tags);
create trigger cameras_set_updated_at
  before update on cameras for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- markets — prediction-market contracts (Polymarket / Kalshi) that can be
-- linked to a conflict and/or a specific feature for the odds overlay.
-- ---------------------------------------------------------------------------
create table markets (
  id            uuid primary key default gen_random_uuid(),
  conflict_id   uuid references conflicts(id) on delete set null,
  provider      text not null check (provider in ('polymarket','kalshi')),
  external_id   text not null,                              -- condition_id / ticker
  question      text not null,
  url           text,
  status        text not null default 'open'
                  check (status in ('open','closed','resolved')),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider, external_id)
);
create index markets_conflict_idx on markets (conflict_id);
create trigger markets_set_updated_at
  before update on markets for each row execute function set_updated_at();

-- Time-series odds snapshots so the overlay can show movement, not just spot.
create table market_snapshots (
  id            uuid primary key default gen_random_uuid(),
  market_id     uuid not null references markets(id) on delete cascade,
  outcome       text not null,                              -- 'Yes' / candidate / etc.
  probability   double precision not null,                  -- 0..1
  volume        double precision,
  captured_at   timestamptz not null default now()
);
create index market_snapshots_market_idx on market_snapshots (market_id, captured_at desc);

-- Optional link table: a market pinned to a specific plotted feature/event.
create table market_feature_links (
  market_id     uuid not null references markets(id) on delete cascade,
  feature_id    uuid not null references layer_features(id) on delete cascade,
  primary key (market_id, feature_id)
);

-- ---------------------------------------------------------------------------
-- ingestion_runs — audit trail for each adapter fetch (observability).
-- ---------------------------------------------------------------------------
create table ingestion_runs (
  id            uuid primary key default gen_random_uuid(),
  layer_id      uuid references conflict_layers(id) on delete cascade,
  adapter_key   text not null,
  status        text not null check (status in ('ok','partial','error')),
  features_upserted integer not null default 0,
  message       text,
  duration_ms   integer,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index ingestion_runs_layer_idx on ingestion_runs (layer_id, started_at desc);
