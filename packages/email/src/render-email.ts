import { render } from '@react-email/render';
import type { ReactElement } from 'react';

// ============================================================================
// One place every letter becomes a string — and where Outlook gets told how
// wide the thing is.
//
// ── The problem ─────────────────────────────────────────────────────────────
//
// The card is `width="100%"` with `max-width:600px`. Modern clients cap it at
// 600; Outlook on Windows renders through Word, which ignores max-width
// entirely, so the letter ran the full width of the reading pane — a 1400px
// line of 15px type.
//
// ── The fix, and why it is shaped like this ─────────────────────────────────
//
// Adapted from Cerberus (MIT, © 2017 Ted Goas) — the hybrid pattern's outer
// wrapper: a fixed-width table that ONLY Outlook sees, wrapped around
// everything, leaving the fluid max-width to do the work everywhere else.
//
// Applied to the rendered STRING rather than written in the component, because
// conditional comments have to be plain siblings of the content and React
// cannot emit a bare comment node — `dangerouslySetInnerHTML` needs an element
// to hang off, and a <div> between the opening conditional and the table it
// opens produces markup Word closes in the wrong place. At the string level
// they sit exactly where Cerberus puts them.
//
// See NOTICE at the repository root.
// ============================================================================

const MSO_OPEN =
  '<!--[if mso]><table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" width="600"><tr><td><![endif]-->';
const MSO_CLOSE = '<!--[if mso]></td></tr></table><![endif]-->';

/**
 * Wrap a rendered document so Outlook holds it to 600px.
 *
 * Idempotent: a document that already carries the wrapper is returned
 * untouched, so a caller that renders through here twice — or a template that
 * composes another — cannot end up nested two deep.
 */
export function withOutlookWidth(html: string): string {
  if (!html || html.includes('[if mso]')) return html;

  const bodyOpen = /<body\b[^>]*>/i.exec(html);
  if (!bodyOpen) return html;

  const openAt = bodyOpen.index + bodyOpen[0].length;
  const closeAt = html.lastIndexOf('</body>');
  if (closeAt === -1 || closeAt < openAt) return html;

  return (
    html.slice(0, openAt) +
    MSO_OPEN +
    html.slice(openAt, closeAt) +
    MSO_CLOSE +
    html.slice(closeAt)
  );
}

/**
 * Render a letter to the HTML that gets sent.
 *
 * Every `render*Email` goes through here rather than calling `render` itself,
 * so a document-level fix lands on all eleven at once instead of on whichever
 * ten someone remembered.
 */
export async function renderEmail(element: ReactElement): Promise<string> {
  return withOutlookWidth(await render(element));
}
