import "@elkdonis/cms-ui/hubsite.css";
import type { Metadata } from "next";
import { HubCrumbs } from "@elkdonis/cms-ui/hubsite";
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

  // Event and meeting are one door on the Publish page (owner, 2026-10-08);
  // the switch here picks which form. Full navigations, so the workspace
  // starts fresh on the other kind.
  const gathering = kind === "event" || kind === "meeting";
  const crumbLabel = gathering ? "Event or meeting" : "Make something";

  return (
    <main className="hub hub-compose-page">
      {/* In a .hub-band so it sits on the content column. */}
      <div className="hub-band" style={{ marginTop: 24, marginBottom: -24 }}>
        <HubCrumbs
          items={[
            { label: "Hub", href: "/hub" },
            { label: "Publish", href: "/hub/publish" },
            { label: crumbLabel },
          ]}
        />
      </div>
      <div className="hub-welcome">
        <div>
          <p className="hub-kicker">{siteConfig.orgName}</p>
          <h1>{crumbLabel}</h1>
          <p className="hub-welcome-sub">
            Pick what it is, and the form follows. Everything here belongs to the
            group and shows on the site.
          </p>
        </div>
      </div>

      {gathering && (
        <div className="hub-band" style={{ marginTop: 20 }}>
          <div className="eac-hs-seg" role="group" aria-label="Kind of gathering">
            <a href="/hub/compose?kind=meeting" className={kind === "meeting" ? "is-on" : undefined} aria-current={kind === "meeting" ? "page" : undefined}>
              Meeting
            </a>
            <a href="/hub/compose?kind=event" className={kind === "event" ? "is-on" : undefined} aria-current={kind === "event" ? "page" : undefined}>
              Event
            </a>
          </div>
        </div>
      )}

      <section className="hub-band">
        <ComposeWorkspace
          key={kind ?? "picker"}
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
