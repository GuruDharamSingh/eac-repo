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

export interface RsvpOwnerEmailProps {
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestMessage?: string;
  wantsReminder?: boolean;
  meetingTitle: string;
  section?: string;
  scheduledAt?: string;
  orgName?: string;
  rsvpCount?: number;
}

function RsvpOwnerEmail({
  guestName,
  guestEmail,
  guestPhone,
  guestMessage,
  wantsReminder,
  meetingTitle,
  section,
  scheduledAt,
  orgName = 'Amrit Canada',
  rsvpCount,
}: RsvpOwnerEmailProps) {
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
      <Preview>
        New RSVP from {guestName} — {meetingTitle}
      </Preview>
      <Body style={{ backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
          <Section
            style={{
              backgroundColor: '#fff',
              padding: '40px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
            }}
          >
            <Heading style={{ fontSize: '20px', color: '#36454f', marginTop: 0 }}>
              New RSVP — {meetingTitle}
            </Heading>

            <Section
              style={{
                background: '#f8f8f8',
                borderRadius: '6px',
                padding: '20px',
                margin: '16px 0',
              }}
            >
              <Text
                style={{
                  margin: '0 0 8px',
                  fontSize: '11px',
                  color: '#999',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                }}
              >
                Guest
              </Text>
              <Text style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold' as const, color: '#36454f' }}>
                {guestName}
              </Text>
              {guestEmail && (
                <Text style={{ margin: '0 0 4px', fontSize: '14px', color: '#555' }}>
                  {guestEmail}
                </Text>
              )}
              {guestPhone && (
                <Text style={{ margin: '0 0 4px', fontSize: '14px', color: '#555' }}>
                  {guestPhone}
                </Text>
              )}
              {wantsReminder && (
                <Text style={{ margin: '6px 0 0', fontSize: '13px', color: '#E67E50' }}>
                  ★ Wants a reminder
                </Text>
              )}
            </Section>

            {guestMessage && (
              <Section style={{ margin: '16px 0' }}>
                <Text
                  style={{
                    margin: '0 0 8px',
                    fontSize: '11px',
                    color: '#999',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.06em',
                  }}
                >
                  Message
                </Text>
                <Text
                  style={{
                    margin: 0,
                    fontSize: '15px',
                    color: '#36454f',
                    fontStyle: 'italic' as const,
                    borderLeft: '3px solid #F4C430',
                    paddingLeft: '16px',
                  }}
                >
                  {guestMessage}
                </Text>
              </Section>
            )}

            <Hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '24px 0' }} />

            <Text style={{ margin: '0 0 6px', fontSize: '14px', color: '#555' }}>
              <strong>Meeting:</strong> {meetingTitle}
            </Text>
            {section && (
              <Text style={{ margin: '0 0 6px', fontSize: '14px', color: '#555' }}>
                <strong>Section:</strong> {section}
              </Text>
            )}
            {dateStr && (
              <Text style={{ margin: '0 0 6px', fontSize: '14px', color: '#555' }}>
                <strong>Date:</strong> {dateStr}
              </Text>
            )}
            {rsvpCount !== undefined && (
              <Text style={{ margin: 0, fontSize: '14px', color: '#555' }}>
                <strong>Total RSVPs:</strong> {rsvpCount}
              </Text>
            )}
          </Section>

          <Text
            style={{
              fontSize: '11px',
              color: '#bbb',
              textAlign: 'center' as const,
              marginTop: '16px',
            }}
          >
            {orgName} · Sent via Elkdonis Arts Collective
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderRsvpOwnerEmail(props: RsvpOwnerEmailProps): Promise<string> {
  return render(React.createElement(RsvpOwnerEmail, props));
}
