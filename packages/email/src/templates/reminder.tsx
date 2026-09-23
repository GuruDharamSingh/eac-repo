import * as React from 'react';
import { Section, Text, Link } from '@react-email/components';
import { renderEmail } from '../render-email';
import { EmailShell, getEmailPalette, EAC_GOLD } from '../components/EmailShell';
import type { EmailChrome } from '../components/EmailShell';
import { ThreadCard, Prose } from '../components/cards';
import type { EmailLinkItem, EmailMediaItem } from './rsvp-owner';
import { OrgWords, hasOrgWords, SlotProse } from '../components/org-words';
import { slotText, type CopyOverrides } from '../copy-slots';

// ============================================================================
// "This begins soon."
//
// The one email in the suite whose value is entirely in its timing, so it
// leads with WHEN and leaves everything else to the thread card. The
// "in 3 hours" line is computed at render time — which is send time — so it is
// accurate for exactly the moment it lands, and would be a lie if precomputed.
// ============================================================================

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
  /** Small header emblem (e.g. amrit-canada's Khanda). */
  emblemUrl?: string;
  emblemAlt?: string;
  /** Author-editable copy (email_template_settings config). */
  bodyText?: string;
  /** The same words with emphasis, links and lists. Wins over bodyText. */
  bodyHtml?: string;
  /**
   * This organisation's words for any block of this letter.
   *
   * Every sentence below is a SLOT (copy-slots.ts). Passing nothing renders
   * the network's defaults, which is what every caller did before overriding
   * existed and what most callers still do.
   */
  copy?: CopyOverrides;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];

  /** 'workshop' | 'meeting' | 'event' — shown on the thread card. */
  threadKind?: string;
  coverUrl?: string;
  summary?: string;
  /** Where the reader turns the reminder off or moves it earlier. */
  reminderSettingsUrl?: string;
  calendarUrl?: string;
  dark?: boolean;
  orgHeader?: boolean;
  orgAccent?: string;
  /** Which body face this organisation's mail is set in, by id. */
  bodyFont?: string;
  /**
   * The organisation's own masthead image and frame — see `EmailChrome`.
   *
   * ONE bag rather than four more props, and passed straight through to the
   * shell without this template reading any of it. Every other brand value
   * here (`orgName`, `orgAccent`, `bodyFont`) is threaded individually
   * because the BODY uses it too; nothing in a body has an opinion about the
   * picture at the top of the card, so spreading it is both shorter and the
   * honest description of what happens to it.
   */
  chrome?: EmailChrome;
}

const TZ = 'America/Toronto';

/** "in 3 hours", "in 2 days", "in 45 minutes" — or null if it has passed. */
function relativeWhen(scheduledAt?: string): string | null {
  if (!scheduledAt) return null;
  const at = new Date(scheduledAt).getTime();
  if (Number.isNaN(at)) return null;

  const minutes = Math.round((at - Date.now()) / 60000);
  if (minutes < 1) return null;
  if (minutes < 60) return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;

  const hours = Math.round(minutes / 60);
  if (hours < 36) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;

  const days = Math.round(hours / 24);
  return `in ${days} ${days === 1 ? 'day' : 'days'}`;
}

