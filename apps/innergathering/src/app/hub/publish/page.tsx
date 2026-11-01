import "@elkdonis/cms-ui/hubsite.css";
import type { Metadata } from "next";
import { HubCardGrid, HubLinkCard, HubPageFrame } from "@elkdonis/cms-ui/hubsite";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { studioHref } from "@/lib/hub-links";

export const metadata: Metadata = { title: "Publish · Hub" };
export const dynamic = "force-dynamic";

/**
 * Publish, as a page (owner, 2026-10-08). Two doors:
 *
 *   Writing  → the network Studio (arts-collective.com/studio?org=…), which
 *              replaces Blog and Post here. Any member may write; the piece is
 *              homed on their ArtDirect page and listed on this site.
 *   Event or meeting → the existing compose form at /hub/compose, until the
 *              Studio has dated kinds (STUDIO_BRIEF §6 Phase 2). Editors only,
 *              as the classic hub's Publish card was.
 *
 * Poll and questionnaire are not offered here for now; their compose routes
 * still work.
 */
export default async function PublishPage() {
  const viewer = await requireOrgMember("/hub/publish");

  return (
    <HubPageFrame
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Publish" }]}
      title="Publish"
      intro={<p>What would you like to put out? Everything here can show on {siteConfig.orgName}.</p>}
    >
      <HubCardGrid label="What to publish">
        <HubLinkCard
          lead
          external
          href={studioHref()}
          glyph="✎"
          title="Writing"
          blurb="An article, a post, an essay — written in the Studio. It lives on your ArtDirect page and shows here."
        />
        {viewer.canEdit && (
          <HubLinkCard
            href="/hub/compose?kind=meeting"
            glyph="◎"
            title="Event or meeting"
            blurb="A gathering people can join, once or on a schedule. It reaches the calendar."
          />
        )}
      </HubCardGrid>
    </HubPageFrame>
  );
}
