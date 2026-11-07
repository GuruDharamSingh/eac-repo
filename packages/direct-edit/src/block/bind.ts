// ============================================================================
// Binding a design to live data (pass 3): one card is designed once and drawn
// for every item of a feed. A node's words may name fields of the item as
// tokens, `{{title}}` or `{{when}} · {{place}}`; a picture's source may be a
// token too. The design stores tokens, never item data; the page fills them in
// at render time from the item it is drawing (the "instances" idea of the
// patterns prototype, applied to data rows).
//
// Values are always text. Filled into rich markup they are HTML-escaped first,
// so an item's title can never become markup; the host's sanitiser and
// renderer stay the only way markup reaches a page.
// ============================================================================

export interface FieldSpec {
  key: string;
  label: string;
  /** text: words; image: a picture URL (or site path); url: a link. */
  type: "text" | "image" | "url";
  /** Shown when no live item is at hand (editor previews, empty feeds). */
  sample?: string;
}

/** One data row, already formatted for display (dates, prices) by the host. */
export type Item = Record<string, string | null | undefined>;

export const TOKEN_RE = /\{\{\s*([a-z][a-z0-9_]{0,31})\s*\}\}/gi;
const ONE_TOKEN = /^\s*\{\{\s*([a-z][a-z0-9_]{0,31})\s*\}\}\s*$/i;

export const tokensIn = (text: string | undefined | null): string[] => [...String(text ?? "").matchAll(TOKEN_RE)].map((m) => m[1]!.toLowerCase());
export const hasTokens = (text: string | undefined | null) => tokensIn(text).length > 0;
/** The field a value is bound to when it is exactly one token ("{{cover}}"), else null. */
export const soleToken = (text: string | undefined | null): string | null => { const m = ONE_TOKEN.exec(String(text ?? "")); return m ? m[1]!.toLowerCase() : null; };
export const tokenFor = (key: string) => `{{${key}}}`;

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SEP = /^(?:\s*[·•|,\/–—-]\s*)+|(?:\s*[·•|,\/–—-]\s*)+$/g;

export interface Filled {
  text: string;
  /** The words named at least one field. */
  bound: boolean;
  /** At least one named field had a value. */
  any: boolean;
}

/**
 * Fill tokens from an item. `rich` escapes values for markup. Separators left
 * dangling by an empty field are trimmed ("{{when}} · {{place}}" with no date
 * is "Paris", not " · Paris").
 */
export function fillTokens(text: string, item: Item | null | undefined, opts: { rich?: boolean } = {}): Filled {
  let bound = false, any = false;
  const out = text.replace(TOKEN_RE, (_, k: string) => {
    bound = true;
    const v = item ? item[k.toLowerCase()] : undefined;
    const s = v == null ? "" : String(v).replace(/\s+/g, " ").trim();
    if (s) any = true;
    return opts.rich ? escHtml(s) : s;
  });
  if (!bound) return { text: out, bound, any };
  const tidy = out.replace(/(\s[·•|]\s)(?:\s*[·•|]\s)+/g, "$1").replace(SEP, "").trim();
  return { text: tidy, bound, any };
}

/** A picture source a page may draw: http(s), or a path on the same site. Nothing else (no data:, javascript:, protocol-relative). */
export function safeSrc(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  if (/^https?:\/\/[^\s"'<>\\]{1,1000}$/i.test(s)) return s;
  if (/^\/(?!\/)[^\s"'<>\\]{0,1000}$/.test(s)) return s;
  return null;
}

/** A link a box may carry: http(s), mailto, a path on the same site, or an anchor on the page. */
export function safeLink(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  if (/^#[A-Za-z][\w-]{0,63}$/.test(s)) return s;
  if (/^mailto:[^\s"'<>\\]{1,300}$/i.test(s)) return s;
  return safeSrc(s);
}

/** A stored picture source: one token, or a URL safeSrc accepts. */
export function cleanSrc(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const tok = soleToken(v);
  if (tok) return tokenFor(tok);
  return safeSrc(v) ?? undefined;
}
