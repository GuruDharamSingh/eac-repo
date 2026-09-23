import * as React from 'react';
import { Html, Head, Body, Container, Section, Text, Hr, Preview, Img } from '@react-email/components';

// Public origin where the brand fonts are served (/fonts/*) — the same files
// the site itself uses (Brothers for display headings, Basteleur for body
// copy — see apps/inner-gathering/src/app/layout.tsx's localFont setup).
const FONT_BASE_URL = 'https://elkdonis-arts.org/fonts';

const fontFaceCss = `
@font-face {
  font-family: 'Brothers';
  src: url('${FONT_BASE_URL}/BrothersTypeface-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Basteleur';
  src: url('${FONT_BASE_URL}/Basteleur-Moonlight.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Basteleur';
  src: url('${FONT_BASE_URL}/Basteleur-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
`;

// Header face: Brothers first (embedded above), Cinzel/serif fallback for
// clients that strip @font-face (Gmail, Outlook desktop).
export const HEADER_FONT_STACK = "'Brothers', 'Cinzel', Georgia, serif";
// ── Body faces ──────────────────────────────────────────────────────────────
//
// A NAMED CHOICE, never a free string. A font stack is interpolated straight
// into a `style` attribute in an email, which is the same reason the org
// palette next door is a hex allow-list: the safe move is for the code to own
// every value and the org to pick one by id.
//
// The default changed (2026-09-18) from Basteleur — the site's display serif —
// to a neutral sans. Basteleur is a DISPLAY face: it was drawn for headings,
// it is delivered by @font-face, and Gmail, Outlook and Yahoo all strip
// @font-face outright. So in the clients most people actually read mail in,
// the body was never Basteleur anyway; it was the fallback, which meant a
// letter looked one way in a preview pane and another in an inbox. A stack
// whose FIRST entry is installed everywhere removes that gap.
//
// The display serif is still available as a choice for an org that wants it.

export type EmailFontId =
  | 'sans'
  | 'book'
  | 'grotesk'
  | 'humanist'
  | 'transitional'
  | 'compact'
  | 'record'
  | 'collective';

export interface EmailFont {
  label: string;
  /** What it reads like, for the picker. */
  hint: string;
  stack: string;
}

