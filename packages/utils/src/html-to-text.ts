/**
 * HTML → plain text, for the text/plain part of an email and for the stored
 * `bodyText` beside a rich `bodyHtml`.
 *
 * Its own module, with no imports, deliberately: it sits beside
 * `sanitizeEmailHtml`, which pulls in DOMPurify (and jsdom on the server) —
 * and the rich-text EDITOR needs this function in the browser, where none of
 * that should be downloaded to turn some tags into newlines.
 */

/**
 * Plain-text fallback for a rich body.
 *
 * Every letter stores BOTH — the HTML for the message, and this for the
 * templates that still render paragraphs, for the text/plain part, and for the
 * preview line. Deriving it here rather than asking the author to write it
 * twice is the only way the two stay in agreement.
 */
export function emailHtmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    // A break or the end of a block is a newline; everything else is inline.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h2|h3|li|blockquote|ul|ol)>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
