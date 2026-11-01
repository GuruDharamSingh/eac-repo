import { redirect } from "next/navigation";
import { listOrgFeeds } from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { buildComposeCatalogue, type ComposeContext } from "@elkdonis/cms-ui/compose";
import { siteConfig } from "@/config/site";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getSiteContent } from "@/lib/data";
import { getHubViewer } from "@/lib/hub-auth";
import { studioHref } from "@/lib/hub-links";
import { ComposeWorkspace } from "@/components/hub/compose-workspace";
import { HubCrumbBar } from "@/components/hub/HubCrumbBar";

/**
 * Compose — a route, not a tile modal.
 *
 * The hub's other panels fit in a dialog because they are a list and a short
 * form. Composing is a long form with a schedule block, a body, a cover image
 * and two save paths; putting it in a modal over the hub means a member loses
 * their draft to a stray backdrop click, and the browser back button doesn't
 * mean what they expect. So the Compose tile navigates here.
 *
 * The chosen kind is in the URL (`?kind=`), so the breadcrumb names it
 * (Hub › Compose › Post) and "Compose" leads back to the chooser. The page
 * opens straight on the chooser or the form: no heading block above it
 * (owner, 2026-10-10).
 */
export const dynamic = "force-dynamic";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; title?: string }>;
}) {
  const viewer = await getHubViewer();
  if (!viewer) redirect("/login?redirect=/hub/compose");

  const content = await getSiteContent();
  // Private feeds included: an owner composing needs to be able to file
  // something into a members-only section.
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });
  // `title` arrives from the popup's "Open as a page", so a title typed in
  // the modal is not retyped here.
  const { kind, title } = await searchParams;

  const context: ComposeContext = {
    orgSlug: siteConfig.orgId,
    canManageOrg: viewer.canEdit,
    // Real now: lib/cms/actions.ts writes threads through the shared
    // createThread. This was false while the app had no save path.
    // A member may write a post here; dated kinds are a guide's,
    // the same line saveContentAction draws. See HubSurfaces.
    canPublishContent: true,
    canPublishDated: viewer.canEdit,
    hasMeetings: true,
    // "One meeting | Series" on the Meeting form (2026-10-10): a series is
    // saved as kind `series` and planned week by week at /hub/series/<id>.
    // Dated, so guides and owners only, like a meeting (canPublishDated).
    hasSeries: true,
    // No standalone Event: a meeting covers it (owner, 2026-10-10).
    hideEvents: true,
    canCreateDocument: true,
    canCreateTalkRoom: true,
    feeds: feeds.map((feed) => ({ slug: feed.slug, name: feed.name })),
  };

  // The same lookup ComposeWorkspace makes, for the last crumb's name.
  const selected = kind
    ? buildComposeCatalogue(context).find((option) => option.writes.kind === kind) ?? null
    : null;

  return (
    <div className="site-shell">
      <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={viewer.userId} />
      {/* The site header is back above the breadcrumb (owner, 2026-10-10). */}
      <SiteHeader />

      <main className="hub hub-compose-page">
        <HubCrumbBar
          items={[
            { label: "Hub", href: "/hub" },
            selected ? { label: "Compose", href: "/hub/compose" } : { label: "Compose" },
            ...(selected ? [{ label: selected.title }] : []),
          ]}
        />

        {/* The composer, in the same chrome its popup wears — masthead,
            body, foot — so arriving here from a tile reads as the same object
            at page size rather than a different screen. `hub-compose` centres
            it and holds the measure. */}
        <section className="hub-wide hub-compose">
          <ComposeWorkspace
            routed
            initialKind={kind}
            initialTitle={title}
            studioHref={studioHref()}
            context={context}
          />
        </section>
      </main>

      <SiteFooter content={content.footer} />
    </div>
  );
}
