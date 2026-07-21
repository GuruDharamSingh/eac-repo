import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { render } from '@react-email/render';
import { EmailShell, getEmailPalette } from '../components/EmailShell';
import type { EmailLinkItem, EmailMediaItem } from './rsvp-owner';

export interface RsvpGuestEmailProps {
  guestName: string;
  meetingTitle: string;
  section?: string;
  scheduledAt?: string;
  location?: string;
  meetingUrl?: string;
  /** Nextcloud Talk room join link, when the thread has one. */
  talkRoomUrl?: string;
  /** Link to the thread's materials (workshops with a provisioned folder). */
  materialsUrl?: string;
  orgName?: string;
  primaryColor?: string;
  /** Author-editable copy (email_template_settings config) — shown under "From the author" when present. */
  bodyText?: string;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];
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
  talkRoomUrl,
  materialsUrl,
  primaryColor = '#c9a84c',
  bodyText,
  links = [],
  media = [],
}: RsvpGuestEmailProps) {
  const palette = getEmailPalette(true);
  const sectionLabel = section ? (SECTION_LABELS[section] ?? section) : null;
  const bodyParagraphs = bodyText
    ? bodyText.split('\n').map((paragraph) => paragraph.trim()).filter(Boolean)
    : [];

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

  const hasDetails = Boolean(sectionLabel || dateStr || location || meetingUrl || talkRoomUrl || materialsUrl);

  return (
    <EmailShell
      previewText={`Your RSVP is confirmed — ${meetingTitle}`}
      kicker={meetingTitle}
      dark
      showNfpFooter
    >
      <Text style={{ fontSize: '13px', color: palette.textMuted, marginTop: 0, marginBottom: '2px' }}>
        This email is for {guestName}.
      </Text>
      <Text style={{ fontSize: '17px', color: palette.textPrimary, marginTop: 0, lineHeight: '1.5' }}>
        Your RSVP for <strong>{meetingTitle}</strong> has been received.
      </Text>

      {hasDetails && (
        <Section
          style={{
            background: palette.boxBg,
            border: `1px solid ${palette.boxBorder}`,
            borderLeft: `4px solid ${primaryColor}`,
            padding: '16px 20px',
            margin: '22px 0',
          }}
        >
          {sectionLabel && (
            <Text
              style={{
                margin: '0 0 4px',
                fontSize: '11px',
                color: palette.textMuted,
                fontFamily: 'Arial, sans-serif',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
              }}
            >
              {sectionLabel}
            </Text>
          )}
          {dateStr && (
            <Text style={{ margin: '0 0 6px', fontSize: '14px', color: palette.textBody }}>
              <strong>When:</strong> {dateStr}
            </Text>
          )}
          {location && (
            <Text style={{ margin: '0 0 6px', fontSize: '14px', color: palette.textBody }}>
              <strong>Where:</strong> {location}
            </Text>
          )}
          {meetingUrl && (
            <Text style={{ margin: '0 0 6px', fontSize: '14px', color: palette.textBody }}>
              Video link: <a href={meetingUrl} style={{ color: palette.accent }}>{meetingUrl}</a>
            </Text>
          )}
          {talkRoomUrl && (
            <Text style={{ margin: '0 0 6px', fontSize: '14px', color: palette.textBody }}>
              Talk room: <a href={talkRoomUrl} style={{ color: palette.accent }}>Join the Talk room</a>
            </Text>
          )}
          {materialsUrl && (
            <Text style={{ margin: 0, fontSize: '14px', color: palette.textBody }}>
              Materials: <a href={materialsUrl} style={{ color: palette.accent }}>View materials</a>
            </Text>
          )}
        </Section>
      )}

      {bodyParagraphs.length > 0 && (
        <Section style={{ margin: '20px 0' }}>
          <Text
            style={{
              margin: '0 0 8px',
              fontSize: '11px',
              color: palette.textMuted,
              fontFamily: 'Arial, sans-serif',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.12em',
            }}
          >
            From the author
          </Text>
          {bodyParagraphs.map((paragraph, index) => (
            <Text key={index} style={{ fontSize: '15px', color: palette.textBody, lineHeight: '1.7' }}>
              {paragraph}
            </Text>
          ))}
        </Section>
      )}

      {media.map((item, index) => (
        <Section key={`media-${index}`} style={{ margin: '16px 0' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.alt ?? ''}
            style={{ maxWidth: '100%', display: 'block' }}
          />
          {item.caption && (
            <Text style={{ margin: '6px 0 0', fontSize: '12px', color: palette.textMuted }}>
              {item.caption}
            </Text>
          )}
        </Section>
      ))}

      {links.length > 0 && (
        <Section style={{ margin: '16px 0' }}>
          {links.map((link, index) => (
            <Text key={`link-${index}`} style={{ margin: '0 0 6px', fontSize: '14px' }}>
              <a href={link.url} style={{ color: palette.accent }}>{link.label}</a>
            </Text>
          ))}
        </Section>
      )}

      <Text style={{ fontSize: '14px', color: palette.textBody, lineHeight: '1.75', margin: '24px 0 0' }}>
        We thank you for signing up with Elkdonis Arts Collective. There&apos;s a lot of other
        content being developed and constantly coming out — stay tuned for more.
      </Text>
      <Text style={{ fontSize: '14px', color: palette.textBody, lineHeight: '1.75', margin: '10px 0 0' }}>
        You can also expect a reminder email the morning of the meeting.
      </Text>
    </EmailShell>
  );
}

export async function renderRsvpGuestEmail(props: RsvpGuestEmailProps): Promise<string> {
  return render(React.createElement(RsvpGuestEmail, props));
}
