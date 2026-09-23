import { NextResponse } from "next/server";
import { saveOrgTemplate, isTemplateKey, templateMeta } from "@elkdonis/email";
import { sanitizeRichText } from "@elkdonis/utils";
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

  const body = (await req.json().catch(() => ({}))) as {
    bodyText?: unknown;
    bodyHtml?: unknown;
    copySlot?: unknown;
    copyText?: unknown;
    copyHtml?: unknown;
  };
  const bodyText = typeof body.bodyText === "string" ? body.bodyText.trim() : "";
  // Sanitised HERE, on the way in, rather than only where it is rendered: the
  // house rule is that stored markup has already been through the allow-list.
  // This is the STRUCTURAL pass — the narrowing to email-safe tags and the
  // style inlining happen at render, because those depend on the palette of
  // the letter it lands in, which this route does not know.
  const rawHtml = typeof body.bodyHtml === "string" ? body.bodyHtml.trim() : "";
  const bodyHtml = rawHtml ? sanitizeRichText(rawHtml).slice(0, 24_000) : "";

  // One block of the letter's own copy, when that is what this save is.
  // Unknown slot ids are dropped inside the store, so a hand-edited id writes
  // nothing rather than accumulating words nothing renders.
  if (typeof body.copySlot === "string" && body.copySlot) {
    const text = typeof body.copyText === "string" ? body.copyText.trim() : "";
    const rawSlot = typeof body.copyHtml === "string" ? body.copyHtml.trim() : "";
    const slotHtml = rawSlot ? sanitizeRichText(rawSlot).slice(0, 24_000) : "";
    const result = await saveOrgTemplate(
      guard.orgId,
      key,
      {
        copy: {
          [body.copySlot]: text
            ? { text: text.slice(0, 8000), html: slotHtml || undefined }
            : null,
        } as never,
      },
      guard.userId
    );
    return result.ok
      ? NextResponse.json({ ok: true, cleared: !text })
      : NextResponse.json({ error: result.error ?? "Could not save" }, { status: 500 });
  }

  // An empty box means "go back to the network's words", not "send a blank
  // section" — so it passes `null`, which the store CLEARS. Deliberately not
  // `clearOrgTemplate`, which deletes the whole row: a layout composed in the
  // newsletter editor is a separate override and must survive the words being
  // taken back out.
  const result = await saveOrgTemplate(
    guard.orgId,
    key,
    {
      bodyText: bodyText ? bodyText.slice(0, 8000) : null,
      bodyHtml: bodyHtml || null,
    },
    guard.userId
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cleared: !bodyText });
}
