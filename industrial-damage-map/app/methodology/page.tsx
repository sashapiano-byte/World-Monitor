import type { Metadata } from 'next';
import Link from 'next/link';
import { CONFIDENCE_BANDS } from '@/lib/analytics';
import { DATASET_VERSION, EMBARGO_CUTOFF_DATE, LAST_FULL_REVIEW } from '@/data';
import { getDataset } from '@/lib/dataset';
import { CONSTANT_PRICE_BASE_YEAR, RUB_PER_USD_BY_YEAR, USD_DEFLATOR_TO_BASE } from '@/lib/fx';

export const metadata: Metadata = { title: 'Methodology' };
export const dynamic = 'force-static';

export default function MethodologyPage() {
  const dataset = getDataset();

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 text-sm leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Methodology</h1>
        <p className="text-muted-foreground">
          Dataset v{DATASET_VERSION} · last full end-to-end review {LAST_FULL_REVIEW} · publication cut-off{' '}
          {EMBARGO_CUTOFF_DATE}
        </p>
        <p>
          This project documents industrial facilities in the Russian Federation reported physically damaged during the
          war against Ukraine since 24 February 2022. It is retrospective and documentary. It uses open sources only.
        </p>
      </header>

      <Section id="scope" title="1. What this project is, and is not">
        <p>It is a record of damage that has already happened and has already been publicly reported.</p>
        <p className="font-medium">It deliberately contains none of the following:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>facilities that have not been attacked;</li>
          <li>predictions about future targets;</li>
          <li>vulnerability analysis of operating enterprises;</li>
          <li>targeting recommendations, routes or weapon-effect calculations;</li>
          <li>air-defence, security, guard-post or access-control information;</li>
          <li>the position of specific critical installations inside an operating plant;</li>
          <li>operational information about attacks less than 72 hours old;</li>
          <li>anything that exists only in closed databases, leaks or unlawfully obtained material.</li>
        </ul>
        <p>
          Coordinates are the publicly known centre of an industrial site or its published address — never the position
          of a particular shop or piece of equipment. The map is capped at zoom level 12 for the same reason.
        </p>
      </Section>

      <Section id="units" title="2. Units of record">
        <p>Five things are kept separate, because conflating them is how OSINT datasets go wrong:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Facility</strong> — a permanent card for a physical site. A new attack never creates a second card.
          </li>
          <li>
            <strong>Incident</strong> — one attack or damage event.
          </li>
          <li>
            <strong>Damage</strong> — what an incident physically did, recorded on the incident.
          </li>
          <li>
            <strong>Source</strong> — a publication, document, image or statement.
          </li>
          <li>
            <strong>Status change</strong> — a resumption, unit restart or completed repair.
          </li>
        </ul>
      </Section>

      <Section id="inclusion" title="3. Inclusion and exclusion">
        <p>
          Included: refineries; oil depots and large terminals; gas processing and petrochemical complexes;
          metallurgy; chemicals; machine building; aviation and shipbuilding; rail machine building; defence plants
          where damage is <em>already publicly confirmed</em>; power-engineering equipment makers; large industrial
          warehouses; building-materials plants; food industry; pulp and paper; large logistics and
          production-warehouse complexes; industrial ports and export terminals.
        </p>
        <p>
          Excluded: ordinary residential buildings, administrative offices, small shops, vehicles, and military
          objects with no industrial function.
        </p>
        <p>
          Borderline categories — military depot, arsenal, repair base, airfield, electrical substation, energy
          infrastructure — are kept in their own flagged category and are excluded from every &ldquo;damaged
          industrial enterprise&rdquo; total. They are visible only when the reader switches them on. The dataset
          currently carries {dataset.facilities.filter((f) => f.siteCategory !== 'industrial').length} such records,
          retained so the boundary can be seen being applied rather than assumed.
        </p>
        <p>
          Marketplace fulfilment complexes are included only where the site performs an industrial-logistics function
          at scale and confirmed physical damage is documented.
        </p>
      </Section>

      <Section id="sources" title="4. Source hierarchy">
        <p>
          Sources are graded at <strong>item</strong> level, not publisher level: an article whose substance is a
          company or government statement is a tier-A item on what that party said.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Tier A</strong> — enterprise statements; owner or parent-company publications; governors and
            regional authorities; emergency services; sector regulators; exchange disclosures; financial reports;
            insurers; court documents; state procurement and repair tenders; commercial satellite operators;
            Sentinel-2 and other lawfully available satellite data. Ukrainian state statements sit in tier A{' '}
            <em>as a party&apos;s statement only</em>, never as automatic proof of an effect.
          </li>
          <li>
            <strong>Tier B</strong> — Reuters, AP, BBC, FT, NYT, Washington Post, Bloomberg, RFE/RL, Meduza,
            Kommersant, RBC, Vedomosti, trade press, investigative projects with transparent methodology, and
            satellite-OSINT projects that publish imagery with capture dates.
          </li>
          <li>
            <strong>Tier C</strong> — regional media, Telegram, eyewitness posts, social-media photos and video,
            company aggregators and directories.
          </li>
        </ul>
        <p className="font-medium">
          A tier-C source may never be the sole basis for a conclusion of serious damage or destruction.
        </p>
        <p>
          <strong>Syndication is not corroboration.</strong> Five outlets republishing one Reuters report are one
          voice. Each source records whether it is a republication, and the quality-control engine collapses them
          before counting.
        </p>
        <p>
          <Link href="/sources" className="underline">
            The full source register
          </Link>{' '}
          lists all {dataset.sources.length} items with their tier and what each is actually good for.
        </p>
      </Section>

      <Section id="verification" title="5. Verification">
        <p>An incident reaches the main map when at least one of these holds:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>official confirmation of physical damage;</li>
          <li>before/after satellite imagery from a named provider with capture dates;</li>
          <li>several independent outlets with photographs;</li>
          <li>a confirmed repair or production stoppage following the attack.</li>
        </ul>
        <p>
          Medium confidence requires two independent sources, geolocated photo or video, indirect indications of a
          production stop, or authority statements combined with sector data.
        </p>
        <p>
          Low-confidence cases — one party&apos;s claim, uncorroborated Telegram reports, no visual or production
          evidence — are <strong>not shown on the main map by default</strong>. They live in a separate
          &ldquo;unconfirmed&rdquo; layer, they carry a physical-damage score of 0, and they are excluded from every
          headline figure. The dataset currently holds{' '}
          {dataset.incidents.filter((i) => i.verificationStatus === 'unconfirmed').length} such records.
        </p>
        <h3 className="pt-1 font-medium">How §23&apos;s two-source rule is applied</h3>
        <p>
          The quality-control rule is: two <em>independent</em> sources, or one tier-A source, or dated satellite
          imagery. It is enforced as a hard error for any record asserting a damage score of 3 or above. Records at
          score 1–2 backed by a single credible outlet are published but carry a visible{' '}
          <strong>single-source</strong> flag on the map, in the table and on the facility card, rather than being
          suppressed — suppressing them would discard genuine, if thin, reporting while pretending the dataset is
          more complete than it is. Records at score 0 assert no damage and carry no corroboration requirement. This
          reading is a deliberate editorial decision and is flagged here because it is a deviation from the strictest
          possible construction of the rule.
        </p>
      </Section>

      <Section id="damage" title="6. Physical damage scale">
        <ol className="ml-5 list-decimal space-y-1" start={0}>
          <li>attack in the area of the facility, no confirmed damage;</li>
          <li>minor damage: glazing, roofing, a local fire;</li>
          <li>damage to an individual building or ancillary infrastructure;</li>
          <li>serious damage to a production building or process unit;</li>
          <li>a key technological installation or several shops put out of action;</li>
          <li>destruction of the main production site, or the enterprise effectively ceasing to operate.</li>
        </ol>
        <p>
          &ldquo;Hit&rdquo;, &ldquo;damaged&rdquo;, &ldquo;seriously damaged&rdquo;, &ldquo;disabled&rdquo; and
          &ldquo;destroyed&rdquo; are not interchangeable. The most cautious wording the evidence supports is always
          the one used. A score of 5 additionally requires verification status <em>verified</em> and confidence of at
          least 75; the database refuses the row otherwise.
        </p>
      </Section>

      <Section id="status" title="7. Operational status">
        <p>
          Status is one of: normal operations, operations reduced, partially restored, fully restored, temporarily
          suspended, long-term shutdown, destroyed, unknown. Every change records a date, a supporting source,
          whether it is a direct confirmation or our own analytical assessment, and a confidence score.
        </p>
        <p>
          Status is checked against company statements, process-unit loading, sector statistics, aggregated
          retrospective rail and port shipment data, procurement and repair notices, annual reports, and reports of
          output resuming. Job advertisements are <strong>never</strong> treated as evidence of full operation on
          their own.
        </p>
        <p>
          Where a company or regional authority asserts that operations were unaffected, that assertion is recorded
          as a tier-A statement — and its confidence is deliberately held low, because it comes from an interested
          party.
        </p>
      </Section>

      <Section id="financial" title="8. Financial damage">
        <p>Estimates are typed and never mixed:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>official</strong>, <strong>insurance</strong>, <strong>company disclosure</strong> — attested
            figures;
          </li>
          <li>
            <strong>analyst estimate</strong> — a third party&apos;s calculation;
          </li>
          <li>
            <strong>model estimate</strong> — produced by this project;
          </li>
          <li>
            <strong>unknown</strong> — a figure whose provenance could not be established.
          </li>
        </ul>
        <p className="font-medium">
          A model estimate is never presented as an official figure, and the dashboard never adds the two together.
        </p>
        <p>
          Every figure must carry a methodology; the database rejects one that does not. Every model estimate must
          list its assumptions, and those assumptions are shown to the reader in full on the facility card. Estimates
          that cover more than one site, or the whole campaign, are marked as such and excluded from per-facility
          aggregation so they cannot be double counted.
        </p>
        <p>Amounts are shown three ways: original currency; USD at the rate on the incident date; USD in constant prices.</p>
        <div className="scroll-x">
          <table className="min-w-[24rem] text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-4 font-medium">Year</th>
                <th className="py-1 pr-4 font-medium">RUB per USD (annual average)</th>
                <th className="py-1 font-medium">Deflator to {CONSTANT_PRICE_BASE_YEAR} prices</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(RUB_PER_USD_BY_YEAR).map((year) => (
                <tr key={year}>
                  <td className="py-0.5 pr-4 tabular-nums">{year}</td>
                  <td className="py-0.5 pr-4 tabular-nums">{RUB_PER_USD_BY_YEAR[Number(year)]}</td>
                  <td className="py-0.5 tabular-nums">{USD_DEFLATOR_TO_BASE[Number(year)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          These are coarse working rates, published here so the arithmetic is auditable. They are not central-bank
          fixings and this project should not be used as a financial source.
        </p>
      </Section>

      <Section id="satellite" title="9. Satellite imagery">
        <p>
          Only lawfully available material is used. Each image records provider, capture date, resolution, licence,
          a link to the original publication, what is visible, and the limits of interpretation.
        </p>
        <p>
          Imagery whose licence forbids redistribution is <strong>linked, never rehosted</strong>. A hosted thumbnail
          is opt-in and the quality-control engine refuses one unless the licence text positively permits it.
          Annotation of critical equipment is not performed. Optical imagery can show exterior structural change and
          fire scarring; it cannot show whether internal equipment is repairable or whether a plant is running.
        </p>
        <p>
          Connecting Sentinel Hub or the Copernicus Data Space is documented in <code>docs/SATELLITE_IMAGERY.md</code>.
          No credentials are held in this repository.
        </p>
      </Section>

      <Section id="confidence" title="10. Confidence scale">
        <p>Every incident, status change and financial estimate carries a score from 0 to 100.</p>
        <ul className="ml-5 list-disc space-y-1">
          {CONFIDENCE_BANDS.map((band) => (
            <li key={band.key}>
              <strong>
                {band.min}–{band.max}
              </strong>{' '}
              — {band.label.split('·')[1]?.trim() ?? band.label}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="qc" title="11. Automated quality control">
        <p>
          The rules below run on every build and in CI. An error blocks the database seed outright — the database
          cannot hold records the editorial rules reject.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>no incident may precede 24 February 2022;</li>
          <li>no published incident may be less than 72 hours old;</li>
          <li>the corroboration rule described in §5;</li>
          <li>tier-C sources alone cannot carry a score of 4 or 5;</li>
          <li>a score of 5 requires verified status and confidence ≥ 75;</li>
          <li>a recovery status requires a date and a source;</li>
          <li>&ldquo;destroyed&rdquo; may not rest on an analytical assessment;</li>
          <li>every financial estimate needs a methodology; model estimates need listed assumptions;</li>
          <li>coordinates must fall inside the permitted bounding box and match the region&apos;s territory status;</li>
          <li>source URLs must be well formed;</li>
          <li>duplicate facilities are detected by name normalisation and by 2 km proximity, and every flag must be resolved;</li>
          <li>unconfirmed records may not assert a damage score above 0;</li>
          <li>satellite imagery must carry a capture date.</li>
        </ul>
        <p>
          Web-archive snapshots are requested where the publisher and the archive service both permit it; sources
          without one are reported as an informational finding rather than silently accepted.
        </p>
      </Section>

      <Section id="editorial" title="12. Editorial policy and corrections">
        <p>
          Automatically discovered candidates never publish themselves. They enter{' '}
          <Link href="/review-queue" className="underline">
            the review queue
          </Link>{' '}
          and advance through detection, name normalisation, facility matching, detail extraction, corroboration,
          imagery checking and confidence assignment before a named editor approves them. The database enforces the
          approval requirement with a constraint. Published records are re-checked at 7, 30, 90 and 180 days.
        </p>
        <p>
          Corrections are made in the open: the record is amended, the change is logged with a rationale, and the
          changelog records what changed and why. If a record is found not to meet the inclusion criteria it is
          marked <em>rejected</em> rather than deleted, so the correction remains visible.
        </p>
      </Section>

      <Section id="limits" title="13. Known limitations">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            This is an <strong>incomplete sample</strong>, not a census. It is biased towards facilities that
            English-language media cover, and towards oil refining, which is reported far more closely than any other
            sector.
          </li>
          <li>
            Russian operators rarely disclose damage. Absence of a reported effect is not evidence that there was
            none.
          </li>
          <li>
            Wire reporting frequently rests on unnamed &ldquo;industry sources&rdquo;. Such reports are recorded as
            what they are.
          </li>
          <li>
            Ukrainian official statements are a party&apos;s claims. They establish that a claim was made, not that
            an effect occurred.
          </li>
          <li>Russian state media are used only where they concede something against interest.</li>
          <li>
            Not one official, insurance or company-disclosed facility-level damage figure was located in this research
            pass. Every financial number here is therefore an analyst figure, a project model, or of unestablished
            provenance.
          </li>
          <li>Coordinates at locality precision may be off by kilometres. The precision field says which.</li>
          <li>
            Some dates could only be fixed to a month. Those records carry an explicit placeholder warning and sit in
            the unconfirmed layer.
          </li>
        </ul>
      </Section>
    </article>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-2 border-t border-border pt-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
