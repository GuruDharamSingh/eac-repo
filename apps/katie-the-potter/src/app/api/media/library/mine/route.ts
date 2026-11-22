import { NextResponse, type NextRequest } from "next/server";
import { browseMediaFolder, getStorageSlug } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

/**
 * The SIGNED-IN person's own pictures: their personal Nextcloud folder
 * (EAC_Network/users/<their slug>), browsed a folder at a time (`?path=`) or
 * searched (`?q=`). The picker shows it as "My files", beside "This site"
 * (../route.ts, the org's folder).
 *
 * Changed 2026-11-17: this used to list the SITE OWNER's folder, so a guide
 * editing the site saw the owner's private storage. It now lists the viewer's
 * own, and nobody else's: the user id comes from the session and is never read
 * from the request, so there is no parameter that could name another person.
 * Editors only (the picker is an authoring tool). Private/ is never listed
 * (browseMediaFolder).
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const slug = await getStorageSlug(viewer.userId);
  if (!slug) return NextResponse.json({ path: "", items: [], browsable: true });

  const url = new URL(req.url);
  const result = await browseMediaFolder(`EAC_Network/users/${slug}`, url.searchParams.get("path"), {
    q: url.searchParams.get("q"),
  });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ...result, browsable: true });
}
