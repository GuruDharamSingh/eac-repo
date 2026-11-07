import { listAllDirectory, listAssignableMembers } from "@/lib/directory-admin";
import { DirectoryManager } from "@/components/manage/directory-manager";
import { requireIfacManager } from "@/lib/manage-auth";

export const metadata = { title: "Artists & dealers — IFAC" };
export const dynamic = "force-dynamic";

/** The public roster: who appears on the site, and what their page says. */
export default async function ManageDirectoryPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireIfacManager();
  const [profiles, assignableMembers] = await Promise.all([
    listAllDirectory(),
    listAssignableMembers(),
  ]);

  return <DirectoryManager initialProfiles={profiles} initialAssignableMembers={assignableMembers} />;
}
