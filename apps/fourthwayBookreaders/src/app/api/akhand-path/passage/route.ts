import { getPaathReader, getPassage } from "@/lib/paath";

/** One passage, with its check mark and thoughts: what the side column opens. Readers only. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await getPaathReader();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const passage = access ? await getPassage(access.circle, access.viewer.userId, id) : null;
  return passage ? Response.json({ passage }) : Response.json({ error: "Not found" }, { status: 404 });
}
