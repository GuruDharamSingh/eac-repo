import { redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import { getThemeOverrides, listOrgFiles } from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { siteConfig } from "@/config/site";
import { getSiteContent } from "@/lib/data";
import {
  getEventsInRange,
  getProfileSummary,
  getWeeklyMeeting,
  listIdeas,
  listLivingDocuments,
} from "@/lib/hub-data";
import { getHubViewer } from "@/lib/hub-auth";
import { getForumSnapshot } from "@/lib/forum";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ForumMini } from "@elkdonis/cms-ui/surface";
import { HubCard } from "@/components/hub/HubCard";
import { HubDrawer } from "@/components/hub/HubDrawer";
import { AppearanceCard } from "@/components/hub/AppearanceCard";
import { ComposeWorkspace } from "@/components/hub/compose-workspace";
import { CalendarCard } from "@/components/hub/CalendarCard";
import { DocumentsCard } from "@/components/hub/DocumentsCard";
import { FilesCard } from "@/components/hub/FilesCard";
import { IdeasCard } from "@/components/hub/IdeasCard";
import { ProfileCard } from "@/components/hub/ProfileCard";
import { getStoreForUser } from "@elkdonis/commerce/queries";
import { WeeklyMeetingCard } from "@/components/hub/WeeklyMeetingCard";
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
    weeklyMeeting,
    events,
    ideas,
    documents,
    files,
    profile,
    sections,
    forum,
  ] = await Promise.all([
    getWeeklyMeeting(),
    getEventsInRange(monthStart, monthEnd),
    listIdeas(12),
    listLivingDocuments(),
    listOrgFiles(siteConfig.orgId, "Media").catch(() => []),
    getProfileSummary(viewer.userId),
    readProfileSections(viewer.userId),
    // A forum outage costs the tile, not the hub.
    getForumSnapshot().catch(() => null),
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
  const talkBaseUrl =
    process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? process.env.NEXTCLOUD_PUBLIC_URL ?? null;

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

        <div className="hub-grid">
          <div className="hub-col">
            <ProfileCard summary={profile} sections={sections} marketplaceUrl={siteConfig.marketplaceUrl} />

            <DocumentsCard initialDocuments={documents} />

            <HubCard
              title="Pipeline"
              blurb="Board of what the group is working on."
              glyph="▤"
              accent="moss"
              href="/hub/pipeline"
            />

            {/* The forum, on IFAC's own tile. The face is the shared one
                (ForumMini over the same snapshot every other site draws);
                the tile navigates rather than opening a surface, because
                this app keeps its HubCard/<dialog> system. */}
            <HubCard
              title={forum && (forum.unreadCount ?? 0) > 0 ? `Forum · ${forum.unreadCount} new` : "Forum"}
              blurb={
                forum
                  ? `${forum.topicCount} ${forum.topicCount === 1 ? "topic" : "topics"} · ${forum.postCount} ${forum.postCount === 1 ? "post" : "posts"}.`
                  : "The group's board."
              }
              glyph="☰"
              accent="blue"
              href="/forum"
              preview={forum ? <ForumMini recent={forum.recent} feeds={forum.feeds} /> : undefined}
            />

            <WeeklyMeetingCard
              meeting={weeklyMeeting}
              canEdit={viewer.canEdit}
              talkBaseUrl={talkBaseUrl}
            />
          </div>

          <div className="hub-col">
            <HubCard
              title="Compose"
              blurb="Art, announcements, events and products."
              glyph="✚"
              accent="oxide"
              href="/hub/compose"
              preview={
                <span className="hub-preview-line">
                  {viewer.canEdit
                    ? "Article · Event · Meeting · Questionnaire"
                    : "Propose something for the group"}
                </span>
              }
            />

            <CalendarCard initialEvents={events} canEdit={viewer.canEdit} />

            <FilesCard initialFiles={files} canEdit={viewer.canEdit} />

            <IdeasCard initialIdeas={ideas} />
          </div>
        </div>

        {viewer.canEdit && (
          <section className="hub-wide">
            <HubCard
              title="Manage site"
              blurb="Review people and promote members."
              glyph="◈"
              accent="charcoal"
              href="/admin/directory"
              wide
              preview={
                <span className="hub-preview-line">
                  Directory entries, accounts and roles
                </span>
              }
            />
          </section>
        )}

        <section id="questionnaires" className="hub-wide">
          <HubCard
            title="Questionnaires & group research"
            blurb="Ask the membership something, and read the results."
            glyph="◎"
            accent="blue"
            wide
          >
            {viewer.canEdit ? (
              <ComposeWorkspace
                context={{
                  orgSlug: siteConfig.orgId,
                  canManageOrg: true,
                  // The full grid lives at /hub/compose; here only the
                  // research kinds, because that is what this card is for.
                  canPublishContent: false,
                }}
              />
            ) : (
              <div className="hub-panel">
                <p>
                  Administrators open questionnaires and polls from here. When
                  one is running you will be asked to answer it.
                </p>
              </div>
            )}
          </HubCard>
        </section>

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

        <section className="hub-wide">
          <HubCard
            title="Help & notes from the developer"
            blurb="How things work, and how to tell us they don't."
            glyph="?"
            accent="gold"
            wide
          >
            <div className="hub-panel">
              <h4 className="hub-panel-subhead">Getting around</h4>
              <ul className="hub-list">
                <li className="hub-list-row">
                  <div>
                    <p className="hub-list-title">Your page</p>
                    <p className="hub-list-body">
                      My profile &rarr; Edit my page opens your public page with
                      the editor on it, so you see changes where they land.
                    </p>
                  </div>
                </li>
                <li className="hub-list-row">
                  <div>
                    <p className="hub-list-title">Files and documents</p>
                    <p className="hub-list-body">
                      Files is the group&rsquo;s shared drive. Documents are
                      collaborative — several people can type in one at once.
                    </p>
                  </div>
                </li>
                <li className="hub-list-row">
                  <div>
                    <p className="hub-list-title">The calendar</p>
                    <p className="hub-list-body">
                      Anything dated and published reaches the group&rsquo;s
                      Nextcloud calendar, which you can subscribe to on a phone.
                    </p>
                  </div>
                </li>
              </ul>
              <p className="hub-muted">
                Something wrong or missing? Add it to Suggested ideas — that
                queue is read.
              </p>
            </div>
          </HubCard>
        </section>
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
