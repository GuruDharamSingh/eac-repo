import * as React from 'react';
import { Section, Text, Button, Link } from '@react-email/components';
import { renderEmail } from '../render-email';
import { EmailShell, getEmailPalette, EAC_GOLD, HEADER_FONT_STACK } from '../components/EmailShell';
import { Prose } from '../components/cards';
import { PROVISIONING, fill, paragraphsOf } from '../copy';

// ============================================================================
// "Your cloud account is ready to claim."
//
// A separate letter from the welcome, on purpose. The welcome is sent the
// moment an account exists; the Nextcloud account only exists once the address
// has been confirmed and provisioning has run. Folding the two together would
// mean either promising storage that is not there yet, or delaying the
// confirmation that creates it.
//
// This is the first email in the suite that is genuinely about the platform's
// own offering rather than about an organisation, which is why it names what
// the reader is getting rather than assuming they know what Nextcloud is.
// ============================================================================

export interface ProvisioningEmailProps {
  displayName: string;
  orgName?: string;
  /** Where the reader finishes setting up — sets their password and lands in Files. */
  claimUrl: string;
  /** Their Nextcloud login, when it differs from their email. */
  nextcloudUsername?: string;
  /** The org's team folder name, shown so they know what to look for. */
  teamFolderName?: string;
  /** The org's own words, if it has written any. */
  bodyText?: string;
  dark?: boolean;
  orgHeader?: boolean;
  orgAccent?: string;
}

function ProvisioningEmail({
  displayName,
  orgName,
  claimUrl,
  nextcloudUsername,
  teamFolderName,
  bodyText,
  dark = true,
  orgHeader = false,
  orgAccent,
}: ProvisioningEmailProps) {
  const palette = getEmailPalette(dark);
  const org = orgName ?? 'the collective';
  const paragraphs = fill(PROVISIONING, { org });
  const orgParagraphs = paragraphsOf(bodyText);

  return (
    <EmailShell
      previewText="Claim your Nextcloud account and cloud storage"
      kicker="Your cloud account is ready"
      dark={dark}
      orgName={orgName}
      orgHeader={orgHeader}
      orgAccent={orgAccent}
      showNfpFooter
      footerText={
        <Text style={{ fontSize: '12px', color: palette.textMuted, lineHeight: '1.6', margin: 0 }}>
          This email was sent because your address was confirmed on the Elkdonis
          Arts Collective, which is what creates your cloud account.
        </Text>
      }
    >
      <Prose dark={dark}>{displayName},</Prose>

      {paragraphs.map((paragraph, i) => (
        <Prose key={`provision-${i}`} dark={dark}>{paragraph}</Prose>
      ))}

      <Section style={{ textAlign: 'center' as const, margin: '28px 0 10px' }}>
        <Button
          href={claimUrl}
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
          Finalize provisioning
        </Button>
      </Section>

      {(nextcloudUsername || teamFolderName) && (
        <Section
          style={{
            background: palette.boxBg,
            border: `1px solid ${palette.boxBorder}`,
            padding: '16px 20px',
            margin: '22px 0 0',
          }}
        >
          {nextcloudUsername && (
            <Text style={{ fontSize: '14px', color: palette.textBody, margin: '0 0 6px' }}>
              Your username: <span style={{ color: palette.textPrimary }}>{nextcloudUsername}</span>
            </Text>
          )}
          {teamFolderName && (
            <Text style={{ fontSize: '14px', color: palette.textBody, margin: 0 }}>
              Shared with you: <span style={{ color: palette.textPrimary }}>{teamFolderName}</span>
            </Text>
          )}
        </Section>
      )}

      <Prose dark={dark} muted>
        Nextcloud is a suite of software including cloud storage and instant
        messaging. Alongside it you have email support, and tools like
        Excalidraw — a very useful whiteboard program. These are resources of
        the organization, provided by the server this platform runs on.
      </Prose>

      {orgParagraphs.length > 0 && (
        <>
          {orgParagraphs.map((paragraph, i) => (
            <Prose key={`org-${i}`} dark={dark}>{paragraph}</Prose>
          ))}
        </>
      )}

      <Prose dark={dark} muted>
        If the button does not work, copy this address into your browser:{' '}
        <Link href={claimUrl} style={{ color: palette.accent, wordBreak: 'break-all' }}>
          {claimUrl}
        </Link>
      </Prose>
    </EmailShell>
  );
}

export async function renderProvisioningEmail(props: ProvisioningEmailProps): Promise<string> {
  return renderEmail(<ProvisioningEmail {...props} />);
}
