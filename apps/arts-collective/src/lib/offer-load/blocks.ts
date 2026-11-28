import { sanitizeRichText } from "@elkdonis/utils";
import { renderEssayHtml, type EssayDoc, type EssayNode } from "@elkdonis/utils/essay";

/**
 * Studio block document -> what the reading templates take (TemplatePiece):
 * `sections`, `pullQuote`, `picture` + `caption`, `bodyHtml`.
 *
 * The block vocabulary lives in packages/utils/src/essay-types.ts and its renderer in
 * essay-render.ts (the Studio canvas writes this shape; `renderEssayHtml` is the one
 * doc -> HTML function). Top-level nodes the renderer knows:
 *   paragraph, heading (2 or 3), bulletList, orderedList, blockquote, codeBlock,
 *   horizontalRule, hardBreak, essayImage, image (legacy), pullQuote, aside, divider,
 *   threadCard, figureText, gallery. There is no footnote block.
 *
 * Mapping (nothing is invented; a field with no block stays empty):
 *   heading level 2          starts a section; its text is the section title (the template draws
 *                            the title, so the heading is not repeated in the section's html)
 *   heading level 3          stays inside its section as <h3>
 *   first `pullQuote` block  -> pullQuote (text only), removed from the body
 *   first `essayImage` block -> picture (src) + caption (its caption attr), removed from the body
 *   everything else          -> the section html, in order; text before the first h2 is one
 *                            untitled section ("intro"), which the index rail leaves out
 * A plain `blockquote` is not a pull quote: it stays in the text. Every html string leaving this
 * module has been through `sanitizeRichText` (the platform's sanitiser, packages/utils).
 */

export interface PieceBody {
  bodyHtml: string;
  sections: Array<{ id: string; title: string; html: string }>;
  pullQuote: string | null;
  picture: string | null;
  caption: string | null;
}

const SAFE_SRC = /^(https?:\/\/|\/(?!\/))/i;

function plain(nodes: EssayNode[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === "text" ? n.text ?? "" : n.type === "hardBreak" ? " " : plain(n.content))).join("");
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "section"
  );
}

const html = (nodes: EssayNode[]): string => (nodes.length ? sanitizeRichText(renderEssayHtml({ type: "doc", content: nodes })) : "");

export function bodyFromDoc(doc: EssayDoc): PieceBody {
  const nodes = [...(doc.content ?? [])];
  let pullQuote: string | null = null;
  let picture: string | null = null;
  let caption: string | null = null;
  const rest: EssayNode[] = [];
  for (const n of nodes) {
    if (pullQuote === null && n.type === "pullQuote") {
      const text = plain(n.content).trim();
      if (text) {
        pullQuote = text;
        continue;
      }
    }
    if (picture === null && (n.type === "essayImage" || n.type === "image")) {
      const a = n.attrs ?? {};
      const src = typeof a.src === "string" ? a.src.trim() : "";
      if (SAFE_SRC.test(src)) {
        picture = src;
        const cap = n.type === "image" ? a.title : a.caption;
        caption = typeof cap === "string" && cap.trim() ? cap.trim() : null;
        continue;
      }
    }
    rest.push(n);
  }

  const groups: Array<{ title: string; nodes: EssayNode[] }> = [{ title: "", nodes: [] }];
  for (const n of rest) {
    if (n.type === "heading" && Number(n.attrs?.level) <= 2) {
      groups.push({ title: plain(n.content).trim(), nodes: [] });
    } else {
      groups[groups.length - 1]!.nodes.push(n);
    }
  }
  const used = new Set<string>();
  const sections = groups
    .filter((g) => g.title || g.nodes.length)
    .map((g, i) => {
      let id = g.title ? slug(g.title) : "intro";
      while (used.has(id)) id = `${id}-${i}`;
      used.add(id);
      return { id, title: g.title, html: html(g.nodes) };
    });

  return { bodyHtml: html(rest), sections, pullQuote, picture, caption };
}

/**
 * A piece with no block document (body_format 'html'): the stored HTML, sanitised, split into
 * sections at each <h2>. No picture or pull quote is lifted out of free HTML (it would draw twice).
 */
export function bodyFromHtml(raw: string | null | undefined): PieceBody {
  const clean = sanitizeRichText(raw ?? "");
  const sections: PieceBody["sections"] = [];
  const parts = clean.split(/(?=<h2[\s>])/i);
  const used = new Set<string>();
  parts.forEach((part, i) => {
    const m = /^<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(part);
    const title = m ? m[1]!.replace(/<[^>]+>/g, "").trim() : "";
    const inner = (m ? part.slice(m[0].length) : part).trim();
    if (!title && !inner) return;
    let id = title ? slug(title) : "intro";
    while (used.has(id)) id = `${id}-${i}`;
    used.add(id);
    sections.push({ id, title, html: inner });
  });
  return { bodyHtml: clean, sections, pullQuote: null, picture: null, caption: null };
}

/** Reading minutes: about 220 words a minute, rounded up, at least one. */
export function minutesOf(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function textOfHtml(h: string): string {
  return h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * A description for service, series, artwork and event: sanitised HTML when the stored text is HTML
 * (the templates and the popup layers draw it through `Prose`, which renders it), else the plain text as
 * it is (Prose splits it into paragraphs and renders it as text nodes, so it needs no escaping).
 */
export function descriptionOf(h: string | null | undefined): string {
  if (!h) return "";
  return /<\/?[a-z][\s\S]*>/i.test(h) ? sanitizeRichText(h).trim() : h.trim();
}

/**
 * Sanitised HTML -> plain paragraphs (blank line between). The offer templates for service, series and
 * artwork draw `description` as text in a <p>, and the surface layers' Prose treats text with no tag as
 * paragraphs split on blank lines, so plain text reads right in both. Angle brackets are never restored
 * (`&lt;` becomes a typographic bracket), so the result can never look like HTML to `looksLikeHtml`.
 */
export function htmlToParagraphs(h: string | null | undefined): string {
  if (!h) return "";
  return sanitizeRichText(h)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|figure|figcaption|aside)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "‹")
    .replace(/&gt;/g, "›")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[<>]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
