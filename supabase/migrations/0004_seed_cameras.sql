-- ===========================================================================
-- Frontline — seed the live-camera catalog (migration 0004)
--
-- Positioned against worldmonitor.app: relay PUBLIC live streams, YouTube-Live
-- first, embedded via YouTube's own official iframe player (no re-hosting, no
-- proxying — see docs/camera-tos-review.md and lib/cameras/youtube.ts).
--
-- HONESTY POSTURE (load-bearing):
--   * Live YouTube video ids rotate and CANNOT be verified from the build
--     environment, so every row here ships status='unverified' and
--     is_live=false. Nothing is fabricated-and-marked-active. RLS
--     (0002_rls.sql) therefore hides ALL of these from the public anon key
--     until a verification pass (lib/cameras/youtube.ts verifyCameraLiveness,
--     run from a trusted server) resolves a real live id and flips a row to
--     status='active'. Unverified is the correct state, not a bug.
--   * Where a specific YouTube video/channel id is genuinely known it can be
--     supplied later; here we mostly store a STABLE discovery URL (a YouTube
--     search or a channel `/live` handle) so a human/verifier can resolve the
--     current live stream. embed_url is only populated when an embeddable id is
--     known — otherwise the UI offers an "open on YouTube" link.
--   * NON-YouTube sources (provider='other') ship tos_reviewed=false, so RLS
--     keeps them hidden until each is cleared in docs/camera-tos-review.md.
--
-- The url/embed_url are BUILT from a small SQL helper (the CASE block below),
-- mirroring lib/cameras/youtube.ts, so id encoding lives in one place.
-- ===========================================================================

insert into cameras (
  conflict_id, title, description, provider, stream_type, external_id,
  url, embed_url, lng, lat, location_name, city, country, tags,
  is_live, status, tos_reviewed, metadata
)
select
  co.id,
  v.title,
  v.descr,
  v.provider,
  v.stream_type,
  -- Only persist a value in external_id when it is a real YouTube video/channel id.
  case when v.id_type in ('channel','video') then v.external_id else null end,
  -- url helper --------------------------------------------------------------
  case v.id_type
    when 'channel' then 'https://www.youtube.com/channel/' || v.external_id || '/live'
    when 'video'   then 'https://www.youtube.com/watch?v=' || v.external_id
    when 'handle'  then 'https://www.youtube.com/' || v.external_id || '/live'
    when 'search'  then 'https://www.youtube.com/results?search_query=' || v.external_id
    else v.direct_url
  end,
  -- embed_url helper (null when no embeddable id / not permitted) ------------
  case v.id_type
    when 'channel' then 'https://www.youtube.com/embed/live_stream?channel=' || v.external_id || '&mute=1&rel=0&playsinline=1'
    when 'video'   then 'https://www.youtube.com/embed/' || v.external_id || '?mute=1&rel=0&playsinline=1'
    when 'direct'  then v.direct_embed
    else null
  end,
  v.lng, v.lat, v.location_name, v.city, v.country,
  string_to_array(v.tags, ','),
  false,                                   -- is_live: unverified => not asserted live
  'unverified',                            -- status: gated until a liveness pass
  false,                                   -- tos_reviewed: youtube n/a; 'other' gated
  jsonb_build_object(
    'seed', 'phase1c',
    'id_hint', v.id_type,
    'note', v.note,
    'requires', case when v.provider = 'other' then 'tos_review' else 'liveness_verification' end,
    'discovery_query', case when v.id_type = 'search' then v.external_id
                            when v.id_type = 'handle' then v.external_id
                            else null end
  )
