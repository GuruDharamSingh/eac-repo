import * as React from 'react';
import { sanitizeEmailHtml } from '@elkdonis/utils/sanitize-email';
import { getEmailPalette, emailFontStack } from './EmailShell';
import { Prose } from './cards';
import { paragraphsOf } from '../copy';
import { slotHtml, slotText, type CopyOverrides } from '../copy-slots';
import { fillHtml } from '../merge-fields';

/**
 * The organisation's own words, inside a letter the network laid out.
 *
 * Every template that lets an org add a paragraph used to do this inline:
 *
 *   paragraphsOf(bodyText).map((p, i) => <Prose key={i}>{p}</Prose>)
 *
 * — six copies of the same three lines, which is why adding rich text meant
 * editing six files rather than one. This is that block, plus the branch the
 * copies could not have: when the org wrote with the rich-text editor, render
 * what they actually composed.
 *
 * ── Why the HTML is re-styled on the way out ────────────────────────────────
 *
 * `sanitizeEmailHtml` overwrites every tag's inline style from the palette
 * passed here. That is not paranoia about markup — it is the only way the org's
 * paragraph looks like it belongs in the letter around it. A <p> arriving from
 * a browser editor carries the browser's 16px/Arial defaults; dropped into a
 * parchment card set in Basteleur at 15px it reads as a pasted screenshot.
 *
 * ── The plain-text path is not deprecated ───────────────────────────────────
 *
 * It is the fallback, and it has to stay: `bodyText` is what every letter
 * written before the editor existed holds, and what the text/plain part of a
 * message carries. An org that never opens the rich editor never gets HTML,
 * and nothing about their letters changes.
 */
export function OrgWords({
  bodyText,
  bodyHtml,
  dark = false,
  accent,
  font,
}: {
  bodyText?: string;
  bodyHtml?: string;
  dark?: boolean;
  /** The org's accent, when it has set one — links and the quote rule. */
  accent?: string;
  /** The org's body face, by id. Must match the letter around it. */
  font?: string;
}) {
  const palette = getEmailPalette(dark);

  if (bodyHtml?.trim()) {
    const html = sanitizeEmailHtml(bodyHtml, {
      text: palette.textBody,
      muted: palette.textMuted,
      accent: accent || palette.accent,
      border: palette.boxBorder,
    });
    // Empty after sanitising means the editor was left with an empty <p> —
    // fall through to the plain words rather than emitting a blank section.
    if (html) {
      // A plain <div>, not react-email's <Section>. Section renders a
      // table/tbody/tr/td and always supplies its own children, so handing it
      // `dangerouslySetInnerHTML` throws "Can only set one of `children` or
      // `props.dangerouslySetInnerHTML`" — which React swallows into an error
      // boundary, and the whole letter renders as an empty <template>. A div
      // is safe here because the styling is inlined on the tags INSIDE the
      // markup rather than carried by the wrapper's table.
      return (
        <div
          // Body type on the WRAPPER as well as on each tag inside it.
          //
          // The sanitizer strips tags it does not allow but keeps their text —
          // DOMPurify's default, and the right one: silently deleting words
          // somebody pasted is worse than reshaping them. The consequence is
          // that such text arrives as a bare node with no rule of its own, so
          // without this it would inherit the letter's heading face at the
          // browser's default size. With it, orphan text reads as body copy.
          style={{
            fontFamily: emailFontStack(font),
            fontSize: '15px',
            lineHeight: '1.75',
            color: palette.textBody,
            margin: '0 0 4px',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
  }

  const paragraphs = paragraphsOf(bodyText);
  if (paragraphs.length === 0) return null;

  return (
    <>
      {paragraphs.map((paragraph, i) => (
        <Prose key={`org-words-${i}`} dark={dark}>
          {paragraph}
        </Prose>
      ))}
    </>
  );
}

/**
 * Does this org have anything of its own to say in this letter?
 *
 * Templates gate a divider and a "From <org>" label on it, so the question has
 * to be answerable WITHOUT rendering — and it has to count rich text, or a
 * letter written entirely in the editor loses its heading.
 */
export function hasOrgWords(bodyText?: string, bodyHtml?: string): boolean {
  if (bodyHtml?.trim()) return true;
  return paragraphsOf(bodyText).length > 0;
}


/**
 * One named block of a letter — the org's version if it has one.
 *
 * The counterpart to OrgWords for copy the letter ALREADY HAD, rather than the
 * section an org appends. It exists because the two layers have to render the
 * same way: the editor offers rich text on a prose block, so a block that only
 * ever rendered its plain derivation would quietly drop every link and every
 * emphasis somebody typed, and the preview would show it happening without
 * saying why.
 *
 * Tokens are filled on BOTH paths. `{org}` in a rich block has to resolve for
 * the same reason it resolves in a plain one — an org that adds a link and
 * loses its own name in the process has been punished for formatting.
 */
export function SlotProse({
  copy,
  id,
  values = {},
  dark = false,
  accent,
  font,
}: {
  copy?: CopyOverrides;
  id: string;
  values?: Record<string, string | undefined>;
  dark?: boolean;
  accent?: string;
  font?: string;
}) {
  const html = slotHtml(copy, id);
  if (html) {
    return (
      <OrgWords bodyHtml={fillHtml(html, values)} dark={dark} accent={accent} font={font} />
    );
  }
  const paragraphs = slotText(copy, id, values);
  if (paragraphs.length === 0) return null;
  return (
    <>
      {paragraphs.map((paragraph, i) => (
        <Prose key={`${id}-${i}`} dark={dark}>
          {paragraph}
        </Prose>
      ))}
    </>
  );
}

/** Has this block been rewritten with formatting? */
export function slotIsRich(copy: CopyOverrides | undefined, id: string): boolean {
  return Boolean(slotHtml(copy, id));
}
