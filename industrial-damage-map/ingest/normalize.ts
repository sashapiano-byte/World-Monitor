import type { FacilityRecord } from '@/data/types';

/**
 * Facility-name normalisation and matching.
 *
 * Step 2 and 3 of the ingestion workflow: turn whatever a headline calls a
 * plant into something comparable, then try to match it to an existing card.
 * The matcher is deliberately conservative — a wrong match silently attaches an
 * incident to the wrong enterprise, which is worse than no match at all.
 */

const LEGAL_FORMS = /\b(ooo|oao|zao|pao|ao|fkp|gup|fgup|llc|jsc|pjsc|plc|inc|group|holding)\b/g;
const GENERIC_TERMS =
  /\b(refinery|refineries|npz|oil|petroleum|plant|works|factory|zavod|complex|combine|kombinat|terminal|depot|facility|enterprise|company)\b/g;

export function normaliseFacilityName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[«»"'’“”(),.–—-]/g, ' ')
    .replace(LEGAL_FORMS, ' ')
    .replace(GENERIC_TERMS, ' ')
    .replace(/[^a-z0-9а-яё ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token-overlap similarity in [0, 1]. */
export function similarity(a: string, b: string): number {
  const ta = new Set(normaliseFacilityName(a).split(' ').filter(Boolean));
  const tb = new Set(normaliseFacilityName(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  return shared / Math.max(ta.size, tb.size);
}

export interface MatchResult {
  facilityId: string | null;
  score: number;
  /** Other candidates above the ambiguity floor, if any. */
  runnersUp: { facilityId: string; score: number }[];
}

/**
 * Match a detected name to an existing facility card.
 *
 * Returns no match when the best candidate is weak, and also when two
 * candidates are too close to separate — an ambiguous match must go to a human,
 * not to whichever record happened to sort first.
 */
export function matchFacility(
  detectedName: string,
  facilities: FacilityRecord[],
  { threshold = 0.6, ambiguityMargin = 0.12 }: { threshold?: number; ambiguityMargin?: number } = {},
): MatchResult {
  const scored = facilities
    .map((f) => ({
      facilityId: f.id,
      score: Math.max(
        similarity(detectedName, f.canonicalName),
        similarity(detectedName, f.canonicalNameRu),
        ...f.alternativeNames.map((alt) => similarity(detectedName, alt)),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < threshold) {
    return { facilityId: null, score: best?.score ?? 0, runnersUp: [] };
  }
  if (second && best.score - second.score < ambiguityMargin) {
    return {
      facilityId: null,
      score: best.score,
      runnersUp: scored.filter((s) => s.score >= threshold).slice(0, 4),
    };
  }
  return { facilityId: best.facilityId, score: best.score, runnersUp: [] };
}

/**
 * Method detection patterns.
 *
 * NOTE ON `\b`: JavaScript's word boundary is ASCII-only, so `\bбпла` never
 * matches — the boundary between a space and a Cyrillic letter is not a word
 * boundary. Latin terms keep `\b` to avoid matching inside longer words;
 * Cyrillic stems are matched without one, which is safe because the stems are
 * distinctive.
 */
const METHOD_PATTERNS: [RegExp, string][] = [
  [/\b(?:drone|uav|unmanned aerial)|бпла|дрон|безпілотн/i, 'uav'],
  [/\bcruise missile|крилат|крылат/i, 'cruise_missile'],
  [/\bballistic\b|балістичн|баллистическ/i, 'ballistic_missile'],
  [/\b(?:sabotage|diversion)\b|диверси/i, 'sabotage'],
  [/\b(?:shelling|artillery)\b|обстрел|обстріл/i, 'shelling'],
  [/\b(?:naval drone|usv)\b|морськ|морск/i, 'naval_drone'],
];

export function detectMethod(text: string): string | null {
  for (const [pattern, method] of METHOD_PATTERNS) {
    if (pattern.test(text)) return method;
  }
  return null;
}

/**
 * Extract a probable incident date from free text.
 * Returns null rather than guessing — a wrong date is worse than no date, and
 * the review queue is designed to hold dateless candidates indefinitely.
 */
export function detectDate(text: string, fallbackIso?: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const months = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  const named = text
    .toLowerCase()
    .match(/\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
  if (named) {
    const year = fallbackIso?.slice(0, 4) ?? String(new Date().getUTCFullYear());
    const month = String(months.indexOf(named[2]) + 1).padStart(2, '0');
    const day = named[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}