function absoluteWhen(scheduledAt?: string): string | null {
  if (!scheduledAt) return null;
  try {
    return new Date(scheduledAt).toLocaleString('en-CA', {
      weekday: 'long',
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

function ReminderEmail({
  guestName,
  meetingTitle,
  scheduledAt,
  location,
  meetingUrl,
  talkJoinUrl,
  orgName,
  rsvpUrl,
  rsvpCount,
  emblemUrl,
  emblemAlt,
  bodyText,
  bodyHtml,
  copy,
  links = [],
  media = [],
  threadKind,
  coverUrl,
  summary,
  reminderSettingsUrl,
  calendarUrl,
  dark = true,
  orgHeader = false,
  orgAccent,
  bodyFont,
  chrome,
}: ReminderEmailProps) {
  const palette = getEmailPalette(dark);
  const org = orgName ?? 'the collective';
  const relative = relativeWhen(scheduledAt);
  const absolute = absoluteWhen(scheduledAt);
  const hasOrg = hasOrgWords(bodyText, bodyHtml);

  const joinUrl = talkJoinUrl ?? meetingUrl;

  return (
    <EmailShell
      previewText={`${meetingTitle} — ${relative ?? 'starting soon'}`}
      kicker="A reminder"
      dark={dark}
      emblemUrl={emblemUrl}
      emblemAlt={emblemAlt}
      orgName={orgName}
      orgHeader={orgHeader}
      orgAccent={orgAccent}
      bodyFont={bodyFont}
      {...chrome}
      showNfpFooter
      footerText={
        <Text style={{ fontSize: '12px', color: palette.textMuted, lineHeight: '1.6', margin: 0 }}>
          You are receiving this because you said you were coming.
          {reminderSettingsUrl && (
            <>
              {' '}
              <Link href={reminderSettingsUrl} style={{ color: palette.textMuted, textDecoration: 'underline' }}>
                Change when reminders reach you, or turn them off.
              </Link>
            </>
          )}
        </Text>
      }
    >
      <Prose dark={dark}>{guestName},</Prose>

      <SlotProse copy={copy} id="reminder.intro" values={{ thread: meetingTitle, org }} dark={dark} accent={orgAccent} font={bodyFont} />

      {/* The whole point of the email, given its own weight. */}
      {(relative || absolute) && (
        <Section
          style={{
            border: `1px solid ${EAC_GOLD}`,
            background: palette.boxBg,
            padding: '20px',
            margin: '22px 0',
            textAlign: 'center' as const,
          }}
        >
          {relative && (
            <Text
              style={{
                fontSize: '22px',
                lineHeight: '1.25',
                color: palette.textPrimary,
                margin: 0,
              }}
            >
              Begins {relative}
            </Text>
          )}
          {absolute && (
            <Text style={{ fontSize: '14px', color: palette.textMuted, margin: relative ? '8px 0 0' : 0 }}>
              {absolute}
            </Text>
          )}
        </Section>
      )}

      <ThreadCard
        title={meetingTitle}
        kind={threadKind}
        orgName={orgName}
        when={absolute ?? undefined}
        where={location}
        summary={summary}
        coverUrl={coverUrl}
        url={rsvpUrl}
        linkLabel="Navigate back to view details"
        joinUrl={joinUrl}
        dark={dark}
      />

      {typeof rsvpCount === 'number' && rsvpCount > 0 && (
        <Prose dark={dark} muted>
          {rsvpCount} {rsvpCount === 1 ? 'person is' : 'people are'} coming so far.
        </Prose>
      )}

      {calendarUrl && (
        <Prose dark={dark} muted>
          <Link href={calendarUrl} style={{ color: palette.accent }}>Add it to your calendar</Link>
        </Prose>
      )}

      {/* The org's own words, when it has written any. */}
      {hasOrg && (
        <OrgWords
          bodyText={bodyText}
          bodyHtml={bodyHtml}
          dark={dark}
          accent={orgAccent}
          font={bodyFont}
        />
      )}

      {links.length > 0 && (
        <Section style={{ margin: '18px 0 0' }}>
          {links.map((link) => (
            <Text key={link.url} style={{ margin: '0 0 6px' }}>
              <Link href={link.url} style={{ color: palette.accent, fontSize: '14px' }}>
                {link.label}
              </Link>
            </Text>
          ))}
        </Section>
      )}

      {media.length > 0 && (
        <Section style={{ margin: '18px 0 0' }}>
          {media.map((item) => (
            <Section key={item.url} style={{ margin: '0 0 14px' }}>
              <img src={item.url} alt={item.alt ?? ''} width="520" style={{ display: 'block', width: '100%', height: 'auto' }} />
              {item.caption && (
                <Text style={{ fontSize: '12px', color: palette.textMuted, margin: '6px 0 0' }}>{item.caption}</Text>
              )}
            </Section>
          ))}
        </Section>
      )}

      <SlotProse copy={copy} id="reminder.org_note" values={{ org }} dark={dark} accent={orgAccent} font={bodyFont} />
    </EmailShell>
  );
}

export async function renderReminderEmail(props: ReminderEmailProps): Promise<string> {
  return renderEmail(<ReminderEmail {...props} />);
}
