import * as React from 'react';
import { Section, Text, Button } from '@react-email/components';
import { render } from '@react-email/render';
import { EmailShell, getEmailPalette } from '../components/EmailShell';

export type MeetingTriggerType = 'reminder' | 'cancellation';

export interface MeetingTriggerEmailProps {
  type: MeetingTriggerType;
  guestName: string;
  meetingTitle: string;
  scheduledAt?: string;
  location?: string;
  meetingUrl?: string;
  talkRoomUrl?: string;
  materialsUrl?: string;
  /** The guide/author who triggered this send. */
  senderName: string;
  /** Link the guest can click to reconfirm they're still coming (reminder only). */
  confirmUrl?: string;
  orgName?: string;
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
}: MeetingTriggerEmailProps) {
  const palette = getEmailPalette(true);
  const isCancellation = type === 'cancellation';

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

  const countdown = !isCancellation && scheduledAt ? formatCountdown(scheduledAt) : null;
  const hasDetails = Boolean(dateStr || location || meetingUrl || talkRoomUrl || materialsUrl);

  return (
    <EmailShell
      previewText={
        isCancellation
          ? `Cancelled — ${meetingTitle}`
          : `Reminder — ${meetingTitle} starts in ${countdown ?? 'soon'}`
      }
      kicker={meetingTitle}
      dark
      showNfpFooter
    >
      <Text style={{ fontSize: '13px', color: palette.textMuted, marginTop: 0, marginBottom: '2px' }}>
        This email is for {guestName}.
      </Text>

      {isCancellation ? (
        <Text style={{ fontSize: '18px', color: palette.textPrimary, marginTop: 0, lineHeight: '1.5' }}>
          <strong>{meetingTitle}</strong> has been cancelled.
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
            <Text style={{ margin: 0, fontSize: '14px', color: palette.textBody }}>
              Materials: <a href={materialsUrl} style={{ color: palette.accent }}>View materials</a>
            </Text>
          )}
        </Section>
      )}

      {!isCancellation && confirmUrl && (
        <Section style={{ margin: '26px 0 0', textAlign: 'center' as const }}>
          <Text style={{ fontSize: '14px', color: palette.textBody, margin: '0 0 12px' }}>
            Still coming?
          </Text>
          <Button
            href={confirmUrl}
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
            Yes, I&apos;ll be there
          </Button>
        </Section>
      )}
    </EmailShell>
  );
}

export async function renderMeetingTriggerEmail(props: MeetingTriggerEmailProps): Promise<string> {
  return render(React.createElement(MeetingTriggerEmail, props));
}