export const EMAIL_FONTS: Record<EmailFontId, EmailFont> = {
  sans: {
    label: 'Neutral sans',
    hint: 'Plain and legible everywhere. The safest choice for mail.',
    stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },
  book: {
    label: 'Book serif',
    hint: 'Warmer, for longer letters. Installed on every desktop and phone.',
    stack: "Georgia, 'Times New Roman', Times, serif",
  },
  grotesk: {
    label: 'Grotesque',
    hint: 'Tighter and more editorial than the neutral sans.',
    stack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  // ── Added 2026-09-20 ────────────────────────────────────────────────────
  //
  // Four more, and every one of them chosen on the SAME test as the first
  // three: the first name in the stack ships with Windows, macOS, iOS and
  // Android, so no client ever has to substitute. That test is the whole
  // reason this list is short and the reason it is a list at all rather than
  // an upload box — Gmail, Outlook and Yahoo strip @font-face outright, so a
  // face a recipient does not already have is a face they will never see.
  humanist: {
    label: 'Wide humanist',
    hint: 'Verdana. Drawn for screens and the most forgiving at small sizes.',
    stack: "Verdana, Geneva, 'DejaVu Sans', sans-serif",
  },
  transitional: {
    label: 'Old-style serif',
    hint: 'Palatino. Rounder and less formal than the book serif.',
    stack: "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
  },
  compact: {
    label: 'Compact sans',
    hint: 'Tahoma. Narrow, so more words fit on a line in a phone preview.',
    stack: "Tahoma, 'Segoe UI', Geneva, Verdana, sans-serif",
  },
  record: {
    label: 'Typewriter',
    hint: 'Monospace. For letters that read as a notice or a receipt.',
    stack: "'Courier New', Courier, 'Liberation Mono', monospace",
  },
  collective: {
    label: 'Collective serif',
    hint: 'The display face from the website. Most inboxes will substitute it.',
    stack: "'Basteleur', 'Cormorant Garamond', Georgia, serif",
  },
};

export const DEFAULT_EMAIL_FONT: EmailFontId = 'sans';

/** A font id → its stack. An unknown or absent id falls back to the default. */
export function emailFontStack(id?: string): string {
  return (EMAIL_FONTS[id as EmailFontId] ?? EMAIL_FONTS[DEFAULT_EMAIL_FONT]).stack;
}

/** The default body stack. Kept as a constant for callers that had one. */
export const BODY_FONT_STACK = EMAIL_FONTS[DEFAULT_EMAIL_FONT].stack;

export const EAC_GOLD = '#b79a55';
export const EAC_INK = '#022278';

export interface EmailPalette {
  cardBg: string;
  bodyBg: string;
  /** Headings, names, emphasized values. */
  textPrimary: string;
  /** Regular paragraph copy. */
  textBody: string;
  /** Captions, labels, footer copy. */
  textMuted: string;
  /** Inset detail-box background/border. */
  boxBg: string;
  boxBorder: string;
  /** Link/button accent. */
  accent: string;
}

const LIGHT_PALETTE: EmailPalette = {
  cardBg: '#fffdf8',
  bodyBg: '#efe9db',
  textPrimary: '#01124E',
  textBody: '#374238',
  textMuted: '#8f763c',
  boxBg: '#f4f7ff',
  boxBorder: '#dce6ff',
  accent: '#022278',
};

const DARK_PALETTE: EmailPalette = {
  cardBg: '#141a2e',
  bodyBg: '#05070d',
  textPrimary: '#fdf0d0',
  textBody: '#d9d2c2',
  textMuted: '#b79a55',
  boxBg: '#1c2440',
  boxBorder: '#333f6b',
  accent: '#c9a84c',
};

export function getEmailPalette(dark = false): EmailPalette {
  return dark ? DARK_PALETTE : LIGHT_PALETTE;
}

const NFP_FOOTER_TEXT =
  "Elkdonis Arts is a not-for-profit and a collective exercise in providing open resources. We're continuing to grow what we offer — thank you for your patience and interest in our work.";

/**
 * The letter's chrome: the picture at the top of the card, and the rule
 * around it.
 *
 * Its own interface because it travels as one unit. Every template takes it
 * as a single `chrome` prop and spreads it onto the shell without reading a
 * field of it — a template's body has no opinion about the masthead — so
 * grouping the four keeps nine signatures from each growing four props, and
 * keeps them from drifting apart the first time one of them is edited alone.
 */
export interface EmailChrome {
  /**
   * The organisation's own masthead image, shown INSTEAD of the navy-and-gold
   * wordmark at the top of every letter.
   *
   * An absolute https URL, validated where it is stored (identity.ts) rather
   * than here — this component interpolates it into a `src`, so the same rule
   * applies as to the palette hexes next door: the code owns what may appear
   * and the org supplies only a value that passed the check.
   *
   * Unlike `orgHeader`, this is NOT gated on the org sending from its own
   * authenticated domain. A picture is decoration; the From line is a claim
   * about identity, and only the second is what a spam filter reads. So an
   * org's banner appears the day it is set, and whose NAME leads the letter
   * still switches over on the day its DNS lands.
   */
  bannerUrl?: string;
  /** Alt text for the banner. Falls back to the name in the header. */
  bannerAlt?: string;
  /**
   * The rule around the card, and under the masthead.
   *
   * The collective's gold hairline is the default. An org that has a frame of
   * its own on its website — IFAC's 2px purple is the case this was built for
   * — can carry it into its mail, so a letter and the site it comes from are
   * recognisably the same thing.
   */
  frameColor?: string;
  /** Frame thickness in px, 1–4. Anything else falls back to 1. */
  frameWidth?: number;
}

export interface EmailShellProps extends EmailChrome {
  /** Inbox preview snippet. */
  previewText: string;
  /** Small line under the collective name — e.g. "New RSVP", "Order Confirmation". */
  kicker?: string;
  /** Dark card/background variant. Defaults to the light parchment theme. */
  dark?: boolean;
  /** Footer copy, rendered below a divider inside the card. */
  footerText?: React.ReactNode;
  /** Appends the standard not-for-profit/open-source note below footerText. */
  showNfpFooter?: boolean;
  /**
   * Small emblem shown in the header banner, above the collective name.
   * Opt-in per org (e.g. amrit-canada's Khanda) -- unset for every other
   * caller today, so this is purely additive to existing output.
   */
  emblemUrl?: string;
  emblemAlt?: string;
  /**
   * The organisation's own name, shown in the header INSTEAD of the
   * collective's — but only when `orgHeader` is true.
   */
  orgName?: string;
  /**
   * True once the org actually sends from its own authenticated domain
   * (identity.fromIsOrgDomain). Tied to that rather than to merely having a
   * name, because a header claiming to be IFAC above a From address of
   * info@em6860.elkdonis-arts.org is the kind of mismatch spam filters read as
   * impersonation — and a reader would be right to distrust it too.
   */
  orgHeader?: boolean;
  /** The org's own accent. Used for its name and kicker in the header. */
  orgAccent?: string;
  /**
   * Which body face this organisation's mail is set in, by id.
   *
   * See EMAIL_FONTS. Absent means the network default.
   */
  bodyFont?: string;
  children: React.ReactNode;
}

// Shared chrome for every outbound email: "Elkdonis Arts Collective" header
// in the Brothers display face (matching the /feed page header), a gold
// border around the whole card (matching the email-templates preview page's
// own iframe border), and Basteleur body copy (matching the site's body
// font). Square corners throughout. Individual templates own everything
// inside — detail boxes, buttons, colors — via getEmailPalette(dark).
export function EmailShell({
  previewText,
  kicker,
  dark = false,
  footerText,
  showNfpFooter = false,
  emblemUrl,
  emblemAlt,
  orgName,
  orgHeader = false,
  orgAccent,
  bodyFont,
  bannerUrl,
  bannerAlt,
  frameColor,
  frameWidth,
  children,
}: EmailShellProps) {
  const palette = getEmailPalette(dark);

  // Whose name leads. When an org has its own authenticated sending domain,
  // its name is the only one in the header — the reader has a relationship
  // with the organisation, and the network is named in the body copy instead,
  // where it can be a sentence rather than a badge.
  const ownHeader = orgHeader && !!orgName;
  const headerName = ownHeader ? orgName : 'Elkdonis Arts Collective';
  const accent = (ownHeader && orgAccent) || EAC_GOLD;
  const bodyStack = emailFontStack(bodyFont);

  // The frame. Hex-only and 1–4px, for the same reason as every other value
  // that reaches a `style` attribute here; both are already checked where
  // they are stored, and this is the second line of that defence rather than
  // the first, because this component is also called directly in tests.
  const frame = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(frameColor ?? ''))
    ? (frameColor as string)
    : EAC_GOLD;
  const frameW =
    Number.isInteger(frameWidth) && frameWidth! >= 1 && frameWidth! <= 4 ? frameWidth! : 1;
  const rule = `${frameW}px solid ${frame}`;

  // A banner replaces the wordmark rather than sitting above it: two mastheads
  // is not branding, it is a letter that starts twice. The org's name still
  // rides along as the image's alt text, which is what the substantial share
  // of inboxes that block images by default will show in its place.
  const banner = typeof bannerUrl === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(bannerUrl)
    ? bannerUrl
    : undefined;

  return (
    <Html lang="en">
      <Head>
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: palette.bodyBg, fontFamily: bodyStack, margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
          <Section
            style={{
              border: rule,
              background: palette.cardBg,
            }}
          >
            {/* Marked like the body below: the newsletter editor draws this
                above the region it is editing, so an author composes inside the
                letter rather than on a blank white page. */}
            {banner ? (
              /* The org's own masthead.

                 `width="600"` with `max-width:100%` and `height:auto`: Outlook
                 renders through Word, which honours the HTML width attribute
                 and ignores the CSS, so without the attribute a wide banner
                 blows the 600px column open in exactly the client the MSO
                 wrapper in render-email.ts exists to contain. `display:block`
                 kills the baseline gap under an image that otherwise shows as
                 a hairline of card colour between the banner and the body. */
              <Section
                data-eac-header="1"
                style={{
                  padding: 0,
                  fontSize: 0,
                  lineHeight: 0,
                  borderBottom: rule,
                  backgroundColor: '#01124E',
                }}
              >
                <Img
                  src={banner}
                  alt={bannerAlt ?? headerName}
                  width="600"
                  style={{
                    display: 'block',
                    width: '100%',
                    maxWidth: '600px',
                    height: 'auto',
                    border: 0,
                  }}
                />
                {kicker && (
                  <Text
                    style={{
                      color: accent,
                      backgroundColor: '#01124E',
                      fontSize: '11px',
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.13em',
                      lineHeight: '1.4',
                      textAlign: 'center' as const,
                      margin: 0,
                      padding: '8px 32px',
                    }}
                  >
                    {kicker}
                  </Text>
                )}
              </Section>
            ) : (
            <Section
              data-eac-header="1"
              style={{
                /*
                  Solid FIRST, gradient second.

                  Outlook 2007–2019 renders through Word, which has no gradient
                  support and drops the declaration entirely. With only a
                  gradient the masthead rendered with NO background — putting
                  #fdf0d0 text on white at 1.13:1, i.e. the organisation's name
                  invisible, in the client a good share of members read mail in.

                  Word takes backgroundColor and ignores backgroundImage; every
                  modern client paints the gradient over it. #01124E is the
                  gradient's own first stop, so nothing looks different where
                  the gradient does work.
                */
                backgroundColor: '#01124E',
                backgroundImage:
                  'linear-gradient(90deg, #01124E 0%, #022278 54%, #063179 100%)',
                padding: '20px 32px',
                textAlign: 'center' as const,
                borderBottom: rule,
              }}
            >
              {emblemUrl && (
                <Img
                  src={emblemUrl}
                  alt={emblemAlt ?? ''}
                  width="30"
                  height="30"
                  style={{ margin: '0 auto 8px', display: 'block' }}
                />
              )}
              <Text
                style={{
                  color: ownHeader ? accent : '#fdf0d0',
                  fontSize: '19px',
                  fontFamily: HEADER_FONT_STACK,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.09em',
                  lineHeight: '1.25',
                  margin: 0,
                }}
              >
                {headerName}
              </Text>
              {kicker && (
                <Text
                  style={{
                    color: accent,
                    fontSize: '11px',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.13em',
                    margin: ownHeader ? '6px 0 0' : '8px 0 0',
                  }}
                >
                  {kicker}
                </Text>
              )}
            </Section>
            )}

            {/*
              The org-editable region.

              Marked so one reader can lift exactly this out of a rendered
              letter: the newsletter editor seeds itself from the body of the
              template you clicked, and an org's own layout replaces precisely
              this — never the header above or the footer below, which is what
              keeps an unsubscribe link out of reach of a layout.
            */}
            <Section
              data-eac-body="1"
              style={{ padding: '38px 40px', fontFamily: bodyStack }}
            >
              {children}
            </Section>

            {(footerText || showNfpFooter) && (
              <Section
                data-eac-footer="1"
                style={{ padding: '0 40px 30px', fontFamily: bodyStack }}
              >
                <Hr style={{ border: 'none', borderTop: `1px solid ${palette.boxBorder}`, margin: '0 0 20px' }} />
                {footerText}
                {showNfpFooter && (
                  <Text
                    style={{
                      fontSize: '12px',
                      color: palette.textMuted,
                      lineHeight: '1.6',
                      margin: footerText ? '14px 0 0' : 0,
                    }}
                  >
                    {NFP_FOOTER_TEXT}
                  </Text>
                )}
              </Section>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
