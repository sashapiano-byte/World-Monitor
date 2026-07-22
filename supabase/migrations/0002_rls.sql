-- ===========================================================================
-- Frontline — Row Level Security (migration 0002)
--
-- This is a public read dashboard. Everything renderable is world-readable via
-- the anon key. All writes go through the service role (ingestion route
-- handlers / cron), which bypasses RLS — so there are intentionally NO write
-- policies for anon/authenticated. Add auth-gated features later as needed.
-- ===========================================================================

alter table conflicts           enable row level security;
alter table conflict_layers     enable row level security;
alter table layer_features      enable row level security;
alter table cameras             enable row level security;
alter table markets             enable row level security;
alter table market_snapshots    enable row level security;
alter table market_feature_links enable row level security;
alter table ingestion_runs      enable row level security;

-- Public read: conflicts + enabled layers + features.
create policy "public read conflicts"
  on conflicts for select using (true);

create policy "public read enabled layers"
  on conflict_layers for select using (enabled = true);

create policy "public read features"
  on layer_features for select using (true);

-- Cameras: only surface reviewed/active ones to the public. Unverified or
-- non-ToS-reviewed rows stay hidden until cleared (default_visible gate).
create policy "public read cleared cameras"
  on cameras for select
  using (status = 'active' and (provider = 'youtube' or tos_reviewed = true));

create policy "public read markets"
  on markets for select using (true);
create policy "public read market snapshots"
  on market_snapshots for select using (true);
create policy "public read market links"
  on market_feature_links for select using (true);

-- ingestion_runs: internal only. No public policy => anon sees nothing;
-- service role bypasses RLS for the ingestion pipeline.
