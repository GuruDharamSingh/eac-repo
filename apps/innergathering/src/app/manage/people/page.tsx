import { db } from "@elkdonis/db";
import { listOrgMembers } from "@elkdonis/services";
import { Badge } from "@/components/ui/badge";
import { MemberRow } from "@/components/manage/member-row";
import { getViewer } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { siteConfig } from "@/config/site";

interface ProfileRow {
  user_id: string;
  slug: string | null;
  display_name: string | null;
  role_title: string | null;
  bio: string | null;
  photo_url: string | null;
  city: string | null;
  sort_order: number;
  is_public: boolean;
}

interface ContactRow {
  email: string;
  name: string | null;
  source: string | null;
  created_at: Date;
}

/**
 * People: members with roles and published profiles, plus the guest contact
 * list that RSVPs build up.
 *
 * A teacher page hangs off a real account (artist_profiles is keyed on
 * user_id), so this screen promotes and publishes existing members — it can't
 * conjure a person. See the brand doc for why that boundary is where it is.
 */
export default async function ManagePeoplePage() {
  const viewer = await getViewer();

  const [members, profiles, contacts] = await Promise.all([
    listOrgMembers(siteConfig.orgId).catch(() => []),
    db<ProfileRow[]>`
      SELECT user_id, slug, display_name, role_title, bio, photo_url, city,
             sort_order, is_public
      FROM artist_profiles WHERE org_id = ${siteConfig.orgId}
    `.catch(() => [] as ProfileRow[]),
    db<ContactRow[]>`
      SELECT email, name, source, created_at FROM contacts
      WHERE org_id = ${siteConfig.orgId}
      ORDER BY created_at DESC LIMIT 200
    `.catch(() => [] as ContactRow[]),
  ]);

  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));
  const isOwner = viewer?.role === "owner";

  return (
    <>
      <h2 className="font-serif text-2xl">Members</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Anyone who has signed up here. Owners and guides can publish content; publishing a
        profile gives someone a page under <code className="text-xs">/about</code>.
        {!isOwner && " Only the site owner can change roles or publish profiles."}
      </p>

      {members.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No members yet.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              member={{
                userId: member.userId,
                email: member.email,
                displayName: member.displayName,
                role: member.role,
                joinedAt: member.joinedAt.toISOString(),
              }}
              profile={
                profileByUser.get(member.userId)
                  ? {
                      slug: profileByUser.get(member.userId)!.slug ?? "",
                      displayName: profileByUser.get(member.userId)!.display_name ?? "",
                      roleTitle: profileByUser.get(member.userId)!.role_title ?? "",
                      bio: profileByUser.get(member.userId)!.bio ?? "",
                      photoUrl: profileByUser.get(member.userId)!.photo_url ?? "",
                      city: profileByUser.get(member.userId)!.city ?? "",
                      sortOrder: profileByUser.get(member.userId)!.sort_order,
                      isPublic: profileByUser.get(member.userId)!.is_public,
                    }
                  : null
              }
              canManage={isOwner}
              isSelf={member.userId === viewer?.userId}
            />
          ))}
        </div>
      )}

      <h2 className="mt-14 font-serif text-2xl">Contacts</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        People who RSVP&rsquo;d as guests without making an account.
      </p>

      {contacts.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nobody yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((c, i) => (
                <tr key={`${c.email}-${i}`}>
                  <td className="py-2.5 pr-4">{c.name ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <a href={`mailto:${c.email}`} className="underline underline-offset-2">
                      {c.email}
                    </a>
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge variant="outline">{c.source ?? "—"}</Badge>
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {formatShortDate(c.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
