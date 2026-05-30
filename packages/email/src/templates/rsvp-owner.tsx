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
  Img,
  Preview,
} from '@react-email/components';
import { render } from '@react-email/render';

export interface EmailLinkItem {
  label: string;
  url: string;
}

export interface EmailMediaItem {
  url: string;
  alt?: string;
  caption?: string;
}

export interface RsvpOwnerEmailProps {
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestMessage?: string;
  wantsReminder?: boolean;
  meetingTitle: string;
  section?: string;
  scheduledAt?: string;
  rsvpCreatedAt?: string;
  threadUrl?: string;
  orgName?: string;
  rsvpCount?: number;
  bodyText?: string;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];
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
  rsvpCreatedAt,
  threadUrl,
  orgName = 'Amrit Canada',
  rsvpCount,
  bodyText = 'A new presence has crossed the threshold and answered yes. The circle has brightened; tend the gathering thread when you are ready.',
  links = [],
  media = [],
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

  let rsvpTimeStr: string | null = null;
  if (rsvpCreatedAt) {
    try {
      rsvpTimeStr = new Date(rsvpCreatedAt).toLocaleString('en-CA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Toronto',
      });
    } catch {
      rsvpTimeStr = null;
    }
  }

  const allLinks = threadUrl
    ? [{ label: 'Open the gathering thread', url: threadUrl }, ...links]
    : links;

  const bodyParagraphs = bodyText
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <Html lang="en">
      <Head />
      <Preview>
        New RSVP from {guestName} — {meetingTitle}
      </Preview>
      <Body style={{ backgroundColor: '#07112f', fontFamily: 'Georgia, serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
          <Section
            style={{
              background: 'linear-gradient(135deg, #fffaf0 0%, #dce6ff 45%, #b79a55 100%)',
              borderRadius: '10px 10px 0 0',
              padding: '34px 36px',
              textAlign: 'center' as const,
              border: '1px solid #d6c38e',
              borderBottom: 'none',
            }}
          >
            <Text
              style={{
                margin: '0 0 10px',
                color: '#022278',
                fontFamily: 'Arial, sans-serif',
                fontSize: '11px',
                fontWeight: 'bold' as const,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.16em',
              }}
            >
              A new RSVP has arrived
            </Text>
            <Heading
              style={{
                margin: 0,
                color: '#01124E',
                fontSize: '26px',
                lineHeight: '1.25',
                fontFamily: 'Georgia, serif',
                fontWeight: 'normal' as const,
              }}
            >
              {meetingTitle}
            </Heading>
          </Section>

          <Section
            style={{
              background: '#fffdf8',
              padding: '38px',
              borderRadius: '0 0 10px 10px',
              border: '1px solid #d6c38e',
              borderTop: 'none',
            }}
          >
            <Text style={{ fontSize: '16px', color: '#374238', marginTop: 0, lineHeight: '1.7' }}>
              A soft signal has come through the veil: <strong>{guestName}</strong> is going.
            </Text>

            {bodyParagraphs.map((paragraph, index) => (
              <Text key={index} style={{ fontSize: '15px', color: '#374238', lineHeight: '1.75' }}>
                {paragraph}
              </Text>
            ))}

            <Section
              style={{
                background: 'linear-gradient(180deg, #f4f7ff 0%, #fffaf0 100%)',
                borderRadius: '8px',
                padding: '20px',
                margin: '22px 0',
                border: '1px solid #dce6ff',
                borderLeft: '4px solid #b79a55',
              }}
            >
              <Text
                style={{
                  margin: '0 0 8px',
                  fontSize: '11px',
                  color: '#8f763c',
                  fontFamily: 'Arial, sans-serif',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.12em',
                }}
              >
                Guest
              </Text>
              <Text style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 'bold' as const, color: '#01124E' }}>
                {guestName}
              </Text>
              {guestEmail && (
                <Text style={{ margin: '0 0 4px', fontSize: '14px', color: '#4f5d54' }}>
                  {guestEmail}
                </Text>
              )}
              {guestPhone && (
                <Text style={{ margin: '0 0 4px', fontSize: '14px', color: '#4f5d54' }}>
                  {guestPhone}
                </Text>
              )}
              {wantsReminder && (
                <Text style={{ margin: '6px 0 0', fontSize: '13px', color: '#E67E50' }}>
                  ★ Wants a reminder
                </Text>
              )}
            </Section>

            {(guestMessage || rsvpTimeStr || dateStr || rsvpCount !== undefined) && (
              <Section style={{ margin: '16px 0' }}>
                <Text
                  style={{
                    margin: '0 0 8px',
                    fontSize: '11px',
                    color: '#8f763c',
                    fontFamily: 'Arial, sans-serif',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.12em',
                  }}
                >
                  Thread signals
                </Text>
                {rsvpTimeStr && (
                  <Text style={{ margin: '0 0 6px', fontSize: '14px', color: '#374238' }}>
                    <strong>RSVP received:</strong> {rsvpTimeStr}
                  </Text>
                )}
                {dateStr && (
                  <Text style={{ margin: '0 0 6px', fontSize: '14px', color: '#374238' }}>
                    <strong>Meeting date:</strong> {dateStr}
                  </Text>
                )}
                {rsvpCount !== undefined && (
                  <Text style={{ margin: '0 0 6px', fontSize: '14px', color: '#374238' }}>
                    <strong>Total RSVPs:</strong> {rsvpCount}
                  </Text>
                )}
                {guestMessage && (
                  <Text
                    style={{
                      margin: '12px 0 0',
                      fontSize: '15px',
                      color: '#374238',
                      fontStyle: 'italic' as const,
                      borderLeft: '3px solid #b79a55',
                      paddingLeft: '16px',
                    }}
                  >
                    {guestMessage}
                  </Text>
                )}
              </Section>
            )}

            {allLinks.length > 0 && (
              <Section style={{ margin: '24px 0' }}>
                <Button
                  href={allLinks[0].url}
                  style={{
                    backgroundColor: '#022278',
                    color: '#fffdf8',
                    padding: '12px 22px',
                    borderRadius: '4px',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '13px',
                    fontWeight: 'bold' as const,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  {allLinks[0].label}
                </Button>
                {allLinks.slice(1).map((link) => (
                  <Text key={`${link.label}-${link.url}`} style={{ margin: '10px 0 0', fontSize: '13px' }}>
                    <a href={link.url} style={{ color: '#022278' }}>{link.label}</a>
                  </Text>
                ))}
              </Section>
            )}

            {media.length > 0 && (
              <Section style={{ margin: '24px 0' }}>
                {media.map((item) => (
                  <Section key={item.url} style={{ margin: '0 0 16px' }}>
                    <Img
                      src={item.url}
                      alt={item.alt ?? ''}
                      style={{
                        width: '100%',
                        maxWidth: '520px',
                        borderRadius: '8px',
                        border: '1px solid #d6c38e',
                        display: 'block',
                      }}
                    />
                    {item.caption && (
                      <Text style={{ margin: '8px 0 0', fontSize: '12px', color: '#8f763c', fontStyle: 'italic' as const }}>
                        {item.caption}
                      </Text>
                    )}
                  </Section>
                ))}
              </Section>
            )}

            <Hr style={{ border: 'none', borderTop: '1px solid #eadcb8', margin: '28px 0' }} />

            <Text style={{ margin: '0 0 6px', fontSize: '14px', color: '#555' }}>
              <strong>Meeting:</strong> {meetingTitle}
            </Text>
            {section && (
              <Text style={{ margin: '0 0 6px', fontSize: '14px', color: '#555' }}>
                <strong>Section:</strong> {section}
              </Text>
            )}
          </Section>

          <Text
            style={{
              fontSize: '11px',
              color: '#d6c38e',
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
