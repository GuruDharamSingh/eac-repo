import { redirect } from "next/navigation";
import { isAdmin } from "@elkdonis/auth-server";
import { getOrgRole } from "@elkdonis/services";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";

// ============================================================================
// Who may design this site's pages.
//
// A platform admin, or an owner or guide of the marketplace org (`market`).
// The check is made again in every write (savePageAction), never only on the
// editor route: the editor is a client component and decides nothing.
// ============================================================================

export async function getPagesEditor(): Promise<{ userId: string } | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  try {
    if (await isAdmin(userId)) return { userId };
    const role = await getOrgRole(userId, siteConfig.marketplaceOrgId);
    return role === "owner" || role === "guide" ? { userId } : null;
  } catch {
    return null;
  }
}

export async function requirePagesEditor(returnTo: string): Promise<{ userId: string }> {
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  const editor = await getPagesEditor();
  if (!editor) redirect("/");
  return editor;
}
