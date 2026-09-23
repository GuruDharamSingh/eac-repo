import { NextResponse } from "next/server";
import { listOrgMediaLibrary } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The org's media library, for the picker.
 *
 * The listing itself is `listOrgMediaLibrary` in @elkdonis/services — it was
 * duplicated here and in hidden-enneagram, differing only in the org id. What
 * stays here is the authorization, which is per-app on purpose: editors only,
 * because the library is an authoring tool and listing it reveals filenames of
 * unpublished material.
 */
export async function GET() {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const items = await listOrgMediaLibrary(siteConfig.orgId);
  return NextResponse.json({ items });
}
