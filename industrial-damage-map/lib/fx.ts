/**
 * Currency handling.
 *
 * Every monetary figure in this project is presented three ways:
 *   1. the ORIGINAL currency as published;
 *   2. USD at the rate in force on the incident date;
 *   3. USD in constant prices of the last complete year.
 *
 * The rate table below is a documented, editable approximation — annual average
 * RUB/USD rates. It is deliberately coarse and deliberately visible: a reader
 * must be able to see exactly what conversion was applied. Where a source
 * already published its own USD figure we keep the source's number and mark it,
 * rather than re-deriving one.
 */

/** Last complete calendar year used as the constant-price base. */
export const CONSTANT_PRICE_BASE_YEAR = 2025;

/**
 * Approximate annual average RUB per 1 USD.
 * These are round working values, not central-bank fixings. Replace with a
 * proper daily series before using this project for any financial purpose.
 */
export const RUB_PER_USD_BY_YEAR: Record<number, number> = {
  2022: 68,
  2023: 85,
  2024: 92,
  2025: 84,
  2026: 78,
};

/** Approximate annual average EUR per 1 USD (i.e. USD = EUR / rate). */
export const USD_PER_EUR_BY_YEAR: Record<number, number> = {
  2022: 1.05,
  2023: 1.08,
  2024: 1.08,
  2025: 1.1,
  2026: 1.12,
};

/**
 * US CPI-style deflator used to express past USD amounts in base-year prices.
 * Coarse annual factors; documented so the arithmetic is auditable.
 */
export const USD_DEFLATOR_TO_BASE: Record<number, number> = {
  2022: 1.09,
  2023: 1.05,
  2024: 1.02,
  2025: 1.0,
  2026: 0.98,
};

export function yearOf(isoDate: string): number {
  return Number.parseInt(isoDate.slice(0, 4), 10);
}

function rateFor<T extends Record<number, number>>(table: T, year: number, fallbackYear: number): number {
  return table[year] ?? table[fallbackYear] ?? 1;
}

/** Convert an amount in `currency` to USD at the rate for `isoDate`. */
export function toUsdAtDate(amount: number, currency: 'RUB' | 'USD' | 'EUR', isoDate: string): number {
  const year = yearOf(isoDate);
  if (currency === 'USD') return amount;
  if (currency === 'RUB') return amount / rateFor(RUB_PER_USD_BY_YEAR, year, CONSTANT_PRICE_BASE_YEAR);
  return amount * rateFor(USD_PER_EUR_BY_YEAR, year, CONSTANT_PRICE_BASE_YEAR);
}

/** Express a USD amount from `isoDate` in constant base-year prices. */
export function toConstantUsd(usdAmount: number, isoDate: string): number {
  const year = yearOf(isoDate);
  return usdAmount * (USD_DEFLATOR_TO_BASE[year] ?? 1);
}

export interface ConvertedRange {
  original: { min: number | null; max: number | null; currency: string };
  usdAtDate: { min: number | null; max: number | null };
  usdConstant: { min: number | null; max: number | null; baseYear: number };
  /** True when the USD values were taken from the source rather than computed. */
  usdFromSource: boolean;
}

/**
 * Produce the three-way presentation for one min/max pair.
 * If the record already carries source-published USD values, those win —
 * re-deriving them would quietly overwrite a publisher's own figure.
 */
export function presentRange(params: {
  min: number | null | undefined;
  max: number | null | undefined;
  currency: 'RUB' | 'USD' | 'EUR';
  date: string | null;
  sourceUsdMin?: number | null;
  sourceUsdMax?: number | null;
}): ConvertedRange {
  const { min = null, max = null, currency, date } = params;
  const effectiveDate = date ?? `${CONSTANT_PRICE_BASE_YEAR}-01-01`;

  const usdFromSource = params.sourceUsdMin != null || params.sourceUsdMax != null;
  const usdMin = usdFromSource
    ? (params.sourceUsdMin ?? null)
    : min != null
      ? toUsdAtDate(min, currency, effectiveDate)
      : null;
  const usdMax = usdFromSource
    ? (params.sourceUsdMax ?? null)
    : max != null
      ? toUsdAtDate(max, currency, effectiveDate)
      : null;

  return {
    original: { min: min ?? null, max: max ?? null, currency },
    usdAtDate: { min: usdMin, max: usdMax },
    usdConstant: {
      min: usdMin != null ? toConstantUsd(usdMin, effectiveDate) : null,
      max: usdMax != null ? toConstantUsd(usdMax, effectiveDate) : null,
      baseYear: CONSTANT_PRICE_BASE_YEAR,
    },
    usdFromSource,
  };
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

export function formatMoney(value: number | null, currency: string): string {
  if (value == null) return '—';
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₽';
  return `${symbol}${compact.format(value)}`;
}

export function formatRange(min: number | null, max: number | null, currency: string): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null && min === max) return formatMoney(min, currency);
  return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}
