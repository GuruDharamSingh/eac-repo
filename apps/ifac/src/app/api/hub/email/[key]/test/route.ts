import { NextResponse, type NextRequest } from "next/server";
import {
  getOrgEmailIdentity,
  emailChromeFor,
  isTemplateKey,
  loadOrgTemplate,
  renderAdvancedEmail,
  renderSample,
  sendEmail,
  templateMeta,
} from "@elkdonis/email";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Send this template to the person editing it, and to nobody else.
 *
 * A preview in a browser is not the same thing as the letter in an inbox —
 * fonts get stripped, dark mode inverts, Outlook rewrites the layout. This is
 * the only honest way to know what it looks like, so it exists before any of
 * these templates are relied on.
 *
 * The recipient is ALWAYS the signed-in editor's own address, taken from the
 * session rather than the request body. A test-send route that mails an
 * arbitrary address is an open relay wearing a friendly name.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!isTemplateKey(key)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }
  if (!editor.email) {
    return NextResponse.json({ error: "Your account has no email address" }, { status: 400 });
  }

  const meta = templateMeta(key);
  const [identity, stored] = await Promise.all([
    getOrgEmailIdentity(siteConfig.orgId),
    loadOrgTemplate(siteConfig.orgId, key),
  ]);

  // Prefer what the editor just saved, exactly as the send path would.
  const html = stored?.html
    ? await renderAdvancedEmail({
        previewText: `Test — ${meta?.title ?? key}`,
        kicker: meta?.title,
        html: stored.html,
        orgName: identity.fromName,
        orgHeader: identity.fromIsOrgDomain,
        orgAccent: identity.accentColor,
        // And the face it is set in, so the preview is not quieter or louder
        // than the letter that leaves.
        bodyFont: identity.palette?.bodyFont,
        // The masthead image and the frame around the card, so the preview
        // wears the org's own banner rather than the collective's wordmark —
        // which is what the letter that leaves will do.
        chrome: emailChromeFor(identity),
      })
    : await renderSample(key, {
        orgName: identity.fromName,
        orgHeader: identity.fromIsOrgDomain,
        orgAccent: identity.accentColor,
        bodyText: stored?.bodyText,
        bodyHtml: stored?.bodyHtml,
        // The letter's OWN sentences, as this org has rewritten them. Without
        // this the preview renders the network's defaults and quietly disagrees
        // with what will actually send.
        copy: stored?.copy,
      });

  try {
    const result = await sendEmail({
      to: editor.email,
      subject: `[test] ${meta?.title ?? key} — ${identity.fromName}`,
      html,
      orgId: siteConfig.orgId,
      kind: "notification",
      categories: ["test-send"],
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.skipped ? "Email is not configured on this server" : "SendGrid did not accept it" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, sent: 1, to: editor.email });
  } catch (err) {
    console.error(`[hub/email] test send ${key} failed:`, err);
    return NextResponse.json({ ok: false, error: "Could not send" }, { status: 502 });
  }
}
