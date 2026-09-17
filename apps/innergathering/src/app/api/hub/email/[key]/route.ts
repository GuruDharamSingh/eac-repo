import { NextResponse, type NextRequest } from "next/server";
import {
  clearOrgTemplate,
  isTemplateKey,
  saveOrgTemplate,
  templateMeta,
} from "@elkdonis/email";
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
