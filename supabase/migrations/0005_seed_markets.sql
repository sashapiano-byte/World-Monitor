-- ===========================================================================
-- Frontline — seed prediction markets (migration 0005)
--
-- Representative Polymarket / Kalshi contracts linked to the Ukraine and Sudan
-- conflicts so the odds overlay has content BEFORE live ingestion (lib/markets)
-- runs. Markets are DATA: linked to a conflict via a subquery on conflicts.slug,
-- never hard-coded ids.
--
-- IMPORTANT: external_id values here are best-known or CLEARLY PLACEHOLDER
-- (see metadata.needs_verification / metadata.id_scheme). They must be
-- reconciled against live Gamma (conditionId) / Kalshi (ticker) responses
-- before they are treated as canonical — the overlay only needs them to be
-- stable + unique for dedupe today. Probabilities below are illustrative
-- placeholders, not live odds.
-- ===========================================================================

-- --- markets ----------------------------------------------------------------
insert into markets (conflict_id, provider, external_id, question, url, status, metadata)
select c.id, v.provider, v.external_id, v.question, v.url, 'open', v.metadata::jsonb
from conflicts c
join (values
  -- Ukraine ------------------------------------------------------------------
  ('ukraine', 'polymarket', 'pm-seed-ukr-ceasefire-2025',
   'Russia x Ukraine ceasefire in 2025?',
   'https://polymarket.com/event/russia-ukraine-ceasefire-in-2025',
   '{"id_scheme":"placeholder","needs_verification":true,"note":"replace with Gamma conditionId","keywords":["Ukraine","ceasefire"]}'),
  ('ukraine', 'polymarket', 'pm-seed-ukr-territory-2025',
   'Will Russia control more Ukrainian territory by end of 2025?',
   'https://polymarket.com/event/russia-ukraine-territory-2025',
   '{"id_scheme":"placeholder","needs_verification":true,"keywords":["Russia","territory"]}'),
  ('ukraine', 'polymarket', 'pm-seed-ukr-zelensky-2025',
   'Will Zelensky remain President of Ukraine through 2025?',
   'https://polymarket.com/event/zelensky-president-through-2025',
   '{"id_scheme":"placeholder","needs_verification":true,"keywords":["Zelensky"]}'),
  ('ukraine', 'polymarket', 'pm-seed-ukr-nato-2026',
   'Will Ukraine join NATO before 2027?',
   'https://polymarket.com/event/ukraine-nato-before-2027',
   '{"id_scheme":"placeholder","needs_verification":true,"keywords":["NATO"]}'),
  ('ukraine', 'kalshi', 'KXUKRAINECF-25',
   'Ukraine-Russia ceasefire agreement signed in 2025?',
   'https://kalshi.com/markets/kxukrainecf',
   '{"id_scheme":"best_known_ticker","needs_verification":true,"series_ticker":"KXUKRAINECF","keywords":["Ukraine","ceasefire"]}'),
  ('ukraine', 'kalshi', 'KXRUSTROOP-25',
   'Will Russian forces withdraw from any oblast in 2025?',
   'https://kalshi.com/markets/kxrustroop',
   '{"id_scheme":"placeholder","needs_verification":true,"keywords":["Russia","withdraw"]}'),
  ('ukraine', 'kalshi', 'KXPUTIN-2025',
   'Will Vladimir Putin remain in power through 2025?',
   'https://kalshi.com/markets/kxputin',
   '{"id_scheme":"placeholder","needs_verification":true,"keywords":["Putin"]}'),

  -- Sudan --------------------------------------------------------------------
  ('sudan', 'polymarket', 'pm-seed-sdn-ceasefire-2025',
   'Will the SAF and RSF agree to a ceasefire in 2025?',
   'https://polymarket.com/event/sudan-ceasefire-2025',
   '{"id_scheme":"placeholder","needs_verification":true,"keywords":["Sudan","ceasefire","RSF","SAF"]}'),
  ('sudan', 'polymarket', 'pm-seed-sdn-khartoum-2025',
   'Will the RSF control Khartoum at the end of 2025?',
   'https://polymarket.com/event/rsf-control-khartoum-2025',
   '{"id_scheme":"placeholder","needs_verification":true,"keywords":["Khartoum","RSF"]}'),
  ('sudan', 'polymarket', 'pm-seed-sdn-elfasher-2025',
   'Will el-Fasher fall to the RSF in 2025?',
   'https://polymarket.com/event/el-fasher-rsf-2025',
   '{"id_scheme":"placeholder","needs_verification":true,"keywords":["Darfur","el-Fasher","RSF"]}'),
  ('sudan', 'kalshi', 'KXSUDANCF-25',
   'Sudan nationwide ceasefire in effect in 2025?',
   'https://kalshi.com/markets/kxsudancf',
   '{"id_scheme":"placeholder","needs_verification":true,"series_ticker":"KXSUDANCF","keywords":["Sudan","ceasefire"]}'),
  ('sudan', 'kalshi', 'KXSUDANGOV-25',
   'Will the SAF-led government control Khartoum through 2025?',
   'https://kalshi.com/markets/kxsudangov',
   '{"id_scheme":"placeholder","needs_verification":true,"keywords":["SAF","Khartoum"]}')
) as v(slug, provider, external_id, question, url, metadata)
  on c.slug = v.slug
