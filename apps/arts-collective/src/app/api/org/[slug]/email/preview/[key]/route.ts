import { NextResponse } from "next/server";
import {
  renderSample,
  templateMeta,
  getOrgEmailIdentity,
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
      bodyText: override?.bodyText,
    });
    return NextResponse.json({ html });
  } catch (err) {
    console.error(`[email] preview ${key} for ${guard.orgId}:`, err);
    return NextResponse.json({ error: "Could not render that letter" }, { status: 500 });
  }
}
