import type { IndustryRecord, RegionRecord } from './types';

/**
 * Industry taxonomy. Colours are the map marker palette — chosen to stay
 * distinguishable in both light and dark themes and for common colour-vision
 * deficiencies (no red/green-only pairs carry meaning; shape encodes status).
 */
export const INDUSTRIES: IndustryRecord[] = [
  { id: 'oil_refining', name: 'Oil refining', nameRu: 'Нефтепереработка', color: '#1f6feb', sortOrder: 10 },
  { id: 'oil_gas_storage', name: 'Oil depots & terminals', nameRu: 'Нефтебазы и терминалы', color: '#3fb950', sortOrder: 20 },
  { id: 'ports_export', name: 'Ports & export terminals', nameRu: 'Порты и экспортные терминалы', color: '#1f9c9c', sortOrder: 30 },
  { id: 'pipeline_infrastructure', name: 'Pipeline pumping & dispatch', nameRu: 'Трубопроводные НПС и ЛПДС', color: '#7d8590', sortOrder: 40 },
  { id: 'gas_processing', name: 'Gas processing & petrochemicals', nameRu: 'Газопереработка и нефтехимия', color: '#a371f7', sortOrder: 50 },
  { id: 'chemicals', name: 'Chemical industry', nameRu: 'Химическая промышленность', color: '#db61a2', sortOrder: 60 },
  { id: 'metallurgy', name: 'Metallurgy', nameRu: 'Металлургия', color: '#bf8700', sortOrder: 70 },
  { id: 'machine_building', name: 'Machine building', nameRu: 'Машиностроение', color: '#e3742f', sortOrder: 80 },
  { id: 'defence_industry', name: 'Defence industry', nameRu: 'Оборонная промышленность', color: '#cf222e', sortOrder: 90 },
  { id: 'electronics', name: 'Electronics & instruments', nameRu: 'Электроника и приборостроение', color: '#8250df', sortOrder: 100 },
  { id: 'aviation_space', name: 'Aviation & space', nameRu: 'Авиационная и космическая отрасль', color: '#0969da', sortOrder: 110 },
  { id: 'shipbuilding', name: 'Shipbuilding & ship repair', nameRu: 'Судостроение и судоремонт', color: '#1a7f37', sortOrder: 120 },
  { id: 'logistics_warehousing', name: 'Logistics & warehousing', nameRu: 'Логистика и склады', color: '#6e7781', sortOrder: 130 },
  { id: 'food_industry', name: 'Food & beverage industry', nameRu: 'Пищевая промышленность', color: '#9a6700', sortOrder: 140 },
  { id: 'power_equipment', name: 'Power engineering equipment', nameRu: 'Энергетическое машиностроение', color: '#57606a', sortOrder: 150 },
  { id: 'energy_infrastructure', name: 'Energy infrastructure (flagged)', nameRu: 'Энергетическая инфраструктура (помечено)', color: '#4d4d4d', sortOrder: 900 },
];

/**
 * Federal subjects touched by the dataset.
 *
 * `territoryStatus` records the internationally recognised status of the
 * territory. Crimea and Sevastopol are internationally recognised as Ukrainian
 * and are rendered as a SEPARATE map layer; they are never silently merged into
 * "the Russian Federation" totals. See SECURITY_AND_ETHICS.md §Territory.
 */
