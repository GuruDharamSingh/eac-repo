import { NextResponse } from "next/server";
import {
  addAddresses,
  updateContact,
  suppressAddress,
  removeContact,
} from "@elkdonis/email";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/** The most anyone can paste in one go. A list longer than this is a file. */
const MAX_PASTE = 100_000;

const tagsOf = (raw: unknown): string[] | undefined =>
  Array.isArray(raw)
    ? raw.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 10)
    : undefined;

/** Add addresses by hand — typed, pasted, or dragged out of a spreadsheet. */
export async function POST(req: Request) {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { text?: string; tags?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ error: "Nothing to add" }, { status: 400 });
  if (text.length > MAX_PASTE) {
    return NextResponse.json(
      { error: "That's too much at once — split it up." },
      { status: 413 }
    );
  }

  const result = await addAddresses({
    orgId: siteConfig.orgId,
    text,
    addedBy: editor.userId,
    tags: tagsOf(body.tags),
  });
  return NextResponse.json({ ok: true, ...result });
}

/** Edit one entry's name, tags or notes; or stop mailing an address. */
export async function PATCH(req: Request) {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    id?: string;
    suppressEmail?: string;
    name?: string | null;
    tags?: unknown;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Suppression takes an ADDRESS rather than an id, deliberately: a member or
  // an RSVP guest has no `contacts` row to name, and the suppression record is
  // exactly the row that gets written for them.
  if (body.suppressEmail) {
    await suppressAddress({
      orgId: siteConfig.orgId,
      email: String(body.suppressEmail).trim().toLowerCase(),
      addedBy: editor.userId,
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ error: "Which entry?" }, { status: 400 });
  // A synthetic `user:<uuid>` id belongs to a member with no contact row —
  // there is nothing to edit, and saying so beats a silent no-op.
  if (body.id.startsWith("user:")) {
    return NextResponse.json(
      { error: "That person is here as a member; there's nothing stored to edit." },
      { status: 400 }
    );
  }

  const ok = await updateContact({
    orgId: siteConfig.orgId,
    contactId: body.id,
    name: body.name,
    tags: tagsOf(body.tags),
    notes: body.notes,
  });
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Take a manually-added entry off the list entirely. */
export async function DELETE(req: Request) {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which entry?" }, { status: 400 });
  if (id.startsWith("user:")) {
    return NextResponse.json(
      { error: "That person is a member of this organisation; remove them there." },
      { status: 400 }
    );
  }

  const ok = await removeContact(siteConfig.orgId, id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
