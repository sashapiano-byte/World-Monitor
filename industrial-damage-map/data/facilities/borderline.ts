import { facility, incident, statusChange } from '../helpers';
import type { ClaimRecord, FacilityRecord, IncidentRecord, StatusChangeRecord } from '../types';

/**
 * FLAGGED BORDERLINE CATEGORIES.
 *
 * These sites are NOT industrial enterprises and are deliberately kept apart
 * from the headline counts. Per the brief they must never be blended into the
 * industrial dataset without their own category:
 *
 *   military_depot | arsenal | repair_base | airfield |
 *   electrical_substation | energy_infrastructure
 *
 * The analytics layer excludes every record with siteCategory !== 'industrial'
 * from "damaged industrial enterprises" totals. They are retained because
 * excluding them silently would make the exclusion invisible, and because
 * power-engineering plants and their captive CHP sit genuinely on the boundary.
 */

export const BORDERLINE_FACILITIES: FacilityRecord[] = [
  facility({
    id: 'f-michurinskaya-chp-belgorod',
    slug: 'michurinskaya-chp-belgorod',
    canonicalName: 'Michurinskaya CHP plant (serving Belenergomash-BZEM)',
    canonicalNameRu: 'Мичуринская ТЭЦ (энергоснабжение «Белэнергомаш-БЗЭМ»)',
    alternativeNames: ['Michurinskaya TETs', 'Мичуринская ТЭЦ'],
    legalEntity: 'Not independently established',
    parentCompany: 'Associated with Belenergomash-BZEM',
    industryId: 'energy_infrastructure',
    subindustry: 'Captive combined heat and power plant',
    siteCategory: 'energy_infrastructure',
    regionId: 'ru-bel',
    locality: 'Belgorod',
    publicAddress: 'Belgorod, Belgorod Oblast',
    latitude: 50.6167,
    longitude: 36.6,
    coordinatePrecision: 'locality_only',
    nameplateCapacity: 'Not published',
    description:
      'A combined heat and power plant that primarily supplies the production and administrative buildings of the Belenergomash-BZEM works, a manufacturer of equipment for power generation, oil and gas, petrochemical and nuclear industries.',
    inclusionRationale:
      'BORDERLINE. This is energy infrastructure, not an industrial enterprise — but it is a plant’s captive power supply, and strikes on it have knocked out civilian power and water in Belgorod. Kept in a flagged category and excluded from industrial totals.',
    tags: ['borderline', 'excluded-from-industrial-totals', 'civilian-utility-impact'],
  }),
  facility({
    id: 'f-engels-2-airbase',
    slug: 'engels-2-air-base',
    canonicalName: 'Engels-2 air base',
    canonicalNameRu: 'Аэродром Энгельс-2',
    alternativeNames: ['Engels air base'],
    legalEntity: 'Russian Armed Forces',
    parentCompany: 'Russian Ministry of Defence',
    industryId: 'energy_infrastructure',
    subindustry: 'Military airfield',
    siteCategory: 'airfield',
    regionId: 'ru-sar',
    locality: 'Engels',
    publicAddress: 'Engels, Saratov Oblast',
    latitude: 51.48,
    longitude: 46.21,
    coordinatePrecision: 'locality_only',
    nameplateCapacity: 'n/a',
    description: 'Military airfield.',
    inclusionRationale:
      'EXPLICITLY NOT AN INDUSTRIAL SITE. Retained as a single worked example of the exclusion rule, so that a reader can see the boundary being applied rather than inferring it. Coordinates are locality-level only and no site detail is recorded.',
    tags: ['borderline', 'excluded-from-industrial-totals', 'exclusion-example'],
  }),
  facility({
    id: 'f-engels-oil-facility',
    slug: 'engels-oil-facility',
    canonicalName: 'Unidentified oil facility, Engels',
    canonicalNameRu: 'Неустановленный нефтяной объект, Энгельс',
    alternativeNames: ['Engels oil refinery (as described in reporting)'],
    legalEntity: 'Not established',
    parentCompany: 'Not established',
    industryId: 'oil_gas_storage',
    subindustry: 'Unidentified',
    regionId: 'ru-sar',
    locality: 'Engels',
    publicAddress: 'Engels, Saratov Oblast',
    latitude: 51.48,
    longitude: 46.13,
    coordinatePrecision: 'locality_only',
    nameplateCapacity: 'Not established',
    description:
      'Reporting describes "the Engels oil refinery" as ablaze after a June 2025 drone attack. This project could not establish which facility that refers to — Engels is adjacent to Saratov and its refinery, and several fuel-handling sites exist in the area.',
    inclusionRationale:
      'UNRESOLVED IDENTITY. Kept as an explicitly unidentified record rather than being silently merged into the Saratov refinery card, which would have manufactured a false attribution.',
    tags: ['identity-unresolved', 'low-confidence', 'do-not-merge-without-evidence'],
  }),
];

