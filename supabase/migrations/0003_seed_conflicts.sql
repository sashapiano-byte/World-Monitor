-- ===========================================================================
-- Frontline — seed the first two conflicts (migration 0003)
--
-- Ukraine and Sudan are DATA, not code. They are the first two rows in
-- `conflicts`; their layers are rows in `conflict_layers` bound to adapters by
-- `adapter_key`. Note `nasa_firms` is reused across BOTH conflicts — proof the
-- design is conflict-agnostic (one adapter, many theatres).
--
-- Attribution / license columns are populated verbatim and must not be edited
-- to remove credit. ACLED ships enabled=false until the license decision in
-- DECISIONS.md is approved.
-- ===========================================================================

insert into conflicts (slug, name, summary, status, start_date, center_lng, center_lat, default_zoom, bbox, region, display_order, is_featured)
values
  ('ukraine',
   'Ukraine',
   'Russia''s full-scale invasion of Ukraine. Front line, strikes, fires and documented equipment losses.',
   'active', date '2022-02-24',
   31.1656, 48.3794, 5.5,
   array[22.0, 44.0, 40.5, 52.5], 'Europe', 10, true),
  ('sudan',
   'Sudan',
   'Civil war between the Sudanese Armed Forces (SAF) and the Rapid Support Forces (RSF).',
   'active', date '2023-04-15',
   30.2176, 15.5007, 5.5,
   array[21.8, 8.6, 38.6, 22.2], 'Africa', 20, true);

-- --- Ukraine layers ---------------------------------------------------------
insert into conflict_layers
  (conflict_id, key, name, description, adapter_key, layer_type,
   source_name, source_url, attribution, license, license_url,
   refresh_interval_seconds, z_index, enabled, default_visible, config)
select c.id, v.key, v.name, v.description, v.adapter_key, v.layer_type,
       v.source_name, v.source_url, v.attribution, v.license, v.license_url,
       v.refresh, v.z, v.enabled, v.vis, v.config::jsonb
from conflicts c
join (values
  ('isw_control', 'Assessed Control of Terrain', 'ISW & Critical Threats Project assessed Russian-controlled and claimed areas.',
   'isw_arcgis', 'fill',
   'Institute for the Study of War', 'https://www.understandingwar.org/',
   'Institute for the Study of War and AEI''s Critical Threats Project (Fair Use).',
   'ISW Fair Use', 'https://www.understandingwar.org/',
   21600, 10, true, true, '{"arcgis_layer":"assessed_control"}'),
  ('viina_events', 'Reported Events (VIINA)', 'Violent Incident Information from News Articles — geolocated event feed.',
   'viina', 'point',
   'VIINA — Center for Security Studies, ETH Zurich', 'https://vdem.net/data/viina/',
   'VIINA: Violent Incident Information from News Articles (Zhukov et al.), licensed under ODbL 1.0.',
   'ODbL 1.0', 'https://opendatacommons.org/licenses/odbl/1-0/',
   3600, 20, true, true, '{}'),
  ('firms_fires', 'Active Fire / Thermal (FIRMS)', 'NASA FIRMS VIIRS/MODIS active-fire detections in the theatre bbox.',
   'nasa_firms', 'heatmap',
   'NASA FIRMS', 'https://firms.modaps.eosdis.nasa.gov/',
   'Data courtesy of NASA FIRMS (Fire Information for Resource Management System).',
   'NASA Open Data', 'https://firms.modaps.eosdis.nasa.gov/',
   3600, 15, true, false, '{"sensor":"VIIRS_SNPP_NRT","day_range":2}'),
  ('oryx_losses', 'Documented Equipment Losses (Oryx)', 'Photo-confirmed equipment losses aggregated from the Oryx dataset.',
   'oryx', 'point',
   'Oryx', 'https://www.oryxspioenkop.com/',
   'Documented equipment losses via Oryx (oryxspioenkop.com). Photo-verified, undercount by design.',
   'CC BY (attribution)', 'https://www.oryxspioenkop.com/',
   86400, 25, true, false, '{}')
) as v(key,name,description,adapter_key,layer_type,source_name,source_url,attribution,license,license_url,refresh,z,enabled,vis,config)
  on true
where c.slug = 'ukraine';

-- --- Sudan layers -----------------------------------------------------------
insert into conflict_layers
  (conflict_id, key, name, description, adapter_key, layer_type,
   source_name, source_url, attribution, license, license_url,
   refresh_interval_seconds, z_index, enabled, default_visible, config)
select c.id, v.key, v.name, v.description, v.adapter_key, v.layer_type,
       v.source_name, v.source_url, v.attribution, v.license, v.license_url,
       v.refresh, v.z, v.enabled, v.vis, v.config::jsonb
from conflicts c
join (values
  -- ACLED ships DISABLED (enabled=false) pending the license decision. The
  -- free tier is non-commercial and requires substantially reworked output.
  ('acled_events', 'Armed Conflict Events (ACLED)', 'ACLED political-violence events. DISABLED pending license approval (see DECISIONS.md).',
   'acled', 'point',
   'ACLED', 'https://acleddata.com/',
   'Armed Conflict Location & Event Data Project (ACLED); acleddata.com. Non-commercial use requires ACLED terms compliance.',
   'ACLED Terms (non-commercial free tier)', 'https://acleddata.com/terms-of-use/',
   21600, 20, false, false, '{"gated":true,"reason":"license_pending"}'),
  ('ucdp_ged', 'Georeferenced Events (UCDP GED)', 'UCDP Georeferenced Event Dataset — organized-violence events with fatalities.',
   'ucdp_ged', 'point',
   'Uppsala Conflict Data Program', 'https://ucdp.uu.se/',
   'Uppsala Conflict Data Program (UCDP), Georeferenced Event Dataset, licensed under CC BY 4.0.',
   'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/',
   86400, 22, true, true, '{"dataset":"gedevents","country":"Sudan"}'),
  ('hdx_sudan', 'Humanitarian Datasets (HDX)', 'Pre-aggregated Sudan datasets from the Humanitarian Data Exchange (displacement, admin, etc.).',
   'hdx', 'fill',
   'OCHA Humanitarian Data Exchange', 'https://data.humdata.org/group/sdn',
   'Data via the Humanitarian Data Exchange (HDX), OCHA. Individual datasets carry their own licenses — preserved per dataset.',
   'Per-dataset (HDX)', 'https://data.humdata.org/faqs/licenses',
   86400, 12, true, false, '{"group":"sdn"}'),
  ('firms_fires', 'Active Fire / Thermal (FIRMS)', 'NASA FIRMS active-fire detections in the Sudan bbox (same adapter as Ukraine).',
   'nasa_firms', 'heatmap',
   'NASA FIRMS', 'https://firms.modaps.eosdis.nasa.gov/',
   'Data courtesy of NASA FIRMS (Fire Information for Resource Management System).',
   'NASA Open Data', 'https://firms.modaps.eosdis.nasa.gov/',
   3600, 15, true, false, '{"sensor":"VIIRS_SNPP_NRT","day_range":2}')
) as v(key,name,description,adapter_key,layer_type,source_name,source_url,attribution,license,license_url,refresh,z,enabled,vis,config)
  on true
where c.slug = 'sudan';
