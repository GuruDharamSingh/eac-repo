import { redirect } from "next/navigation";
import { listOrgFeeds } from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { siteConfig } from "@/config/site";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getSiteContent } from "@/lib/data";
import { getHubViewer } from "@/lib/hub-auth";
import { ComposeWorkspace } from "@/components/hub/compose-workspace";

/**
 * Compose — a route, not a tile modal.
 *
 * The hub's other panels fit in a dialog because they are a list and a short
 * form. Composing is a long form with a schedule block, a body, a cover image
 * and two save paths; putting it in a modal over the hub means a member loses
 * their draft to a stray backdrop click, and the browser back button doesn't
 * mean what they expect. So the Compose tile navigates here.
 */
export const dynamic = "force-dynamic";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const viewer = await getHubViewer();
  if (!viewer) redirect("/login?redirect=/hub/compose");

  const content = await getSiteContent();
  // Private feeds included: an owner composing needs to be able to file
  // something into a members-only section.
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });
  const { kind } = await searchParams;

  return (
    <div className="site-shell">
      <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={viewer.userId} />
      <SiteHeader />

      <main className="hub">
        <div className="hub-welcome">
          <div>
            <p className="kicker">{siteConfig.shortName}</p>
            <h1>Compose</h1>
            <p className="hub-welcome-sub">
              Everything you make here belongs to IFAC and appears on the site.
              Dated items also reach the group&rsquo;s calendar.
            </p>
          </div>
          <a className="hub-btn" href="/hub">
            &larr; Back to the hub
          </a>
        </div>

        <section className="hub-wide hub-compose">
          <ComposeWorkspace
            initialKind={kind}
            context={{
              orgSlug: siteConfig.orgId,
              canManageOrg: viewer.canEdit,
              // Real now: lib/cms/actions.ts writes threads through the shared
              // createThread. This was false while the app had no save path.
              canPublishContent: viewer.canEdit,
              hasMeetings: true,
              canCreateDocument: true,
              feeds: feeds.map((feed) => ({ slug: feed.slug, name: feed.name })),
            }}
          />
        </section>
      </main>

      <SiteFooter content={content.footer} />
    </div>
  );
}
