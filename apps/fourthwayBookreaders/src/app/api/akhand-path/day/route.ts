import { getPaathReader, isDay, setDayNote } from "@/lib/paath";

/** The day's own note (how the reading went, who was there). Any reader. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await getPaathReader();
  if (!access) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { day?: string; note?: string } | null;
  if (!isDay(body?.day) || typeof body?.note !== "string") return Response.json({ error: "day and note are required" }, { status: 400 });
  await setDayNote(access.circle, access.viewer, body.day, body.note);
  return Response.json({ ok: true });
}
