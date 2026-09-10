import { NextResponse } from "next/server";
import { listOrgMediaLibrary } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The org's media library, for the picker.
 *
 * The listing is shared (`listOrgMediaLibrary` in @elkdonis/services); the
 * editor gate stays here, because authorization is the part that must not be
 * made uniform by accident.
 */
export async function GET() {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const items = await listOrgMediaLibrary(siteConfig.orgId);
  return NextResponse.json({ items });
}
