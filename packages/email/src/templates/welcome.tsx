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
} from '@react-email/components';
import { render } from '@react-email/render';

export interface WelcomeEmailProps {
  displayName: string;
  portalUrl?: string;
}

function WelcomeEmail({
  displayName,
  portalUrl = 'https://gathering.elkdonis-arts.org',
}: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to Elkdonis Arts Collective</Preview>
      <Body style={{ backgroundColor: '#0f0f0f', fontFamily: 'Georgia, serif', margin: 0, padding: 0 }}>
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
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.2em',
                margin: '0 0 12px',
              }}
            >
              Elkdonis Arts Collective
            </Text>
            <Heading
              style={{
                color: '#f0ece4',
                fontSize: '28px',
                fontFamily: 'Georgia, serif',
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
            <Text style={{ fontSize: '16px', color: '#d4cfc7', marginTop: 0, lineHeight: '1.7' }}>
              Hello {displayName} —
            </Text>

            <Text style={{ fontSize: '16px', color: '#d4cfc7', lineHeight: '1.7' }}>
              You're now part of Elkdonis Arts Collective — a mutual aid network for
              artists, healers, and community builders rooted in Toronto and growing
              outward.
            </Text>

            <Text style={{ fontSize: '16px', color: '#d4cfc7', lineHeight: '1.7' }}>
              A member profile has been created for you in the artist directory. You
              can fill it in at any time — tell us about your practice, your work,
              what you're looking for, and what you bring.
            </Text>

            <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
              <Button
                href={portalUrl}
                style={{
                  backgroundColor: '#c9a84c',
                  color: '#0f0f0f',
                  padding: '14px 32px',
                  borderRadius: '4px',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Enter the Gathering
              </Button>
            </Section>

            <Hr style={{ border: 'none', borderTop: '1px solid #2a2a2a', margin: '32px 0' }} />

            <Text style={{ fontSize: '14px', color: '#888', lineHeight: '1.7', margin: 0 }}>
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
