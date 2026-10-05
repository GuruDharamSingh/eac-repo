import { Fragment, type HTMLAttributes, type ReactNode } from "react";
import { sanitizePageText } from "@elkdonis/utils/sanitize";

// ============================================================================
// Author-typed text, rendered safely.
//
// Two blocks now take a body of text — prose, and the image-and-text block —
// and both must treat it identically: blank lines separate paragraphs, a
// single newline is a line break, and every character reaches the page as a
// TEXT NODE rather than as markup.
//
// That last rule is why this is a shared function and not a copied loop.
// Blocks are placed by org members, a page is public, and the moment one of
// the two copies reaches for `dangerouslySetInnerHTML` the page builder has
// become an XSS vector. One implementation means one thing to get right.
//
// RICH text (a `richtext` prop, typed on the page in the editor) is the one
// exception, and it goes through <RichText> below: HTML is rendered only
// after `sanitizePageText` (@elkdonis/utils) has cut it down to paragraphs,
// emphasis, links, lists, subheadings and quotes. The sanitising is here, at
// render, so every page that shows the block is covered whatever path the
// HTML took into the database; page-builder also sanitises on save.
// ============================================================================

/**
 * Split a body into paragraphs on blank lines.
 *
 * `\r\n` as well as `\n`, because text pasted from a document editor on
 * Windows carries carriage returns and would otherwise be one long paragraph.
 */
export function toParagraphs(body: string | undefined): string[] {
  return (body ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** The paragraphs of a body, as `<p>` elements. Empty body renders nothing. */
export function Paragraphs({ body }: { body?: string }) {
  const paragraphs = toParagraphs(body);
  if (paragraphs.length === 0) return null;

  return (
    <>
      {paragraphs.map((paragraph, i) => (
        // A single newline inside a paragraph stays a line break, which is what
        // someone typing an address or a verse expects.
        <p key={i}>
          {paragraph.split(/\r?\n/).map((line, j, all) => (
            <Fragment key={j}>
              {line}
              {j < all.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

// ── Rich text ───────────────────────────────────────────────────────────────

/** The block-level tag the editor's HTML always starts with; plain text never does. */
const RICH_START = /^\s*<(p|h[1-6]|ul|ol|blockquote)[\s>]/i;

/** True for HTML written by the rich-text editor, false for plain text typed before a prop became rich. */
export function isRichHtml(value: unknown): value is string {
  return typeof value === "string" && RICH_START.test(value);
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Plain text as the editor's HTML: blank lines make paragraphs, single
 * newlines line breaks — what <Paragraphs> draws, so opening an old page in
 * the rich editor keeps its paragraphs. Rich HTML is returned unchanged.
 */
export function textToHtml(body: string): string {
  if (isRichHtml(body)) return body;
  return toParagraphs(body)
    .map((p) => `<p>${p.split(/\r?\n/).map(escapeHtml).join("<br>")}</p>`)
    .join("");
}

/** Whether a body has anything to show. The editor's on-page editor always counts. */
export function hasText(body: unknown): boolean {
  if (body === undefined || body === null || body === "") return false;
  if (typeof body !== "string") return true;
  if (!isRichHtml(body)) return toParagraphs(body).length > 0;
  return sanitizePageText(body).replace(/<[^>]*>/g, "").trim() !== "";
}

/**
 * A rich-text body in a container of the caller's choosing (class, data
 * attributes). Three shapes arrive: the editor's on-page editor (a React
 * node, drawn as is), HTML from it (sanitised, then set as the container's
 * content), or plain text from before (as <Paragraphs>).
 */
export function RichText({ body, ...rest }: { body?: string | ReactNode } & HTMLAttributes<HTMLDivElement>) {
  if (typeof body !== "string") return <div {...rest}>{body}</div>;
  if (!isRichHtml(body)) {
    return (
      <div {...rest}>
        <Paragraphs body={body} />
      </div>
    );
  }
  return <div {...rest} dangerouslySetInnerHTML={{ __html: sanitizePageText(body) }} />;
}

/**
 * Every rich-text string anywhere in a saved page, sanitised — the save-side
 * twin of <RichText>'s render-side sanitising (@elkdonis/page-builder calls
 * it before writing a page). Recognises rich text by its shape, since a page
 * store does not know which props are rich; plain text passes untouched.
 */
export function sanitizeRichValues<T>(value: T): T {
  if (isRichHtml(value)) return sanitizePageText(value) as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeRichValues(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitizeRichValues(v);
    return out as T;
  }
  return value;
}