export const BORDERLINE_INCIDENTS: IncidentRecord[] = [
  incident({
    id: 'i-michurinskaya-2026-07-03',
    facilityId: 'f-michurinskaya-chp-belgorod',
    incidentDate: '2026-07-03',
    attackMethod: 'ballistic_missile',
    methodConfidence: 'low',
    fireConfirmed: null,
    physicalDamageScore: 3,
    casualtiesKilled: 1,
    damageSummary:
      'A missile strike on the electrical substation of the Michurinskaya CHP plant. Belgorod lost power and water supply; one death was reported. Reporting notes the plant had been struck before, including in February 2026, when it was said to have sustained significant damage and been temporarily taken out of operation.',
    damagedAssets: ['Electrical substation of the CHP plant'],
    operationalEffect: 'Power and water supply to Belgorod interrupted.',
    downtimeDays: null,
    confidence: 60,
    verificationStatus: 'corroborated',
    claimedBy: 'ukraine_official',
    sourceIds: ['s-militarnyi-michurinskaya-chp', 's-euromaidan-belgorod-gas-turbine'],
    established: ['The substation was struck.', 'Civilian power and water supply were interrupted.', 'One death was reported.'],
    unresolved: [
      'The munition type — "missile strike" is asserted without specification, so ballistic is recorded at LOW confidence.',
      'Damage to the CHP plant itself as distinct from the substation.',
    ],
  }),
  incident({
    id: 'i-engels-airbase-2026-07-15',
    facilityId: 'f-engels-2-airbase',
    incidentDate: '2026-07-15',
    attackMethod: 'uav',
    methodConfidence: 'medium',
    fireConfirmed: true,
    physicalDamageScore: 0,
    damageSummary:
      'A fire was reported at the air base after a drone attack. NO DAMAGE ASSESSMENT IS RECORDED: this is a military airfield, outside the scope of this project, and the record exists only to document the exclusion.',
    damagedAssets: [],
    operationalEffect: 'Out of scope — not assessed.',
    downtimeDays: null,
    confidence: 40,
    verificationStatus: 'corroborated',
    claimedBy: 'ukraine_official',
    sourceIds: ['s-kyivpost-engels-air-base'],
    established: ['A fire was reported.'],
    unresolved: ['Deliberately not investigated — out of scope.'],
  }),
  incident({
    id: 'i-engels-oil-2025-06-06',
    facilityId: 'f-engels-oil-facility',
    incidentDate: '2025-06-06',
    attackMethod: 'uav',
    methodConfidence: 'medium',
    fireConfirmed: true,
    physicalDamageScore: 0,
    damageSummary:
      'An oil facility described in reporting as "the Engels oil refinery" was ablaze after an overnight drone attack. The facility could not be identified with confidence.',
    damagedAssets: [],
    operationalEffect: 'Not established.',
    downtimeDays: null,
    confidence: 38,
    verificationStatus: 'unconfirmed',
    claimedBy: 'ukraine_official',
    sourceIds: ['s-kyivindependent-engels-refinery-fire'],
    established: ['A fire occurred at an oil facility in Engels.'],
    unresolved: ['WHICH FACILITY. Identity unresolved; deliberately not merged with the Saratov refinery record.'],
  }),
];

export const BORDERLINE_STATUS: StatusChangeRecord[] = [
  statusChange({
    id: 'st-michurinskaya-2026-07-03',
    facilityId: 'f-michurinskaya-chp-belgorod',
    incidentId: 'i-michurinskaya-2026-07-03',
    status: 'temporarily_suspended',
    statusDate: '2026-07-03',
    evidenceType: 'media_reporting',
    determination: 'analytical_assessment',
    confidence: 50,
    notes: 'Inferred from the reported loss of city power and water supply.',
    sourceIds: ['s-euromaidan-belgorod-gas-turbine'],
  }),
];

export const BORDERLINE_CLAIMS: ClaimRecord[] = [
  {
    id: 'c-michurinskaya-utility-loss',
    sourceId: 's-euromaidan-belgorod-gas-turbine',
    facilityId: 'f-michurinskaya-chp-belgorod',
    incidentId: 'i-michurinskaya-2026-07-03',
    claimType: 'physical_damage',
    claimText: 'Belgorod lost power and water supply following the strike on the gas-turbine/CHP installation; one person was killed.',
    stance: 'supports',
    confidence: 60,
  },
  {
    id: 'c-engels-identity-unresolved',
    sourceId: 's-kyivindependent-engels-refinery-fire',
    facilityId: 'f-engels-oil-facility',
    incidentId: 'i-engels-oil-2025-06-06',
    claimType: 'facility_identity',
    claimText:
      'Reporting refers to "Russia’s Engels oil refinery" without naming a legal entity or address, leaving the facility unidentified.',
    stance: 'context',
    confidence: 35,
  },
];
