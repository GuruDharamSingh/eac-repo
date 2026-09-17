import * as React from 'react';
import { renderEmail } from '../render-email';
import { EmailShell } from '../components/EmailShell';
import { fillHtml } from '../merge-fields';

// ============================================================================
// An organisation's own layout, wrapped in the network's envelope.
//
// When an org composes an email in the newsletter editor, this is what sends
// it. The org owns everything between the header and the footer; the network
// keeps the header, the footer and — critically — whatever the footer carries,
// which for bulk mail is the unsubscribe. An org cannot compose its way out of
// an unsubscribe link, and that is on purpose.
//
// The HTML is inserted as-is. It came from an editor an org owner used, so it
// is first-party content at the same trust level as a blog post they wrote —
// but it is NEVER rendered in a browser session belonging to anyone else, only
// mailed, where scripts do not run. The callers that store it are the
// authorisation boundary.
// ============================================================================

export interface AdvancedEmailProps {
  /** Inbox preview line. Falls back to the subject if unset. */
  previewText: string;
  /** The small line under the header. */
  kicker?: string;
  /** Body HTML from the editor — already inlined by juice on export. */
  html: string;
  /**
   * `{field}` → value, for the tokens a laid-out body carries.
   *
   * Omitted means no substitution, which is what a newsletter wants: it has no
   * per-recipient data and its author may legitimately have typed a literal
   * brace. Every triggered letter passes them — see mergeValuesFor.
   */
  values?: Record<string, string | undefined>;
  dark?: boolean;
  emblemUrl?: string;
  emblemAlt?: string;
  footerText?: string;
  showNfpFooter?: boolean;
  orgName?: string;
  orgHeader?: boolean;
  orgAccent?: string;
}

/**
 * Take the body out of a full document.
 *
 * The newsletter preset exports `<html><head>…<body>…</body></html>`. Nesting
 * that inside the shell's own document would produce a second <html> element
 * mid-page, which mail clients resolve in entertainingly different ways.
 */
export function bodyOf(html: string): string {
  const match = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return (match ? match[1] : html).trim();
}



function AdvancedEmail({
  previewText,
  kicker,
  html,
  values,
  dark = true,
  emblemUrl,
  emblemAlt,
  footerText,
  showNfpFooter = true,
  orgName,
  orgHeader = false,
  orgAccent,
}: AdvancedEmailProps) {
  return (
    <EmailShell
      previewText={previewText}
      kicker={kicker}
      dark={dark}
      emblemUrl={emblemUrl}
      emblemAlt={emblemAlt}
      orgName={orgName}
      orgHeader={orgHeader}
      orgAccent={orgAccent}
      showNfpFooter={showNfpFooter}
      footerText={
        footerText ? (
          <div dangerouslySetInnerHTML={{ __html: footerText }} />
        ) : undefined
      }
    >
      <div dangerouslySetInnerHTML={{ __html: fillHtml(bodyOf(html), values) }} />
    </EmailShell>
  );
}

export async function renderAdvancedEmail(props: AdvancedEmailProps): Promise<string> {
  return renderEmail(<AdvancedEmail {...props} />);
}
