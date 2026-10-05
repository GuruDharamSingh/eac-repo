import type { EssayDoc, EssayNode, EssayWidth, RenderOptions, ThreadCardAttrs } from './essay-types';

// ============================================================================
// doc → HTML. Pure, deterministic, escapes everything it did not generate.
//
// The output is passed through sanitizeRichText by the caller (services), so
// this renderer may emit only what that allow-list admits: figure, figcaption,
// picture, source, aside, the eac-* classes, srcset/sizes, data-* attributes.
// A node the renderer does not know is dropped, not passed through: the
// browser's HTML is never trusted (brief §3.2).
// ============================================================================

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const attr = (name: string, value: unknown): string =>
  value === null || value === undefined || value === '' ? '' : ` ${name}="${esc(value)}"`;

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;
const safeHref = (h: unknown): string | null => (typeof h === 'string' && SAFE_HREF.test(h.trim()) ? h.trim() : null);

const widthClass = (w: unknown): string => (w === 'wide' || w === 'full' ? ` eac-w-${w}` : '');

const WIDTHS: Record<EssayWidth, string> = {
  content: '(min-width: 1200px) 65ch, 100vw',
  wide: '(min-width: 1200px) 1100px, 100vw',
  full: '100vw',
};
const SRCSET_WIDTHS = [512, 1024, 1600, 2400];

/**
 * A `?w=` srcset for our own media route. Other hosts get the src alone: we
 * cannot resize what we do not serve.
 */
