import * as React from 'react';
import { Section, Row, Column, Text, Img, Link } from '@react-email/components';
import { getEmailPalette, EAC_GOLD, HEADER_FONT_STACK } from './EmailShell';

// ============================================================================
// The two cards the network's emails are built around.
//
// A ProfileCard says "this is the account"; a ThreadCard says "this is the
// thing you joined". Between them they cover signup, purchase, RSVP, reminder
// and owner-notification — which is why they live here rather than being drawn
// again inside each template.
//
// Everything is <table> and inline styles, because that is the only layout
// email clients agree on: no flex, no grid, no class selectors, no shorthand
// background. Each card is deliberately simple enough to have a twin in the
// newsletter editor's block library, so an org editing by hand and an org
// using the default get the same shapes.
// ============================================================================

export interface ProfileCardProps {
  displayName: string;
  email?: string;
  username?: string;
  /** Absolute URL. Relative paths do not resolve in a mail client. */
  avatarUrl?: string;
  /** e.g. "Joined 16 September 2026" — already formatted by the caller. */
  metaLine?: string;
  dark?: boolean;
}

export function ProfileCard({
  displayName,
  email,
  username,
  avatarUrl,
  metaLine,
  dark = false,
}: ProfileCardProps) {
  const palette = getEmailPalette(dark);
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <Section
      style={{
        background: palette.boxBg,
        border: `1px solid ${palette.boxBorder}`,
        padding: '18px 20px',
        margin: '24px 0',
      }}
    >
      <Row>
        <Column style={{ width: '56px', verticalAlign: 'top' }}>
          {avatarUrl ? (
            <Img
              src={avatarUrl}
              alt=""
              width="44"
              height="44"
              style={{
                borderRadius: '22px',
                display: 'block',
                border: `1px solid ${EAC_GOLD}`,
              }}
            />
          ) : (
            // A lettered disc rather than a broken image: many clients block
            // remote images by default, and an empty box reads as an error.
            <Text
              style={{
                width: '44px',
                height: '44px',
                lineHeight: '44px',
                textAlign: 'center' as const,
                borderRadius: '22px',
                background: palette.cardBg,
                border: `1px solid ${EAC_GOLD}`,
                color: palette.textMuted,
                fontFamily: HEADER_FONT_STACK,
                fontSize: '18px',
                margin: 0,
              }}
            >
              {initial}
            </Text>
          )}
        </Column>

        <Column style={{ verticalAlign: 'top' }}>
          <Text
            style={{
              fontFamily: HEADER_FONT_STACK,
              fontSize: '17px',
              color: palette.textPrimary,
              margin: '0 0 3px',
              lineHeight: '1.3',
            }}
          >
            {displayName}
          </Text>
          {username && (
            <Text style={{ fontSize: '13px', color: palette.textMuted, margin: '0 0 2px' }}>
              @{username}
            </Text>
          )}
          {email && (
            <Text style={{ fontSize: '13px', color: palette.textBody, margin: '0 0 2px' }}>
              {email}
            </Text>
          )}
          {metaLine && (
            <Text style={{ fontSize: '12px', color: palette.textMuted, margin: '4px 0 0' }}>
              {metaLine}
            </Text>
          )}
        </Column>
      </Row>
    </Section>
  );
}

export interface ThreadCardProps {
  title: string;
  /** 'workshop' | 'meeting' | 'event' | 'post' | 'listing' — shown as a kicker. */
  kind?: string;
  /** Already formatted for the reader's benefit, with a timezone if it matters. */
  when?: string;
  where?: string;
  /** Absolute URL to the thread's own page. */
  url?: string;
  /** Wording for the link. The copy asks for "Navigate back to view details". */
  linkLabel?: string;
  /**
   * The way IN — a Nextcloud Talk room or a video-conference URL. It belongs
   * on the card rather than loose in the body: on the day, this is the only
   * thing anyone is looking for, and a card is what they scroll back to.
   */
  joinUrl?: string;
  joinLabel?: string;
  /** An alternative destination, e.g. the org's tab in the network hub. */
  altUrl?: string;
  altLabel?: string;
  coverUrl?: string;
  /** One line under the title — an excerpt, or what the org wants said. */
  summary?: string;
  orgName?: string;
  dark?: boolean;
}

