import { NextResponse, type NextRequest } from "next/server";
import {
  clearOrgTemplate,
  isTemplateKey,
  saveOrgTemplate,
  templateMeta,
} from "@elkdonis/email";
import { sanitizeRichText } from "@elkdonis/utils";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Save this organisation's version of one email.
 *
 * Takes either shape: `{ bodyText }` from the simple form, or
 * `{ project, html }` from the newsletter editor. The store merges rather than
 * replaces, so writing one never discards the other — someone who lays out a
 * letter and later edits the plain copy keeps both.
 *
 * The AUTHORISATION BOUNDARY is here. Nothing in @elkdonis/email checks who is
 * asking; every function there takes the orgId it is handed.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const meta = templateMeta(key);
  if (!isTemplateKey(key) || !meta?.editable) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  const input: Parameters<typeof saveOrgTemplate>[2] = {};
  if (typeof body.bodyText === "string") {
    // An empty box means "go back to the network's words", not "send a blank
    // section" — so it stores NULL, which the store clears. It passed
    // `undefined` until 2026-09-17, which the store reads as "leave alone", so
    // taking your own words back out of a letter silently did nothing.
    input.bodyText = body.bodyText.trim() ? body.bodyText.trim().slice(0, 8000) : null;
  }
  if (typeof body.bodyHtml === "string") {
    // Sanitised on the way in — the STRUCTURAL pass only. Narrowing to the
    // email-safe tag set and inlining the styles happen at render, where the
    // letter's palette is known.
    const clean = body.bodyHtml.trim() ? sanitizeRichText(body.bodyHtml.trim()) : "";
    input.bodyHtml = clean ? clean.slice(0, 24_000) : null;
  }
  // One block of the letter's own copy. The slot id is checked against the
  // registry inside the store (parseCopyOverrides drops unknown ids), so a
  // hand-edited id writes nothing rather than accumulating dead words.
  if (body.copySlot && typeof body.copySlot === "string") {
    const text = typeof body.copyText === "string" ? body.copyText.trim() : "";
    const rawHtml = typeof body.copyHtml === "string" ? body.copyHtml.trim() : "";
    const html = rawHtml ? sanitizeRichText(rawHtml).slice(0, 24_000) : "";
    // An emptied box means "go back to the network's words" for THAT block,
    // which is `null` — the store deletes the entry rather than storing "".
    input.copy = {
      [body.copySlot]: text ? { text: text.slice(0, 8000), html: html || undefined } : null,
    } as never;
  }
  if (body.project !== undefined) input.project = body.project;
  if (typeof body.html === "string") input.html = body.html;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  const result = await saveOrgTemplate(siteConfig.orgId, key, input, editor.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Drop this org's override so the network's default applies again. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!isTemplateKey(key)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  const ok = await clearOrgTemplate(siteConfig.orgId, key);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
