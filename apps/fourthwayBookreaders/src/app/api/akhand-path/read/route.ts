import { getPaathReader, getProgress, markRead } from "@/lib/paath";

/** Check a passage off as read, or undo the check. Any reader. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await getPaathReader();
  if (!access) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { unitId?: string; done?: boolean } | null;
  if (!body?.unitId || typeof body.done !== "boolean") return Response.json({ error: "unitId and done are required" }, { status: 400 });
  const ok = await markRead(access.circle, access.viewer, body.unitId, body.done);
  if (!ok) return Response.json({ error: "No such passage" }, { status: 404 });
  const progress = await getProgress(access.circle);
  return Response.json({ ok: true, progress, at: new Date().toISOString() });
}
