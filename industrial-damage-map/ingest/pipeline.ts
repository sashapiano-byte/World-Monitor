import type { FacilityRecord, ReviewQueueItem } from '@/data/types';
import type { Candidate } from './feeds';
import { detectDate, detectMethod, matchFacility } from './normalize';

/**
 * The candidate-intake pipeline (METHODOLOGY.md §12).
 *
 *   1. detection            → 2. name normalisation → 3. facility matching
 *   4. detail extraction    → 5. corroboration      → 6. imagery check
 *   7. confidence assigned  → 8. MANUAL APPROVAL    → 9. publication
 *   10. re-check at 7, 30, 90 and 180 days
 *
 * Steps 1–7 are automated. Step 8 is not, and cannot be: this module has no way
 * to mark anything published. The database enforces the same rule with a CHECK
 * constraint requiring a named approver.
 */

export const EMBARGO_HOURS_FLOOR = 72;
export const RECHECK_DAYS = [7, 30, 90, 180] as const;

/** Terms that suggest an item is about industrial damage at all. */
const RELEVANCE_TERMS = [
  'refinery',
  'refineries',
  'plant',
  'factory',
  'depot',
  'terminal',
  'warehouse',
  'petrochemical',
  'chemical',
  'metallurg',
  'shipyard',
  'нпз',
  'завод',
  'нефтебаз',
  'комбинат',
  'склад',
];

const DAMAGE_TERMS = [
  'damage',
  'fire',
  'blaze',
  'struck',
  'hit',
  'halted',
  'suspended',
  'shut',
  'explosion',
  'пожар',
  'поврежд',
  'удар',
  'зупин',
  'пошкодж',
];

export interface PipelineOptions {
  /** ISO date used as "now" for the embargo test. */
  asOf: string;
  facilities: FacilityRecord[];
  /** Minimum age in hours before an item may even be reviewed. Floor is 72. */
  minAgeHours?: number;
  /** Candidate URLs already in the queue or already published. */
  knownUrls?: Set<string>;
}

export interface PipelineResult {
  accepted: ReviewQueueItem[];
  /** Items dropped before reaching the queue, with the reason. */
  discarded: { candidate: Candidate; reason: string }[];
}

export function runPipeline(candidates: Candidate[], options: PipelineOptions): PipelineResult {
  const minAgeHours = Math.max(options.minAgeHours ?? EMBARGO_HOURS_FLOOR, EMBARGO_HOURS_FLOOR);
  const known = options.knownUrls ?? new Set<string>();
  const accepted: ReviewQueueItem[] = [];
  const discarded: { candidate: Candidate; reason: string }[] = [];

  for (const candidate of candidates) {
    const text = `${candidate.headline} ${candidate.summary}`.toLowerCase();

    if (!candidate.url || !/^https?:\/\//.test(candidate.url)) {
      discarded.push({ candidate, reason: 'no usable URL' });
      continue;
    }
    if (known.has(candidate.url)) {
      discarded.push({ candidate, reason: 'already known' });
      continue;
    }
    if (!RELEVANCE_TERMS.some((t) => text.includes(t))) {
      discarded.push({ candidate, reason: 'no industrial-facility term' });
      continue;
    }
    if (!DAMAGE_TERMS.some((t) => text.includes(t))) {
      discarded.push({ candidate, reason: 'no damage term' });
      continue;
    }

    const detectedDate = detectDate(text, candidate.publishedAt ?? undefined) ?? candidate.publishedAt;
    const detectedMethod = detectMethod(text);
    const detectedName = extractFacilityName(candidate.headline);
    const match = detectedName ? matchFacility(detectedName, options.facilities) : null;

    const ageHours = detectedDate ? hoursBetween(detectedDate, options.asOf) : null;
    const embargoed = ageHours != null && ageHours < minAgeHours;

    let stage: ReviewQueueItem['stage'] = 'detected';
    let blockedReason: string | null = null;

    if (embargoed) {
      blockedReason = `EMBARGOED: incident is less than ${minAgeHours} hours old. Earliest review date ${addDays(
        detectedDate!,
        Math.ceil(minAgeHours / 24),
      )}.`;
    } else if (!detectedDate) {
      stage = 'name_normalised';
      blockedReason = 'No incident date could be extracted. A published record may not carry a placeholder date.';
    } else if (match?.facilityId) {
      stage = 'facility_matched';
      blockedReason = 'Awaiting corroboration: a second independent source or dated imagery is required.';
    } else if (match && match.runnersUp.length > 1) {
      stage = 'name_normalised';
      blockedReason = `Ambiguous facility match between ${match.runnersUp
        .map((r) => r.facilityId)
        .join(', ')}. A human must resolve this — a wrong match attaches damage to the wrong enterprise.`;
    } else {
      stage = 'details_extracted';
      blockedReason = 'No existing facility card matched. A new card must be created and justified by an editor.';
    }

    accepted.push({
      id: `q-${slugify(candidate.headline).slice(0, 48)}-${options.asOf}`,
      discoveredAt: options.asOf,
      headline: candidate.headline,
      url: candidate.url,
      publisher: candidate.publisher,
      detectedFacilityName: detectedName,
      matchedFacilityId: match?.facilityId ?? null,
      detectedDate,
      detectedMethod: (detectedMethod as ReviewQueueItem['detectedMethod']) ?? null,
      stage,
      blockedReason,
      notes:
        'Automatically discovered. NOT published. Requires a named editor to approve before it can appear anywhere.',
    });
  }

  return { accepted, discarded };
}

/** Dates on which a published record should be re-checked. */
export function recheckSchedule(incidentDate: string): string[] {
  return RECHECK_DAYS.map((days) => addDays(incidentDate, days));
}

function extractFacilityName(headline: string): string | null {
  // Prefer a quoted or capitalised run immediately before an industrial noun.
  const m = headline.match(
    /([A-ZА-ЯЁ][\w'’-]*(?:\s+[A-ZА-ЯЁ][\w'’-]*){0,3})\s+(refinery|plant|works|terminal|depot|shipyard|combine|warehouse)/,
  );
  if (m) return `${m[1]} ${m[2]}`;
  const words = headline.split(/\s+/).filter((w) => /^[A-ZА-ЯЁ]/.test(w));
  return words.length ? words.slice(0, 4).join(' ') : null;
}

function hoursBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 3_600_000;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
