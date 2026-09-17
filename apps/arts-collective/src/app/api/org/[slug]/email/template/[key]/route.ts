import { NextResponse } from "next/server";
import { saveOrgTemplate, isTemplateKey, templateMeta } from "@elkdonis/email";
import { guardOrgEmailWrite } from "@/lib/email-suite";

/**
 * Save this organisation's own words for one letter.
 *
 * The org-scoped twin of innergathering's `/api/hub/email/<key>`, and the
 * reason the network hub can now edit letters at all: the editor itself moved
 * into the shared suite as a connector, so what differs per host is this one
 * route rather than a whole page.
 *
 * The AUTHORISATION BOUNDARY is here. Nothing in @elkdonis/email checks who is
 * asking; every function there takes the orgId it is handed.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; key: string }> }
) {
  const { slug, key } = await params;
  const guard = await guardOrgEmailWrite(slug);
  if (!guard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = templateMeta(key);
  if (!isTemplateKey(key) || !meta?.editable) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { bodyText?: unknown };
  const bodyText = typeof body.bodyText === "string" ? body.bodyText.trim() : "";

  // An empty box means "go back to the network's words", not "send a blank
  // section" — so it passes `null`, which the store CLEARS. Deliberately not
  // `clearOrgTemplate`, which deletes the whole row: a layout composed in the
  // newsletter editor is a separate override and must survive the words being
  // taken back out.
  const result = await saveOrgTemplate(
    guard.orgId,
    key,
    { bodyText: bodyText ? bodyText.slice(0, 8000) : null },
    guard.userId
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cleared: !bodyText });
}
