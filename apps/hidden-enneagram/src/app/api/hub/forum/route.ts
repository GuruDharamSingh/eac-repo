import { getForumSnapshot } from "@/lib/forum";

/** This org's forum in one object, so the hub's forum surface can refresh. */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getForumSnapshot());
}
