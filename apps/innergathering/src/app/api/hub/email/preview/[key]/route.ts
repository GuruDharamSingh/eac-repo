import { NextResponse } from "next/server";
import {
  renderSample,
  templateMeta,
  getOrgEmailIdentity,
  loadOrgTemplate,
  isTemplateKey,
} from "@elkdonis/email";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * One letter, rendered as this org would actually send it.
 *
 * Lazily, per letter, rather than rendering all eight into the suite's initial
 * payload: the face and the other four tabs never need them, and eight React
 * Email renders on every hub load would be paid by everyone to serve the one
 * person who opened Letters.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { key } = await params;
  // Checked against the known keys rather than passed through: `key` is a path
  // segment and `renderSample` selects a component by it.
  if (!isTemplateKey(key) || !templateMeta(key)) {
    return NextResponse.json({ error: "No such letter" }, { status: 404 });
  }

  const [identity, override] = await Promise.all([
    getOrgEmailIdentity(siteConfig.orgId),
    loadOrgTemplate(siteConfig.orgId, key),
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
    console.error(`[email] preview ${key}:`, err);
    return NextResponse.json({ error: "Could not render that letter" }, { status: 500 });
  }
}
