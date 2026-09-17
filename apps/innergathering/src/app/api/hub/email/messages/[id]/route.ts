import { NextResponse } from "next/server";
import { setInboxState, reclassifyInbox } from "@elkdonis/email";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

const STATES = ["unread", "read", "archived"] as const;
const CLASSES = ["reply", "enquiry", "auto", "bounce", "spam"] as const;

/** Mark a message read/archived, or correct what the filter decided it was. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;

  let body: { state?: string; classification?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Both helpers are org-scoped in their WHERE clause, so an id from another
  // org updates nothing rather than being checked and then trusted.
  if (body.state) {
    if (!STATES.includes(body.state as (typeof STATES)[number])) {
      return NextResponse.json({ error: "Unknown state" }, { status: 400 });
    }
    const ok = await setInboxState(
      siteConfig.orgId,
      id,
      body.state as (typeof STATES)[number]
    );
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.classification) {
    if (!CLASSES.includes(body.classification as (typeof CLASSES)[number])) {
      return NextResponse.json({ error: "Unknown classification" }, { status: 400 });
    }
    const ok = await reclassifyInbox(
      siteConfig.orgId,
      id,
      body.classification as (typeof CLASSES)[number]
    );
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
}