on conflict (provider, external_id) do nothing;

-- --- one snapshot per market (Yes outcome) so the UI renders a probability --
-- Probabilities are illustrative placeholders (0..1). Volume is nominal.
insert into market_snapshots (market_id, outcome, probability, volume, captured_at)
select m.id, 'Yes', v.probability, v.volume, now()
from markets m
join (values
  ('pm-seed-ukr-ceasefire-2025', 0.34, 4200000.0),
  ('pm-seed-ukr-territory-2025', 0.58, 1500000.0),
  ('pm-seed-ukr-zelensky-2025',  0.82, 900000.0),
  ('pm-seed-ukr-nato-2026',      0.11, 650000.0),
  ('KXUKRAINECF-25',             0.29, 320000.0),
  ('KXRUSTROOP-25',              0.17, 145000.0),
  ('KXPUTIN-2025',               0.88, 210000.0),
  ('pm-seed-sdn-ceasefire-2025', 0.22, 180000.0),
  ('pm-seed-sdn-khartoum-2025',  0.41, 95000.0),
  ('pm-seed-sdn-elfasher-2025',  0.63, 120000.0),
  ('KXSUDANCF-25',               0.19, 40000.0),
  ('KXSUDANGOV-25',              0.52, 55000.0)
) as v(external_id, probability, volume)
  on m.external_id = v.external_id
where not exists (
  select 1 from market_snapshots s where s.market_id = m.id
);

-- Also seed the complementary 'No' outcome for binary markets so expanded
-- views have both sides. Probability = 1 - Yes.
insert into market_snapshots (market_id, outcome, probability, volume, captured_at)
select m.id, 'No', 1 - v.probability, v.volume, now()
from markets m
join (values
  ('pm-seed-ukr-ceasefire-2025', 0.34, 4200000.0),
  ('pm-seed-ukr-territory-2025', 0.58, 1500000.0),
  ('pm-seed-ukr-zelensky-2025',  0.82, 900000.0),
  ('pm-seed-ukr-nato-2026',      0.11, 650000.0),
  ('KXUKRAINECF-25',             0.29, 320000.0),
  ('KXRUSTROOP-25',              0.17, 145000.0),
  ('KXPUTIN-2025',               0.88, 210000.0),
  ('pm-seed-sdn-ceasefire-2025', 0.22, 180000.0),
  ('pm-seed-sdn-khartoum-2025',  0.41, 95000.0),
  ('pm-seed-sdn-elfasher-2025',  0.63, 120000.0),
  ('KXSUDANCF-25',               0.19, 40000.0),
  ('KXSUDANGOV-25',              0.52, 55000.0)
) as v(external_id, probability, volume)
  on m.external_id = v.external_id
where not exists (
  select 1 from market_snapshots s
  where s.market_id = m.id and s.outcome = 'No'
);
