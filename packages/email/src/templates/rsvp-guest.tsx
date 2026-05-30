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
  Preview,
} from '@react-email/components';
import { render } from '@react-email/render';

export interface RsvpGuestEmailProps {
  guestName: string;
  meetingTitle: string;
  section?: string;
  scheduledAt?: string;
  location?: string;
  meetingUrl?: string;
  orgName?: string;
  primaryColor?: string;
}

const SECTION_LABELS: Record<string, string> = {
  amrit_vela: 'Amrit Vela',
  yoga: 'Yoga',
  gurdwara: 'Gurdwara',
};

function RsvpGuestEmail({
  guestName,
  meetingTitle,
  section,
  scheduledAt,
  location,
  meetingUrl,
  orgName = 'Amrit Canada',
  primaryColor = '#F4C430',
}: RsvpGuestEmailProps) {
  const sectionLabel = section ? (SECTION_LABELS[section] ?? section) : null;

  let dateStr: string | null = null;
  if (scheduledAt) {
    try {
      dateStr = new Date(scheduledAt).toLocaleDateString('en-CA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Toronto',
      });
    } catch {
      dateStr = null;
    }
  }

  return (
    <Html lang="en">
      <Head />
      <Preview>Your RSVP is confirmed — {meetingTitle}</Preview>
      <Body style={{ backgroundColor: '#FDF5E6', fontFamily: 'Georgia, serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
          <Section
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, #E67E50)`,
              borderRadius: '8px 8px 0 0',
              padding: '32px 40px',
              textAlign: 'center' as const,
            }}
          >
            <Heading
              style={{
                color: '#36454f',
                fontSize: '22px',
                fontFamily: 'Georgia, serif',
                margin: 0,
                letterSpacing: '0.02em',
              }}
            >
              {orgName}
            </Heading>
          </Section>

          <Section
            style={{
              backgroundColor: '#fff',
              padding: '40px',
              borderRadius: '0 0 8px 8px',
              border: '1px solid #E8D5B0',
              borderTop: 'none',
            }}
          >
            <Text style={{ fontSize: '16px', color: '#36454f', marginTop: 0 }}>
              Sat Nam, {guestName} —
            </Text>
            <Text style={{ fontSize: '16px', color: '#36454f' }}>
              Your RSVP for <strong>{meetingTitle}</strong> has been received. Waheguru!
            </Text>

            {(sectionLabel || dateStr || location || meetingUrl) && (
              <Section
                style={{
                  background: '#FDF5E6',
                  border: '1px solid #E8D5B0',
                  borderLeft: `4px solid ${primaryColor}`,
                  borderRadius: '4px',
                  padding: '16px 20px',
                  margin: '24px 0',
                }}
              >
                {sectionLabel && (
                  <Text
                    style={{
                      margin: '0 0 4px',
                      fontSize: '12px',
                      color: '#999',
                      fontFamily: 'Arial, sans-serif',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                    }}
                  >
                    {sectionLabel}
                  </Text>
                )}
                <Text style={{ margin: 0, fontSize: '16px', color: '#36454f', fontWeight: 'bold' as const }}>
                  {meetingTitle}
                </Text>
                {dateStr && (
                  <Text style={{ margin: '4px 0 0', fontSize: '14px', color: '#666' }}>
                    {dateStr}
                  </Text>
                )}
                {location && (
                  <Text style={{ margin: '4px 0 0', fontSize: '14px', color: '#666' }}>
                    {location}
                  </Text>
                )}
                {meetingUrl && (
                  <Text style={{ margin: '8px 0 0', fontSize: '14px', color: '#36454f' }}>
                    Meeting link: <a href={meetingUrl} style={{ color: primaryColor }}>{meetingUrl}</a>
                  </Text>
                )}
              </Section>
            )}

            <Text style={{ fontSize: '15px', color: '#36454f' }}>
              We look forward to seeing you. Please arrive a few minutes early so we
              can begin together in stillness.
            </Text>

            <Hr style={{ border: 'none', borderTop: '1px solid #E8D5B0', margin: '32px 0' }} />

            <Text style={{ fontSize: '12px', color: '#bbb', margin: 0 }}>
              This is a confirmation for your RSVP with {orgName}. If you did not
              sign up, no action is needed.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderRsvpGuestEmail(props: RsvpGuestEmailProps): Promise<string> {
  return render(React.createElement(RsvpGuestEmail, props));
}
