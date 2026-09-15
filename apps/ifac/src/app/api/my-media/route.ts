import { NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import {
  getStorageSlug,
  listUserFiles,
  listOrgMediaLibrary,
} from "@elkdonis/services";
import { getHubViewer } from "@/lib/hub-auth";
import { siteConfig } from "@/config/site";

/**
 * Images the signed-in person can put in a gallery.
 *
 * Two sources, each tagged so the picker can offer them as tabs:
 *   - `user`: their own folder, EAC_Network/users/<slug>/Media/Images — what
 *     they uploaded through any org's site, since that folder follows them;
 *   - `org`:  IFAC's own Media/Images, for members only (getHubViewer), the
 *     same gate as the hub's drive. A visitor with an account but no IFAC
 *     membership sees only their own files.
 *
 * The identity is always the session's: no slug or user id is read from the
 * request, so this can never list someone else's folder.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const userId = session.user.db_user_id ?? session.user.id;

  const files: Array<{ url: string; name: string; source: "user" | "org"; mimeType?: string | null }> = [];

  const slug = await getStorageSlug(userId);
  if (slug) {
    try {
      const own = await listUserFiles(slug, "Media/Images");
      for (const f of own) {
        if (f.isFolder) continue;
        files.push({ url: f.url, name: f.name, source: "user", mimeType: f.mimeType });
      }
    } catch (error) {
      // A person whose folder hasn't been created yet simply has no files.
      console.error("[ifac] my-media user listing:", error);
    }
  }

  if (await getHubViewer()) {
    const org = await listOrgMediaLibrary(siteConfig.orgId);
    for (const item of org) files.push({ url: item.url, name: item.filename, source: "org" });
  }

  return NextResponse.json({ files });
}