from (values
  -- title, descr, provider, stream_type, id_type, external_id/query/handle,
  -- direct_url, direct_embed, lng, lat, location_name, city, country,
  -- conflict_slug, tags, note

  -- ========================= UKRAINE (conflict) =========================
  ('Kyiv — City Centre Live', 'Independence Square / central Kyiv live view.', 'youtube', 'youtube_live', 'search', 'kyiv+maidan+live+webcam', null::text, null::text, 30.5234, 50.4501, 'Maidan Nezalezhnosti', 'Kyiv', 'Ukraine', 'ukraine', 'conflict,ukraine,city,capital', 'Multiple operators stream central Kyiv; resolve current live id.'),
  ('Kharkiv — City Live', 'Central Kharkiv live view near Freedom Square.', 'youtube', 'youtube_live', 'search', 'kharkiv+live+webcam', null, null, 36.2304, 49.9935, 'Freedom Square', 'Kharkiv', 'Ukraine', 'ukraine', 'conflict,ukraine,city,frontline-region', 'Frequent air-alert region.'),
  ('Odesa — Port & Seafront', 'Odesa Black Sea port / seafront live view.', 'youtube', 'youtube_live', 'search', 'odesa+live+webcam+port', null, null, 30.7233, 46.4825, 'Odesa Seaport', 'Odesa', 'Ukraine', 'ukraine', 'conflict,ukraine,city,port,black-sea', 'Grain-corridor relevant port.'),
  ('Lviv — Rynok Square', 'Historic centre of Lviv, Rynok (Market) Square.', 'youtube', 'youtube_live', 'search', 'lviv+rynok+square+live+webcam', null, null, 24.0297, 49.8397, 'Rynok Square', 'Lviv', 'Ukraine', 'ukraine', 'conflict,ukraine,city,west', 'Western hub, refugee transit.'),
  ('Dnipro — City Live', 'Dnipro riverfront / city centre live.', 'youtube', 'youtube_live', 'search', 'dnipro+live+webcam', null, null, 35.0462, 48.4647, 'Dnipro Embankment', 'Dnipro', 'Ukraine', 'ukraine', 'conflict,ukraine,city', 'Logistics hub.'),
  ('Zaporizhzhia — City Live', 'Zaporizhzhia city live view.', 'youtube', 'youtube_live', 'search', 'zaporizhzhia+live+webcam', null, null, 35.1396, 47.8388, 'Zaporizhzhia', 'Zaporizhzhia', 'Ukraine', 'ukraine', 'conflict,ukraine,city,frontline-region', 'Near ZNPP / active front.'),
  ('Kherson — City Live', 'Kherson city / Dnipro right-bank live view.', 'youtube', 'youtube_live', 'search', 'kherson+live+webcam', null, null, 32.6178, 46.6354, 'Kherson', 'Kherson', 'Ukraine', 'ukraine', 'conflict,ukraine,city,frontline-region', 'Contested riverbank.'),
  ('Mykolaiv — City Live', 'Mykolaiv shipbuilding city live view.', 'youtube', 'youtube_live', 'search', 'mykolaiv+live+webcam', null, null, 31.9946, 46.9750, 'Mykolaiv', 'Mykolaiv', 'Ukraine', 'ukraine', 'conflict,ukraine,city', 'Southern approach to Odesa.'),
  ('Sumy — City Live', 'Sumy city centre, near the north-east border.', 'youtube', 'youtube_live', 'search', 'sumy+live+webcam', null, null, 34.7981, 50.9077, 'Sumy', 'Sumy', 'Ukraine', 'ukraine', 'conflict,ukraine,city,border', 'North-east border oblast.'),
  ('Chernihiv — City Live', 'Chernihiv city live view.', 'youtube', 'youtube_live', 'search', 'chernihiv+live+webcam', null, null, 31.2893, 51.4982, 'Chernihiv', 'Chernihiv', 'Ukraine', 'ukraine', 'conflict,ukraine,city,border', 'Northern border oblast.'),
  ('Kramatorsk — City Live', 'Kramatorsk, Donetsk oblast hub.', 'youtube', 'youtube_live', 'search', 'kramatorsk+live+webcam', null, null, 37.5843, 48.7233, 'Kramatorsk', 'Kramatorsk', 'Ukraine', 'ukraine', 'conflict,ukraine,city,donbas,frontline-region', 'Donbas administrative hub.'),
  ('Kryvyi Rih — City Live', 'Kryvyi Rih industrial city live view.', 'youtube', 'youtube_live', 'search', 'kryvyi+rih+live+webcam', null, null, 33.3910, 47.9105, 'Kryvyi Rih', 'Kryvyi Rih', 'Ukraine', 'ukraine', 'conflict,ukraine,city', 'Industrial centre.'),
  ('Vinnytsia — City Live', 'Vinnytsia central live view.', 'youtube', 'youtube_live', 'search', 'vinnytsia+live+webcam', null, null, 28.4682, 49.2331, 'Vinnytsia', 'Vinnytsia', 'Ukraine', 'ukraine', 'conflict,ukraine,city', 'Central Ukraine.'),
  ('Poltava — City Live', 'Poltava central live view.', 'youtube', 'youtube_live', 'search', 'poltava+live+webcam', null, null, 34.5514, 49.5883, 'Poltava', 'Poltava', 'Ukraine', 'ukraine', 'conflict,ukraine,city', 'Central-east Ukraine.'),
  ('Kupiansk / Vovchansk Border Region', 'North-east Kharkiv oblast border area.', 'youtube', 'youtube_live', 'search', 'vovchansk+kharkiv+border+live', null, null, 36.9459, 50.2900, 'Vovchansk area', 'Vovchansk', 'Ukraine', 'ukraine', 'conflict,ukraine,border,frontline-region', 'Active border-front sector; live coverage sparse.'),

  -- ========================= SUDAN (conflict) ==========================
  ('Khartoum — City Live', 'Sudanese capital, confluence of the Niles.', 'youtube', 'youtube_live', 'search', 'khartoum+live+webcam', null, null, 32.5599, 15.5007, 'Khartoum', 'Khartoum', 'Sudan', 'sudan', 'conflict,sudan,city,capital,frontline-region', 'Contested SAF/RSF; live cams very scarce.'),
  ('Omdurman — City Live', 'Omdurman, across the Nile from Khartoum.', 'youtube', 'youtube_live', 'search', 'omdurman+sudan+live', null, null, 32.4801, 15.6445, 'Omdurman', 'Omdurman', 'Sudan', 'sudan', 'conflict,sudan,city,frontline-region', 'Heavy fighting; coverage sparse.'),
  ('Port Sudan — Red Sea', 'Port Sudan, wartime seat of government.', 'youtube', 'youtube_live', 'search', 'port+sudan+red+sea+live', null, null, 37.2164, 19.6158, 'Port Sudan', 'Port Sudan', 'Sudan', 'sudan', 'conflict,sudan,city,port,red-sea', 'De facto administrative capital.'),
  ('El Fasher — North Darfur', 'El Fasher, besieged North Darfur capital.', 'youtube', 'youtube_live', 'search', 'el+fasher+darfur+news+live', null, null, 25.3494, 13.6279, 'El Fasher', 'El Fasher', 'Sudan', 'sudan', 'conflict,sudan,darfur,frontline-region', 'Siege; expect news feeds, not fixed cams.'),
  ('Nyala — South Darfur', 'Nyala, South Darfur.', 'youtube', 'youtube_live', 'search', 'nyala+darfur+live', null, null, 24.8807, 12.0489, 'Nyala', 'Nyala', 'Sudan', 'sudan', 'conflict,sudan,darfur', 'RSF-controlled; coverage sparse.'),
  ('Kassala — East Sudan', 'Kassala near the Eritrean border.', 'youtube', 'youtube_live', 'search', 'kassala+sudan+live', null, null, 36.4000, 15.4510, 'Kassala', 'Kassala', 'Sudan', 'sudan', 'conflict,sudan,city,border', 'Eastern border town.'),
  ('Wad Madani — Al Jazirah', 'Wad Madani, Al Jazirah state.', 'youtube', 'youtube_live', 'search', 'wad+madani+sudan+live', null, null, 33.5199, 14.4012, 'Wad Madani', 'Wad Madani', 'Sudan', 'sudan', 'conflict,sudan,city,frontline-region', 'Changed hands during the war.'),

  -- ============= OTHER CONFLICT / TENSION ZONES (no conflict_id) =============
  ('Sderot — Gaza Border Overlook', 'Israeli town on the Gaza border.', 'youtube', 'youtube_live', 'search', 'sderot+gaza+border+live', null, null, 34.5967, 31.5250, 'Sderot / Gaza border', 'Sderot', 'Israel', null, 'conflict,israel,gaza,border,middle-east', 'High-tension border; news livestreams common.'),
  ('Gaza City — Skyline', 'Gaza City skyline / news live view.', 'youtube', 'youtube_live', 'search', 'gaza+city+live+news', null, null, 34.4668, 31.5017, 'Gaza City', 'Gaza City', 'Palestine', null, 'conflict,gaza,palestine,middle-east', 'Coverage via news broadcasters.'),
  ('Jerusalem — Western Wall Live', 'Western Wall (Kotel) plaza live camera.', 'youtube', 'youtube_live', 'search', 'western+wall+jerusalem+live+cam', null, null, 35.2345, 31.7767, 'Western Wall', 'Jerusalem', 'Israel', null, 'city,religion,middle-east,tension', 'Long-running fixed live cam.'),
  ('Metula — Israel/Lebanon Border', 'Northern Israel at the Lebanese frontier.', 'youtube', 'youtube_live', 'search', 'israel+lebanon+border+live', null, null, 35.5717, 33.2790, 'Metula', 'Metula', 'Israel', null, 'conflict,israel,lebanon,border,middle-east', 'Cross-border exchanges.'),
  ('Beirut — City Live', 'Beirut skyline / Mediterranean corniche.', 'youtube', 'youtube_live', 'search', 'beirut+live+webcam', null, null, 35.5018, 33.8938, 'Beirut', 'Beirut', 'Lebanon', null, 'city,middle-east,tension', 'Capital under regional strain.'),
  ('Damascus — City Live', 'Damascus city live view.', 'youtube', 'youtube_live', 'search', 'damascus+syria+live', null, null, 36.2765, 33.5138, 'Damascus', 'Damascus', 'Syria', null, 'conflict,syria,city,capital,middle-east', 'Post-2024 transition; verify feeds.'),
  ('Idlib — North-West Syria', 'Idlib, north-west Syria.', 'youtube', 'youtube_live', 'search', 'idlib+syria+live', null, null, 36.6339, 35.9306, 'Idlib', 'Idlib', 'Syria', null, 'conflict,syria,frontline-region,middle-east', 'Contested north-west.'),
  ('Aden — Yemen Port', 'Aden port and gulf live view.', 'youtube', 'youtube_live', 'search', 'aden+yemen+live', null, null, 45.0187, 12.7855, 'Aden', 'Aden', 'Yemen', null, 'conflict,yemen,port,middle-east', 'Southern seat of government.'),
  ('Kinmen — Taiwan Strait', 'Kinmen islands facing mainland Xiamen.', 'youtube', 'youtube_live', 'search', 'kinmen+taiwan+strait+live', null, null, 118.3186, 24.4489, 'Kinmen', 'Kinmen', 'Taiwan', null, 'conflict,taiwan,strait,border,asia', 'Front-line islands of the Strait.'),
  ('Taipei — 101 Skyline', 'Taipei skyline incl. Taipei 101.', 'youtube', 'youtube_live', 'search', 'taipei+101+live+cam', null, null, 121.5645, 25.0330, 'Taipei 101', 'Taipei', 'Taiwan', null, 'city,skyline,asia,tension', 'Capital of a flashpoint.'),
  ('Panmunjom — Korean DMZ', 'Korean Demilitarized Zone / JSA area.', 'youtube', 'youtube_live', 'search', 'korean+dmz+panmunjom+live', null, null, 126.6770, 37.9560, 'Panmunjom / DMZ', 'Paju', 'South Korea', null, 'conflict,korea,dmz,border,asia', 'Most militarized border on earth.'),
  ('Seoul — City Live', 'Seoul skyline / Han River live view.', 'youtube', 'youtube_live', 'search', 'seoul+live+cam', null, null, 126.9780, 37.5665, 'Seoul', 'Seoul', 'South Korea', null, 'city,skyline,asia,tension', 'Capital within DPRK range.'),
  ('Srinagar — Kashmir', 'Srinagar, Dal Lake / Kashmir valley.', 'youtube', 'youtube_live', 'search', 'srinagar+kashmir+live', null, null, 74.7973, 34.0837, 'Srinagar', 'Srinagar', 'India', null, 'conflict,kashmir,border,asia', 'Disputed India/Pakistan region.'),
  ('Stepanakert / Nagorno-Karabakh', 'Stepanakert (Khankendi) area.', 'youtube', 'youtube_live', 'search', 'stepanakert+karabakh+news+live', null, null, 46.7524, 39.8177, 'Stepanakert', 'Stepanakert', 'Azerbaijan', null, 'conflict,caucasus,nagorno-karabakh', 'Post-2023 exodus; verify feeds.'),
  ('Tbilisi — City Live', 'Tbilisi old town / Mtkvari river.', 'youtube', 'youtube_live', 'search', 'tbilisi+live+cam', null, null, 44.8271, 41.7151, 'Tbilisi', 'Tbilisi', 'Georgia', null, 'city,caucasus,tension', 'Frequent political protest hub.'),
  ('Tiraspol — Transnistria', 'Tiraspol, breakaway Transnistria.', 'youtube', 'youtube_live', 'search', 'tiraspol+transnistria+live', null, null, 29.6436, 46.8403, 'Tiraspol', 'Tiraspol', 'Moldova', null, 'conflict,moldova,transnistria,frozen', 'Russian-garrisoned enclave.'),
  ('Suwalki Gap — Poland/Lithuania', 'Strategic NATO corridor near the border.', 'youtube', 'youtube_live', 'search', 'suwalki+gap+border+live', null, null, 23.1000, 54.1000, 'Suwalki Gap', 'Suwalki', 'Poland', null, 'conflict,nato,border,europe', 'Kaliningrad-Belarus land bridge chokepoint.'),
  ('Belgorod — Russia Border', 'Belgorod, Russian border city near Ukraine.', 'youtube', 'youtube_live', 'search', 'belgorod+live+webcam', null, null, 36.5983, 50.5977, 'Belgorod', 'Belgorod', 'Russia', null, 'conflict,russia,border,frontline-region', 'Frequent cross-border strikes.'),
  ('Sevastopol — Crimea', 'Sevastopol bay, Black Sea Fleet base.', 'youtube', 'youtube_live', 'search', 'sevastopol+live+webcam', null, null, 33.5253, 44.6166, 'Sevastopol', 'Sevastopol', 'Ukraine', null, 'conflict,crimea,port,black-sea,frontline-region', 'Contested naval base (internationally Ukraine).'),

  -- ========================= MAJOR WORLD CITIES =========================
  ('New York — Times Square', 'Times Square 24/7 live street view.', 'youtube', 'youtube_live', 'search', 'times+square+live+cam', null, null, -73.9855, 40.7580, 'Times Square', 'New York', 'United States', null, 'city,skyline,street,usa,americas', 'Iconic always-on street cam.'),
  ('New York — Manhattan Skyline', 'Manhattan skyline live panorama.', 'youtube', 'youtube_live', 'search', 'manhattan+skyline+live+cam', null, null, -73.9712, 40.7831, 'Manhattan', 'New York', 'United States', null, 'city,skyline,usa,americas', 'Skyline panorama.'),
  ('London — City Live', 'Central London live view.', 'youtube', 'youtube_live', 'search', 'london+live+cam', null, null, -0.1278, 51.5074, 'Central London', 'London', 'United Kingdom', null, 'city,skyline,europe', 'Capital live view.'),
  ('Paris — Eiffel Tower', 'Eiffel Tower live view.', 'youtube', 'youtube_live', 'search', 'eiffel+tower+live+cam', null, null, 2.2945, 48.8584, 'Eiffel Tower', 'Paris', 'France', null, 'city,skyline,landmark,europe', 'Landmark live cam.'),
  ('Tokyo — Shibuya Crossing', 'Shibuya scramble crossing live.', 'youtube', 'youtube_live', 'search', 'shibuya+crossing+live+cam', null, null, 139.7005, 35.6595, 'Shibuya Crossing', 'Tokyo', 'Japan', null, 'city,street,asia', 'Busiest crossing on earth.'),
  ('Tokyo — Shinjuku', 'Shinjuku district live view.', 'youtube', 'youtube_live', 'search', 'shinjuku+tokyo+live+cam', null, null, 139.7036, 35.6938, 'Shinjuku', 'Tokyo', 'Japan', null, 'city,skyline,street,asia', 'Neon district.'),
  ('Moscow — Red Square', 'Red Square / Kremlin area live view.', 'youtube', 'youtube_live', 'search', 'moscow+red+square+live+cam', null, null, 37.6208, 55.7539, 'Red Square', 'Moscow', 'Russia', null, 'city,skyline,landmark,europe', 'Capital landmark.'),
  ('Berlin — City Live', 'Berlin Brandenburg Gate / centre live.', 'youtube', 'youtube_live', 'search', 'berlin+live+cam', null, null, 13.3777, 52.5163, 'Brandenburg Gate', 'Berlin', 'Germany', null, 'city,skyline,europe', 'Capital live view.'),
  ('Dubai — Skyline', 'Dubai / Burj Khalifa skyline live.', 'youtube', 'youtube_live', 'search', 'dubai+skyline+live+cam', null, null, 55.2708, 25.2048, 'Downtown Dubai', 'Dubai', 'United Arab Emirates', null, 'city,skyline,middle-east', 'Skyline live.'),
  ('Singapore — Marina Bay', 'Marina Bay skyline live view.', 'youtube', 'youtube_live', 'search', 'singapore+marina+bay+live+cam', null, null, 103.8198, 1.3521, 'Marina Bay', 'Singapore', 'Singapore', null, 'city,skyline,asia', 'Harbour skyline.'),
  ('Hong Kong — Victoria Harbour', 'Victoria Harbour skyline live.', 'youtube', 'youtube_live', 'search', 'hong+kong+victoria+harbour+live', null, null, 114.1694, 22.3193, 'Victoria Harbour', 'Hong Kong', 'Hong Kong', null, 'city,skyline,asia', 'Harbour skyline.'),
  ('Los Angeles — Skyline', 'Downtown LA skyline live.', 'youtube', 'youtube_live', 'search', 'los+angeles+skyline+live+cam', null, null, -118.2437, 34.0522, 'Downtown LA', 'Los Angeles', 'United States', null, 'city,skyline,usa,americas', 'Skyline live.'),
  ('Chicago — Skyline', 'Chicago lakefront skyline live.', 'youtube', 'youtube_live', 'search', 'chicago+skyline+live+cam', null, null, -87.6298, 41.8781, 'Chicago Lakefront', 'Chicago', 'United States', null, 'city,skyline,usa,americas', 'Lakefront skyline.'),
  ('Toronto — Skyline', 'Toronto / CN Tower skyline live.', 'youtube', 'youtube_live', 'search', 'toronto+skyline+live+cam', null, null, -79.3832, 43.6532, 'Downtown Toronto', 'Toronto', 'Canada', null, 'city,skyline,americas', 'Skyline live.'),
  ('Sydney — Harbour', 'Sydney Harbour / Opera House live.', 'youtube', 'youtube_live', 'search', 'sydney+harbour+live+cam', null, null, 151.2093, -33.8688, 'Sydney Harbour', 'Sydney', 'Australia', null, 'city,skyline,landmark,oceania', 'Harbour live.'),
  ('Rome — City Live', 'Rome centre live view.', 'youtube', 'youtube_live', 'search', 'rome+live+cam', null, null, 12.4964, 41.9028, 'Central Rome', 'Rome', 'Italy', null, 'city,europe', 'Capital live view.'),
  ('Amsterdam — Canals', 'Amsterdam canal district live.', 'youtube', 'youtube_live', 'search', 'amsterdam+live+cam', null, null, 4.9041, 52.3676, 'Canal Belt', 'Amsterdam', 'Netherlands', null, 'city,europe', 'Canal live view.'),
  ('Istanbul — Bosphorus', 'Bosphorus strait live view.', 'youtube', 'youtube_live', 'search', 'istanbul+bosphorus+live+cam', null, null, 28.9784, 41.0082, 'Bosphorus', 'Istanbul', 'Turkey', null, 'city,skyline,strait,europe,asia', 'Strategic strait.'),
  ('Cairo — City Live', 'Cairo / Nile live view.', 'youtube', 'youtube_live', 'search', 'cairo+live+cam', null, null, 31.2357, 30.0444, 'Central Cairo', 'Cairo', 'Egypt', null, 'city,africa,middle-east', 'Capital live view.'),
  ('Bangkok — City Live', 'Bangkok skyline live view.', 'youtube', 'youtube_live', 'search', 'bangkok+live+cam', null, null, 100.5018, 13.7563, 'Central Bangkok', 'Bangkok', 'Thailand', null, 'city,skyline,asia', 'Skyline live.'),
  ('Mumbai — City Live', 'Mumbai / Marine Drive live view.', 'youtube', 'youtube_live', 'search', 'mumbai+live+cam', null, null, 72.8777, 19.0760, 'Marine Drive', 'Mumbai', 'India', null, 'city,skyline,asia', 'Coastal skyline.'),
  ('Delhi — City Live', 'New Delhi live view.', 'youtube', 'youtube_live', 'search', 'delhi+live+cam', null, null, 77.2090, 28.6139, 'New Delhi', 'Delhi', 'India', null, 'city,asia', 'Capital live view.'),
  ('Beijing — City Live', 'Beijing skyline live view.', 'youtube', 'youtube_live', 'search', 'beijing+live+cam', null, null, 116.4074, 39.9042, 'Central Beijing', 'Beijing', 'China', null, 'city,skyline,asia', 'Capital live view.'),
  ('Shanghai — The Bund', 'Shanghai Bund / Pudong skyline live.', 'youtube', 'youtube_live', 'search', 'shanghai+bund+live+cam', null, null, 121.4737, 31.2304, 'The Bund', 'Shanghai', 'China', null, 'city,skyline,asia', 'Pudong skyline.'),
  ('Rio de Janeiro — Copacabana', 'Copacabana beach live view.', 'youtube', 'youtube_live', 'search', 'rio+copacabana+live+cam', null, null, -43.1729, -22.9068, 'Copacabana', 'Rio de Janeiro', 'Brazil', null, 'city,beach,americas', 'Beach live cam.'),
  ('Sao Paulo — Skyline', 'Sao Paulo skyline live view.', 'youtube', 'youtube_live', 'search', 'sao+paulo+skyline+live+cam', null, null, -46.6333, -23.5505, 'Central Sao Paulo', 'Sao Paulo', 'Brazil', null, 'city,skyline,americas', 'Skyline live.'),
  ('Mexico City — Zocalo', 'Mexico City Zocalo / centre live.', 'youtube', 'youtube_live', 'search', 'mexico+city+zocalo+live+cam', null, null, -99.1332, 19.4326, 'Zocalo', 'Mexico City', 'Mexico', null, 'city,americas', 'Central square.'),
  ('Madrid — City Live', 'Madrid centre / Gran Via live.', 'youtube', 'youtube_live', 'search', 'madrid+live+cam', null, null, -3.7038, 40.4168, 'Gran Via', 'Madrid', 'Spain', null, 'city,europe', 'Capital live view.'),
  ('Barcelona — City Live', 'Barcelona centre live view.', 'youtube', 'youtube_live', 'search', 'barcelona+live+cam', null, null, 2.1686, 41.3874, 'Central Barcelona', 'Barcelona', 'Spain', null, 'city,europe', 'City live view.'),
  ('Vienna — City Live', 'Vienna historic centre live view.', 'youtube', 'youtube_live', 'search', 'vienna+live+cam', null, null, 16.3738, 48.2082, 'Central Vienna', 'Vienna', 'Austria', null, 'city,europe', 'Capital live view.'),
  ('Prague — Old Town Square', 'Prague Old Town Square live.', 'youtube', 'youtube_live', 'search', 'prague+old+town+square+live+cam', null, null, 14.4378, 50.0755, 'Old Town Square', 'Prague', 'Czechia', null, 'city,europe', 'Old town live cam.'),
  ('Krakow — Main Square', 'Krakow Rynek Glowny live view.', 'youtube', 'youtube_live', 'search', 'krakow+main+square+live+cam', null, null, 19.9450, 50.0647, 'Rynek Glowny', 'Krakow', 'Poland', null, 'city,europe', 'Main market square.'),
  ('Warsaw — City Live', 'Warsaw centre live view.', 'youtube', 'youtube_live', 'search', 'warsaw+live+cam', null, null, 21.0122, 52.2297, 'Central Warsaw', 'Warsaw', 'Poland', null, 'city,europe,nato', 'NATO eastern-flank capital.'),
  ('Stockholm — City Live', 'Stockholm waterfront live view.', 'youtube', 'youtube_live', 'search', 'stockholm+live+cam', null, null, 18.0686, 59.3293, 'Central Stockholm', 'Stockholm', 'Sweden', null, 'city,europe', 'Waterfront live.'),
  ('Oslo — City Live', 'Oslo harbour live view.', 'youtube', 'youtube_live', 'search', 'oslo+live+cam', null, null, 10.7522, 59.9139, 'Oslo Harbour', 'Oslo', 'Norway', null, 'city,europe', 'Harbour live.'),
  ('Copenhagen — Nyhavn', 'Copenhagen Nyhavn live view.', 'youtube', 'youtube_live', 'search', 'copenhagen+nyhavn+live+cam', null, null, 12.5683, 55.6761, 'Nyhavn', 'Copenhagen', 'Denmark', null, 'city,europe', 'Harbour district.'),
  ('Helsinki — Market Square', 'Helsinki Kauppatori harbour live.', 'youtube', 'youtube_live', 'search', 'helsinki+market+square+live+cam', null, null, 24.9384, 60.1699, 'Kauppatori', 'Helsinki', 'Finland', null, 'city,europe,nato', 'Harbour market square.'),
  ('Athens — Acropolis', 'Athens Acropolis live view.', 'youtube', 'youtube_live', 'search', 'athens+acropolis+live+cam', null, null, 23.7275, 37.9838, 'Acropolis', 'Athens', 'Greece', null, 'city,landmark,europe', 'Landmark live.'),
  ('Lisbon — City Live', 'Lisbon Tagus riverfront live.', 'youtube', 'youtube_live', 'search', 'lisbon+live+cam', null, null, -9.1393, 38.7223, 'Central Lisbon', 'Lisbon', 'Portugal', null, 'city,europe', 'Riverfront live.'),
  ('Venice — St Marks Square', 'Piazza San Marco live view.', 'youtube', 'youtube_live', 'search', 'venice+st+marks+square+live+cam', null, null, 12.3388, 45.4342, 'Piazza San Marco', 'Venice', 'Italy', null, 'city,landmark,europe', 'Piazza live cam.'),
  ('Dublin — City Live', 'Dublin city centre live view.', 'youtube', 'youtube_live', 'search', 'dublin+live+cam', null, null, -6.2603, 53.3498, 'Central Dublin', 'Dublin', 'Ireland', null, 'city,europe', 'City live view.'),
  ('Edinburgh — Castle', 'Edinburgh Castle / old town live.', 'youtube', 'youtube_live', 'search', 'edinburgh+castle+live+cam', null, null, -3.1883, 55.9533, 'Edinburgh Castle', 'Edinburgh', 'United Kingdom', null, 'city,landmark,europe', 'Castle live cam.'),
  ('Zurich — City Live', 'Zurich lake / old town live view.', 'youtube', 'youtube_live', 'search', 'zurich+live+cam', null, null, 8.5417, 47.3769, 'Central Zurich', 'Zurich', 'Switzerland', null, 'city,europe', 'Lake live view.'),
  ('Munich — Marienplatz', 'Munich Marienplatz live view.', 'youtube', 'youtube_live', 'search', 'munich+marienplatz+live+cam', null, null, 11.5820, 48.1351, 'Marienplatz', 'Munich', 'Germany', null, 'city,europe', 'Central square.'),
  ('Reykjavik — City Live', 'Reykjavik harbour live view.', 'youtube', 'youtube_live', 'search', 'reykjavik+live+cam', null, null, -21.9426, 64.1466, 'Central Reykjavik', 'Reykjavik', 'Iceland', null, 'city,europe', 'Harbour live view.'),
  ('Nairobi — City Live', 'Nairobi skyline live view.', 'youtube', 'youtube_live', 'search', 'nairobi+live+cam', null, null, 36.8219, -1.2921, 'Central Nairobi', 'Nairobi', 'Kenya', null, 'city,skyline,africa', 'Skyline live.'),
  ('Cape Town — Table Mountain', 'Cape Town / Table Mountain live.', 'youtube', 'youtube_live', 'search', 'cape+town+table+mountain+live+cam', null, null, 18.4241, -33.9249, 'Table Mountain', 'Cape Town', 'South Africa', null, 'city,landmark,africa', 'Mountain / bay live.'),
  ('Lagos — City Live', 'Lagos skyline / lagoon live view.', 'youtube', 'youtube_live', 'search', 'lagos+nigeria+live+cam', null, null, 3.3792, 6.5244, 'Lagos Island', 'Lagos', 'Nigeria', null, 'city,skyline,africa', 'Skyline live.'),
  ('Johannesburg — City Live', 'Johannesburg skyline live view.', 'youtube', 'youtube_live', 'search', 'johannesburg+live+cam', null, null, 28.0473, -26.2041, 'Central Johannesburg', 'Johannesburg', 'South Africa', null, 'city,skyline,africa', 'Skyline live.'),
  ('Buenos Aires — City Live', 'Buenos Aires obelisk / centre live.', 'youtube', 'youtube_live', 'search', 'buenos+aires+live+cam', null, null, -58.3816, -34.6037, 'Obelisco', 'Buenos Aires', 'Argentina', null, 'city,americas', 'Central live view.'),
  ('Santiago — City Live', 'Santiago skyline / Andes backdrop live.', 'youtube', 'youtube_live', 'search', 'santiago+chile+live+cam', null, null, -70.6693, -33.4489, 'Central Santiago', 'Santiago', 'Chile', null, 'city,skyline,americas', 'Skyline live.'),
  ('Lima — City Live', 'Lima Miraflores coastline live.', 'youtube', 'youtube_live', 'search', 'lima+miraflores+live+cam', null, null, -77.0428, -12.0464, 'Miraflores', 'Lima', 'Peru', null, 'city,coast,americas', 'Coastal live.'),
  ('Bogota — City Live', 'Bogota skyline live view.', 'youtube', 'youtube_live', 'search', 'bogota+live+cam', null, null, -74.0721, 4.7110, 'Central Bogota', 'Bogota', 'Colombia', null, 'city,skyline,americas', 'Skyline live.'),
  ('Vancouver — City Live', 'Vancouver harbour / skyline live.', 'youtube', 'youtube_live', 'search', 'vancouver+live+cam', null, null, -123.1207, 49.2827, 'Coal Harbour', 'Vancouver', 'Canada', null, 'city,skyline,americas', 'Harbour skyline.'),
  ('Miami — Beach Live', 'Miami / South Beach live view.', 'youtube', 'youtube_live', 'search', 'miami+south+beach+live+cam', null, null, -80.1918, 25.7617, 'South Beach', 'Miami', 'United States', null, 'city,beach,usa,americas', 'Beach live cam.'),
  ('San Francisco — Bay', 'SF / Golden Gate live view.', 'youtube', 'youtube_live', 'search', 'san+francisco+golden+gate+live+cam', null, null, -122.4194, 37.7749, 'Golden Gate', 'San Francisco', 'United States', null, 'city,landmark,usa,americas', 'Bay / bridge live.'),
  ('Seattle — Skyline', 'Seattle / Space Needle skyline live.', 'youtube', 'youtube_live', 'search', 'seattle+skyline+live+cam', null, null, -122.3321, 47.6062, 'Space Needle', 'Seattle', 'United States', null, 'city,skyline,usa,americas', 'Skyline live.'),
  ('Las Vegas — Strip', 'Las Vegas Strip live view.', 'youtube', 'youtube_live', 'search', 'las+vegas+strip+live+cam', null, null, -115.1728, 36.1147, 'The Strip', 'Las Vegas', 'United States', null, 'city,street,usa,americas', 'Strip live cam.'),
  ('New Orleans — Bourbon Street', 'Bourbon Street live view.', 'youtube', 'youtube_live', 'search', 'bourbon+street+live+cam', null, null, -90.0644, 29.9584, 'Bourbon Street', 'New Orleans', 'United States', null, 'city,street,usa,americas', 'French Quarter live cam.'),
  ('Washington DC — City Live', 'Washington DC / Capitol area live.', 'youtube', 'youtube_live', 'search', 'washington+dc+live+cam', null, null, -77.0369, 38.9072, 'National Mall', 'Washington', 'United States', null, 'city,usa,americas,capital', 'Capital live view.'),
  ('Boston — City Live', 'Boston skyline / harbour live.', 'youtube', 'youtube_live', 'search', 'boston+live+cam', null, null, -71.0589, 42.3601, 'Central Boston', 'Boston', 'United States', null, 'city,skyline,usa,americas', 'Skyline live.'),
  ('Honolulu — Waikiki', 'Waikiki Beach live view.', 'youtube', 'youtube_live', 'search', 'waikiki+beach+live+cam', null, null, -157.8293, 21.2793, 'Waikiki Beach', 'Honolulu', 'United States', null, 'city,beach,usa,oceania', 'Beach live cam.'),
  ('Kuala Lumpur — Petronas', 'KL / Petronas Towers skyline live.', 'youtube', 'youtube_live', 'search', 'kuala+lumpur+petronas+live+cam', null, null, 101.6869, 3.1390, 'KLCC', 'Kuala Lumpur', 'Malaysia', null, 'city,skyline,landmark,asia', 'Skyline live.'),
  ('Jakarta — City Live', 'Jakarta skyline live view.', 'youtube', 'youtube_live', 'search', 'jakarta+live+cam', null, null, 106.8456, -6.2088, 'Central Jakarta', 'Jakarta', 'Indonesia', null, 'city,skyline,asia', 'Skyline live.'),
  ('Manila — Bay', 'Manila Bay skyline live view.', 'youtube', 'youtube_live', 'search', 'manila+bay+live+cam', null, null, 120.9842, 14.5995, 'Manila Bay', 'Manila', 'Philippines', null, 'city,skyline,bay,asia', 'Bay skyline.'),
  ('Ho Chi Minh City — City Live', 'HCMC / Saigon skyline live view.', 'youtube', 'youtube_live', 'search', 'ho+chi+minh+city+live+cam', null, null, 106.6297, 10.8231, 'District 1', 'Ho Chi Minh City', 'Vietnam', null, 'city,skyline,asia', 'Skyline live.'),
  ('Auckland — Harbour', 'Auckland harbour / Sky Tower live.', 'youtube', 'youtube_live', 'search', 'auckland+live+cam', null, null, 174.7633, -36.8485, 'Waitemata Harbour', 'Auckland', 'New Zealand', null, 'city,skyline,oceania', 'Harbour skyline.'),

  -- ================= NON-YOUTUBE SOURCES (tos_reviewed=false) =================
  -- All 'other' rows are HIDDEN by RLS until cleared per docs/camera-tos-review.md.
  ('Rome — Colosseum (Skyline Webcams)', 'Colosseum live via Skyline Webcams portal.', 'other', 'webpage', 'direct', null, 'https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/colosseo.html', null, 12.4922, 41.8902, 'Colosseum', 'Rome', 'Italy', null, 'city,landmark,europe,third-party', 'Skyline Webcams — embedding requires their ToS/permission review.'),
  ('Venice — St Marks (Skyline Webcams)', 'St Marks Square via Skyline Webcams portal.', 'other', 'webpage', 'direct', null, 'https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/piazza-san-marco.html', null, 12.3388, 45.4342, 'Piazza San Marco', 'Venice', 'Italy', null, 'city,landmark,europe,third-party', 'Skyline Webcams — ToS/permission review required before enabling.'),
  ('New York — Times Square (EarthCam)', 'Times Square via EarthCam portal.', 'other', 'webpage', 'direct', null, 'https://www.earthcam.com/usa/newyork/timessquare/', null, -73.9857, 40.7570, 'Times Square', 'New York', 'United States', null, 'city,street,usa,third-party', 'EarthCam — hotlink/embed prohibited by ToS without a license; review required.'),
  ('Reykjavik — Windy Webcam', 'Reykjavik via Windy.com webcams (Windy/Windyty).', 'other', 'webpage', 'direct', null, 'https://www.windy.com/webcams', null, -21.9426, 64.1466, 'Reykjavik', 'Reykjavik', 'Iceland', null, 'city,europe,third-party', 'Windy webcams aggregate third-party feeds; per-cam licensing review required.'),
  ('Rio — Copacabana (WebcamTaxi)', 'Copacabana via WebcamTaxi aggregator.', 'other', 'webpage', 'direct', null, 'https://www.webcamtaxi.com/en/brazil/rio-de-janeiro/copacabana-beach.html', null, -43.1822, -22.9711, 'Copacabana', 'Rio de Janeiro', 'Brazil', null, 'city,beach,americas,third-party', 'WebcamTaxi aggregates YouTube/third-party cams; verify original source + ToS.'),
  ('New York — DOT Traffic Cam', 'NYC DOT traffic still-image/MJPEG camera (public).', 'other', 'mjpeg', 'direct', null, 'https://webcams.nyctmc.org/', null, -73.9860, 40.7560, 'Midtown Manhattan', 'New York', 'United States', null, 'city,traffic,usa,gov,third-party', 'NYC DOT/511 cams: public but usage terms + rate limits need review.'),
  ('Los Angeles — Caltrans Traffic (HLS)', 'Caltrans / district traffic camera, HLS stream (public DOT).', 'other', 'hls', 'direct', null, 'https://cwwp2.dot.ca.gov/vm/streamlist.htm', null, -118.2437, 34.0522, 'Downtown LA', 'Los Angeles', 'United States', null, 'city,traffic,usa,gov,third-party', 'Caltrans public feeds: confirm redistribution terms before embedding.')

) as v(
  title, descr, provider, stream_type, id_type, external_id,
  direct_url, direct_embed, lng, lat, location_name, city, country,
  conflict_slug, tags, note
)
left join conflicts co on co.slug = v.conflict_slug;
