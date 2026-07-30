/**
 * Feed and CSV readers for the candidate-discovery stage.
 *
 * Both produce the same `Candidate` shape. Nothing here decides anything —
 * discovery only ever adds items to the review queue.
 */

export interface Candidate {
  headline: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  summary: string;
}

/**
 * Minimal RSS/Atom reader.
 *
 * A dedicated XML parser would be more robust, but feeds are an optional,
 * human-supervised input here and a regex reader keeps the dependency surface
 * of a research repository small. Malformed entries are skipped, not guessed at.
 */
export function parseFeed(xml: string, publisherFallback: string): Candidate[] {
  const items: Candidate[] = [];
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);

  for (const block of blocks) {
    const title = pick(block, 'title');
    const link = pickLink(block);
    if (!title || !link) continue;

    items.push({
      headline: decode(title),
      url: link,
      publisher: decode(pick(block, 'source') ?? pick(block, 'dc:creator') ?? publisherFallback),
      publishedAt: normaliseDate(pick(block, 'pubDate') ?? pick(block, 'published') ?? pick(block, 'updated')),
      summary: decode(pick(block, 'description') ?? pick(block, 'summary') ?? ''),
    });
  }
  return items;
}

function pick(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
}

function pickLink(block: string): string | null {
  const href = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (href) return href[1];
  const text = pick(block, 'link');
  return text && /^https?:\/\//.test(text) ? text : null;
}

function normaliseDate(raw: string | null): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Manual CSV import.
 * Expected header: headline,url,publisher,published_at,summary
 */
export function parseCsv(text: string): Candidate[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return {
      headline: cells[idx('headline')] ?? '',
      url: cells[idx('url')] ?? '',
      publisher: cells[idx('publisher')] ?? 'manual import',
      publishedAt: normaliseDate(cells[idx('published_at')] ?? null),
      summary: cells[idx('summary')] ?? '',
    };
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
