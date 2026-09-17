import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { sanitizeRichText } from "@elkdonis/utils";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Save one block of site copy to org_site_sections.
 *
 * The keys are an allowlist, not free text: this writes jsonb that the public
 * home page renders, so "any key" would let an editor plant content under a
 * key some future page trusts differently.
 *
 * `body` fields are passed through sanitizeRichText HERE, on write. The home
 * page renders meeting_structure.body with dangerouslySetInnerHTML; it is safe
 * to do so only because nothing reaches that column except through this
 * function. (Worth knowing: a tsx probe that writes the row directly skips
 * this, so test the editor through this route, not around it.)
 *
 * The jsonb is bound with db.json(), never JSON.stringify(x)::jsonb — the
 * latter double-encodes and stores a JSON *string*, which reads back as text
 * and silently breaks every `content->>'field'` lookup.
 */
const ALLOWED_KEYS = new Set([
  "current_book",
  "suggested_books",
  "meeting_structure",
  "hero_image",
  "side_banner",
  "mission",
  "about",
]);

export async function PUT(request: Request) {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  let payload: { key?: unknown; content?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const key = typeof payload.key === "string" ? payload.key : "";
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  }
  if (!payload.content || typeof payload.content !== "object" || Array.isArray(payload.content)) {
    return NextResponse.json({ error: "Content must be an object" }, { status: 400 });
  }

  const content = { ...(payload.content as Record<string, unknown>) };
  if (typeof content.body === "string") content.body = sanitizeRichText(content.body);

  // A cap, so a pasted-in whole book can't produce a row the home page then
  // has to load on every request. ~400KB is a few hundred transcribed pages.
  if (JSON.stringify(content).length > 400_000) {
    return NextResponse.json({ error: "That's too large to save in one section" }, { status: 413 });
  }

  try {
    await db`
      INSERT INTO org_site_sections (org_id, section_key, content, updated_by)
      VALUES (${siteConfig.orgId}, ${key}, ${db.json(content as never)}, ${editor.userId})
      ON CONFLICT (org_id, section_key)
      DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[fourthway] save section(${key}):`, err);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
