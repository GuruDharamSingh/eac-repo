import { getPaathReader, getUnread } from "@/lib/paath";

/** The next unread passages from a position on: the reader asks for more as passages are checked off. */
export const dynamic = "force-dynamic";

const nope = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET(request: Request) {
  const access = await getPaathReader();
  if (!access) return nope();
  const url = new URL(request.url);
  const from = Number(url.searchParams.get("from") ?? 0) || 0;
  const limit = Number(url.searchParams.get("limit") ?? 3) || 3;
  const passages = await getUnread(access.circle, access.viewer.userId, limit, from);
  return Response.json({ passages });
}
