import { redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import {
  getStandingMeeting,
  getThemeOverrides,
  getViewerAlerts,
  listOrgDocuments,
  listOrgEventsInRange,
  listOrgFiles,
  listOrgIdeas,
} from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { siteConfig } from "@/config/site";
import { getSiteContent } from "@/lib/data";
import { getProfileSummary } from "@/lib/hub-data";
import { getHubViewer } from "@/lib/hub-auth";
import { getForumSnapshot } from "@/lib/forum";
import { getPipelineBoard } from "@/lib/pipeline";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ForumFace, SurfaceCard, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import {
  CalendarFace,
  DocumentsFace,
  IdeasFace,
  PipelineFace,
  ProfileFace,
  StandingMeetingFace,
} from "@elkdonis/cms-ui/hub";
import { HubDrawer } from "@/components/hub/HubDrawer";
import { AppearanceCard } from "@/components/hub/AppearanceCard";
import { FilesFace } from "@/components/hub/FilesCard";
import { PageSectionsFace } from "@/components/hub/PageSectionsCard";
import { getStoreForUser } from "@elkdonis/commerce/queries";
import { IFAC_THEME_VARS, IFAC_THEMEABLE_PAGES } from "@/lib/theme-tokens";
import { saveIfacThemeAction } from "@/lib/theme-actions";

/**
 * The IFAC members' hub.
 *
 * The tiles were all stubs — deliberately, for a layout review. This is the
 * pass that wires them, and the shape it settles on is: every tile arrives
 * carrying real information, and clicking one opens the depth.
 *
 * That split is a load-time budget, not a style. All the reads happen here, in
 * parallel, server-side, and each returns only the handful of fields its tile
 * draws. Nothing fetches on mount. The panels behind the tiles fetch their own
 * fuller data when opened, so eight features cost one page's worth of queries
 * rather than eight — and a member who only wanted to check the meeting time
 * pays for nothing else.
 *
 * Access is members-and-up in the ifac org.
 */
export const dynamic = "force-dynamic";

/** This org's zone, for the faces that render a time. */
const TIME_ZONE = "America/Toronto";

export default async function HubPage() {
  const viewer = await getHubViewer();
  if (!viewer) {
    // Two different failures, two different destinations: not signed in at all
    // versus signed in but not an IFAC member.
    const { getServerSession } = await import("@elkdonis/auth-server");
    const session = await getServerSession();
    redirect(session.user ? "/?notice=members-only" : "/login?redirect=/hub");
  }

  const content = await getSiteContent();

  // Everything the tiles draw, in one parallel batch. Sequential awaits here
  // would make the hub as slow as the sum of its tiles.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1
  );

  const [
    standing,
    events,
    ideas,
    documents,
    files,
    profile,
    sections,
    forum,
    board,
    alerts,
  ] = await Promise.all([
    // The shared resolver, replacing this app's own getWeeklyMeeting: an
    // editor's flag first, then a weekly series, then whatever is soonest —
    // and it reports WHICH, so the tile only says "Weekly meeting" when that
    // is true. IFAC's query could only ever guess from the section name.
    getStandingMeeting(siteConfig.orgId).catch(() => null),
    // The shared query, not this app's own copy of it — see the note in
    // api/hub/calendar/route.ts.
    listOrgEventsInRange(siteConfig.orgId, monthStart, monthEnd),
    listOrgIdeas(siteConfig.orgId, { limit: 12 }),
    // One snippet read back from Nextcloud, for the face's snapshot of the
    // current document. Entries created before the move carry no path and so
    // get no snippet — the title still shows.
    listOrgDocuments(siteConfig.orgId, { withSnippets: 1 }),
    listOrgFiles(siteConfig.orgId, "Media").catch(() => []),
    getProfileSummary(viewer.userId),
    readProfileSections(viewer.userId),
    // A forum outage costs the tile, not the hub.
    getForumSnapshot().catch(() => null),
    // Likewise a Deck outage.
    getPipelineBoard().catch(() => null),
    // Unread messages, unread notifications, upcoming RSVPs — the same
    // subqueries getProfileSummary ran inline until this consolidated onto
    // the shared query every other host already uses. Never throws on its
    // own (reports zeroes on a failed read), so no .catch needed here.
    getViewerAlerts(viewer.userId, siteConfig.orgId),
  ]);

  const overridesByPage: Record<string, Record<string, string>> = {};
  if (viewer.canEdit) {
    // Each scope's own overrides, unmerged — the editor shows what a scope
    // sets, not what it inherits. Only an admin sees the Appearance card, so
    // only an admin pays for these reads.
    for (const page of IFAC_THEMEABLE_PAGES) {
      overridesByPage[page.key] = await getThemeOverrides({
        orgId: siteConfig.orgId,
        pageKey: page.key,
      });
    }
  }

  const displayName = profile?.displayName ?? viewer.email.split("@")[0];

  return (
    <div className="site-shell">
      {/* Site defaults, then this page's overrides, then the viewer's own. */}
      <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={viewer.userId} />
      <SiteHeader
        banner={{ imageUrl: content.hero.imageUrl, className: "hub-hero" }}
      />

      <main className="hub">
        <div className="hub-welcome">
          <div>
            <p className="kicker">{siteConfig.shortName}</p>
            <h1>Welcome IFAC Members to the Main Hub</h1>
            <p className="hub-welcome-sub">
              Post to the group, manage your profile and files, and help shape
              what the collective works on next.
            </p>
          </div>
          <HubDrawer
            displayName={displayName}
            profileHref={profile?.slug ? `/artists/${profile.slug}` : null}
          />
        </div>

        <section className="hub-announcements" aria-labelledby="ann-head">
          <div className="hub-panel-head">
            <h2 id="ann-head">Announcements</h2>
            <span className="hub-tag">IFAC General</span>
          </div>
          <div className="hub-talk-frame">
            <p className="hub-empty">
              The IFAC General talk room has not been provisioned yet, so there
              is nothing to embed. Once the group has a Talk room this becomes
              the live chat and announcements feed.
            </p>
          </div>
        </section>

        {/* One grid of faces, replacing the two hand-packed columns of
            bespoke HubCards. Every tile here is the tile-sized form of the
            popup it opens, and they all open in ONE dialog that stacks — so
            a calendar day can open a gathering, which can open its RSVP,
            without the page moving. The four leading faces are the shared
            ones every site in the network draws; the rest are IFAC's own
            features registered as `custom` surfaces. */}
        <SurfaceCardGrid>
          <StandingMeetingFace
            standing={standing}
            canEdit={viewer.canEdit}
            timeZone={TIME_ZONE}
          />

          <CalendarFace initialEvents={events} canEdit={viewer.canEdit} />

          <PipelineFace board={board} canEdit={viewer.canEdit} />

          <ForumFace forum={forum} />

          {/* Identity: the shared surface, opening in place rather than
              bouncing the member to a different domain to edit their own
              name and bio. */}
          <ProfileFace
            summary={{
              displayName: profile?.displayName ?? viewer.email.split("@")[0],
              avatarUrl: profile?.avatarUrl ?? null,
              headline: profile?.roleTitle ?? profile?.headline ?? null,
              alerts,
            }}
          />

          {/* This site's own: gallery counts, and what shows on the public
              page. See PageSectionsCard.tsx for why this stayed local. */}
          <PageSectionsFace
            summary={profile}
            sections={sections}
            marketplaceUrl={siteConfig.marketplaceUrl}
          />

          <DocumentsFace documents={documents} />

          <FilesFace initialFiles={files} canEdit={viewer.canEdit} />

          {/* The face IS the form now: type it, press Enter. Opening the tile
              goes to the ideas feed on the forum, where they are discussed. */}
          <IdeasFace initialIdeas={ideas} />

          {/* Authoring is a page on this site, not a surface — it has its own
              route and its own workspace, so the tile navigates. */}
          <SurfaceCard
            kind="compose"
            glyph="✚"
            title="Compose"
            blurb="Art, announcements, events and products."
            href="/hub/compose"
            cue="→"
            preview={
              <span className="eac-preview-line">
                {viewer.canEdit
                  ? "Article · Event · Meeting · Questionnaire"
                  : "Propose something for the group"}
              </span>
            }
          />

          <SurfaceCard
            wide
            kind="questionnaire"
            glyph="◎"
            title="Questionnaires & group research"
            blurb="Ask the membership something, and read the results."
            surface={{
              type: "custom",
              key: "questionnaires",
              title: "Questionnaires & group research",
              kind: "questionnaire",
              size: "wide",
              props: { canEdit: viewer.canEdit, orgSlug: siteConfig.orgId },
            }}
          />

          <SurfaceCard
            wide
            kind="neutral"
            glyph="?"
            title="Help & notes from the developer"
            blurb="How things work, and how to tell us they don't."
            surface={{
              type: "custom",
              key: "help",
              title: "Help & notes from the developer",
              kind: "neutral",
            }}
          />

          {viewer.canEdit && (
            <SurfaceCard
              wide
              kind="neutral"
              glyph="◈"
              title="Manage site"
              blurb="Review people and promote members."
              // Still /admin/directory: the /manage dashboard is not built
              // yet, and a tile pointing at a route that 404s is worse than
              // one pointing at the tool that works.
              href="/admin/directory"
              cue="→"
              preview={
                <span className="eac-preview-line">
                  Directory entries, accounts and roles
                </span>
              }
            />
          )}
        </SurfaceCardGrid>

        {viewer.canEdit && (
          <section className="hub-wide">
            <AppearanceCard
              vars={IFAC_THEME_VARS}
              pages={IFAC_THEMEABLE_PAGES}
              overridesByPage={overridesByPage}
              onSaveSite={saveIfacThemeAction}
            />
          </section>
        )}

      </main>

      <SiteFooter content={content.footer} />
    </div>
  );
}

/**
 * Which optional sections this person shows on their own page.
 *
 * Read here rather than folded into getProfileSummary because it is a
 * preference about their page, not a fact about their profile, and the two
 * have different lifetimes.
 */
async function readProfileSections(
  userId: string
): Promise<{ elkdonisFeed: boolean; store: boolean; hasStore: boolean }> {
  try {
    const [row] = await db<Array<{ profile_sections: Record<string, unknown> }>>`
      SELECT profile_sections FROM users WHERE id = ${userId}
    `;
    // Whether they have an active marketplace store at all — drives whether
    // the store toggle is offered or an "open a store" link instead.
    const store = await getStoreForUser(userId).catch(() => null);
    return {
      elkdonisFeed: Boolean(row?.profile_sections?.elkdonisFeed),
      store: Boolean(row?.profile_sections?.store),
      hasStore: store?.status === "active",
    };
  } catch (error) {
    console.error("[ifac] readProfileSections error:", error);
    return { elkdonisFeed: false, store: false, hasStore: false };
  }
}
