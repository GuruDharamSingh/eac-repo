import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Hr,
  Button,
  Preview,
  Img,
} from '@react-email/components';
import { render } from '@react-email/render';

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

// Public origin where the brand fonts are served (/fonts/*).
const FONT_BASE_URL = 'https://elkdonis-arts.org/fonts';

// Brothers — the display face used for landing-page titles.
// Basteleur — the body face used for landing-page body copy.
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

// Font stacks: custom face first, then graceful fallbacks for clients
// (e.g. Gmail) that strip @font-face.
const brothersStack = "'Brothers', 'Arial Narrow', Arial, sans-serif";
const basteleurStack = "'Basteleur', 'Cormorant Garamond', Georgia, serif";

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
  const actionLinks = links === undefined ? [{ label: 'Enter the Gathering', url: portalUrl }] : links;

  return (
    <Html lang="en">
      <Head>
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
      </Head>
      <Preview>Welcome to Elkdonis Arts Collective</Preview>
      <Body style={{ backgroundColor: '#0f0f0f', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
          <Section
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              borderRadius: '8px 8px 0 0',
              padding: '40px',
              textAlign: 'center' as const,
            }}
          >
            <Text
              style={{
                color: '#c9a84c',
                fontSize: '30px',
                fontFamily: brothersStack,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                lineHeight: '1.2',
                margin: '0 0 12px',
              }}
            >
              Elkdonis Arts Collective
            </Text>
            <Heading
              style={{
                color: '#f0ece4',
                fontSize: '20px',
                fontFamily: basteleurStack,
                fontWeight: 'normal',
                margin: 0,
                lineHeight: '1.3',
              }}
            >
              Welcome to the Collective
            </Heading>
          </Section>

          <Section
            style={{
              backgroundColor: '#1c1c1c',
              padding: '40px',
              borderRadius: '0 0 8px 8px',
              border: '1px solid #2a2a2a',
              borderTop: 'none',
            }}
          >
            <Text style={{ fontSize: '17px', color: '#d4cfc7', fontFamily: basteleurStack, marginTop: 0, lineHeight: '1.7' }}>
              Hello {displayName} —
            </Text>

            {bodyParagraphs.map((paragraph, index) => (
              <Text key={index} style={{ fontSize: '17px', color: '#d4cfc7', fontFamily: basteleurStack, lineHeight: '1.7' }}>
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
                    borderRadius: '6px',
                    display: 'block',
                    border: '1px solid #2a2a2a',
                  }}
                />
                {item.caption && (
                  <Text style={{ fontSize: '12px', color: '#888', lineHeight: '1.6', margin: '10px 0 0' }}>
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
                      backgroundColor: '#c9a84c',
                      color: '#0f0f0f',
                      padding: '14px 22px',
                      borderRadius: '4px',
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

            <Hr style={{ border: 'none', borderTop: '1px solid #2a2a2a', margin: '32px 0' }} />

            <Text style={{ fontSize: '15px', color: '#888', fontFamily: basteleurStack, lineHeight: '1.7', margin: 0 }}>
              The Inner Gathering is where members connect, share upcoming events,
              and participate in the ongoing life of the collective. We're glad
              you're here.
            </Text>

            <Hr style={{ border: 'none', borderTop: '1px solid #2a2a2a', margin: '32px 0' }} />

            <Text style={{ fontSize: '12px', color: '#555', margin: 0 }}>
              This email was sent because you created an account at{' '}
              <span style={{ color: '#c9a84c' }}>elkdonis-arts.org</span>.
              If you did not sign up, you can safely ignore this message.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderWelcomeEmail(props: WelcomeEmailProps): Promise<string> {
  return render(React.createElement(WelcomeEmail, props));
}
