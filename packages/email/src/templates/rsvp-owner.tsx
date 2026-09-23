import * as React from 'react';
import { Section, Text, Link } from '@react-email/components';
import { renderEmail } from '../render-email';
import { EmailShell, getEmailPalette } from '../components/EmailShell';
import type { EmailChrome } from '../components/EmailShell';
import { ProfileCard, ThreadCard, Prose } from '../components/cards';
import { OrgWords } from '../components/org-words';

// ============================================================================
// "Someone just arrived." — the letter that goes to whoever runs the thing.
//
// One template for every arrival, because from the owner's side they are the
// same event with a different noun: a signup, a follower, an RSVP, a purchase,
// a message. What differs is only WHAT they arrived at, and that is already
// carried by the thread's kind — so the wording is derived from it rather than
// being a separate template per case.
//
// The file keeps its name, and keeps exporting EmailLinkItem / EmailMediaItem,
// because rsvp-guest.tsx and reminder.tsx import those types from here.
// ============================================================================

export interface EmailLinkItem {
  label: string;
  url: string;
}

export interface EmailMediaItem {
  url: string;
  alt?: string;
  caption?: string;
}

/** What the person did. */
export type OwnerNotificationKind =
  | 'rsvp'
  | 'signup'
  | 'follow'
  | 'purchase'
  | 'contact';

export interface RsvpOwnerEmailProps {
  /** 'reconfirmed' — guest re-affirmed attendance after a trigger email. */
  variant?: 'new' | 'reconfirmed';
  /** Defaults to 'rsvp', which is what every existing caller means. */
  notificationKind?: OwnerNotificationKind;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestMessage?: string;
  guestUsername?: string;
  guestAvatarUrl?: string;
  wantsReminder?: boolean;
  meetingTitle: string;
  section?: string;
  scheduledAt?: string;
  rsvpCreatedAt?: string;
  threadUrl?: string;
  /** 'workshop' | 'meeting' | 'post' | 'listing' — picks the noun in the headline. */
  threadKind?: string;
  coverUrl?: string;
  /** Nextcloud Talk room join link, when the thread has one. */
  talkRoomUrl?: string;
  /** Link to the thread's materials (workshops with a provisioned folder). */
  materialsUrl?: string;
  orgName?: string;
  rsvpCount?: number;
  /**
   * The org's tab in the network hub — an alternative to the thread's own
   * page. An owner reading this on a phone usually wants the console they
   * manage everything from, not the public page the guest just saw.
   * Defaults to arts-collective.com/hub/organization.
   */
  hubUrl?: string;
  dark?: boolean;
  emblemUrl?: string;
  emblemAlt?: string;
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
  bodyText?: string;
  /** The same words with emphasis, links and lists. Wins over bodyText. */
  bodyHtml?: string;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];
}

const ACTION_LABEL: Record<OwnerNotificationKind, string> = {
  rsvp: 'New RSVP',
  signup: 'New signup',
  follow: 'New follower',
  purchase: 'New purchase',
  contact: 'New message',
};

/**
 * What they arrived at, in the owner's words rather than the schema's.
 * An org that has no thread at all gets "your organization".
 */
function targetNoun(threadKind: string | undefined, orgName: string | undefined): string {
  switch (threadKind) {
    case 'workshop':
      return 'your workshop';
    case 'meeting':
    case 'event':
      return 'your meeting';
    case 'post':
    case 'writing':
      return 'your blog';
    case 'listing':
    case 'product':
      return 'your shop';
    default:
      return orgName ? `your organization` : 'your page';
  }
}

const TZ = 'America/Toronto';

function formatWhen(value?: string, withTime = true): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      ...(withTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' as const } : {}),
      timeZone: TZ,
    });
  } catch {
    return null;
  }
}

