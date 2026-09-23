import { listOrgFeeds } from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { ComposeWorkspace } from "@/components/manage/compose-workspace";
import { siteConfig } from "@/config/site";

/**
 * The hub's Compose card lands here.
 *
 * The catalogue is derived from what this org has rather than hardcoded, so
 * this page does not list what can be made — it hands the shared sheet the
 * facts and the sheet decides. That is what keeps two orgs' compose menus
 * consistent without either app owning the list.
 */
export default async function ComposePage() {
  await requireOrgEditor("/manage/compose");
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });

  return (
    <>
      <h2 className="font-serif text-2xl">Compose</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Everything this group can make. Writing and gatherings are filed onto one
        of your pages; questionnaires and polls go to your members.
      </p>

      <div className="mt-6 max-w-3xl">
        <ComposeWorkspace
          context={{
            orgSlug: siteConfig.orgId,
            feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })),
            // requireOrgEditor already established owner/guide above; the
            // server action checks it again rather than trusting this.
            canManageOrg: true,
            // No workshop programme here — the ten-step wizard would be noise.
            hasWorkshops: false,
            // This site runs gatherings with RSVPs and a Talk room.
            hasMeetings: true,
          }}
        />
      </div>
    </>
  );
}
