import type { Metadata } from "next";
import { listOrgFeeds } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { ComposeWorkspace } from "@/components/hub/compose-workspace";

/**
 * Compose — a route, not only a popup.
 *
 * The hub's popup is right for short things. This is the door behind the long
 * ones: a workshop with sessions, a questionnaire with ten questions, an event
 * with a schedule block and a cover. A modal is one stray backdrop click from
 * losing all of it, and the back button does not mean what a person expects.
 *
 * Both doors write through the same actions — see compose-workspace.tsx.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compose · Hub" };

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const viewer = await requireOrgMember("/hub/compose");
  const { kind } = await searchParams;

  // Private feeds included: an organiser composing needs to be able to file
  // something into a members-only section.
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => []);

  return (
    <main className="hub hub-compose-page">
      <div className="hub-welcome">
        <div>
          <p className="hub-kicker">{siteConfig.orgName}</p>
          <h1>Make something</h1>
          <p className="hub-welcome-sub">
            Pick what it is, and the form follows. Everything here belongs to the
            group and shows on the site.
          </p>
        </div>
      </div>

      <section className="hub-band">
        <ComposeWorkspace
          initialKind={kind}
          context={{
            orgSlug: siteConfig.orgId,
            feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })),
            canManageOrg: viewer.canEdit,
            canPublishContent: viewer.canEdit,
            hasMeetings: true,
            hasWorkshops: true,
            // Questionnaire and poll gate on `canManageOrg`, not a flag of
            // their own — see the catalogue.
            canCreateDocument: true,
            canCreateTalkRoom: true,
            canShareToNetwork: false,
          }}
        />
      </section>
    </main>
  );
}
