import * as React from 'react';
import { Section, Text, Button, Img } from '@react-email/components';
import { renderEmail } from '../render-email';
import { EmailShell, getEmailPalette } from '../components/EmailShell';

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
  links?: NewsletterLinkItem[];
  media?: NewsletterMediaItem[];
}

const defaultBodyText = `A short letter from the collective: upcoming gatherings, studio notes, publication fragments, and invitations to take part.

Use this space for newsletter copy that is not tied to account creation.`;

function paragraphsFromText(value?: string) {
  return (value?.trim() || defaultBodyText)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function NewsletterEmail({
  title = 'A Letter From The Collective',
  previewText = 'Updates, invitations, and notes from Elkdonis Arts Collective.',
  orgName = 'Elkdonis Arts Collective',
  bodyText,
  links = [],
  media = [],
}: NewsletterEmailProps) {
  const bodyParagraphs = paragraphsFromText(bodyText);
  const palette = getEmailPalette(true);

  return (
    <EmailShell
      previewText={previewText}
      kicker={title}
      dark
      showNfpFooter
      footerText={
        <Text style={{ color: palette.textMuted, fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
          You are receiving this because you signed up for updates from {orgName}.
        </Text>
      }
    >
      {bodyParagraphs.map((paragraph, index) => (
        <Text key={index} style={{ color: palette.textBody, fontSize: '15px', lineHeight: '1.75', margin: '0 0 18px' }}>
          {paragraph}
        </Text>
      ))}

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