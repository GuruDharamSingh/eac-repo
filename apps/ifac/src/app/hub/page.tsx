import { redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import {
  getMeetingAttendance,
  getOrgChatIdentity,
  getOrgChatRoom,
  getStandingMeeting,
  getThemeOverrides,
  getViewerAlerts,
  listOrgChatMessages,
  listOrgDocuments,
  listOrgEventsInRange,
  listOrgFiles,
  listOrgIdeas,
  resolveMeetingLight,
} from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { ChatCard, ProvisionChat } from "@elkdonis/chat";
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
import { WhiteboardFace } from "@elkdonis/cms-ui/whiteboard";
import { KindTilesFace } from "@/components/hub/KindTilesFace";
import { HelpErrand } from "@/components/hub/HelpErrand";
import { AppearanceCard } from "@/components/hub/AppearanceCard";
import { FilesFace } from "@/components/hub/FilesCard";
import { PageSectionsFace, type HubSections } from "@/components/hub/PageSectionsCard";
import type { StoreEntryState } from "@elkdonis/commerce/links";
import { getStoreForUser } from "@elkdonis/commerce/queries";
import { IFAC_THEME_VARS, IFAC_THEMEABLE_PAGES } from "@/lib/theme-tokens";
import { saveIfacThemeAction } from "@/lib/theme-actions";
import { getHubSkin } from "@/lib/hub-skin-store";
import { saveHubSkinAction } from "@/lib/hub-skin-actions";

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
    redirect(session.user ? "/?notice=members-only" : "/login?next=/hub");
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
    chatRoom,
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
    // Whether IFAC has a Talk room at all. Null is the ordinary first state,
    // not a failure — the announcements panel then offers to create one.
    getOrgChatRoom(siteConfig.orgId).catch(() => null),
  ]);

  // Is it happening, and what has this member already said?
  //
  // These cannot join the batch above: both are keyed on `standing.event.id`,
  // which that batch is what produces. Two indexed single-row lookups, and
  // only paid for when there is a gathering to say anything about.
  const [meetingLight, meetingAnswer] = standing
    ? await Promise.all([
        resolveMeetingLight(standing.event.id, { occurrence: standing.at }),
        getMeetingAttendance(standing.event.id, viewer.userId),
      ])
    : [null, null];

  // The transcript, only once we know there is a room to read. Two awaits
  // rather than one because both of these need its token.
  const [chatMessages, chatIdentity] = chatRoom
    ? await Promise.all([
        listOrgChatMessages(siteConfig.orgId, viewer.userId, { limit: 20 }),
        getOrgChatIdentity(
          siteConfig.orgId,
          viewer.userId,
          profile?.displayName?.trim() || viewer.email
        ),
      ])
    : [[], undefined];

  // The layout reads this too, for the `data-hub-skin` attribute. Read again
  // rather than threaded through `children`, which a layout cannot do: one
  // indexed single-row lookup against a value the page has to show anyway.
  const skin = await getHubSkin(siteConfig.orgId);

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
  // Just the given name for the greeting. A display name may be a full name,
  // a studio name or an email stub; the first word of it is the friendliest
  // thing that is true in all three cases.
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;

  return (
    <div className="site-shell">
      {/* Site defaults, then this page's overrides, then the viewer's own. */}
      <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={viewer.userId} />
      {/* No banner here. The hub is a working page, not a front page, and the
          hero image pushed every tile below the fold — the same reason about,
          artists and gallery pass nothing. Restore it by handing SiteHeader
          `banner={{ imageUrl: content.hero.imageUrl, className: "hub-hero" }}`
          again; .hub-hero is still in globals.css. */}
      <SiteHeader />

      <main className="hub">
        <div className="hub-welcome">
          <div>
            <p className="kicker">{siteConfig.shortName}</p>
            {/* The member's own name, not "Welcome IFAC Members to the Main
                Hub". A hub for a collective of artists and dealers should
                greet a person; the old line greeted a category, and then
                spent its second sentence listing the tiles directly beneath
                it — which the bands now name for themselves. */}
            <h1>Welcome back, {firstName}.</h1>
            <p className="hub-welcome-sub">
              Here is what the collective has on, and what you can add to it.
            </p>
          </div>
          <HubDrawer
            displayName={displayName}
            profileHref={profile?.slug ? `/artists/${profile.slug}` : null}
          />
        </div>

        {/*
          Three bands, not one grid of thirteen.

          Every tile used to carry the same weight in one auto-fill grid, so
          the gathering that is the point of the group sat the same size as
          "Help & notes from the developer", and a member arriving had no
          reading order to follow. The bands give one: what is happening, what
          you can make, and your own place in it. Each is still the same face
          grid — this is an arrangement, not a second component.

          Every tile arrives carrying real information and clicking one opens
          the depth. That split is a load-time budget, not a style: all the
          reads happen above, in parallel, and each returns only the handful of
          fields its tile draws.
        */}

        <section className="hub-band" aria-labelledby="band-week">
          <div className="hub-band-head">
            <h2 id="band-week">This week</h2>
            <p>What the collective has on, and where it is being discussed.</p>
          </div>
          {/* Its own grid rather than the shared auto-fill one: the gathering
              leads at half the row and the other two share the rest, which is
              what makes it read as the lead rather than as the first of
              three equals. Collapses to one column on a phone. */}
          <SurfaceCardGrid className="hub-band-grid hub-band-grid--lead">
            {/* The three opt-in behaviours. Left off, this renders exactly
                the card it always did — which is why amrit-canada and
                innergathering are untouched by any of it.

                `attendance` is "Will you make it?", answered in words rather
                than yes/no: the flavour is stored beside a canonical status,
                so every count in the network still reads `status='yes'` and
                an early, hesitant or this-week-only yes all count the same.

                `light` is whether it is actually happening. Yellow derives
                itself when the gathering has a minimum attendance it has not
                met; an owner or guide can override, and the override names
                the occurrence so it expires on its own. */}
            <StandingMeetingFace
              standing={standing}
              canEdit={viewer.canEdit}
              timeZone={TIME_ZONE}
              attendance={{ answered: meetingAnswer }}
              light={meetingLight ?? undefined}
              history={{}}
            />
            <CalendarFace initialEvents={events} canEdit={viewer.canEdit} />
            <ForumFace forum={forum} />
          </SurfaceCardGrid>
        </section>

        <section className="hub-band" aria-labelledby="band-make">
          <div className="hub-band-head">
            <h2 id="band-make">Make something</h2>
            <p>
              Everything here belongs to IFAC and shows on the site. Dated
              items also reach the group&rsquo;s calendar.
            </p>
          </div>
          <SurfaceCardGrid className="hub-band-grid">
            {/*
              Publish — a plain face over the catalogue.

              The kinds were tiles ON this card for one revision. They are
              gone: a tile grid inside a tile is the picker drawn twice, and
              the popup already draws it properly, at a readable size, with
              each kind's accent. The face's job is to be the door.

              What each kind does once chosen is still per-kind — short things
              stay in the popup, long ones open their own page — and that
              decision lives in the catalogue, not here.
            */}
            <SurfaceCard
              kind="compose"
              glyph="✚"
              kicker={null}
              title="Publish"
              blurb="Writing, gatherings, work for sale — everything the group puts out."
              surface={{ type: "compose" }}
              ariaLabel="Choose what to publish"
            />

            {/* The face IS the form: type it, press Enter. Opening the tile
                goes to the ideas feed on the forum, where they are discussed. */}
            <IdeasFace initialIdeas={ideas} />

            <DocumentsFace documents={documents} />

            <FilesFace initialFiles={files} canEdit={viewer.canEdit} />

            <PipelineFace board={board} canEdit={viewer.canEdit} />

            {/* The shared canvas. It sits with the things you make rather
                than with the things you read, and it opens at `full` width —
                a drawing surface with a toolbar down one side has nothing to
                give back at tile-and-a-half. */}
            <WhiteboardFace blurb="A shared canvas. Sketch a hang, a floor plan, an idea." />

            {/*
              Group research. Was "Ask the membership", a single tile that
              opened a popup holding a long question-builder — the same
              losable-draft problem compose had. The three things it can be
              are tiles now, and the two that are real open their form on its
              own page.
            */}
            <KindTilesFace
              kind="questionnaire"
              title="Group research"
              blurb="Put something to the membership, and read what comes back."
              tiles={[
                {
                  kind: "questionnaire",
                  glyph: "▤",
                  label: "Questionnaire",
                  href: "/hub/compose?kind=questionnaire",
                  note: "A set of questions",
                },
                {
                  kind: "poll",
                  glyph: "▥",
                  label: "Poll",
                  href: "/hub/compose?kind=poll",
                  note: "One question, a result bar",
                },
                {
                  // Declared but not built. Shown so the set reads as a whole
                  // — "what can we ask the group" has three answers, and one
                  // of them is coming.
                  kind: "meeting",
                  glyph: "◷",
                  label: "Arrange a time",
                  note: "Find when everyone is free",
                },
              ]}
            />
          </SurfaceCardGrid>
        </section>

        <section className="hub-band" aria-labelledby="band-you">
          <div className="hub-band-head">
            <h2 id="band-you">Your place here</h2>
            <p>
              How you appear to the rest of the collective, and what your own
              page carries.
            </p>
          </div>
          <SurfaceCardGrid className="hub-band-grid hub-band-grid--pair">
            {/* Identity: the shared surface, opening in place rather than
                bouncing the member to a different domain to edit their own
                name and bio. */}
            <ProfileFace
              summary={{
                displayName: displayName,
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
          </SurfaceCardGrid>
        </section>

        {/* General Chat, under the bands.
            It used to sit above them, which put a chat nobody had asked for
            between the welcome and every tile — and pushed the tiles below the
            fold on a laptop.

            Height came down from h-[42rem] to h-[30rem]. Forty-two was two
            tiles deep, chosen when the chat was the only thing under a flat
            grid; with three banded sections above it, a half-screen well of
            mostly empty transcript was the largest thing on the page and the
            last thing a member needed. Thirty still holds a conversation
            rather than a peek, and /hub/chat is one click away for the rest.

            The room is created from the button here, by an owner or guide, and
            this becomes the live transcript. Members post under their OWN
            names without holding Nextcloud accounts: each gets a Talk guest
            session (migration 102). Reads go over the service account, which
            is a participant in every room the network provisions. See
            packages/services/src/org-chat.ts. */}
        <section className="hub-band hub-band--chat" aria-labelledby="chat-head">
          <div className="hub-band-head">
            <h2 id="chat-head">General chat</h2>
            <p>Everyone in IFAC. Say hello, ask the room, share what you found.</p>
          </div>
          {chatRoom ? (
            <ChatCard
              messages={chatMessages}
              // getHubViewer already refused anyone who is not member-and-up,
              // so reaching this line IS the permission to post.
              canPost
              identity={chatIdentity}
              title="General Chat"
              expandedHref="/hub/chat"
              heightClass="h-[30rem]"
            />
          ) : (
            <div className="hub-talk-frame">
              <ProvisionChat canProvision={viewer.canEdit} />
            </div>
          )}
        </section>

        {/* The quiet end of the page.

            Running the site and asking how it works were both full-width
            faces in the grid above, each as large as the gathering and each
            carrying one line. They are errands, not features: they belong
            after the work, at the size of a link. */}
        <section className="hub-band hub-band--errands" aria-labelledby="band-errands">
          <div className="hub-band-head">
            <h2 id="band-errands">Running things</h2>
          </div>
          <div className="hub-errands">
            {viewer.canEdit && (
              <a className="hub-errand" href="/manage">
                <span className="hub-errand-glyph" aria-hidden>
                  &#9672;
                </span>
                <span>
                  <strong>Manage the site</strong>
                  <em>Artists &amp; dealers &middot; people &amp; access &middot; site copy</em>
                </span>
              </a>
            )}
            <a className="hub-errand" href="/forum/general">
              <span className="hub-errand-glyph" aria-hidden>
                &#9776;
              </span>
              <span>
                <strong>The forum</strong>
                <em>Every board, in full</em>
              </span>
            </a>
            <HelpErrand />
          </div>

          {viewer.canEdit && (
            <AppearanceCard
              vars={IFAC_THEME_VARS}
              pages={IFAC_THEMEABLE_PAGES}
              overridesByPage={overridesByPage}
              onSaveSite={saveIfacThemeAction}
              skin={skin}
              onSaveSkin={saveHubSkinAction}
            />
          )}
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
async function readProfileSections(userId: string): Promise<HubSections> {
  const empty: HubSections = {
    elkdonisFeed: false,
    store: false,
    blog: false,
    storeState: "none",
    storeId: null,
    storeName: null,
  };
  try {
    const [row] = await db<Array<{ profile_sections: Record<string, unknown> }>>`
      SELECT profile_sections FROM users WHERE id = ${userId}
    `;
    // Their marketplace store, in whatever state it is actually in. This used
    // to collapse to `hasStore: status === "active"`, which told a member
    // whose application was under review to go and open a store — the one
    // thing they had already done.
    const store = await getStoreForUser(userId).catch(() => null);
    return {
      elkdonisFeed: Boolean(row?.profile_sections?.elkdonisFeed),
      store: Boolean(row?.profile_sections?.store),
      blog: Boolean(row?.profile_sections?.blog),
      storeState: (store?.status as StoreEntryState) ?? "none",
      storeId: store?.id ?? null,
      storeName: store?.displayName ?? null,
    };
  } catch (error) {
    console.error("[ifac] readProfileSections error:", error);
    return empty;
  }
}
