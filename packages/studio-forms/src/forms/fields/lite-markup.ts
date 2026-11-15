// ============================================================================
// Markdown-lite ⇄ HTML for the lite editor (PLAN §1.5, a1 round 2).
//
// Stored bodies are HTML. The lite editor edits a small, declared subset of
// it as markdown-lite in a textarea, and writes sanitised HTML back:
//
//   paragraphs        blank line between; a single line break is <br>
//   ## / ###          <h2> / <h3>
//   - item, 1. item   <ul> / <ol>, one level
//   **b** *i* ++u++   <strong> <em> <u>
//   [text](url)       <a href>  (http(s), mailto, tel, relative and # only)
//   \*                a literal marker character
//
// The subset is checked by ROUND TRIP, not by a tag list alone: a body is
// editable only when html → lite → html gives back the same canonical HTML.
// Anything else (pictures, quotes, tables, classes, nested lists) opens read
// only with "Edit in full editor", so re-saving never strips formatting.
//
// No DOM: the same code runs on the server (first render) and the client.
// Output is built tag by tag from escaped text, so it is safe by construction.
// ============================================================================

export const LITE_SUBSET = ['p', 'br', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'u', 'a'] as const;

// ── markdown-lite → HTML ─────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The hrefs a lite link may carry. Everything else is dropped to text. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null; // javascript:, data:, …
  if (/^(\/|#|\.\/|\.\.\/)/.test(href)) return href;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(href)) return `https://${href}`;
  return null;
}

const ESCAPABLE = /\\([*_+[\]()#\\.-])/g;
const HOLD = '\u0000';

function inline(src: string): string {
  const held: string[] = [];
  const hold = (html: string) => `${HOLD}${held.push(html) - 1}${HOLD}`;
  // 1. backslash escapes, then links (their text is formatted on its own)
  let s = src.replace(ESCAPABLE, (_, ch: string) => hold(escapeHtml(ch)));
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text: string, url: string) => {
    const href = safeHref(url.replace(new RegExp(`${HOLD}(\\d+)${HOLD}`, 'g'), (_x, i: string) => held[Number(i)] ?? ''));
    if (!href) return m;
    return hold(`<a href="${escapeHtml(href)}">${marks(escapeHtml(text))}</a>`);
  });
  s = marks(escapeHtml(s));
  return s.replace(new RegExp(`${HOLD}(\\d+)${HOLD}`, 'g'), (_x, i: string) => held[Number(i)] ?? '');
}

function marks(s: string): string {
  return s
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/\+\+(?=\S)([\s\S]*?\S)\+\+/g, '<u>$1</u>')
    .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>');
}

