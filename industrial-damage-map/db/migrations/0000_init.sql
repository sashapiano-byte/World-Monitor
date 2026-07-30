-- ===========================================================================
-- Russian Industrial Damage Map — initial schema
-- PostgreSQL 16 + PostGIS 3.4
--
-- Design notes
--   * `facilities` is the permanent card; `incidents` are events against it.
--     A new attack NEVER creates a new facility row.
--   * Geometry is stored as POINT(4326) alongside the plain lat/lon columns so
--     that spatial queries work without forcing every reader through PostGIS.
--   * Editorial constraints live here as CHECK constraints wherever the rule is
--     absolute (war start date, score ranges, confidence ranges). Rules that
--     need cross-row context live in lib/qc.ts.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- --------------------------------------------------------------------------
-- Enumerations
-- --------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE attack_method AS ENUM (
    'uav', 'cruise_missile', 'ballistic_missile', 'sabotage',
    'shelling', 'naval_drone', 'unknown_means');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE method_confidence AS ENUM ('high', 'medium', 'low', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE operational_status AS ENUM (
    'normal_operations', 'operations_reduced', 'partially_restored',
    'fully_restored', 'temporarily_suspended', 'long_term_shutdown',
    'destroyed', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM (
    'verified', 'corroborated', 'unconfirmed', 'disputed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE source_tier AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE damage_estimate_type AS ENUM (
    'official', 'insurance', 'company_disclosure',
    'analyst_estimate', 'model_estimate', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estimate_scope AS ENUM ('facility', 'multi_facility', 'campaign');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE coordinate_precision AS ENUM (
    'exact_public_address', 'facility_centroid',
    'industrial_zone_centroid', 'locality_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE site_category AS ENUM (
    'industrial', 'military_depot', 'arsenal', 'repair_base',
    'airfield', 'electrical_substation', 'energy_infrastructure');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE territory_status AS ENUM (
    'internationally_recognised_russia',
    'occupied_ukraine_internationally_recognised_as_ukraine');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE claim_stance AS ENUM ('supports', 'disputes', 'partially_supports', 'context');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_stage AS ENUM (
    'detected', 'name_normalised', 'facility_matched', 'details_extracted',
    'corroboration_sought', 'imagery_checked', 'confidence_assigned',
    'awaiting_approval', 'published', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------------
-- Reference tables
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS industries (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  name_ru     text NOT NULL,
  color       text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS regions (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  name_ru          text NOT NULL,
  federal_district text NOT NULL,
  territory_status territory_status NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id          text PRIMARY KEY,
  description text NOT NULL DEFAULT ''
);

-- --------------------------------------------------------------------------
-- Core
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facilities (
  id                    text PRIMARY KEY,
  slug                  text NOT NULL UNIQUE,
  canonical_name        text NOT NULL,
  canonical_name_ru     text NOT NULL,
  alternative_names     text[] NOT NULL DEFAULT '{}',
  legal_entity          text,
  parent_company        text,
  industry_id           text NOT NULL REFERENCES industries (id),
  subindustry           text,
  site_category         site_category NOT NULL DEFAULT 'industrial',
  region_id             text NOT NULL REFERENCES regions (id),
  locality              text NOT NULL,
  public_address        text,
  latitude              double precision NOT NULL CHECK (latitude BETWEEN 41 AND 82),
  longitude             double precision NOT NULL CHECK (longitude BETWEEN 19 AND 191),
  geom                  geometry(Point, 4326),
  coordinate_precision  coordinate_precision NOT NULL,
  territory_status      territory_status NOT NULL,
  facility_area_hectares numeric,
  prewar_employees      integer,
  prewar_revenue_usd    numeric,
  nameplate_capacity    text,
  description           text NOT NULL,
  inclusion_rationale   text NOT NULL,
  tags                  text[] NOT NULL DEFAULT '{}',
  created_at            date NOT NULL,
  updated_at            date NOT NULL
);

CREATE INDEX IF NOT EXISTS facilities_geom_idx    ON facilities USING gist (geom);
CREATE INDEX IF NOT EXISTS facilities_region_idx  ON facilities (region_id);
CREATE INDEX IF NOT EXISTS facilities_industry_idx ON facilities (industry_id);
CREATE INDEX IF NOT EXISTS facilities_name_trgm_idx ON facilities USING gin (canonical_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS sources (
  id               text PRIMARY KEY,
  title            text NOT NULL,
  publisher        text NOT NULL,
  url              text NOT NULL,
  publication_date date,
  tier             source_tier NOT NULL,
  kind             text NOT NULL,
  language         text NOT NULL,
  archived_url     text,
  notes            text
);

CREATE TABLE IF NOT EXISTS incidents (
  id                     text PRIMARY KEY,
  facility_id            text NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  -- Hard editorial boundary: this project starts at the full-scale invasion.
  incident_date          date NOT NULL CHECK (incident_date >= DATE '2022-02-24'),
  incident_time_local    time,
  attack_method          attack_method NOT NULL,
  weapon_model_claimed   text,
  weapon_model_confidence method_confidence NOT NULL DEFAULT 'unknown',
  method_confidence      method_confidence NOT NULL DEFAULT 'medium',
  casualties_killed      integer CHECK (casualties_killed >= 0),
  casualties_injured     integer CHECK (casualties_injured >= 0),
  fire_confirmed         boolean,
  physical_damage_score  smallint NOT NULL CHECK (physical_damage_score BETWEEN 0 AND 5),
  damage_summary         text NOT NULL,
  damaged_assets         text[] NOT NULL DEFAULT '{}',
  operational_effect     text NOT NULL,
  downtime_days          integer CHECK (downtime_days >= 0),
  downtime_is_estimate   boolean NOT NULL DEFAULT true,
  confidence_score       smallint NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  verification_status    verification_status NOT NULL,
  claimed_by             text,
  established            text[] NOT NULL DEFAULT '{}',
  unresolved             text[] NOT NULL DEFAULT '{}',
  last_reviewed          date NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  -- An unconfirmed record may never assert damage.
  CONSTRAINT unconfirmed_has_no_damage
    CHECK (verification_status <> 'unconfirmed' OR physical_damage_score = 0),
  -- Total destruction requires the top verification tier.
  CONSTRAINT destruction_requires_verification
    CHECK (physical_damage_score < 5 OR verification_status = 'verified')
);

CREATE INDEX IF NOT EXISTS incidents_facility_idx ON incidents (facility_id);
CREATE INDEX IF NOT EXISTS incidents_date_idx     ON incidents (incident_date);
CREATE INDEX IF NOT EXISTS incidents_status_idx   ON incidents (verification_status);

CREATE TABLE IF NOT EXISTS incident_sources (
  incident_id text NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  source_id   text NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
  PRIMARY KEY (incident_id, source_id)
);

CREATE TABLE IF NOT EXISTS operational_status_history (
  id                       text PRIMARY KEY,
  facility_id              text NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  incident_id              text REFERENCES incidents (id) ON DELETE SET NULL,
  status                   operational_status NOT NULL,
  status_date              date NOT NULL,
  capacity_estimate_percent numeric CHECK (capacity_estimate_percent BETWEEN 0 AND 100),
  evidence_type            text NOT NULL,
  determination            text NOT NULL CHECK (determination IN ('direct_confirmation','analytical_assessment')),
  confidence_score         smallint NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  notes                    text NOT NULL DEFAULT '',
  -- "Destroyed" can never rest on our own inference.
  CONSTRAINT destroyed_needs_direct_confirmation
    CHECK (status <> 'destroyed' OR determination = 'direct_confirmation')
);

CREATE INDEX IF NOT EXISTS status_facility_idx ON operational_status_history (facility_id, status_date);

CREATE TABLE IF NOT EXISTS status_sources (
  status_id text NOT NULL REFERENCES operational_status_history (id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
  PRIMARY KEY (status_id, source_id)
);

CREATE TABLE IF NOT EXISTS damage_estimates (
  id                        text PRIMARY KEY,
  facility_id               text NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  incident_id               text REFERENCES incidents (id) ON DELETE SET NULL,
  estimate_type             damage_estimate_type NOT NULL,
  scope                     estimate_scope NOT NULL DEFAULT 'facility',
  currency                  text NOT NULL CHECK (currency IN ('RUB','USD','EUR')),
  direct_damage_min         numeric, direct_damage_max         numeric,
  lost_revenue_min          numeric, lost_revenue_max          numeric,
  repair_cost_min           numeric, repair_cost_max           numeric,
  downtime_cost_min         numeric, downtime_cost_max         numeric,
  insurance_coverage        numeric,
  usd_at_incident_date_min  numeric, usd_at_incident_date_max  numeric,
  usd_constant_min          numeric, usd_constant_max          numeric,
  estimate_date             date,
  -- No figure without a stated method. This is the single most important
  -- guard against a model number being mistaken for an official one.
  methodology               text NOT NULL CHECK (length(methodology) >= 20),
  assumptions               text[] NOT NULL DEFAULT '{}',
  confidence_score          smallint NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  CONSTRAINT model_estimate_lists_assumptions
    CHECK (estimate_type <> 'model_estimate' OR array_length(assumptions, 1) >= 1)
);

CREATE TABLE IF NOT EXISTS estimate_sources (
  estimate_id text NOT NULL REFERENCES damage_estimates (id) ON DELETE CASCADE,
  source_id   text NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
  PRIMARY KEY (estimate_id, source_id)
);

CREATE TABLE IF NOT EXISTS claims (
  id               text PRIMARY KEY,
  source_id        text NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
  facility_id      text NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  incident_id      text REFERENCES incidents (id) ON DELETE SET NULL,
  claim_type       text NOT NULL,
  claim_text       text NOT NULL,
  stance           claim_stance NOT NULL,
  confidence_score smallint NOT NULL CHECK (confidence_score BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS media (
  id                    text PRIMARY KEY,
  facility_id           text NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  incident_id           text REFERENCES incidents (id) ON DELETE SET NULL,
  media_type            text NOT NULL CHECK (media_type IN ('satellite','photo','video','diagram')),
  provider              text NOT NULL,
  capture_date          date,
  url                   text NOT NULL,
  license               text NOT NULL,
  thumbnail_url         text,
  before_or_after       text NOT NULL CHECK (before_or_after IN ('before','after','n/a')),
  caption               text NOT NULL,
  interpretation_limits text,
  resolution_metres     numeric,
  -- Satellite imagery is meaningless without a capture date.
  CONSTRAINT satellite_needs_capture_date
    CHECK (media_type <> 'satellite' OR capture_date IS NOT NULL)
);

-- --------------------------------------------------------------------------
-- Editorial workflow: review queue, revisions, editors, moderation, merges
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS editors (
  id           text PRIMARY KEY,
  display_name text NOT NULL,
  role         text NOT NULL CHECK (role IN ('contributor','editor','maintainer')),
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_queue (
  id                     text PRIMARY KEY,
  discovered_at          timestamptz NOT NULL,
  headline               text NOT NULL,
  url                    text NOT NULL,
  publisher              text NOT NULL,
  detected_facility_name text,
  matched_facility_id    text REFERENCES facilities (id) ON DELETE SET NULL,
  detected_date          date,
  detected_method        attack_method,
  stage                  review_stage NOT NULL DEFAULT 'detected',
  blocked_reason         text,
  notes                  text NOT NULL DEFAULT '',
  approved_by            text REFERENCES editors (id),
  approved_at            timestamptz,
  -- Nothing may be published without a named approver. This is the code-level
  -- expression of "no automatic publication".
  CONSTRAINT publication_requires_approval
    CHECK (stage <> 'published' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS revisions (
  id          bigserial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  editor_id   text REFERENCES editors (id),
  changed_at  timestamptz NOT NULL DEFAULT now(),
  change_note text NOT NULL,
  before_json jsonb,
  after_json  jsonb
);

CREATE INDEX IF NOT EXISTS revisions_entity_idx ON revisions (entity_type, entity_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS moderation_log (
  id         bigserial PRIMARY KEY,
  actor_id   text REFERENCES editors (id),
  action     text NOT NULL,
  entity_type text NOT NULL,
  entity_id  text NOT NULL,
  rationale  text NOT NULL,
  logged_at  timestamptz NOT NULL DEFAULT now()
);

-- Records the resolution of suspected duplicate facilities, in both directions:
-- merged (they were the same site) and rejected (they were genuinely distinct).
CREATE TABLE IF NOT EXISTS facility_duplicates (
  id             bigserial PRIMARY KEY,
  facility_id    text NOT NULL REFERENCES facilities (id) ON DELETE CASCADE,
  duplicate_of   text REFERENCES facilities (id) ON DELETE SET NULL,
  candidate_name text NOT NULL,
  resolution     text NOT NULL CHECK (resolution IN ('merged','distinct','open')),
  rationale      text NOT NULL,
  resolved_by    text REFERENCES editors (id),
  resolved_at    timestamptz
);

-- --------------------------------------------------------------------------
-- Convenience view: one row per facility with derived headline attributes.
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW facility_summary AS
SELECT
  f.id,
  f.slug,
  f.canonical_name,
  f.industry_id,
  f.region_id,
  f.site_category,
  f.territory_status,
  f.latitude,
  f.longitude,
  COUNT(i.id) FILTER (WHERE i.verification_status IN ('verified','corroborated','disputed')) AS published_incidents,
  COUNT(i.id) AS all_incidents,
  COALESCE(MAX(i.physical_damage_score) FILTER (WHERE i.verification_status IN ('verified','corroborated','disputed')), 0) AS max_damage_score,
  COALESCE(MAX(i.confidence_score) FILTER (WHERE i.verification_status IN ('verified','corroborated','disputed')), 0) AS max_confidence,
  MIN(i.incident_date) AS first_incident_date,
  MAX(i.incident_date) AS last_incident_date
FROM facilities f
LEFT JOIN incidents i ON i.facility_id = f.id
GROUP BY f.id;