function srcset(src: string): string | null {
  if (!/^\/api\/media\//.test(src)) return null;
  const sep = src.includes('?') ? '&' : '?';
  return SRCSET_WIDTHS.map((w) => `${src}${sep}w=${w} ${w}w`).join(', ');
}

function marks(text: string, node: EssayNode): string {
  let out = esc(text);
  for (const m of node.marks ?? []) {
    switch (m.type) {
      case 'bold':
        out = `<strong>${out}</strong>`;
        break;
      case 'italic':
        out = `<em>${out}</em>`;
        break;
      case 'underline':
        out = `<u>${out}</u>`;
        break;
      case 'strike':
        out = `<s>${out}</s>`;
        break;
      case 'code':
        out = `<code>${out}</code>`;
        break;
      case 'highlight':
        out = `<mark>${out}</mark>`;
        break;
      case 'link': {
        const href = safeHref(m.attrs?.href);
        out = href ? `<a href="${esc(href)}" rel="noopener">${out}</a>` : out;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function inline(nodes: EssayNode[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === 'text') return marks(n.text ?? '', n);
      if (n.type === 'hardBreak') return '<br>';
      return '';
    })
    .join('');
}

function plain(nodes: EssayNode[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === 'text' ? n.text ?? '' : n.type === 'hardBreak' ? '\n' : plain(n.content))).join('');
}

function image(n: EssayNode, profile: 'page' | 'email'): string {
  const a = n.attrs ?? {};
  const src = safeHref(a.src);
  if (!src) return '';
  const w = (a.width as EssayWidth) || 'content';
  const alt = esc(a.alt ?? '');
  const caption = typeof a.caption === 'string' && a.caption.trim() ? `<figcaption>${esc(a.caption)}</figcaption>` : '';
  const dims = attr('width', a.naturalWidth) + attr('height', a.naturalHeight);
  const focal =
    typeof a.focalX === 'number' && typeof a.focalY === 'number'
      ? ` style="object-position:${(a.focalX * 100).toFixed(1)}% ${(a.focalY * 100).toFixed(1)}%"`
      : '';
  const set = srcset(src);
  if (profile === 'email') {
    return `<figure class="eac-image"><img src="${esc(src)}" alt="${alt}"${dims} style="max-width:100%;height:auto">${caption}</figure>`;
  }
  const img = `<img src="${esc(src)}" alt="${alt}"${dims}${set ? ` srcset="${esc(set)}" sizes="${WIDTHS[w] ?? WIDTHS.content}"` : ''} loading="lazy" decoding="async"${focal}>`;
  const link = safeHref(a.href);
  return `<figure class="eac-image${widthClass(w)}"${attr('data-width', w)}>${link ? `<a href="${esc(link)}">${img}</a>` : img}${caption}</figure>`;
}

function threadCard(n: EssayNode, profile: 'page' | 'email'): string {
  const a = (n.attrs ?? {}) as Partial<ThreadCardAttrs>;
  if (!a.threadId || !a.title) return '';
  const href = safeHref(a.href);
  const title = href ? `<a href="${esc(href)}">${esc(a.title)}</a>` : esc(a.title);
  if (profile === 'email') return `<p class="eac-card-fallback">${title}${a.meta ? ` — ${esc(a.meta)}` : ''}</p>`;
  const cover = safeHref(a.coverImageUrl) ? `<img class="eac-card__cover" src="${esc(a.coverImageUrl)}" alt="" loading="lazy">` : '';
  const price = a.forSale && a.price ? `<span class="eac-card__price">${esc(a.price)}</span>` : a.kind === 'artwork' && a.forSale === false ? `<span class="eac-card__price eac-card__price--nfs">Not for sale</span>` : '';
  // The marker: a site with a resolver swaps the whole figure for its live
  // card; without one, this snapshot reads as a link with its meta.
  return (
    `<figure class="eac-card eac-card--${esc(a.kind ?? 'thread')}${a.view === 'compact' ? ' eac-card--compact' : ''}${a.width === 'wide' ? ' eac-w-wide' : ''}"` +
    ` data-eac-card="thread"${attr('data-thread-id', a.threadId)}${attr('data-kind', a.kind)}${attr('data-view', a.view ?? 'card')}>` +
    `${cover}<figcaption><span class="eac-card__kind">${esc(a.kind ?? '')}</span><strong class="eac-card__title">${title}</strong>` +
    `${a.meta ? `<span class="eac-card__meta">${esc(a.meta)}</span>` : ''}${price}</figcaption></figure>`
  );
}

function figureText(n: EssayNode, profile: 'page' | 'email'): string {
  const a = n.attrs ?? {};
  const src = safeHref(a.src);
  const side = a.side === 'right' ? 'right' : 'left';
  const share = [40, 50, 60].includes(Number(a.share)) ? Number(a.share) : 45;
  const caption = typeof a.caption === 'string' && a.caption.trim() ? `<figcaption>${esc(a.caption)}</figcaption>` : '';
  const text = `<div class="eac-figtext__text"><p>${inline(n.content)}</p></div>`;
  if (!src) return `<p>${inline(n.content)}</p>`;
  const img = `<img src="${esc(src)}" alt="${esc(a.alt ?? '')}"${attr('width', a.naturalWidth)}${attr('height', a.naturalHeight)} loading="lazy" decoding="async">`;
  if (profile === 'email') return `<figure class="eac-figtext">${img}${text}${caption}</figure>`;
  return `<figure class="eac-figtext eac-figtext--${side}" data-share="${share}" style="--share:${share}%">${img}${text}${caption}</figure>`;
}

function gallery(n: EssayNode, profile: 'page' | 'email'): string {
  const a = n.attrs ?? {};
  const items = (Array.isArray(a.items) ? a.items : []) as Array<{ src?: unknown; alt?: unknown; caption?: unknown; naturalWidth?: unknown; naturalHeight?: unknown }>;
  const ok = items.filter((i) => safeHref(i.src));
  if (ok.length === 0) return '';
  const w = a.width === 'full' ? 'full' : 'wide';
  const sizes = ok.length <= 3 ? [ok.length] : ok.length === 4 ? [2, 2] : ok.length === 5 ? [3, 2] : [3, 3];
  let i = 0;
  const rows: string[] = [];
  for (const s of sizes) {
    const row = ok.slice(i, i + s);
    i += s;
    rows.push(
      `<div class="eac-gallery__row">${row
        .map((it) => {
          const nw = Number(it.naturalWidth) || 0;
          const nh = Number(it.naturalHeight) || 0;
          const ratio = nw && nh ? (nw / nh).toFixed(4) : '1';
          const cap = typeof it.caption === 'string' && it.caption.trim() ? `<figcaption>${esc(it.caption)}</figcaption>` : '';
          const src = safeHref(it.src) as string;
          const set = srcset(src);
          return `<figure class="eac-gallery__item" style="flex:${ratio} 1 0%"><img src="${esc(src)}" alt="${esc(it.alt ?? '')}"${attr('width', nw || null)}${attr('height', nh || null)}${set && profile === 'page' ? ` srcset="${esc(set)}" sizes="(min-width: 1200px) 33vw, 50vw"` : ''} loading="lazy" decoding="async">${cap}</figure>`;
        })
        .join('')}</div>`
    );
  }
  return `<figure class="eac-gallery${profile === 'page' ? ` eac-w-${w}` : ''}">${rows.join('')}</figure>`;
}

function block(n: EssayNode, profile: 'page' | 'email'): string {
  const a = n.attrs ?? {};
  switch (n.type) {
    case 'paragraph':
      return `<p>${inline(n.content)}</p>`;
    case 'heading': {
      const lvl = Math.min(Math.max(Number(a.level) || 2, 2), 3);
      return `<h${lvl}>${inline(n.content)}</h${lvl}>`;
    }
    case 'bulletList':
      return `<ul>${(n.content ?? []).map((li) => `<li>${blocks(li.content, profile)}</li>`).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(n.content ?? []).map((li) => `<li>${blocks(li.content, profile)}</li>`).join('')}</ol>`;
    case 'blockquote':
      return `<blockquote>${blocks(n.content, profile)}</blockquote>`;
    case 'codeBlock':
      return `<pre><code${attr('data-language', a.language)}>${esc(plain(n.content))}</code></pre>`;
    case 'horizontalRule':
      return '<hr>';
    case 'hardBreak':
      return '<br>';
    case 'essayImage':
      return image(n, profile);
    case 'pullQuote': {
      const w = a.width === 'wide' ? 'wide' : 'content';
      const att = typeof a.attribution === 'string' && a.attribution.trim() ? `<cite>${esc(a.attribution)}</cite>` : '';
      return `<blockquote class="eac-pull${widthClass(w)}"><p>${inline(n.content)}</p>${att}</blockquote>`;
    }
    case 'aside':
      return `<aside class="eac-aside"><p>${inline(n.content)}</p></aside>`;
    case 'divider': {
      const style = a.style === 'rule' || a.style === 'space' ? a.style : 'ornament';
      return `<hr class="eac-divider eac-divider--${style}">`;
    }
    case 'threadCard':
      return threadCard(n, profile);
    case 'figureText':
      return figureText(n, profile);
    case 'gallery':
      return gallery(n, profile);
    case 'image': {
      // TipTap's stock image node (legacy bodies parsed in): render as ours.
      return image({ ...n, attrs: { src: a.src, alt: a.alt, caption: a.title, width: 'content' } }, profile);
    }
    default:
      return '';
  }
}

function blocks(nodes: EssayNode[] | undefined, profile: 'page' | 'email'): string {
  return (nodes ?? []).map((n) => block(n, profile)).join('\n');
}

/** The whole body. The caller sanitises the result; this never trusts input. */
export function renderEssayHtml(doc: EssayDoc | null | undefined, opts: RenderOptions = {}): string {
  if (!doc || doc.type !== 'doc') return '';
  return blocks(doc.content, opts.profile ?? 'page');
}

/** Words in the body, for the status line and reading time. */
export function essayWordCount(doc: EssayDoc | null | undefined): number {
  if (!doc) return 0;
  const text = plain(doc.content);
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/** True when the doc is empty or only blank paragraphs. */
export function essayIsEmpty(doc: EssayDoc | null | undefined): boolean {
  if (!doc?.content?.length) return true;
  return doc.content.every((n) => n.type === 'paragraph' && !plain(n.content).trim());
}
