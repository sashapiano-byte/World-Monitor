import type { ReviewQueueItem } from './types';

/**
 * Manual review queue.
 *
 * Everything the ingestion module surfaces lands here. NOTHING in this file is
 * rendered on the map, counted in the dashboard, or included in exports of
 * published data. Items advance through the workflow in METHODOLOGY.md §18 and
 * are published only after an editor approves them.
 *
 * Two hard gates are enforced in code (see lib/qc.ts):
 *   1. An item younger than 72 hours cannot be reviewed at all.
 *   2. An item cannot reach `published` without meeting the source-count rule.
 */
export const REVIEW_QUEUE: ReviewQueueItem[] = [
  {
    id: 'q-wb-penza-udmurtia-2026-07-30',
    discoveredAt: '2026-07-30',
    headline: 'Ukraine Ramps Up Campaign Against Wildberries, Striking Warehouses in Penza and Udmurtia',
    url: 'https://www.themoscowtimes.com/2026/07/30/ukraine-ramps-up-campaign-against-wildberries-striking-warehouses-in-penza-and-udmurtia-a93375',
    publisher: 'The Moscow Times',
    detectedFacilityName: 'Wildberries warehouses, Penza and Udmurtia',
    matchedFacilityId: null,
    detectedDate: '2026-07-30',
    detectedMethod: 'uav',
    stage: 'detected',
    blockedReason: 'EMBARGOED: incident is less than 72 hours old. Earliest review date 2026-08-02.',
    notes:
      'Two new facility cards would be required (Penza, Udmurtia). Held under the 72-hour rule — this is exactly the case the rule exists for.',
  },
  {
    id: 'q-wb-yekaterinburg-2026-07-25',
    discoveredAt: '2026-07-26',
    headline: '571 Drones, Fires and Flight Delays: Ukraine Strikes Wildberries Hubs Again',
    url: 'https://www.kyivpost.com/post/80959',
    publisher: 'Kyiv Post',
    detectedFacilityName: 'Wildberries warehouse, Yekaterinburg',
    matchedFacilityId: null,
    detectedDate: '2026-07-25',
    detectedMethod: 'uav',
    stage: 'corroboration_sought',
    blockedReason:
      'Only one tier-C source describes the site, and it says a "parking lot was hit". Insufficient for publication under the source rule.',
    notes:
      'A car park is not an industrial production asset. Even with corroboration this may end up scored 1 or excluded outright.',
  },
  {
    id: 'q-wb-nechayevka-2026-07-23',
    discoveredAt: '2026-07-24',
    headline: 'Wildberries site, Nechayevka, Voronezh Oblast reported struck',
    url: 'https://en.wikipedia.org/wiki/Ukrainian_strikes_on_Wildberries_warehouses',
    publisher: 'Wikipedia (aggregator)',
    detectedFacilityName: 'Wildberries site, Nechayevka',
    matchedFacilityId: null,
    detectedDate: '2026-07-23',
    detectedMethod: 'uav',
    stage: 'corroboration_sought',
    blockedReason: 'Aggregator-only. No tier-A or tier-B source located describing damage at this site.',
    notes: 'Tier-C aggregators cannot carry a damage claim on their own (SOURCES_POLICY.md).',
  },
  {
    id: 'q-wb-tyushevo-2026-07-29',
    discoveredAt: '2026-07-30',
    headline: 'Wildberries site, Tyushevo, Ryazan Oblast reported struck',
    url: 'https://en.wikipedia.org/wiki/Ukrainian_strikes_on_Wildberries_warehouses',
    publisher: 'Wikipedia (aggregator)',
    detectedFacilityName: 'Wildberries site, Tyushevo',
    matchedFacilityId: null,
    detectedDate: '2026-07-29',
    detectedMethod: 'uav',
    stage: 'detected',
    blockedReason: 'EMBARGOED: less than 72 hours old, AND aggregator-only sourcing.',
    notes: 'Blocked on two independent grounds.',
  },
  {
    id: 'q-cherkassy-lpds-2026-07-08',
    discoveredAt: '2026-07-28',
    headline: 'Cherkassy LPDS, Bashkortostan and Bashkortostan oil pumping station reported struck',
    url: 'https://boereport.com/2026/07/27/ukraines-attacks-on-russian-energy-sites-what-has-been-hit/',
    publisher: 'Reuters (via BOE Report)',
    detectedFacilityName: 'Cherkassy LPDS / Bashkortostan oil pumping station',
    matchedFacilityId: null,
    detectedDate: '2026-07-08',
    detectedMethod: 'uav',
    stage: 'facility_matched',
    blockedReason:
      'Facility identity ambiguous: the factbox lists what may be one site under two descriptions. Needs address-level resolution before a card is created.',
    notes:
      'Creating two cards for one site would inflate the facility count. Deliberately held rather than guessed — this is the duplicate-prevention rule working.',
  },
  {
    id: 'q-tikhoretsk-2026-03',
    discoveredAt: '2026-07-28',
    headline: 'Tikhoretsk oil pumping station reported struck, March 2026',
    url: 'https://en.wikipedia.org/wiki/Deep_strike_campaign',
    publisher: 'Wikipedia (aggregator)',
    detectedFacilityName: 'Tikhoretsk oil pumping station',
    matchedFacilityId: null,
    detectedDate: null,
    detectedMethod: 'uav',
    stage: 'details_extracted',
    blockedReason: 'No exact date and no tier-A/B damage description located.',
    notes: 'Would need a specific date before an incident record can be created; placeholder dates are not permitted for published records.',
  },
  {
    id: 'q-yugnefteprodukt-2026-07',
    discoveredAt: '2026-07-28',
    headline: 'Yugnefteprodukt oil depot, Stavropol Krai reported hit multiple times',
    url: 'https://en.wikipedia.org/wiki/Deep_strike_campaign',
    publisher: 'Wikipedia (aggregator)',
    detectedFacilityName: 'Yugnefteprodukt oil depot',
    matchedFacilityId: null,
    detectedDate: null,
    detectedMethod: 'uav',
    stage: 'details_extracted',
    blockedReason: 'Multiple undated strikes reported by an aggregator only.',
    notes: '"Hit multiple times" cannot be turned into discrete incident records without dates.',
  },
  {
    id: 'q-taganrog-terminal-2026-07',
    discoveredAt: '2026-07-28',
    headline: 'Taganrog oil terminal, Rostov Oblast reported struck July 2026',
    url: 'https://en.wikipedia.org/wiki/Deep_strike_campaign',
    publisher: 'Wikipedia (aggregator)',
    detectedFacilityName: 'Taganrog oil terminal',
    matchedFacilityId: null,
    detectedDate: null,
    detectedMethod: 'uav',
    stage: 'details_extracted',
    blockedReason: 'Aggregator-only, undated.',
    notes: 'Candidate for the next research pass.',
  },
  {
    id: 'q-rostvertol-2026',
    discoveredAt: '2026-07-29',
    headline: 'Reports of strikes on aviation-industry sites in Taganrog and Rostov-on-Don',
    url: 'https://militarnyi.com/en/news/drones-strike-aviation-and-space-components-plant-in-arzamas/',
    publisher: 'Militarnyi',
    detectedFacilityName: 'Taganrog aviation sites / Rostvertol',
    matchedFacilityId: null,
    detectedDate: null,
    detectedMethod: null,
    stage: 'name_normalised',
    blockedReason:
      'Reporting conflates several distinct Taganrog enterprises (a drone plant, the Beriev aviation works, a metallurgical plant). Cannot be resolved to a facility.',
    notes: 'Named as a data gap in the final report. Requires Russian-language primary sourcing to disentangle.',
  },
  {
    id: 'q-petersburg-oil-terminal',
    discoveredAt: '2026-07-28',
    headline: 'Petersburg Oil Terminal reported struck Jan 2024 and June–July 2026',
    url: 'https://en.wikipedia.org/wiki/Deep_strike_campaign',
    publisher: 'Wikipedia (aggregator)',
    detectedFacilityName: 'Petersburg Oil Terminal',
    matchedFacilityId: null,
    detectedDate: null,
    detectedMethod: 'uav',
    stage: 'details_extracted',
    blockedReason: 'Aggregator-only; no dated tier-A/B damage reporting located.',
    notes: 'High-value candidate — a large terminal inside a major city. Priority for the next pass.',
  },
];
