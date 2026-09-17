import * as React from 'react';
import { Section, Text, Link } from '@react-email/components';
import { renderEmail } from '../render-email';
import { EmailShell, getEmailPalette } from '../components/EmailShell';
import { ThreadCard, Prose } from '../components/cards';
import type { EmailLinkItem, EmailMediaItem } from './rsvp-owner';
import { SIGNUP_BY_PURCHASE, REMINDER_OPTIONS_NOTE, paragraphsOf } from '../copy';

// ============================================================================
// "You are on the list."
//
// Sent to whoever just reserved a place. Shares its middle with the welcome
// email on purpose — same thread card, same materials note, same reminder
// options — because for someone who signed up *by* reserving a place, the two
// letters are one thought split across two moments. The difference is that
// this one assumes the account already exists, so it skips the network letter
// and the confirm link.
// ============================================================================

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
  dark?: boolean;
  emblemUrl?: string;
  emblemAlt?: string;
  /** Author-editable copy (email_template_settings config). */
  bodyText?: string;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];

  /** The thread's own page — "Navigate back to view details". */
  threadUrl?: string;
  threadKind?: string;
  coverUrl?: string;
  summary?: string;
  /** Where the reader turns the reminder off or moves it earlier. */
  reminderSettingsUrl?: string;
  calendarUrl?: string;
  orgHeader?: boolean;
  orgAccent?: string;
}

const SECTION_LABELS: Record<string, string> = {
  amrit_vela: 'Amrit Vela',
  yoga: 'Yoga',
  gurdwara: 'Gurdwara',
};

const TZ = 'America/Toronto';

function formatWhen(value?: string): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('en-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: TZ,
      timeZoneName: 'short',
    });
  } catch {
    return null;
  }
}

function RsvpGuestEmail({
  guestName,
  meetingTitle,
  section,
  scheduledAt,
  location,
  meetingUrl,
  talkRoomUrl,
  materialsUrl,
  orgName,
  dark = true,
  emblemUrl,
  emblemAlt,
  bodyText,
  links = [],
  media = [],
  threadUrl,
  threadKind,
  coverUrl,
  summary,
  reminderSettingsUrl,
  calendarUrl,
  orgHeader = false,
  orgAccent,
}: RsvpGuestEmailProps) {
  const palette = getEmailPalette(dark);
  const when = formatWhen(scheduledAt);
  const sectionLabel = section ? (SECTION_LABELS[section] ?? section) : null;
  const orgParagraphs = paragraphsOf(bodyText);
  const joinUrl = talkRoomUrl ?? meetingUrl;

  return (
    <EmailShell
      previewText={`Your place at ${meetingTitle} is confirmed`}
      kicker="You are on the list"
      dark={dark}
      emblemUrl={emblemUrl}
      emblemAlt={emblemAlt}
      orgName={orgName}
      orgHeader={orgHeader}
      orgAccent={orgAccent}
      showNfpFooter
      footerText={
        <Text style={{ fontSize: '12px', color: palette.textMuted, lineHeight: '1.6', margin: 0 }}>
          You are receiving this because you reserved a place
          {orgName ? ` with ${orgName}` : ''}.
          {reminderSettingsUrl && (
            <>
              {' '}
              <Link href={reminderSettingsUrl} style={{ color: palette.textMuted, textDecoration: 'underline' }}>
                Change or turn off reminders.
              </Link>
            </>
          )}
        </Text>
      }
    >
      <Prose dark={dark}>{guestName},</Prose>
      <Prose dark={dark}>
        Your registration is completed{sectionLabel ? `, in ${sectionLabel}` : ''}.
      </Prose>

      <ThreadCard
        title={meetingTitle}
        kind={threadKind}
        orgName={orgName}
        when={when ?? undefined}
        where={location}
        summary={summary}
        coverUrl={coverUrl}
        url={threadUrl}
        linkLabel="Navigate back to view details"
        joinUrl={joinUrl}
        dark={dark}
      />

      {SIGNUP_BY_PURCHASE.map((paragraph, i) => (
        <Prose key={`materials-${i}`} dark={dark}>{paragraph}</Prose>
      ))}

      {materialsUrl && (
        <Section style={{ margin: '0 0 18px' }}>
          {materialsUrl && (
            <Text style={{ margin: '0 0 6px' }}>
              <Link href={materialsUrl} style={{ color: palette.accent, fontSize: '14px' }}>
                Open the materials
              </Link>
            </Text>
          )}
        </Section>
      )}

      {(reminderSettingsUrl || calendarUrl) && (
        <Prose dark={dark} muted>
          {REMINDER_OPTIONS_NOTE}{' '}
          {reminderSettingsUrl && (
            <Link href={reminderSettingsUrl} style={{ color: palette.accent }}>
              Change or turn off the reminder
            </Link>
          )}
          {reminderSettingsUrl && calendarUrl ? ' · ' : ''}
          {calendarUrl && (
            <Link href={calendarUrl} style={{ color: palette.accent }}>
              Add it to your calendar
            </Link>
          )}
        </Prose>
      )}

      {orgParagraphs.length > 0 && (
        <Section style={{ margin: '4px 0 0' }}>
          <Text
            style={{
              fontSize: '11px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.13em',
              color: palette.textMuted,
              margin: '0 0 12px',
            }}
          >
            {orgName ? `From ${orgName}` : 'From your hosts'}
          </Text>
          {orgParagraphs.map((paragraph, i) => (
            <Prose key={`org-${i}`} dark={dark}>{paragraph}</Prose>
          ))}
        </Section>
      )}

      {links.length > 0 && (
        <Section style={{ margin: '10px 0 0' }}>
          {links.map((link) => (
            <Text key={link.url} style={{ margin: '0 0 6px' }}>
              <Link href={link.url} style={{ color: palette.accent, fontSize: '14px' }}>{link.label}</Link>
            </Text>
          ))}
        </Section>
      )}

      {media.length > 0 && (
        <Section style={{ margin: '14px 0 0' }}>
          {media.map((item) => (
            <Section key={item.url} style={{ margin: '0 0 12px' }}>
              <img src={item.url} alt={item.alt ?? ''} width="520" style={{ display: 'block', width: '100%', height: 'auto' }} />
              {item.caption && (
                <Text style={{ fontSize: '12px', color: palette.textMuted, margin: '6px 0 0' }}>{item.caption}</Text>
              )}
            </Section>
          ))}
        </Section>
      )}
    </EmailShell>
  );
}

export async function renderRsvpGuestEmail(props: RsvpGuestEmailProps): Promise<string> {
  return renderEmail(<RsvpGuestEmail {...props} />);
}
