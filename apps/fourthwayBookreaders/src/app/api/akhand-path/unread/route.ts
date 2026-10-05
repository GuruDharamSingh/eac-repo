import { getPaathReader, getProgress, getRecentlyRead, markUnread } from "@/lib/paath";

/** The recently read passages (GET), and putting chosen ones back as unread (POST). Any reader. */
export const dynamic = "force-dynamic";

const nope = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET(request: Request) {
  const access = await getPaathReader();
  if (!access) return nope();
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 10) || 10;
  return Response.json({ recent: await getRecentlyRead(access.circle, limit) });
}

export async function POST(request: Request) {
  const access = await getPaathReader();
  if (!access) return nope();
  const body = (await request.json().catch(() => null)) as { unitIds?: unknown } | null;
  const ids = Array.isArray(body?.unitIds) ? body.unitIds.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0) return Response.json({ error: "unitIds is required" }, { status: 400 });
  const changed = await markUnread(access.circle, ids);
  return Response.json({ changed, progress: await getProgress(access.circle) });
}
