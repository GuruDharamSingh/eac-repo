import * as React from 'react';
import { Section, Text, Button, Img } from '@react-email/components';
import { render } from '@react-email/render';
import { EmailShell, getEmailPalette } from '../components/EmailShell';
import type { EmailLinkItem, EmailMediaItem } from './rsvp-owner';

export type MeetingTriggerType = 'reminder' | 'cancellation' | 'confirmation';

export interface MeetingTriggerEmailProps {
  type: MeetingTriggerType;
  guestName: string;
  meetingTitle: string;
  scheduledAt?: string;
  location?: string;
  /** Video-call join link, distinct from rsvpUrl. */
  meetingUrl?: string;
  talkRoomUrl?: string;
  materialsUrl?: string;
  /** The guide/author who triggered this send. */
  senderName: string;
  /** Link the guest can click to reconfirm they're still coming (reminder only). */
  confirmUrl?: string;
  orgName?: string;
  /** The thread's public page, where the real RSVP UI lives. */
  rsvpUrl?: string;
  /** "N people are coming so far" -- shown in the detail box when present. */
  rsvpCount?: number;
  /** Dark card/background variant. Defaults to dark, matching today's output. */
  dark?: boolean;
  /** Small header emblem (e.g. amrit-canada's Khanda). Unset for every other caller. */
  emblemUrl?: string;
  emblemAlt?: string;
  /** Author-editable copy (email_template_settings config). */
  bodyText?: string;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];
}

function formatCountdown(scheduledAt: string): string {
  const diffMs = new Date(scheduledAt).getTime() - Date.now();
  if (diffMs <= 0) return 'now';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(diffMs / 3600000);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(diffMs / 86400000);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function MeetingTriggerEmail({
  type,
  guestName,
  meetingTitle,
  scheduledAt,
  location,
  meetingUrl,
  talkRoomUrl,
  materialsUrl,
  senderName,
  confirmUrl,
  rsvpUrl,
  rsvpCount,
  dark = true,
  emblemUrl,
  emblemAlt,
  bodyText,
  links = [],
  media = [],
}: MeetingTriggerEmailProps) {
  const palette = getEmailPalette(dark);
  const isCancellation = type === 'cancellation';
  const isConfirmation = type === 'confirmation';

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

  const countdown = type === 'reminder' && scheduledAt ? formatCountdown(scheduledAt) : null;
  const hasDetails = Boolean(dateStr || location || meetingUrl || talkRoomUrl || materialsUrl || rsvpCount !== undefined);
  const bodyParagraphs = bodyText
    ? bodyText.split('\n').map((paragraph) => paragraph.trim()).filter(Boolean)
    : [];
  const rsvpHref = rsvpUrl ?? confirmUrl;

  return (
    <EmailShell
      previewText={
        isCancellation
          ? `Cancelled — ${meetingTitle}`
          : isConfirmation
            ? `Confirmed — ${meetingTitle}`
            : `Reminder — ${meetingTitle} starts in ${countdown ?? 'soon'}`
      }
      kicker={meetingTitle}
      dark={dark}
      showNfpFooter
      emblemUrl={emblemUrl}
      emblemAlt={emblemAlt}
    >
      <Text style={{ fontSize: '13px', color: palette.textMuted, marginTop: 0, marginBottom: '2px' }}>
        This email is for {guestName}.
      </Text>

      {isCancellation ? (
        <Text style={{ fontSize: '18px', color: palette.textPrimary, marginTop: 0, lineHeight: '1.5' }}>
          <strong>{meetingTitle}</strong> has been cancelled.
        </Text>
      ) : isConfirmation ? (
        <Text style={{ fontSize: '18px', color: palette.textPrimary, marginTop: 0, lineHeight: '1.5' }}>
          <strong>{meetingTitle}</strong> is confirmed.
        </Text>
      ) : (
        <Text style={{ fontSize: '18px', color: palette.textPrimary, marginTop: 0, lineHeight: '1.5' }}>
          <strong>{meetingTitle}</strong> is starting in <strong>{countdown}</strong>.
        </Text>
      )}

      <Text style={{ fontSize: '14px', color: palette.textBody, lineHeight: '1.6', margin: '10px 0 0' }}>
        Sent by {senderName}.
      </Text>

      {hasDetails && (
        <Section
          style={{
            background: palette.boxBg,
            border: `1px solid ${palette.boxBorder}`,
            borderLeft: `4px solid ${palette.accent}`,
            padding: '16px 20px',
            margin: '20px 0',
          }}
        >
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
          {talkRoomUrl && !isCancellation && (
            <Text style={{ margin: '0 0 6px', fontSize: '14px', color: palette.textBody }}>
              Talk room: <a href={talkRoomUrl} style={{ color: palette.accent }}>Join the Talk room</a>
            </Text>
          )}
          {materialsUrl && (
            <Text style={{ margin: '0 0 6px', fontSize: '14px', color: palette.textBody }}>
              Materials: <a href={materialsUrl} style={{ color: palette.accent }}>View materials</a>
            </Text>
          )}
          {rsvpCount !== undefined && !isCancellation && (
            <Text style={{ margin: 0, fontSize: '14px', color: palette.textBody }}>
              {rsvpCount} {rsvpCount === 1 ? 'person is' : 'people are'} coming so far.
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
          <Img src={item.url} alt={item.alt ?? ''} style={{ maxWidth: '100%', display: 'block' }} />
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

      {!isCancellation && rsvpHref && (
        <Section style={{ margin: '26px 0 0', textAlign: 'center' as const }}>
          <Text style={{ fontSize: '14px', color: palette.textBody, margin: '0 0 12px' }}>
            {isConfirmation ? "Haven't RSVP'd yet?" : 'Still coming?'}
          </Text>
          <Button
            href={rsvpHref}
            style={{
              backgroundColor: palette.accent,
              color: '#0b0e18',
              padding: '12px 26px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '13px',
              fontWeight: 'bold' as const,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            RSVP here
          </Button>
        </Section>
      )}
    </EmailShell>
  );
}

export async function renderMeetingTriggerEmail(props: MeetingTriggerEmailProps): Promise<string> {
  return render(React.createElement(MeetingTriggerEmail, props));
}
