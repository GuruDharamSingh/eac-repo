import { renderWithProps, sampleProps } from './samples';
import { mergeFieldsFor, mergeValuesFor } from './merge-fields';

// ============================================================================
// Turning a letter the network draws into a layout an org can edit.
//
// ── The problem ─────────────────────────────────────────────────────────────
//
// "Lay it out yourself" opened an empty canvas. The template you clicked under
// never reached the editor — the page passed `stored?.project ?? null`, and on
// a first visit that is null. So every org that wanted to brand its own
// confirmation email started from nothing and had to rebuild, from memory, a
// letter it was looking at one click earlier.
//
// ── Why the seed is not just the sample ─────────────────────────────────────
//
// The obvious fix — hand the editor the preview HTML — is a trap. The preview
// says "Ada Whitfield" and names a workshop that does not exist, and the
// advanced send path inserts stored HTML verbatim. An org that saved that
// would mail every guest somebody else's name.
//
// So the letter is rendered with its sample props, and then each rendered
// sample VALUE is swapped back to its `{token}`. What lands in the editor is
// the real layout with live slots in it, and `fillHtml` puts the real values
// back at send time.
//
// Reverse substitution rather than rendering the tokens directly, because the
// templates compute some of their own display values — `formatWhen` turns an
// ISO string into "Saturday, 3 October, 7:00 p.m. EDT", and there is no
// scheduledAt you could pass that would format to the literal "{when}".
// ============================================================================

/**
 * The org-editable region of a rendered letter.
 *
 * Located by the `data-eac-body` marker EmailShell puts on it, then scanned to
 * its matching close. A regex cannot do the second half: the body contains
 * nested tables (every block in the library is one), and `<table>…</table>`
 * with anything nested is exactly the shape a regex gets wrong — which is the
 * same reason the template binding engine parses rather than matches.
 */
export function extractEditableBody(html: string): string {
  return extractRegion(html, 'data-eac-body');
}

/**
 * The balanced `<table>` carrying `marker`.
 *
 * A regex cannot do this: every region contains nested tables (every block in
 * the library is one), and `<table>…</table>` with anything nested is exactly
 * the shape a regex gets wrong — the same reason the template binding engine
 * parses rather than matches.
 */
export function extractRegion(html: string, marker: string): string {
  const at = html.indexOf(marker);
  if (at === -1) return '';
  const markerIndex = at;

  const open = html.lastIndexOf('<table', markerIndex);
  if (open === -1) return '';

  const openEnd = html.indexOf('>', markerIndex);
  if (openEnd === -1) return '';

  let depth = 1;
  let i = openEnd + 1;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<table', i);
    const nextClose = html.indexOf('</table', i);
    if (nextClose === -1) return '';
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 6;
    } else {
      depth -= 1;
      i = nextClose + 7;
    }
  }
  if (depth !== 0) return '';

  const close = html.indexOf('>', i);
  return html.slice(open, close === -1 ? i : close + 1);
}

/**
 * The card's own colours, lifted from a rendered letter.
 *
 * Read off the document rather than imported from the palette so the canvas
 * follows whatever the shell actually drew — including an org accent, which is
 * resolved at render time and is not in any constant.
 */
export function envelopeColors(html: string): { page: string; card: string } {
  const page = /<body[^>]*background(?:-color)?:\s*([^;"']+)/i.exec(html)?.[1]?.trim();
  const cards = [...html.matchAll(/background(?:-color)?:\s*(#[0-9a-f]{3,8})/gi)]
    .map((m) => m[1].toLowerCase())
    .filter((c) => c !== page?.toLowerCase());
  return { page: page ?? '#05070d', card: cards[0] ?? '#141a2e' };
}

/** Longest first, so "Ada Whitfield" is replaced before "Ada". */
function byLengthDesc(a: [string, string], b: [string, string]): number {
  return b[1].length - a[1].length;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The HTML entities @react-email emits for characters that appear in samples.
 *
 * A sample value containing an apostrophe or an em-dash is written into the
 * document escaped, so a plain string search for the raw value finds nothing
 * and the field silently fails to become a slot.
 */
function asRendered(value: string): string[] {
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#x27;')
    .replace(/"/g, '&quot;');
  return escaped === value ? [value] : [escaped, value];
}

export interface SeedOptions {
  orgName?: string;
  orgHeader?: boolean;
  orgAccent?: string;
}

/**
 * The body of one letter, as a layout to open an editor on.
 *
 * Returns '' for a key with no template, so a caller can fall back to a blank
 * canvas rather than crash — a missing seed should cost the seed, not the
 * editor.
 */
export async function renderTemplateBody(
  key: string,
  opts: SeedOptions = {}
): Promise<string> {
  const props = sampleProps(key, opts);
  const html = await renderWithProps(key, props);
  if (!html) return '';

  const body = extractEditableBody(html);
  if (!body) return '';

  // What each field rendered AS, so it can be found in the output. Derived
  // from the same props the render just used, through the same `from`
  // functions the send path uses — so the string being searched for is by
  // construction the string that was written.
  const rendered = mergeValuesFor(key, props);

  const pairs = mergeFieldsFor(key)
    .map((field): [string, string] | null => {
      const value = rendered[field.name];
      return value ? [field.name, value] : null;
    })
    .filter((p): p is [string, string] => p !== null)
    .sort(byLengthDesc);

  let out = body;
  for (const [name, value] of pairs) {
    for (const form of asRendered(value)) {
      out = out.replace(new RegExp(escapeRe(form), 'g'), `{${name}}`);
    }
  }
  return out;
}

export interface TemplateEnvelope {
  /** Everything above the editable body — masthead, kicker, card opening. */
  before: string;
  /** Everything below it — the footer, and whatever it carries. */
  after: string;
  /** The page behind the card. */
  pageColor: string;
  /** The card the letter sits on. */
  cardColor: string;
}

/**
 * The chrome an editor should draw around the body it is editing.
 *
 * Each half is extracted as a BALANCED element by its own marker rather than
 * by slicing the document at the body — a slice ends mid-`<table>`, and the
 * two halves are then unbalanced markup that cannot be inserted anywhere.
 *
 * Rendered from the SAME props the seed came from, so the masthead says what
 * the real letter's masthead will say — including whether the org leads the
 * header, which depends on its sending domain and is decided at render time.
 */
export async function renderTemplateEnvelope(
  key: string,
  opts: SeedOptions = {}
): Promise<TemplateEnvelope | null> {
  const html = await renderWithProps(key, sampleProps(key, opts));
  if (!html) return null;
  const before = extractRegion(html, 'data-eac-header');
  if (!before) return null;
  const { page, card } = envelopeColors(html);
  return {
    before,
    after: extractRegion(html, 'data-eac-footer'),
    pageColor: page,
    cardColor: card,
  };
}