export function ThreadCard({
  title,
  kind,
  when,
  where,
  url,
  linkLabel,
  joinUrl,
  joinLabel,
  altUrl,
  altLabel,
  coverUrl,
  summary,
  orgName,
  dark = false,
}: ThreadCardProps) {
  const palette = getEmailPalette(dark);
  const label = kind
    ? `${kind}${orgName ? ` · ${orgName}` : ''}`
    : orgName;

  return (
    <Section
      style={{
        background: palette.boxBg,
        border: `1px solid ${palette.boxBorder}`,
        margin: '24px 0',
      }}
    >
      {coverUrl && (
        <Img
          src={coverUrl}
          alt=""
          width="600"
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            borderBottom: `1px solid ${palette.boxBorder}`,
          }}
        />
      )}

      <Section style={{ padding: '18px 20px' }}>
        {label && (
          <Text
            style={{
              fontSize: '11px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.12em',
              color: palette.textMuted,
              margin: '0 0 6px',
            }}
          >
            {label}
          </Text>
        )}

        <Text
          style={{
            fontFamily: HEADER_FONT_STACK,
            fontSize: '19px',
            lineHeight: '1.3',
            color: palette.textPrimary,
            margin: '0 0 8px',
          }}
        >
          {title}
        </Text>

        {summary && (
          <Text style={{ fontSize: '14px', lineHeight: '1.6', color: palette.textBody, margin: '0 0 10px' }}>
            {summary}
          </Text>
        )}

        {when && (
          <Text style={{ fontSize: '14px', color: palette.textBody, margin: '0 0 2px' }}>
            {when}
          </Text>
        )}
        {where && (
          <Text style={{ fontSize: '14px', color: palette.textBody, margin: '0 0 2px' }}>
            {where}
          </Text>
        )}

        {joinUrl && (
          <Text style={{ margin: '14px 0 0' }}>
            <Link
              href={joinUrl}
              style={{
                color: palette.textPrimary,
                fontSize: '15px',
                textDecoration: 'underline',
              }}
            >
              {joinLabel ?? 'Join when it begins'}
            </Link>
          </Text>
        )}

        {url && (
          <Text style={{ margin: joinUrl ? '8px 0 0' : '12px 0 0' }}>
            <Link
              href={url}
              style={{
                color: palette.accent,
                fontSize: '14px',
                textDecoration: 'underline',
              }}
            >
              {linkLabel ?? 'View details'}
            </Link>
          </Text>
        )}

        {altUrl && (
          <Text style={{ margin: '6px 0 0' }}>
            <Link href={altUrl} style={{ color: palette.textMuted, fontSize: '13px', textDecoration: 'underline' }}>
              {altLabel ?? 'Open it in your hub'}
            </Link>
          </Text>
        )}
      </Section>
    </Section>
  );
}

/** A paragraph in the body face — used by every template for prose. */
export function Prose({
  children,
  dark = false,
  muted = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
  muted?: boolean;
}) {
  const palette = getEmailPalette(dark);
  return (
    <Text
      style={{
        fontSize: muted ? '13px' : '15px',
        lineHeight: '1.75',
        color: muted ? palette.textMuted : palette.textBody,
        margin: '0 0 16px',
      }}
    >
      {children}
    </Text>
  );
}

/**
 * A "read more" that is safe in email.
 *
 * `<details>` works in Apple Mail and most webmail. Where a client strips the
 * tag it does NOT strip the children, so the content renders expanded — the
 * failure mode is "the reader sees everything", which is the right way round
 * for a letter whose whole purpose is to be read. Never put anything essential
 * behind it anyway: assume it is always open and be pleased when it is not.
 */
export function ReadMore({
  label,
  children,
  dark = false,
}: {
  label: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  const palette = getEmailPalette(dark);
  return (
    <details style={{ margin: '4px 0 0' }}>
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          display: 'block',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '11px',
          letterSpacing: '0.13em',
          textTransform: 'uppercase' as const,
          color: EAC_GOLD,
          borderTop: `1px solid ${palette.boxBorder}`,
          borderBottom: `1px solid ${palette.boxBorder}`,
          padding: '12px 0',
          margin: '0 0 18px',
        }}
      >
        {label}
      </summary>
      {children}
    </details>
  );
}
