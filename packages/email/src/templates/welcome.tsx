import * as React from 'react';
import { Section, Text, Button, Img, Link, Hr } from '@react-email/components';
import { renderEmail } from '../render-email';
import { EmailShell, getEmailPalette, EAC_GOLD, HEADER_FONT_STACK } from '../components/EmailShell';
import { ProfileCard, ThreadCard, Prose, ReadMore, type ThreadCardProps } from '../components/cards';
import {
  NETWORK_MANIFESTO,
  NETWORK_RESOURCES,
  SIGNUP_CONFIRM,
  SIGNUP_NETWORK_NOTE,
  SIGNUP_BY_PURCHASE,
  REMINDER_OPTIONS_NOTE,
  fill,
  paragraphsOf,
} from '../copy';

// ============================================================================
// The one letter the network sends on its own behalf.
//
// It does three jobs at once, in this order, because that is the order the
// reader cares about:
//
//   1. confirm the account they just made, with the organisation they made it
//      with — and carry the confirm-email link, which is what triggers their
//      Nextcloud provisioning. That link is LOAD-BEARING; an account that
//      never confirms never gets its storage.
//   2. show them what they joined — their own profile, and, when the account
//      was created by buying or reserving a place, the thing they bought.
//   3. say what the Elkdonis Arts Collective is. Once, properly, at the only
//      moment someone is reliably reading.
//
// Every organisation on the network sends this same letter (see
// auth-server's handleSignup) — that is deliberate. Signing up is a NETWORK
// event: the account is on the network, org membership is downstream, and the
// confirm link provisions a network resource. An org adds its own voice
// through `bodyText`, which renders as its own section rather than displacing
// any of the above.
// ============================================================================

export interface WelcomeLinkItem {
  label: string;
  url: string;
}

export interface WelcomeMediaItem {
  url: string;
  alt?: string;
  caption?: string;
}

export interface WelcomeEmailProps {
  displayName: string;
  /** Shown on the profile card — the address this was sent to. */
  email?: string;
  username?: string;
  avatarUrl?: string;
  /** The organisation the account was created with. */
  orgName?: string;

  /**
   * The confirm-email link. Rendered as the primary button.
   * Confirming is what triggers Nextcloud provisioning, so when this is
   * present it outranks every other call to action in the email.
   */
  confirmUrl?: string;

  /**
   * Set when the account was created by buying or reserving a place — a
   * workshop, a meeting. Renders the thread card and the materials note.
   */
  thread?: Omit<ThreadCardProps, 'dark'>;

  /** Where the reader can turn the reminder off or move it earlier. */
  reminderSettingsUrl?: string;
  /** A .ics or Google Calendar link for the thread above. */
  calendarUrl?: string;

  /** The whole network. Defaults to arts-collective.com. */
  networkUrl?: string;
  /** The collective itself. Defaults to elkdonis-arts.org. */
  collectiveUrl?: string;

  /** The org's own words, shown as its own section. */
  bodyText?: string;
  /** Extra links from the org. The confirm button is separate and always wins. */
  links?: WelcomeLinkItem[];
  media?: WelcomeMediaItem[];

  /**
   * Legacy fallback CTA for callers that pass no confirmUrl.
   * NB: this used to default to gathering.elkdonis-arts.org, which does not
   * resolve — every email rendered without a confirm link carried a dead
   * button.
   */
  portalUrl?: string;
  dark?: boolean;
  /** True once the org sends from its own authenticated domain. */
  orgHeader?: boolean;
  orgAccent?: string;
}

const NETWORK_URL = 'https://arts-collective.com';
const COLLECTIVE_URL = 'https://elkdonis-arts.org';

