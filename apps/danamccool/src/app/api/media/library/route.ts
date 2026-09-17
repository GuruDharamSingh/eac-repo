import { NextResponse } from "next/server";
import { listOrgMediaLibrary } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * This site's media library, for the picker in the page editor.
 *
 * The listing itself is `listOrgMediaLibrary` in @elkdonis/services — it
 * merges the `media` table with a live Nextcloud folder listing, so a file
 * dropped straight into storage appears too. What stays here is the
 * authorization: editors only, because listing a library reveals the filenames
 * of work that has not been published.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const items = await listOrgMediaLibrary(siteConfig.orgId);
  return NextResponse.json({ items });
}