function OwnerNotificationEmail({
  variant = 'new',
  notificationKind = 'rsvp',
  guestName,
  guestEmail,
  guestPhone,
  guestMessage,
  guestUsername,
  guestAvatarUrl,
  wantsReminder,
  meetingTitle,
  scheduledAt,
  rsvpCreatedAt,
  threadUrl,
  threadKind,
  coverUrl,
  talkRoomUrl,
  materialsUrl,
  orgName,
  rsvpCount,
  hubUrl = 'https://arts-collective.com/hub/organization',
  dark = true,
  emblemUrl,
  emblemAlt,
  orgHeader = false,
  orgAccent,
  bodyFont,
  chrome,
  bodyText,
  bodyHtml,
  links = [],
  media = [],
}: RsvpOwnerEmailProps) {
  const palette = getEmailPalette(dark);
  const action = variant === 'reconfirmed' ? 'Confirmed' : ACTION_LABEL[notificationKind];
  const noun = targetNoun(threadKind, orgName);
  const arrivedAt = formatWhen(rsvpCreatedAt);
  const startsAt = formatWhen(scheduledAt);

  return (
    <EmailShell
      previewText={`${action}: ${guestName} — ${meetingTitle}`}
      kicker={action}
      dark={dark}
      emblemUrl={emblemUrl}
      emblemAlt={emblemAlt}
      orgName={orgName}
      orgHeader={orgHeader}
      orgAccent={orgAccent}
      bodyFont={bodyFont}
      {...chrome}
      footerText={
        <Text style={{ fontSize: '12px', color: palette.textMuted, lineHeight: '1.6', margin: 0 }}>
          You are receiving this because you are listed as a contact for
          {orgName ? ` ${orgName}` : ' this organization'}.
        </Text>
      }
    >
      <Prose dark={dark}>
        You have received {variant === 'reconfirmed' ? 'a confirmation' : `a ${ACTION_LABEL[notificationKind].replace('New ', '').toLowerCase()}`} to {noun}.
      </Prose>

      <ProfileCard
        displayName={guestName}
        email={guestEmail}
        username={guestUsername}
        avatarUrl={guestAvatarUrl}
        metaLine={arrivedAt ? `Arrived ${arrivedAt}` : undefined}
        dark={dark}
      />

      {guestPhone && (
        <Prose dark={dark} muted>Phone: {guestPhone}</Prose>
      )}

      {guestMessage && (
        <Section
          style={{
            background: palette.boxBg,
            border: `1px solid ${palette.boxBorder}`,
            padding: '16px 20px',
            margin: '0 0 22px',
          }}
        >
          <Text style={{ fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: palette.textMuted, margin: '0 0 8px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            What they said
          </Text>
          <Text style={{ fontSize: '15px', lineHeight: '1.7', color: palette.textBody, margin: 0, whiteSpace: 'pre-wrap' as const }}>
            {guestMessage}
          </Text>
        </Section>
      )}

      <ThreadCard
        title={meetingTitle}
        kind={threadKind}
        orgName={orgName}
        when={startsAt ?? undefined}
        coverUrl={coverUrl}
        url={threadUrl}
        linkLabel="View details"
        altUrl={hubUrl}
        altLabel="Or open your organization in the hub"
        dark={dark}
      />

      {typeof rsvpCount === 'number' && rsvpCount > 0 && (
        <Prose dark={dark}>
          {rsvpCount} {rsvpCount === 1 ? 'person is' : 'people are'} coming so far.
        </Prose>
      )}

      {typeof wantsReminder === 'boolean' && (
        <Prose dark={dark} muted>
          {wantsReminder
            ? 'They asked to be reminded before it begins.'
            : 'They asked not to be reminded.'}
        </Prose>
      )}

      {(talkRoomUrl || materialsUrl) && (
        <Section style={{ margin: '4px 0 0' }}>
          {talkRoomUrl && (
            <Text style={{ margin: '0 0 6px' }}>
              <Link href={talkRoomUrl} style={{ color: palette.accent, fontSize: '14px' }}>Open the conversation</Link>
            </Text>
          )}
          {materialsUrl && (
            <Text style={{ margin: '0 0 6px' }}>
              <Link href={materialsUrl} style={{ color: palette.accent, fontSize: '14px' }}>Open the materials</Link>
            </Text>
          )}
        </Section>
      )}

      <OrgWords
          bodyText={bodyText}
          bodyHtml={bodyHtml}
          dark={dark}
          accent={orgAccent}
          font={bodyFont}
        />

      {links.length > 0 && (
        <Section style={{ margin: '14px 0 0' }}>
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

export async function renderRsvpOwnerEmail(props: RsvpOwnerEmailProps): Promise<string> {
  return renderEmail(<OwnerNotificationEmail {...props} />);
}

/** The name this template deserves, now that it covers every arrival. */
export const renderOwnerNotificationEmail = renderRsvpOwnerEmail;
export type OwnerNotificationEmailProps = RsvpOwnerEmailProps;
