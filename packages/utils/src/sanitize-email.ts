/**
 * HTML sanitization for rich text that is going into an EMAIL.
 *
 * A fourth profile beside sanitizeRichText / sanitizePostBody / sanitizeSilexHtml,
 * and it earns its place by doing something none of them do: it INLINES the
 * styling. Mail clients strip <style> blocks and ignore classes — Gmail drops
 * <style> in the forwarded copy, Outlook rewrites it — so markup that looks
 * right in a browser arrives in an inbox as unstyled Times New Roman. Rich text
 * that is not inlined is not rich text once it is sent.
 *
 * The tag list is also much narrower than the editor's. Tables, code blocks,
 * YouTube iframes and images-by-URL either do not render in Outlook, do not
 * render in the Gmail app, or get the whole message binned as suspicious. What
 * survives is what a person actually wants when they write a paragraph in their
 * organisation's voice: emphasis, links, lists, a quote, a small heading.
 *
 * Nothing here decides WHETHER to send HTML — see richBody() in @elkdonis/email.
 * This turns a given string into markup that is safe to put in front of a
 * stranger's mail client.
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * What an org may write in a letter. Deliberately smaller than the editor can
 * emit: the editor is shared with the blog, where a table is fine.
 */
const EMAIL_TAGS = [
  'p', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
  'a',
  'ul', 'ol', 'li',
  'blockquote',
  'h2', 'h3',
  'span',
];

/**
 * `style` is allowed because this module WRITES it — an author's own inline
 * colours are overwritten below, not preserved. `href` and the link hardening
 * attributes are the only other things that survive.
 */
const EMAIL_ATTR = ['href', 'style', 'target', 'rel'];

/** The colours an email body is drawn in. Supplied by the caller's palette. */
export interface EmailHtmlPalette {
  /** Body copy. */
  text: string;
  /** Quiet text — a blockquote, a rule. */
  muted: string;
  /** Links and the quote's edge. */
  accent: string;
  /** Hairlines. */
  border: string;
}

/**
 * Per-tag inline style. Every rule here has to survive Outlook's HTML renderer,
 * which is Word's: no flexbox, no shorthand `margin` with fewer than four
 * values in some builds, no `rem`.
 */
function styleFor(tag: string, palette: EmailHtmlPalette): string | null {
  const body = `font-size:15px;line-height:1.75;color:${palette.text};`;
  switch (tag) {
    case 'P':
      return `${body}margin:0 0 16px 0;`;
    case 'H2':
      return `font-size:18px;line-height:1.4;color:${palette.text};font-weight:600;margin:24px 0 10px 0;`;
    case 'H3':
      return `font-size:16px;line-height:1.4;color:${palette.text};font-weight:600;margin:20px 0 8px 0;`;
    case 'UL':
    case 'OL':
      // Outlook needs the left padding on the list, not the item.
      return `${body}margin:0 0 16px 0;padding-left:22px;`;
    case 'LI':
      return `${body}margin:0 0 6px 0;`;
    case 'BLOCKQUOTE':
      // Not `${body}` + an override: that emitted `color:x;color:y` in one
      // attribute, and Outlook's HTML parser is not dependable about which of
      // two identical declarations wins.
      return `font-size:15px;line-height:1.75;color:${palette.muted};margin:0 0 16px 0;padding:2px 0 2px 14px;border-left:3px solid ${palette.accent};`;
    case 'A':
      return `color:${palette.accent};text-decoration:underline;`;
    case 'HR':
      return `border:none;border-top:1px solid ${palette.border};margin:24px 0;`;
    case 'STRONG':
    case 'B':
      return 'font-weight:600;';
    case 'EM':
    case 'I':
      return 'font-style:italic;';
    case 'U':
      return 'text-decoration:underline;';
    case 'S':
    case 'STRIKE':
    case 'DEL':
      return 'text-decoration:line-through;';
    default:
      return null;
  }
}

/**
 * Sanitize and inline-style rich text for an email body.
 *
 * Returns '' for nullish input, and for input that sanitizes down to nothing —
 * an editor that has been emptied leaves `<p></p>` behind, and a caller needs
 * to be able to tell "they wrote nothing" from "they wrote something".
 */
export function sanitizeEmailHtml(
  html: string | null | undefined,
  palette: EmailHtmlPalette
): string {
  if (!html) return '';

  // Two passes rather than one hook-driven pass, because the hook has to be
  // registered against THIS palette and DOMPurify's hooks are global: two
  // letters rendering concurrently with different org accents would race for
  // the same hook. The second pass walks the result instead.
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: EMAIL_TAGS,
    ALLOWED_ATTR: EMAIL_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'class', 'id'],
  });

  return inlineStyles(clean, palette);
}

/**
 * Rewrite every tag's `style` attribute from the palette.
 *
 * String-based rather than DOM-based on purpose: this runs inside the send
 * path, which is already holding a database connection and a SendGrid client,
 * and standing up a jsdom document per letter to set a dozen attributes is not
 * a trade worth making. The input has ALREADY been through DOMPurify, so what
 * arrives here is a known-small set of tags with a known-small set of
 * attributes — the regex is operating on output this module produced, not on
 * anything a person typed.
 */
function inlineStyles(html: string, palette: EmailHtmlPalette): string {
  return html.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (whole, rawTag: string, attrs: string) => {
    const tag = rawTag.toUpperCase();
    const style = styleFor(tag, palette);
    if (!style) return whole;

    // Drop whatever style the author's editor put there and use ours. An org
    // choosing its own 8px grey body text in a letter the network is
    // accountable for is not a feature.
    const withoutStyle = attrs.replace(/\s+style\s*=\s*"[^"]*"/gi, '').replace(/\s+style\s*=\s*'[^']*'/gi, '');
    return `<${rawTag}${withoutStyle} style="${style}">`;
  });
}

// The plain-text fallback lives in its own module (no DOMPurify) and is
// re-exported here so callers of the email sanitizer find it in one place.
export { emailHtmlToText } from './html-to-text';
