import { listManageContacts, listManageMembers } from "@/lib/manage";
import { PeopleTable } from "@/components/manage/people-table";
import { requireIfacManager } from "@/lib/manage-auth";
import { siteConfig } from "@/config/site";

export const metadata = { title: "People & access — IFAC" };
export const dynamic = "force-dynamic";

/**
 * Who is in IFAC, what they may do, and whether the public site shows them.
 *
 * The three are deliberately on one screen and in three separate columns. On
 * the old /admin they were on two screens that each called their own thing
 * "role" — one meant access, the other a public byline — and there was no way
 * at all to take someone off the front page or out of the org.
 */
export default async function ManagePeoplePage() {
  const viewer = await requireIfacManager("/manage/people");
  const [members, contacts] = await Promise.all([listManageMembers(), listManageContacts()]);

  return (
    <PeopleTable
      initialMembers={members}
      initialContacts={contacts}
      viewerUserId={viewer.userId}
      centralAdminUrl={siteConfig.centralAdminUrl}
    />
  );
}
