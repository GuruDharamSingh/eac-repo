import "@elkdonis/cms-ui/hubsite.css";
import "./hub-cards.css";
import type { Metadata } from "next";
import {
  getProfile,
  getStandingMeeting,
  listOrgDocuments,
  listOrgEventsInRange,
  listOrgMediaLibrary,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { HubCardGrid, HubLinkCard, MeetingBanner, type MeetingBannerData } from "@elkdonis/cms-ui/hubsite";
import { SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import { DocumentsFace, GalleryFace } from "@elkdonis/cms-ui/hub";
import { getPayoutIdentity } from "@elkdonis/commerce/server";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { getPipelineBoard } from "@/lib/pipeline";
import { getAllThreadsForOrg } from "@/lib/data";
import { formatDeparture, listTours, nextDepartures } from "@/lib/tours";
import { EmailFace } from "@/components/hub/EmailFace";
import { PayoutsCard } from "@/components/manage/payouts-card";
import { TourScheduleCard } from "@/components/hub/tour-schedule-card";
import { listSuggestionsAction } from "@/lib/suggestion-actions";

export const metadata: Metadata = { title: "Hub" };
export const dynamic = "force-dynamic";

const TIME_ZONE = "Europe/Paris";
const TALK_BASE = (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");

/**
 * The members' hub in IFAC's "Cards 2" layout (apps/ifac/src/app/hub/
 * cards-view.tsx; 2026-11-02): the gathering banner, then cards that are
 * plain links to their own pages, built from cms-ui's shared hubsite
 * (`HubCardGrid`, `HubLinkCard`, `MeetingBanner`).
 *
 *   three across  Publish · Profile / Center · Tours (editors)
 *   panel         Tours offered: every tour, drafts filter, a way into each editor (editors)
 *   panel         Getting paid: the Stripe onboarding (editors; Stripe returns here since 2026-11-06, when it left /manage/tours)
 *   four across   Calendar · Manage the site · Whiteboard · General chat
 *   then          Working together: Forum · Ideas · Pipeline
 *   editor tools  Email, Gallery, Documents open in place (no page of their own on this site yet)
 */
export default async function HubPage({ searchParams }: { searchParams: Promise<{ payouts?: string }> }) {
  const viewer = await requireOrgMember("/hub");
  const { payouts: returned = null } = await searchParams;

  const from = startOfMonth(new Date());
  const [profile, standing, events, board, documents, media, emailThreads, tours, identity] = await Promise.all([
    getProfile(viewer.userId).catch(() => null),
    getStandingMeeting(siteConfig.orgId).catch(() => null),
    listOrgEventsInRange(siteConfig.orgId, from, addMonths(from, 1)).catch(() => []),
    // A Deck outage costs the card's count line, not the hub.
    getPipelineBoard().catch(() => null),
    listOrgDocuments(siteConfig.orgId, { withSnippets: 1 }).catch(() => []),
    // Editors only, as /api/media/library: the library lists unpublished material.
    viewer.canEdit
      ? listOrgMediaLibrary(siteConfig.orgId)
          .then((items) => items.map((i) => ({ url: i.url, name: i.filename })))
          .catch(() => [])
      : [],
    viewer.canEdit
      ? getAllThreadsForOrg(50)
          .then((threads) => threads.filter((t) => t.kind !== "post"))
          .catch(() => [])
      : [],
    viewer.canEdit ? listTours({ includeDrafts: true }).catch(() => []) : [],
    viewer.canEdit ? getPayoutIdentity(viewer.userId).catch(() => null) : null,
  ]);
  // Visitors' suggestions waiting for an editor (round 6). A failure costs the count line, not the hub.
  const waiting = viewer.canEdit
    ? await listSuggestionsAction({ status: "pending" }).then((l) => l.length).catch(() => null)
    : null;
  const next = viewer.canEdit && tours.length ? await nextDepartures(tours.map((t) => t.id)).catch(() => new Map()) : new Map();

  // The banner as IFAC's Cards 2 draws it, without the rota and light this site does not run.
  const meeting: MeetingBannerData | null = standing
    ? {
        id: standing.event.id,
        title: standing.event.title,
        at: standing.at.toISOString(),
        location: standing.event.location,
        kicker: standing.source === "next" ? "Next gathering" : "Next weekly meeting",
        photos: standing.event.coverImageUrl ? [standing.event.coverImageUrl] : [],
        joinUrl:
          standing.event.meetingUrl ||
          (standing.event.talkToken && TALK_BASE ? `${TALK_BASE}/call/${standing.event.talkToken}` : null),
        attendance: null,
        host: null,
        light: null,
        planAheadThreadId: null,
      }
    : null;

  const displayName = profile?.displayName?.trim() || viewer.email.split("@")[0];
  const firstName = displayName.split(/\s+/)[0] || displayName;

  const now = Date.now();
  const nextEvent = events
    .filter((e) => e.scheduledAt && new Date(e.scheduledAt).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0];
  const calendarLine = nextEvent
    ? `Next: ${nextEvent.title} · ${new Date(nextEvent.scheduledAt!).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE })}`
    : undefined;
  const boardCards = board ? board.stacks.reduce((n, s) => n + (s.cards ?? []).filter((c) => !c.archived).length, 0) : null;
  const drafts = tours.filter((t) => t.status !== "published").length;

  return (
    <main className="hub">
      <div className="eac-hs el-c2">
        <div className="el-c2-welcome">
          <div>
            <p className="eac-hs-kicker">{siteConfig.orgName}</p>
            <h1>Welcome back, {firstName}.</h1>
          </div>
        </div>

        <MeetingBanner meeting={meeting} timeZone={TIME_ZONE} />

        <HubCardGrid label="Hub" className="el-row-3">
          {viewer.canEdit ? (
            <HubLinkCard href="/manage/compose" glyph="✚" title="Publish" blurb="Journal posts, gatherings, pages: everything the site puts out." />
          ) : null}
          <HubLinkCard href="/center" title="Profile / Center" blurb="Your profile, what you follow, and your own efforts." />
          {viewer.canEdit ? (
            <HubLinkCard
              href="/manage/tours"
              glyph="⌖"
              title="Tours"
              blurb="Write and edit tours, their stops, films and dates."
              meta={`${tours.length} tour${tours.length === 1 ? "" : "s"}${drafts ? ` · ${drafts} draft${drafts === 1 ? "" : "s"}` : ""}`}
            />
          ) : null}
        </HubCardGrid>

        {viewer.canEdit ? (
          <TourScheduleCard
            tours={tours.map((t) => {
              const d = next.get(t.id);
              return { id: t.id, slug: t.slug, title: t.title, status: t.status, next: d ? formatDeparture(d.startsAt) : null };
            })}
          />
        ) : null}

        {viewer.canEdit ? (
          <div className="el-c2-payouts">
            {/* The Stripe onboarding (it was also on /manage/tours until 2026-11-06): the guide is the payee of the tours they author. */}
            <PayoutsCard
              identity={{
                country: identity?.country ?? null,
                payoutMethod: identity?.payoutMethod ?? null,
                payoutEmail: identity?.payoutEmail ?? null,
                hasAccount: Boolean(identity?.stripeAccountId),
                onboarded: Boolean(identity?.canReceiveDestinationCharge),
              }}
              cardAvailable={isCardPaymentAvailable()}
              returned={returned}
            />
          </div>
        ) : null}

        <HubCardGrid label="Calendar and tools" className={viewer.canEdit ? "el-row-5" : "el-row-3"}>
          <HubLinkCard href="/hub/calendar" glyph="▦" title="Calendar" blurb="Every gathering and departure, month by month." meta={calendarLine} />
          {viewer.canEdit ? (
            <HubLinkCard href="/manage" glyph="◈" title="Manage the site" blurb="Places, experiences, fly-overs, people and site copy." />
          ) : null}
          {viewer.canEdit ? (
            <HubLinkCard
              href="/manage/suggestions"
              glyph="✉"
              title="Suggestions"
              blurb="Spots and walks visitors suggested on the places page."
              meta={waiting != null ? (waiting === 0 ? "Nothing waiting" : `${waiting} waiting`) : undefined}
            />
          ) : null}
          <HubLinkCard href="/hub/whiteboard" glyph="✎" title="Whiteboard" blurb="A shared canvas. Sketch a route, a plan, an idea." />
          <HubLinkCard href="/hub/chat" glyph="☏" title="General chat" blurb={`Everyone in ${siteConfig.orgName}. Say hello, ask the room.`} />
        </HubCardGrid>

        <section className="eac-hp-section" aria-labelledby="c2-together">
          <h2 id="c2-together" className="eac-hp-section-title">
            Working together
          </h2>
          <HubCardGrid label="Working together" className="el-row-3">
            <HubLinkCard href="/forum" glyph="☰" title="Forum" blurb="What is being discussed, every board in full." />
            <HubLinkCard href="/forum/ideas" glyph="✦" title="Ideas" blurb="Suggestions for the site and the tours." />
            <HubLinkCard
              href="/hub/pipeline"
              glyph="▥"
              title="Pipeline"
              blurb="What the team is working on, on its Deck board."
              meta={boardCards !== null ? `${boardCards} card${boardCards === 1 ? "" : "s"} on the board` : undefined}
            />
          </HubCardGrid>
        </section>

        {/* These open in place: this site has no page for them yet, so they stay as faces. */}
        <section className="eac-hp-section" aria-labelledby="c2-tools">
          <h2 id="c2-tools" className="eac-hp-section-title">
            {viewer.canEdit ? "Documents and editor tools" : "Documents"}
          </h2>
          <SurfaceCardGrid>
            <DocumentsFace documents={documents} />
            {viewer.canEdit && <GalleryFace images={media} />}
            {viewer.canEdit && (
              <EmailFace
                threads={emailThreads.map((t) => ({
                  id: t.id,
                  title: t.title,
                  scheduledAt: t.scheduledAt?.toISOString() ?? null,
                  reminderMinutesBefore: t.reminderMinutesBefore,
                }))}
              />
            )}
          </SurfaceCardGrid>
        </section>
      </div>
    </main>
  );
}
