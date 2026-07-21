import * as React from 'react';
import { Section, Text, Button, Img } from '@react-email/components';
import { render } from '@react-email/render';
import { EmailShell, getEmailPalette } from '../components/EmailShell';

export interface WelcomeLinkItem {
  label: string;
  url: string;
}

export interface WelcomeMediaItem {
  url: string;
  alt?: string;
  caption?: string;
}

export interface WelcomeEmailProps {
  displayName: string;
  portalUrl?: string;
  bodyText?: string;
  links?: WelcomeLinkItem[];
  media?: WelcomeMediaItem[];
}

const defaultBodyText = `This is an email to confirm your sign up.

Thanks.`;

function paragraphsFromText(value?: string) {
  return (value?.trim() || defaultBodyText)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function WelcomeEmail({
  displayName,
  portalUrl = 'https://gathering.elkdonis-arts.org',
  bodyText,
  links,
  media = [],
}: WelcomeEmailProps) {
  const bodyParagraphs = paragraphsFromText(bodyText);
  const actionLinks = links === undefined ? [{ label: 'Enter the Collective', url: portalUrl }] : links;
  const palette = getEmailPalette(true);

  return (
    <EmailShell
      previewText="Welcome to Elkdonis Arts Collective"
      kicker="Welcome to the Collective"
      dark
      showNfpFooter
      footerText={
        <Text style={{ fontSize: '12px', color: palette.textMuted, margin: 0 }}>
          This email was sent because you created an account at{' '}
          <span style={{ color: palette.accent }}>elkdonis-arts.org</span>.
          If you did not sign up, you can safely ignore this message.
        </Text>
      }
    >
      <Text style={{ fontSize: '16px', color: palette.textBody, marginTop: 0, lineHeight: '1.7' }}>
        Hello {displayName} —
      </Text>

      {bodyParagraphs.map((paragraph, index) => (
        <Text key={index} style={{ fontSize: '15px', color: palette.textBody, lineHeight: '1.75' }}>
          {paragraph}
        </Text>
      ))}

      {media.map((item, index) => (
        <Section key={`${item.url}-${index}`} style={{ margin: '28px 0' }}>
          <Img
            src={item.url}
            alt={item.alt ?? ''}
            style={{
              width: '100%',
              display: 'block',
              border: `1px solid ${palette.boxBorder}`,
            }}
          />
          {item.caption && (
            <Text style={{ fontSize: '12px', color: palette.textMuted, lineHeight: '1.6', margin: '10px 0 0' }}>
              {item.caption}
            </Text>
          )}
        </Section>
      ))}

      {actionLinks.length > 0 && (
        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          {actionLinks.map((link) => (
            <Button
              key={`${link.label}-${link.url}`}
              href={link.url}
              style={{
                backgroundColor: palette.accent,
                color: '#0b0e18',
                padding: '14px 22px',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '13px',
                fontWeight: 'bold',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                textDecoration: 'none',
                display: 'inline-block',
                margin: '0 6px 10px',
              }}
            >
              {link.label}
            </Button>
          ))}
        </Section>
      )}

      <Text style={{ fontSize: '14px', color: palette.textBody, lineHeight: '1.7', margin: '8px 0 0' }}>
        You&apos;re joining <strong>Elkdonis Arts Collective</strong> — a platform for many
        different arts collectives, built on open resources. We&apos;re working to give
        artists who aren&apos;t especially tech-savvy — artists closer to the street
        level of society — access to the kind of business-level tools and engagement
        that&apos;s often out of reach.
      </Text>
      <Text style={{ fontSize: '14px', color: palette.textBody, lineHeight: '1.7', margin: '12px 0 0' }}>
        We&apos;re in an early stage: new sites are coming together to form this
        broader network, helping many artists succeed.
      </Text>

      <Section style={{ margin: '22px 0 0' }}>
        <Text
          style={{
            margin: '0 0 6px',
            fontSize: '11px',
            color: palette.textMuted,
            fontFamily: 'Arial, sans-serif',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.12em',
          }}
        >
          Follow along
        </Text>
        <Text style={{ margin: 0, fontSize: '13px', color: palette.textBody }}>
          <a href="https://elkdonisarts.substack.com/" style={{ color: palette.accent }}>Substack</a>
          {' · '}
          <a href="https://www.instagram.com/Elkdonisarts" style={{ color: palette.accent }}>Instagram</a>
        </Text>
      </Section>
    </EmailShell>
  );
}

export async function renderWelcomeEmail(props: WelcomeEmailProps): Promise<string> {
  return render(React.createElement(WelcomeEmail, props));
}
