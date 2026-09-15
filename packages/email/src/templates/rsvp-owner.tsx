import * as React from 'react';
import { Section, Text, Button, Img } from '@react-email/components';
import { render } from '@react-email/render';
import { EmailShell, getEmailPalette } from '../components/EmailShell';

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
  /** 'reconfirmed' — guest re-affirmed attendance after a reminder trigger email. */
  variant?: 'new' | 'reconfirmed';
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
  /** Nextcloud Talk room join link, when the thread has one. */
  talkRoomUrl?: string;
  /** Link to the thread's materials (workshops with a provisioned folder). */
  materialsUrl?: string;
  orgName?: string;
  rsvpCount?: number;
  /** Dark card/background variant. Defaults to dark, matching today's output. */
  dark?: boolean;
  /** Small header emblem (e.g. amrit-canada's Khanda). Unset for every other caller. */
  emblemUrl?: string;
  emblemAlt?: string;
  bodyText?: string;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];
}

function RsvpOwnerEmail({
  variant = 'new',
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
  talkRoomUrl,
  materialsUrl,
  rsvpCount,
  dark = true,
  emblemUrl,
  emblemAlt,
  bodyText,
  links = [],
  media = [],
}: RsvpOwnerEmailProps) {
  const isReconfirm = variant === 'reconfirmed';
  const palette = getEmailPalette(dark);

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
    ? [{ label: 'Open the thread', url: threadUrl }, ...links]
    : links;

  const bodyParagraphs = bodyText
    ? bodyText.split('\n').map((paragraph) => paragraph.trim()).filter(Boolean)
    : [];

  return (
    <EmailShell
      previewText={
        isReconfirm
          ? `${guestName} reconfirmed — ${meetingTitle}`
          : `New RSVP from ${guestName} — ${meetingTitle}`
      }
      kicker={isReconfirm ? 'RSVP Reconfirmed' : 'New RSVP'}
      dark={dark}
      showNfpFooter
      emblemUrl={emblemUrl}
      emblemAlt={emblemAlt}
      footerText={
        <Text style={{ fontSize: '12px', color: palette.textMuted, margin: 0 }}>
          Sent via Elkdonis Arts Collective.
        </Text>
      }
    >
      <Text style={{ margin: '0 0 18px', fontSize: '20px', color: palette.textPrimary, fontWeight: 'bold' as const }}>
        {meetingTitle}
      </Text>

      {/* Data first: who, when, for what. */}
      <Section
        style={{
          background: palette.boxBg,
          border: `1px solid ${palette.boxBorder}`,
          borderLeft: `4px solid ${palette.accent}`,
          padding: '18px 20px',
          margin: '0 0 20px',
        }}
      >
        <Text style={{ margin: '0 0 4px', fontSize: '11px', color: palette.textMuted, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
          Guest
        </Text>
        <Text style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 'bold' as const, color: palette.textPrimary }}>
          {guestName}
          {guestEmail && <span style={{ fontWeight: 'normal' as const, color: palette.textBody }}> · {guestEmail}</span>}
        </Text>
        {guestPhone && (
          <Text style={{ margin: '0 0 10px', fontSize: '14px', color: palette.textBody }}>
            {guestPhone}
          </Text>
        )}
        {rsvpTimeStr && (
          <Text style={{ margin: '0 0 4px', fontSize: '14px', color: palette.textBody }}>
            <strong>RSVP date:</strong> {rsvpTimeStr}
          </Text>
        )}
        <Text style={{ margin: '0 0 4px', fontSize: '14px', color: palette.textBody }}>
          <strong>Thread:</strong> {meetingTitle}
          {section && <> · {section}</>}
        </Text>
        {dateStr && (
          <Text style={{ margin: '0 0 4px', fontSize: '14px', color: palette.textBody }}>
            <strong>Meeting date:</strong> {dateStr}
          </Text>
        )}
        {rsvpCount !== undefined && (
          <Text style={{ margin: '0 0 4px', fontSize: '14px', color: palette.textBody }}>
            <strong>Total RSVPs:</strong> {rsvpCount}
          </Text>
        )}
        {wantsReminder && (
          <Text style={{ margin: '6px 0 0', fontSize: '13px', color: palette.accent }}>
            Requested a reminder.
          </Text>
        )}
      </Section>

      <Text style={{ fontSize: '15px', color: palette.textBody, marginTop: 0, lineHeight: '1.6' }}>
        {isReconfirm
          ? <>{guestName} confirmed they&apos;re still coming to <strong>{meetingTitle}</strong> after your reminder.</>
          : <>{guestName} has RSVP&apos;d yes for <strong>{meetingTitle}</strong>.</>}
      </Text>

      {(talkRoomUrl || materialsUrl) && (
        <Section style={{ margin: '16px 0 0' }}>
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
        <Section style={{ margin: '20px 0 0' }}>
          {bodyParagraphs.map((paragraph, index) => (
            <Text key={index} style={{ fontSize: '14px', color: palette.textBody, lineHeight: '1.7' }}>
              {paragraph}
            </Text>
          ))}
        </Section>
      )}

      {guestMessage && (
        <Text
          style={{
            margin: '16px 0 0',
            fontSize: '14px',
            color: palette.textBody,
            fontStyle: 'italic' as const,
            borderLeft: `3px solid ${palette.accent}`,
            paddingLeft: '16px',
          }}
        >
          {guestMessage}
        </Text>
      )}

      {allLinks.length > 0 && (
        <Section style={{ margin: '24px 0 0' }}>
          <Button
            href={allLinks[0].url}
            style={{
              backgroundColor: palette.accent,
              color: '#0b0e18',
              padding: '12px 22px',
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
              <a href={link.url} style={{ color: palette.accent }}>{link.label}</a>
            </Text>
          ))}
        </Section>
      )}

      {media.length > 0 && (
        <Section style={{ margin: '24px 0 0' }}>
          {media.map((item) => (
            <Section key={item.url} style={{ margin: '0 0 16px' }}>
              <Img
                src={item.url}
                alt={item.alt ?? ''}
                style={{
                  width: '100%',
                  maxWidth: '520px',
                  border: `1px solid ${palette.boxBorder}`,
                  display: 'block',
                }}
              />
              {item.caption && (
                <Text style={{ margin: '8px 0 0', fontSize: '12px', color: palette.textMuted, fontStyle: 'italic' as const }}>
                  {item.caption}
                </Text>
              )}
            </Section>
          ))}
        </Section>
      )}
    </EmailShell>
  );
}

export async function renderRsvpOwnerEmail(props: RsvpOwnerEmailProps): Promise<string> {
  return render(React.createElement(RsvpOwnerEmail, props));
}
