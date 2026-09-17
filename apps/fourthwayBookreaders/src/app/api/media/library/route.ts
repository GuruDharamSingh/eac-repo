import { NextResponse } from "next/server";
import { listOrgMediaLibrary } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The org's media library, for the picker on /manage. Editors only: it is an
 * authoring tool, and listing it reveals filenames of unpublished material.
 */
export async function GET(request: Request) {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const type = new URL(request.url).searchParams.get("type");
  const items = await listOrgMediaLibrary(siteConfig.orgId, {
    type: type === "all" ? null : (type ?? "image"),
  });
  return NextResponse.json({ items });
}
