import { NextResponse, type NextRequest } from "next/server";
import { browseMediaFolder, getStorageSlug } from "@elkdonis/services";
import { getSiteOwnerUserId, getViewer } from "@/lib/auth";

/**
 * DANA's own pictures — her personal Nextcloud folder (EAC_Network/users/<her
 * slug>), browsed a folder at a time (`?path=`) or searched (`?q=`).
 *
 * The SITE OWNER's folder, not the signed-in person's: this is her site, and
 * the picker's "Dana's images" must show her work when a guide is editing it.
 * That is why it is editors only — it lists someone else's storage. The owner
 * comes from the membership table, never from the request. Private/ is never
 * listed (browseMediaFolder).
 *
 * Uploads through /api/media/upload land in this folder too.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const owner = await getSiteOwnerUserId();
  const slug = owner ? await getStorageSlug(owner) : null;
  if (!slug) return NextResponse.json({ path: "", items: [], browsable: true });

  const url = new URL(req.url);
  const result = await browseMediaFolder(`EAC_Network/users/${slug}`, url.searchParams.get("path"), {
    q: url.searchParams.get("q"),
  });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ...result, browsable: true });
}
