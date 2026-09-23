import { NextResponse } from "next/server";
import {
  renderSample,
  templateMeta,
  getOrgEmailIdentity,
  emailChromeFor,
  loadOrgTemplate,
  isTemplateKey,
} from "@elkdonis/email";
import { guardOrgEmail } from "@/lib/email-suite";

/**
 * One letter, rendered as the org would actually send it.
 *
 * Lazily, per letter, rather than rendering all eight into the suite's initial
 * payload: the face and the other four tabs never need them, and eight React
 * Email renders on every hub page load would be paid by everyone to serve the
 * one person who opened Letters.
 *
 * The response is HTML but is returned as JSON and put into an iframe's
 * `srcdoc` with `sandbox=""` by the caller. An email is a whole document with
 * its own body background and table layout; inlined into the page it would
 * inherit the site's CSS and show something other than what gets sent.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; key: string }> }
) {
  const { slug, key } = await params;
  const guard = await guardOrgEmail(slug);
  if (!guard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Checked against the known keys rather than passed through: `key` is a path
  // segment and `renderSample` selects a component by it.
  if (!isTemplateKey(key) || !templateMeta(key)) {
    return NextResponse.json({ error: "No such letter" }, { status: 404 });
  }

  const [identity, override] = await Promise.all([
    getOrgEmailIdentity(guard.orgId),
    loadOrgTemplate(guard.orgId, key),
  ]);

  try {
    const html = await renderSample(key, {
      orgName: identity.fromName,
      orgHeader: identity.fromIsOrgDomain,
      orgAccent: identity.palette?.accent ?? identity.accentColor,
      // And the face it is set in, so the preview is not quieter or louder
      // than the letter that leaves.
      bodyFont: identity.palette?.bodyFont,
      // The masthead image and the frame around the card, so the preview
      // wears the org's own banner rather than the collective's wordmark —
      // which is what the letter that leaves will do.
      chrome: emailChromeFor(identity),
      bodyText: override?.bodyText,
      bodyHtml: override?.bodyHtml,
      // The letter's OWN sentences, as this org has rewritten them. Without
      // this the preview renders the network's defaults and quietly disagrees
      // with what will actually send.
      copy: override?.copy,
    });
    return NextResponse.json({ html });
  } catch (err) {
    console.error(`[email] preview ${key} for ${guard.orgId}:`, err);
    return NextResponse.json({ error: "Could not render that letter" }, { status: 500 });
  }
}