function WelcomeEmail({
  displayName,
  email,
  username,
  avatarUrl,
  orgName,
  confirmUrl,
  thread,
  reminderSettingsUrl,
  calendarUrl,
  networkUrl = NETWORK_URL,
  collectiveUrl = COLLECTIVE_URL,
  bodyText,
  links,
  media = [],
  portalUrl = COLLECTIVE_URL,
  dark = true,
  orgHeader = false,
  orgAccent,
}: WelcomeEmailProps) {
  const palette = getEmailPalette(dark);
  const org = orgName ?? 'the Elkdonis Arts Collective';

  const confirmParagraphs = fill(SIGNUP_CONFIRM, { org });
  const orgParagraphs = paragraphsOf(bodyText);
  const primaryUrl = confirmUrl ?? portalUrl;
  // Confirming is optional — GOTRUE_MAILER_AUTOCONFIRM is on, so the address
  // is already confirmed, and nothing is withheld from someone who never
  // clicks. The link is offered, not pressed: no urgency copy underneath it.
  const primaryLabel = confirmUrl ? 'Confirm account' : 'Enter the Collective';
  const extraLinks = (links ?? []).filter((link) => link.url && link.url !== primaryUrl);

  const divider = (
    <Hr style={{ border: 'none', borderTop: `1px solid ${palette.boxBorder}`, margin: '30px 0 26px' }} />
  );

  const sectionLabel = (text: string) => (
    <Text
      style={{
        fontSize: '11px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.13em',
        color: EAC_GOLD,
        margin: '0 0 14px',
      }}
    >
      {text}
    </Text>
  );

  return (
    <EmailShell
      previewText={`Your account with ${org} — and the collective it joins`}
      kicker={orgHeader ? undefined : orgName ? `Welcome to ${orgName}` : 'Welcome to the Collective'}
      dark={dark}
      orgName={orgName}
      orgHeader={orgHeader}
      orgAccent={orgAccent}
      showNfpFooter
      footerText={
        <Text style={{ fontSize: '12px', color: palette.textMuted, lineHeight: '1.6', margin: 0 }}>
          This email was sent because an account was created with {org} on the
          Elkdonis Arts Collective. If that was not you, you can safely ignore
          this message and nothing further will happen.
        </Text>
      }
    >
      {/* 1 — the confirmation itself */}
      {confirmParagraphs.map((paragraph, i) => (
        <Prose key={`confirm-${i}`} dark={dark}>{paragraph}</Prose>
      ))}

      <ProfileCard
        displayName={displayName}
        email={email}
        username={username}
        avatarUrl={avatarUrl}
        metaLine={orgName ? `Member of ${orgName}` : undefined}
        dark={dark}
      />

      {/* 2 — what they bought or reserved, when that is why the account exists */}
      {thread && (
        <>
          <ThreadCard
            {...thread}
            linkLabel={thread.linkLabel ?? 'Navigate back to view details'}
            orgName={thread.orgName ?? orgName}
            dark={dark}
          />
          {SIGNUP_BY_PURCHASE.map((paragraph, i) => (
            <Prose key={`purchase-${i}`} dark={dark}>{paragraph}</Prose>
          ))}

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
        </>
      )}

      {/* The load-bearing action. */}
      <Section style={{ textAlign: 'center' as const, margin: '30px 0 8px' }}>
        <Button
          href={primaryUrl}
          style={{
            backgroundColor: EAC_GOLD,
            color: '#01124E',
            fontFamily: HEADER_FONT_STACK,
            fontSize: '14px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            padding: '14px 30px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          {primaryLabel}
        </Button>
      </Section>

      {extraLinks.length > 0 && (
        <Section style={{ margin: '10px 0 0', textAlign: 'center' as const }}>
          {extraLinks.map((link) => (
            <Text key={link.url} style={{ margin: '0 0 6px' }}>
              <Link href={link.url} style={{ color: palette.accent, fontSize: '14px' }}>
                {link.label}
              </Link>
            </Text>
          ))}
        </Section>
      )}

      {/* 3 — the org's own words, if it has written any */}
      {orgParagraphs.length > 0 && (
        <>
          {divider}
          {sectionLabel(orgName ? `From ${orgName}` : 'From your hosts')}
          {orgParagraphs.map((paragraph, i) => (
            <Prose key={`org-${i}`} dark={dark}>{paragraph}</Prose>
          ))}
        </>
      )}

      {media.length > 0 && (
        <Section style={{ margin: '18px 0 0' }}>
          {media.map((item) => (
            <Section key={item.url} style={{ margin: '0 0 14px' }}>
              <Img src={item.url} alt={item.alt ?? ''} width="520" style={{ display: 'block', width: '100%', height: 'auto' }} />
              {item.caption && (
                <Text style={{ fontSize: '12px', color: palette.textMuted, margin: '6px 0 0' }}>
                  {item.caption}
                </Text>
              )}
            </Section>
          ))}
        </Section>
      )}

      {/* 4 — the network this account actually joins */}
      {divider}
      {fill(SIGNUP_NETWORK_NOTE, { org }).map((paragraph, i) => (
        <Prose key={`net-${i}`} dark={dark}>{paragraph}</Prose>
      ))}
      <Prose dark={dark}>
        You can visit{' '}
        <Link href={networkUrl} style={{ color: palette.accent }}>arts-collective.com</Link>{' '}
        to view the full network, or choose to investigate Elkdonis Arts at{' '}
        <Link href={collectiveUrl} style={{ color: palette.accent }}>elkdonis-arts.org</Link>.
      </Prose>

      {/* 5 — what the collective is */}
      {/*
        The collective's letter, in two parts. The opening two paragraphs say
        what this is and stand on their own; everything after them — the
        values, the resources, the bit about hockey teams — is offered behind a
        "read more" rather than imposed on someone who just wanted to confirm
        an address. Where a client strips <details> it all shows anyway, which
        is the right way for that to fail.
      */}
      {divider}
      {sectionLabel('About the collective')}
      {NETWORK_MANIFESTO.slice(0, 2).map((paragraph, i) => (
        <Prose key={`manifesto-${i}`} dark={dark}>{paragraph}</Prose>
      ))}

      <ReadMore label="Read more about the collective" dark={dark}>
        {NETWORK_MANIFESTO.slice(2).map((paragraph, i) => (
          <Prose key={`manifesto-rest-${i}`} dark={dark}>{paragraph}</Prose>
        ))}
        {NETWORK_RESOURCES.map((paragraph, i) => (
          <Prose key={`resources-${i}`} dark={dark}>{paragraph}</Prose>
        ))}
      </ReadMore>
    </EmailShell>
  );
}

export async function renderWelcomeEmail(props: WelcomeEmailProps): Promise<string> {
  return renderEmail(<WelcomeEmail {...props} />);
}
