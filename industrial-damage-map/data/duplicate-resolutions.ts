/**
 * Resolved duplicate-candidate pairs.
 *
 * The QC engine flags any two facilities whose normalised names collide or that
 * sit within ~2 km of each other. Every flag must end up here with a decision,
 * so that "we looked and they are different" is recorded rather than left as a
 * permanent warning nobody reads.
 *
 * `resolution`:
 *   distinct — investigated; genuinely separate enterprises. Warning suppressed.
 *   merged   — they were the same site; one card was removed.
 *   open     — still under investigation. Warning stays visible.
 */
export interface DuplicateResolution {
  facilityId: string;
  otherFacilityId: string;
  resolution: 'distinct' | 'merged' | 'open';
  rationale: string;
  resolvedAt: string | null;
}

export const DUPLICATE_RESOLUTIONS: DuplicateResolution[] = [
  {
    facilityId: 'f-nevinnomyssk-azot',
    otherFacilityId: 'f-wb-nevinnomyssk',
    resolution: 'distinct',
    rationale:
      'Both sit in Nevinnomyssk, Stavropol Krai, and the name normaliser collapses the town name. They are unrelated: one is EuroChem’s nitrogen chemical works, the other a marketplace fulfilment warehouse with a different owner, industry and function.',
    resolvedAt: '2026-07-30',
  },
  {
    facilityId: 'f-afipsky-refinery',
    otherFacilityId: 'f-krasnodar-refinery',
    resolution: 'open',
    rationale:
      'The two plants are reported as a MERGED LEGAL ENTITY with combined 2024 throughput, but they are physically separate sites roughly 20 km apart. Kept as two cards because the damage events are site-specific; the shared legal entity is recorded on both. Revisit if reporting starts attributing damage only to the combined entity.',
    resolvedAt: null,
  },
  {
    facilityId: 'f-ufa-refining-complex',
    otherFacilityId: 'f-ufa-refining-complex',
    resolution: 'merged',
    rationale:
      'UNPZ, Novoil and Ufaneftekhim are three adjacent Bashneft plants that public reporting does not reliably distinguish. Rather than create three cards and guess which was struck, they are held as ONE merged card at industrial-zone coordinate precision, with the ambiguity recorded as an open data gap.',
    resolvedAt: '2026-07-30',
  },
  {
    facilityId: 'f-engels-oil-facility',
    otherFacilityId: 'f-saratov-refinery',
    resolution: 'distinct',
    rationale:
      'Reporting describes "the Engels oil refinery" without identifying a legal entity. Engels sits across the Volga from Saratov and its refinery. Merging the unidentified Engels record into the Saratov refinery card would manufacture an attribution the sources do not support, so the two are deliberately kept apart until the site is identified.',
    resolvedAt: '2026-07-30',
  },
];
