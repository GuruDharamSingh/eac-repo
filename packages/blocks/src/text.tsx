import { Fragment } from "react";

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
// Rich text belongs in the thread editor, which sanitizes. A block is for
// arranging.
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
