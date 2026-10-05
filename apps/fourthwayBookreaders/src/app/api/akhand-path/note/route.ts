import { addNote, getPaathReader, removeNote } from "@/lib/paath";

/** A thought on a passage: any reader adds one; each reader removes only their own. */
export const dynamic = "force-dynamic";

const nope = () => Response.json({ error: "Not found" }, { status: 404 });

export async function POST(request: Request) {
  const access = await getPaathReader();
  if (!access) return nope();
  const body = (await request.json().catch(() => null)) as { unitId?: string; body?: string } | null;
  if (!body?.unitId || !body.body?.trim()) return Response.json({ error: "unitId and body are required" }, { status: 400 });
  const note = await addNote(access.circle, access.viewer, body.unitId, body.body);
  return note ? Response.json({ note }) : nope();
}

export async function DELETE(request: Request) {
  const access = await getPaathReader();
  if (!access) return nope();
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return Response.json({ error: "id is required" }, { status: 400 });
  return (await removeNote(access.circle, access.viewer, body.id)) ? Response.json({ ok: true }) : nope();
}
