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
// Body face: Basteleur — the same face the site uses for body copy
// (root layout's --font-basteleur). No 'Times New Roman' in the fallback.
export const BODY_FONT_STACK = "'Basteleur', 'Cormorant Garamond', Georgia, serif";

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

export interface EmailShellProps {
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

  return (
    <Html lang="en">
      <Head>
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: palette.bodyBg, fontFamily: BODY_FONT_STACK, margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
          <Section
            style={{
              border: `1px solid ${EAC_GOLD}`,
              background: palette.cardBg,
            }}
          >
            {/* Marked like the body below: the newsletter editor draws this
                above the region it is editing, so an author composes inside the
                letter rather than on a blank white page. */}
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
                borderBottom: `1px solid ${EAC_GOLD}`,
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
              style={{ padding: '38px 40px', fontFamily: BODY_FONT_STACK }}
            >
              {children}
            </Section>

            {(footerText || showNfpFooter) && (
              <Section
                data-eac-footer="1"
                style={{ padding: '0 40px 30px', fontFamily: BODY_FONT_STACK }}
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