export const REGIONS: RegionRecord[] = [
  { id: 'ru-mow', name: 'Moscow (federal city)', nameRu: 'Москва', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-mos', name: 'Moscow Oblast', nameRu: 'Московская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-rya', name: 'Ryazan Oblast', nameRu: 'Рязанская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-yar', name: 'Yaroslavl Oblast', nameRu: 'Ярославская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-lip', name: 'Lipetsk Oblast', nameRu: 'Липецкая область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-tam', name: 'Tambov Oblast', nameRu: 'Тамбовская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-tul', name: 'Tula Oblast', nameRu: 'Тульская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-bry', name: 'Bryansk Oblast', nameRu: 'Брянская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-bel', name: 'Belgorod Oblast', nameRu: 'Белгородская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-kur', name: 'Kursk Oblast', nameRu: 'Курская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-vor', name: 'Voronezh Oblast', nameRu: 'Воронежская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-vla', name: 'Vladimir Oblast', nameRu: 'Владимирская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-tve', name: 'Tver Oblast', nameRu: 'Тверская область', federalDistrict: 'Central', territoryStatus: 'internationally_recognised_russia' },

  { id: 'ru-spe', name: 'Saint Petersburg (federal city)', nameRu: 'Санкт-Петербург', federalDistrict: 'Northwestern', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-len', name: 'Leningrad Oblast', nameRu: 'Ленинградская область', federalDistrict: 'Northwestern', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-kom', name: 'Komi Republic', nameRu: 'Республика Коми', federalDistrict: 'Northwestern', territoryStatus: 'internationally_recognised_russia' },

  { id: 'ru-kda', name: 'Krasnodar Krai', nameRu: 'Краснодарский край', federalDistrict: 'Southern', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-ros', name: 'Rostov Oblast', nameRu: 'Ростовская область', federalDistrict: 'Southern', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-vgg', name: 'Volgograd Oblast', nameRu: 'Волгоградская область', federalDistrict: 'Southern', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-ast', name: 'Astrakhan Oblast', nameRu: 'Астраханская область', federalDistrict: 'Southern', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-ad', name: 'Republic of Adygea', nameRu: 'Республика Адыгея', federalDistrict: 'Southern', territoryStatus: 'internationally_recognised_russia' },

  { id: 'ru-sta', name: 'Stavropol Krai', nameRu: 'Ставропольский край', federalDistrict: 'North Caucasian', territoryStatus: 'internationally_recognised_russia' },

  { id: 'ru-sam', name: 'Samara Oblast', nameRu: 'Самарская область', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-sar', name: 'Saratov Oblast', nameRu: 'Саратовская область', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-niz', name: 'Nizhny Novgorod Oblast', nameRu: 'Нижегородская область', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-ta', name: 'Republic of Tatarstan', nameRu: 'Республика Татарстан', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-ba', name: 'Republic of Bashkortostan', nameRu: 'Республика Башкортостан', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-cu', name: 'Chuvash Republic', nameRu: 'Чувашская Республика', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-ud', name: 'Udmurt Republic', nameRu: 'Удмуртская Республика', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-per', name: 'Perm Krai', nameRu: 'Пермский край', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-ore', name: 'Orenburg Oblast', nameRu: 'Оренбургская область', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-kir', name: 'Kirov Oblast', nameRu: 'Кировская область', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-pnz', name: 'Penza Oblast', nameRu: 'Пензенская область', federalDistrict: 'Volga', territoryStatus: 'internationally_recognised_russia' },

  { id: 'ru-sve', name: 'Sverdlovsk Oblast', nameRu: 'Свердловская область', federalDistrict: 'Ural', territoryStatus: 'internationally_recognised_russia' },
  { id: 'ru-tyu', name: 'Tyumen Oblast', nameRu: 'Тюменская область', federalDistrict: 'Ural', territoryStatus: 'internationally_recognised_russia' },

  { id: 'ru-oms', name: 'Omsk Oblast', nameRu: 'Омская область', federalDistrict: 'Siberian', territoryStatus: 'internationally_recognised_russia' },

  // Internationally recognised as Ukraine; under Russian occupation since 2014.
  { id: 'ua-crimea', name: 'Crimea (occupied; internationally recognised as Ukraine)', nameRu: 'Крым (оккупирован; международно признан частью Украины)', federalDistrict: '—', territoryStatus: 'occupied_ukraine_internationally_recognised_as_ukraine' },
  { id: 'ua-sevastopol', name: 'Sevastopol (occupied; internationally recognised as Ukraine)', nameRu: 'Севастополь (оккупирован; международно признан частью Украины)', federalDistrict: '—', territoryStatus: 'occupied_ukraine_internationally_recognised_as_ukraine' },
];

export const INDUSTRY_BY_ID = new Map(INDUSTRIES.map((i) => [i.id, i]));
export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));
