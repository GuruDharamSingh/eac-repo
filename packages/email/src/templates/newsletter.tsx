import * as React from 'react';
import { Section, Text, Button, Img } from '@react-email/components';
import { renderEmail } from '../render-email';
import { EmailShell, getEmailPalette } from '../components/EmailShell';
import type { EmailChrome } from '../components/EmailShell';
import { OrgWords } from '../components/org-words';

export interface NewsletterLinkItem {
  label: string;
  url: string;
}

export interface NewsletterMediaItem {
  url: string;
  alt?: string;
  caption?: string;
}

export interface NewsletterEmailProps {
  title?: string;
  previewText?: string;
  orgName?: string;
  bodyText?: string;
  /** The same words with emphasis, links and lists. Wins over bodyText. */
  bodyHtml?: string;
  /** Which body face this organisation's mail is set in, by id. */
  bodyFont?: string;
  /**
   * The organisation's own masthead image and frame — see `EmailChrome`.
   *
   * ONE bag rather than four more props, and passed straight through to the
   * shell without this template reading any of it. Every other brand value
   * here (`orgName`, `orgAccent`, `bodyFont`) is threaded individually
   * because the BODY uses it too; nothing in a body has an opinion about the
   * picture at the top of the card, so spreading it is both shorter and the
   * honest description of what happens to it.
   */
  chrome?: EmailChrome;
  links?: NewsletterLinkItem[];
  media?: NewsletterMediaItem[];
}

const defaultBodyText = `A short letter from the collective: upcoming gatherings, studio notes, publication fragments, and invitations to take part.

Use this space for newsletter copy that is not tied to account creation.`;

function NewsletterEmail({
  title = 'A Letter From The Collective',
  previewText = 'Updates, invitations, and notes from Elkdonis Arts Collective.',
  orgName = 'Elkdonis Arts Collective',
  bodyText,
  bodyHtml,
  bodyFont,
  chrome,
  links = [],
  media = [],
}: NewsletterEmailProps) {
  const palette = getEmailPalette(true);

  return (
    <EmailShell
      previewText={previewText}
      kicker={title}
      dark
      bodyFont={bodyFont}
      {...chrome}
      showNfpFooter
      footerText={
        <Text style={{ color: palette.textMuted, fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
          You are receiving this because you signed up for updates from {orgName}.
        </Text>
      }
    >
      <OrgWords
        bodyText={bodyText?.trim() ? bodyText : defaultBodyText}
        bodyHtml={bodyHtml}
        dark
        font={bodyFont}
      />

      {media.map((item, index) => (
        <Section key={`${item.url}-${index}`} style={{ margin: '28px 0' }}>
          <Img
            src={item.url}
            alt={item.alt ?? ''}
            style={{ width: '100%', display: 'block', border: `1px solid ${palette.boxBorder}` }}
          />
          {item.caption && (
            <Text style={{ color: palette.textMuted, fontSize: '12px', lineHeight: '1.6', margin: '10px 0 0' }}>
              {item.caption}
            </Text>
          )}
        </Section>
      ))}

      {links.length > 0 && (
        <Section style={{ margin: '30px 0 8px' }}>
          {links.map((link) => (
            <Button
              key={`${link.label}-${link.url}`}
              href={link.url}
              style={{
                backgroundColor: palette.accent,
                color: '#0b0e18',
                display: 'inline-block',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                margin: '0 8px 10px 0',
                padding: '13px 18px',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </Button>
          ))}
        </Section>
      )}
    </EmailShell>
  );
}

export async function renderNewsletterEmail(props: NewsletterEmailProps): Promise<string> {
  return renderEmail(React.createElement(NewsletterEmail, props));
}