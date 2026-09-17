import { listAllDirectory, listAssignableMembers } from "@/lib/directory-admin";
import { DirectoryManager } from "@/components/manage/directory-manager";

export const metadata = { title: "Artists & dealers — IFAC" };
export const dynamic = "force-dynamic";

/** The public roster: who appears on the site, and what their page says. */
export default async function ManageDirectoryPage() {
  const [profiles, assignableMembers] = await Promise.all([
    listAllDirectory(),
    listAssignableMembers(),
  ]);

  return <DirectoryManager initialProfiles={profiles} initialAssignableMembers={assignableMembers} />;
}
