import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { render } from '@react-email/render';
import { EmailShell } from '../components/EmailShell';
import type { EmailLinkItem, EmailMediaItem } from './rsvp-owner';

export interface ReminderEmailProps {
  guestName: string;
  meetingTitle: string;
  scheduledAt?: string;
  location?: string;
  meetingUrl?: string;
  talkJoinUrl?: string;
  orgName?: string;
  primaryColor?: string;
  /** The thread's public page, where the real RSVP UI lives. */
  rsvpUrl?: string;
  /** "N people are coming so far" -- shown in the detail box when present. */
  rsvpCount?: number;
  /** Small header emblem (e.g. amrit-canada's Khanda). Unset for every other caller. */
  emblemUrl?: string;
  emblemAlt?: string;
  /** Author-editable copy (email_template_settings config). */
  bodyText?: string;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];
}

function ReminderEmail({
  guestName,
  meetingTitle,
  scheduledAt,
  location,
  meetingUrl,
  talkJoinUrl,
  orgName = 'Elkdonis Arts Collective',
  primaryColor = '#022278',
  rsvpUrl,
  rsvpCount,
  emblemUrl,
  emblemAlt,
  bodyText = 'A reminder that your session begins soon. Gather your materials and settle in — we look forward to seeing you.',
  links = [],
  media = [],
}: ReminderEmailProps) {
  let whenStr: string | null = null;
  if (scheduledAt) {
    try {
      whenStr = new Date(scheduledAt).toLocaleString('en-CA', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Toronto',
      });
    } catch {
      whenStr = null;
    }
  }

  const bodyParagraphs = bodyText
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  const joinUrl = talkJoinUrl || meetingUrl;

  return (
    <EmailShell
      previewText={`Starting soon — ${meetingTitle}`}
      kicker={orgName}
      emblemUrl={emblemUrl}
      emblemAlt={emblemAlt}
      footerText={
        <Text style={{ fontSize: '12px', color: '#999', margin: 0 }}>
          You are receiving this because you RSVP&apos;d with {orgName}.
        </Text>
      }
    >
      <Text style={{ fontSize: '16px', color: '#374238', marginTop: 0 }}>
        Hello {guestName} —
      </Text>
      <Text style={{ fontSize: '16px', color: '#374238' }}>
        <strong>{meetingTitle}</strong> is starting soon.
      </Text>

      {bodyParagraphs.map((paragraph, index) => (
        <Text key={index} style={{ fontSize: '15px', color: '#374238', lineHeight: '1.7' }}>
          {paragraph}
        </Text>
      ))}

      {(whenStr || location || joinUrl) && (
        <Section
          style={{
            background: '#f4f7ff',
            border: '1px solid #dce6ff',
            borderLeft: `4px solid ${primaryColor}`,
            borderRadius: '4px',
            padding: '16px 20px',
            margin: '24px 0',
          }}
        >
          {whenStr && (
            <Text style={{ margin: '0 0 4px', fontSize: '14px', color: '#374238' }}>
              <strong>When:</strong> {whenStr}
            </Text>
          )}
          {location && (
            <Text style={{ margin: '0 0 4px', fontSize: '14px', color: '#374238' }}>
              <strong>Where:</strong> {location}
            </Text>
          )}
          {joinUrl && (
            <Text style={{ margin: '8px 0 0', fontSize: '14px' }}>
              <a
                href={joinUrl}
                style={{
                  display: 'inline-block',
                  background: primaryColor,
                  color: '#fffaf0',
                  padding: '10px 22px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '14px',
                }}
              >
                Join the session
              </a>
            </Text>
          )}
          {rsvpCount !== undefined && (
            <Text style={{ margin: '8px 0 0', fontSize: '14px', color: '#374238' }}>
              {rsvpCount} {rsvpCount === 1 ? 'person is' : 'people are'} coming so far.
            </Text>
          )}
        </Section>
      )}

      {rsvpUrl && (
        <Section style={{ margin: '20px 0 0' }}>
          <Text style={{ margin: '0 0 6px', fontSize: '14px' }}>
            <a
              href={rsvpUrl}
              style={{
                display: 'inline-block',
                background: primaryColor,
                color: '#fffaf0',
                padding: '10px 22px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
              }}
            >
              RSVP here
            </a>
          </Text>
        </Section>
      )}

      {media.map((item, index) => (
        <Section key={`media-${index}`} style={{ margin: '16px 0' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.alt ?? ''}
            style={{ maxWidth: '100%', borderRadius: '6px', display: 'block' }}
          />
          {item.caption && (
            <Text style={{ margin: '6px 0 0', fontSize: '12px', color: '#999' }}>
              {item.caption}
            </Text>
          )}
        </Section>
      ))}

      {links.length > 0 && (
        <Section style={{ margin: '16px 0' }}>
          {links.map((link, index) => (
            <Text key={`link-${index}`} style={{ margin: '0 0 6px', fontSize: '14px' }}>
              <a href={link.url} style={{ color: primaryColor }}>{link.label}</a>
            </Text>
          ))}
        </Section>
      )}
    </EmailShell>
  );
}

export async function renderReminderEmail(props: ReminderEmailProps): Promise<string> {
  return render(React.createElement(ReminderEmail, props));
}
