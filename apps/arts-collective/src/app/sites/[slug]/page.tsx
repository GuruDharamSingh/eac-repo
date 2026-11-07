import { notFound } from "next/navigation";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getOfferingThread } from "@/lib/org";
import { loadSiteContext } from "@/lib/site-context";
import { renderOrgHome } from "@/lib/puck/render";
import { SilexLayout } from "@/components/silex-layout";
import { OfferingPage } from "@/components/sites/OfferingPage";
import { OrgDefaultPage } from "@/components/sites/OrgDefaultPage";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";

export const dynamic = "force-dynamic";

/**
 * The subdomain root, in order of what the org has done:
 *
 *   1. A Silex homepage (`layout_mode='silex'`) keeps it: hidden-enneagram is
 *      live on it.
 *   2. A landing page designed in the page editor (`site_config` key
 *      `puck:home`, /hub/sites/<slug>/design) is drawn with the site's chrome
 *      around it. Decision A of the onboarding brief (2026-10-29), which
 *      reversed the 2026-09-26 "Puck only on ArtDirect" rule for org sites.
 *   3. The offering: the pinned thread, else the newest published public
 *      one, as a full page (`OfferingPage`, also `/offering`).
 *   4. Otherwise a page built from the org's identity (`OrgDefaultPage`)
 *      rather than an empty state.
 *
 * An unconfirmed site shows "being set up" to everyone but its editors, on
 * every branch; `OfferingPage` carries its own copy of that gate for the
 * `/offering` route.
 */
export default async function OrgSiteRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await loadSiteContext(slug);
  if (!ctx) notFound();
  const { org, user, canEdit, canEditSite, mainSiteUrl } = ctx;

  if (org.layout_mode === "silex" && org.silex_published_path) {
    return <SilexLayout org={org} />;
  }

  if (!org.subdomain_confirmed && !canEdit) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteNav orgName={org.name} current="offering" mainSiteUrl={mainSiteUrl} signedIn={Boolean(user)} />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-serif text-3xl">{org.name}</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            This site is being set up and hasn&apos;t opened to the public yet.
          </p>
        </div>
      </div>
    );
  }

  const designed = await renderOrgHome({ id: org.id, slug }, { canEdit });
  if (designed) {
    const designHref = `${ctx.proto}://${ctx.rootHost}/hub/sites/${encodeURIComponent(slug)}/design`;
    return (
      <div className="min-h-screen bg-background text-foreground">
        <ThemeStyle orgId={org.id} pageKey="home" />
        <SiteNav orgName={org.name} current="offering" mainSiteUrl={mainSiteUrl} signedIn={Boolean(user)} />
        <main className="flex flex-col gap-2" data-page="org-designed">{designed}</main>
        {canEditSite && (
          <a
            href={designHref}
            className="fixed bottom-4 right-4 z-50 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium shadow-lg hover:bg-accent"
          >
            Edit this page
          </a>
        )}
        <SiteFooter orgName={org.name} mainSiteUrl={mainSiteUrl} />
      </div>
    );
  }

  const offering = await getOfferingThread(org.id);
  if (!offering) return <OrgDefaultPage ctx={ctx} offering={null} />;

  return <OfferingPage slug={slug} />;
}
