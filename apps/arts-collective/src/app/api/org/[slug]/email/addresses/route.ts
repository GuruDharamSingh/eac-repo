import { NextResponse } from "next/server";
import {
  addAddresses,
  updateContact,
  suppressAddress,
  removeContact,
} from "@elkdonis/email";
import { guardOrgEmailWrite } from "@/lib/email-suite";

/** The most anyone can paste in one go. A list longer than this is a file. */
const MAX_PASTE = 100_000;

/** Add addresses by hand — typed, pasted, or dragged out of a spreadsheet. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const guard = await guardOrgEmailWrite(slug);
  if (!guard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { text?: string; tags?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "Nothing to add" }, { status: 400 });
  }
  if (text.length > MAX_PASTE) {
    return NextResponse.json(
      { error: "That's too much at once — split it up." },
      { status: 413 }
    );
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 10)
    : undefined;

  const result = await addAddresses({
    orgId: guard.orgId,
    text,
    addedBy: guard.userId,
    tags,
  });

  return NextResponse.json({ ok: true, ...result });
}

/** Edit one entry's name, tags or notes; or stop mailing an address. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const guard = await guardOrgEmailWrite(slug);
  if (!guard) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      orgId: guard.orgId,
      email: String(body.suppressEmail).trim().toLowerCase(),
      addedBy: guard.userId,
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Which entry?" }, { status: 400 });
  }
  // A synthetic `user:<uuid>` id belongs to a member with no contact row —
  // there is nothing to edit, and saying so beats a silent no-op.
  if (body.id.startsWith("user:")) {
    return NextResponse.json(
      { error: "That person is here as a member; there's nothing stored to edit." },
      { status: 400 }
    );
  }

  const ok = await updateContact({
    orgId: guard.orgId,
    contactId: body.id,
    name: body.name,
    tags: Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 10)
      : undefined,
    notes: body.notes,
  });
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Take a manually-added entry off the list entirely. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const guard = await guardOrgEmailWrite(slug);
  if (!guard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which entry?" }, { status: 400 });
  if (id.startsWith("user:")) {
    return NextResponse.json(
      { error: "That person is a member of this organisation; remove them there." },
      { status: 400 }
    );
  }

  const ok = await removeContact(guard.orgId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
