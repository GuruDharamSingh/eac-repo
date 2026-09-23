import * as React from 'react';
import { Section, Text, Link } from '@react-email/components';
import { renderEmail } from '../render-email';
import { EmailShell, getEmailPalette } from '../components/EmailShell';
import type { EmailChrome } from '../components/EmailShell';
import { ThreadCard, Prose } from '../components/cards';
import type { EmailLinkItem, EmailMediaItem } from './rsvp-owner';
import { OrgWords, hasOrgWords, SlotProse } from '../components/org-words';
import { slotText, slotLine, type CopyOverrides } from '../copy-slots';

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
  bodyHtml,
  copy,
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
  bodyFont,
  chrome,
}: RsvpGuestEmailProps) {
  const palette = getEmailPalette(dark);
  const when = formatWhen(scheduledAt);
  const sectionLabel = section ? (SECTION_LABELS[section] ?? section) : null;
  const hasOrg = hasOrgWords(bodyText, bodyHtml);
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
      bodyFont={bodyFont}
      {...chrome}
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

      <SlotProse copy={copy} id="signup.by_purchase" dark={dark} accent={orgAccent} font={bodyFont} />

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
          {slotLine(copy, 'reminder.options')}{' '}
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

      {hasOrg && (
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
          <OrgWords
          bodyText={bodyText}
          bodyHtml={bodyHtml}
          dark={dark}
          accent={orgAccent}
          font={bodyFont}
        />
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
