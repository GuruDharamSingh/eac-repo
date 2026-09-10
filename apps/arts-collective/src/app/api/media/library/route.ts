import { NextResponse, type NextRequest } from "next/server";
import { listOrgMediaLibrary } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { canEditOrgSite, getOrgBySlug } from "@/lib/org";

/**
 * An org's media library, for the compose sheet's picker.
 *
 * Unlike the single-org sites, this app serves every org, so the org is a
 * parameter and the gate has to be checked against *that* org rather than a
 * fixed one — `canEditOrgSite`, the same bar the compose actions use. Without
 * the per-org check this would be a cross-org listing of unpublished filenames
 * to any signed-in user.
 */
export async function GET(request: NextRequest) {
  const orgSlug = request.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json({ error: "Missing org" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not allowed" }, { status: 401 });

  const org = await getOrgBySlug(orgSlug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canEditOrgSite(user.id, org.id))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const items = await listOrgMediaLibrary(org.id);
  return NextResponse.json({ items });
}