/** Markdown-lite to the stored HTML. */
export function liteToHtml(md: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^\s*(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      const level = h[1]!.length === 3 ? 3 : 2;
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`);
      continue;
    }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = ul ? null : /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const tag = ul ? 'ul' : 'ol';
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((ul ?? ol)![1]!);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join('');
}

// ── HTML → tokens → canonical HTML / markdown-lite ───────────────────────────

type Token =
  | { t: 'open'; tag: string; attrs: Record<string, string>; selfClosing: boolean }
  | { t: 'close'; tag: string }
  | { t: 'text'; text: string };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? (code === 160 ? ' ' : String.fromCodePoint(code)) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function parseAttrs(src: string): Record<string, string> | null {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let rest = src.replace(/\/\s*$/, '').trim();
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) attrs[m[1]!.toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  rest = rest.replace(re, '').trim();
  return rest ? null : attrs;
}

function tokenize(html: string): Token[] | null {
  const out: Token[] = [];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)(\s[^<>]*?)?(\/?)>|([^<]+)|(<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) out.push({ t: 'close', tag: m[1].toLowerCase() });
    else if (m[2]) {
      const attrs = parseAttrs(m[3] ?? '');
      if (!attrs) return null;
      out.push({ t: 'open', tag: m[2].toLowerCase(), attrs, selfClosing: Boolean(m[4]) });
    } else out.push({ t: 'text', text: decode(m[5] ?? m[6] ?? '') });
  }
  return out;
}

/** One block of the subset: a paragraph, a heading, or a list of inline runs. */
type Inline = { kind: 'text'; text: string } | { kind: 'br' } | { kind: 'mark'; tag: 'strong' | 'em' | 'u'; children: Inline[] } | { kind: 'a'; href: string; children: Inline[] };
type Block = { kind: 'p' | 'h2' | 'h3'; children: Inline[] } | { kind: 'ul' | 'ol'; items: Inline[][] };

const INLINE_ALIAS: Record<string, 'strong' | 'em' | 'u'> = { strong: 'strong', b: 'strong', em: 'em', i: 'em', u: 'u' };

type Node = string | { tag: string; attrs: Record<string, string>; children: Node[] };

const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr']);
const BLOCKS = new Set(['p', 'h2', 'h3', 'ul', 'ol']);

/** Tokens into a tree; null on a mismatched or unclosed tag (we never guess HTML's implied closes). */
function buildTree(tokens: Token[]): Node[] | null {
  const root: Exclude<Node, string> = { tag: '#root', attrs: {}, children: [] };
  const stack: Array<Exclude<Node, string>> = [root];
  for (const tk of tokens) {
    const top = stack[stack.length - 1]!;
    if (tk.t === 'text') top.children.push(tk.text);
    else if (tk.t === 'open') {
      const node = { tag: tk.tag, attrs: tk.attrs, children: [] as Node[] };
      top.children.push(node);
      if (!VOID.has(tk.tag) && !tk.selfClosing) stack.push(node);
    } else {
      if (VOID.has(tk.tag)) continue;
      if (top.tag !== tk.tag) return null;
      stack.pop();
    }
  }
  return stack.length === 1 ? root.children : null;
}

const blank = (n: Node) => typeof n === 'string' && !n.trim();
const bare = (n: Exclude<Node, string>) => Object.keys(n.attrs).length === 0;

function toInline(nodes: Node[]): Inline[] | null {
  const out: Inline[] = [];
  for (const n of nodes) {
    if (typeof n === 'string') {
      out.push({ kind: 'text', text: n });
      continue;
    }
    if (n.tag === 'br' && bare(n)) out.push({ kind: 'br' });
    else if (INLINE_ALIAS[n.tag] && bare(n)) {
      const kids = toInline(n.children);
      if (!kids) return null;
      out.push({ kind: 'mark', tag: INLINE_ALIAS[n.tag]!, children: kids });
    } else if (n.tag === 'a') {
      const others = { ...n.attrs };
      const safe = safeHref(others.href ?? '');
      delete others.href;
      delete others.target; // tiptap's Link writes target/rel; they are not formatting
      delete others.rel;
      if (Object.keys(others).length || !safe) return null;
      const kids = toInline(n.children);
      if (!kids) return null;
      out.push({ kind: 'a', href: safe, children: kids });
    } else return null;
  }
  return out;
}

/** Parse into the subset's blocks; null when the HTML holds anything the subset cannot say. */
function parseSubset(html: string): Block[] | null {
  const tokens = tokenize(html);
  const tree = tokens && buildTree(tokens);
  if (!tree) return null;
  const blocks: Block[] = [];
  let loose: Node[] = [];
  const flushLoose = (): boolean => {
    if (loose.some((n) => !blank(n))) {
      const kids = toInline(loose);
      if (!kids) return false;
      blocks.push({ kind: 'p', children: kids }); // loose text at the top is a paragraph (a plain-text body)
    }
    loose = [];
    return true;
  };
  for (const n of tree) {
    if (typeof n === 'string' || !BLOCKS.has(n.tag)) {
      loose.push(n);
      continue;
    }
    if (!flushLoose() || !bare(n)) return null;
    if (n.tag === 'p' || n.tag === 'h2' || n.tag === 'h3') {
      const kids = toInline(n.children);
      if (!kids) return null;
      blocks.push({ kind: n.tag, children: kids });
      continue;
    }
    const items: Inline[][] = [];
    for (const li of n.children) {
      if (blank(li)) continue;
      if (typeof li === 'string' || li.tag !== 'li' || !bare(li)) return null;
      const inner = li.children.filter((c) => !blank(c));
      // tiptap writes <li><p>…</p></li>: one paragraph is the item's text.
      const only = inner.length === 1 ? inner[0] : null;
      const kids = only && typeof only !== 'string' && only.tag === 'p' && bare(only) ? toInline(only.children) : toInline(li.children);
      if (!kids) return null;
      items.push(kids);
    }
    blocks.push({ kind: n.tag as 'ul' | 'ol', items });
  }
  return flushLoose() ? blocks : null;
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ');
}

function inlineHtml(kids: Inline[]): string {
  return kids
    .map((k) => {
      if (k.kind === 'text') return escapeHtml(collapse(k.text));
      if (k.kind === 'br') return '<br>';
      if (k.kind === 'a') return `<a href="${escapeHtml(k.href)}">${inlineHtml(k.children)}</a>`;
      const inner = inlineHtml(k.children);
      return inner.trim() ? `<${k.tag}>${inner}</${k.tag}>` : inner;
    })
    .join('');
}

function trimInline(html: string): string {
  return html.replace(/^(\s|<br>)+|(\s|<br>)+$/g, '');
}

function blocksHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if ('items' in b) return `<${b.kind}>${b.items.map((it) => `<li>${trimInline(inlineHtml(it))}</li>`).join('')}</${b.kind}>`;
      const inner = trimInline(inlineHtml(b.children));
      return inner ? `<${b.kind}>${inner}</${b.kind}>` : '';
    })
    .join('');
}

/** The subset's canonical HTML for `html`, or null when it falls outside the subset. */
export function canonicalLiteHtml(html: string): string | null {
  const blocks = parseSubset(html);
  return blocks ? blocksHtml(blocks) : null;
}

function escapeLite(text: string, lineStart: boolean): string {
  let s = text.replace(/([\\*_+[\]])/g, '\\$1');
  if (lineStart) s = s.replace(/^(\s*)(#|[-•]\s|\d+[.)]\s)/, (_m, sp: string, mk: string) => `${sp}\\${mk}`);
  return s;
}

function inlineLite(kids: Inline[], parent: 'strong' | 'em' | 'u' | null = null): string {
  let out = '';
  for (const k of kids) {
    if (k.kind === 'text') out += escapeLite(collapse(k.text), out === '' || out.endsWith('\n'));
    else if (k.kind === 'br') out += '\n';
    else if (k.kind === 'a') out += `[${inlineLite(k.children)}](${k.href})`;
    else {
      const inner = inlineLite(k.children, k.tag);
      const lead = inner.match(/^\s*/)![0];
      const trail = inner.match(/\s*$/)![0];
      const core = inner.trim();
      // Italic next to bold uses `_`, so "**_x_**" never reads as "***x***".
      const nearStrong = parent === 'strong' || k.children.some((c) => c.kind === 'mark' && c.tag === 'strong');
      const mk = k.tag === 'strong' ? '**' : k.tag === 'u' ? '++' : nearStrong ? '_' : '*';
      out += core ? `${lead}${mk}${core}${mk}${trail}` : inner;
    }
  }
  return out;
}

function trimLite(s: string): string {
  return s.replace(/^[ \n]+|[ \n]+$/g, '').replace(/ *\n */g, '\n');
}

export type LiteParse = { editable: true; md: string } | { editable: false; reason: string };

/**
 * Stored HTML → markdown-lite, when the subset can carry it unchanged.
 * Checked by round trip: lite → HTML must give the same canonical HTML.
 */
export function htmlToLite(html: string): LiteParse {
  if (!html || !html.trim()) return { editable: true, md: '' };
  const blocks = parseSubset(html);
  if (!blocks) return { editable: false, reason: 'formatting the short editor does not keep (pictures, quotes, tables or styles)' };
  const md = blocks
    .map((b) => {
      if ('items' in b && b.kind === 'ul') return b.items.map((it) => `- ${trimLite(inlineLite(it)).replace(/\n/g, ' ')}`).join('\n');
      if ('items' in b) return b.items.map((it, n) => `${n + 1}. ${trimLite(inlineLite(it)).replace(/\n/g, ' ')}`).join('\n');
      const text = trimLite(inlineLite(b.children));
      if (b.kind === 'h2') return `## ${text.replace(/\n/g, ' ')}`;
      if (b.kind === 'h3') return `### ${text.replace(/\n/g, ' ')}`;
      return text;
    })
    .filter((s) => s !== '')
    .join('\n\n');
  const before = blocksHtml(blocks);
  const after = canonicalLiteHtml(liteToHtml(md));
  if (after !== before) return { editable: false, reason: 'line breaks or marks the short editor cannot write back exactly' };
  return { editable: true, md };
}
