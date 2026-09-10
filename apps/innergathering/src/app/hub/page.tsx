import type { Metadata } from "next";
import {
  getOrgChatIdentity,
  getOrgChatRoom,
  getProfile,
  listOrgChatMessages,
  getStandingMeeting,
  listOrgEventsInRange,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { ChatCard, ProvisionChat } from "@elkdonis/chat";
import { SurfaceCard, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { CalendarFace } from "@/components/hub/CalendarFace";
import { PipelineFace } from "@/components/hub/PipelineFace";
import { getPipelineBoard } from "@/lib/pipeline";
import { StandingMeetingFace } from "@/components/hub/StandingMeetingFace";
import { HUB_CARDS } from "@/lib/hub-cards";

export const metadata: Metadata = { title: "Hub" };
export const dynamic = "force-dynamic";

const ARTDIRECT_URL = process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "http://localhost:3013";

/**
 * The members' hub: a grid of faces, each the tile-sized form of the popup it
 * opens. Every read the tiles need happens here, in parallel, server-side.
 * The popups fetch their own fuller record when opened, so a member who only
 * wanted the next gathering's time pays for nothing else.
 */
export default async function HubPage() {
  const viewer = await requireOrgMember("/hub");

  const calendarFrom = startOfMonth(new Date());
  const [profile, chatRoom, events, standing, board] = await Promise.all([
    getProfile(viewer.userId),
    getOrgChatRoom(siteConfig.orgId),
    // The calendar face draws this month; it fetches later months itself.
    listOrgEventsInRange(siteConfig.orgId, calendarFrom, addMonths(calendarFrom, 1)),
    // Which gathering leads the hub — an editor's flag first, then a weekly
    // series, then whatever is soonest. See getStandingMeeting.
    getStandingMeeting(siteConfig.orgId),
    // Only the fields the tile draws come out of this; the surface loads the
    // full board when it opens. A Deck outage costs the tile, not the hub.
    getPipelineBoard().catch(() => null),
  ]);

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

  const visible = HUB_CARDS.filter((c) => !c.adminOnly || viewer.canEdit);
  const main = visible.filter((c) => !c.wide);
  const wide = visible.filter((c) => c.wide);

  return (
    <>
      {/* The surface provider is mounted once in the root layout. */}
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
          {siteConfig.orgName}
        </p>
        <h1 className="mt-1 font-serif text-3xl">Hub</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Everything opens in place. Pick a day to see what&rsquo;s on, or to add something to it.
        </p>

        <div className="mt-8">
          <SurfaceCardGrid>
            {/* The standing gathering: what a member opens the hub to check. */}
            <StandingMeetingFace standing={standing} canEdit={viewer.canEdit} />

            <CalendarFace initialEvents={events} canEdit={viewer.canEdit} />

            <PipelineFace board={board} canEdit={viewer.canEdit} />

            {main.map((card) => (
              <SurfaceCard
                key={card.id}
                kind={card.kind}
                glyph={card.glyph}
                kicker={null}
                title={card.title}
                blurb={card.blurb}
                disabled={!card.available}
                surface={card.available ? card.surface : undefined}
                href={
                  card.available
                    ? card.id === "my_profile"
                      ? profile?.slug
                        ? `${ARTDIRECT_URL}/${profile.slug}`
                        : "/account"
                      : card.href
                    : undefined
                }
              />
            ))}

            <div className="w-full">
              {chatRoom ? (
                <ChatCard messages={chatMessages} canPost={viewer.isMember} identity={chatIdentity} />
              ) : (
                <ProvisionChat canProvision={viewer.canEdit} compact />
              )}
            </div>

            {wide.map((card) => (
              <SurfaceCard
                key={card.id}
                wide
                kind={card.kind}
                glyph={card.glyph}
                kicker={null}
                title={card.title}
                blurb={card.blurb}
                disabled={!card.available}
                surface={card.available ? card.surface : undefined}
                href={card.available ? card.href : undefined}
              />
            ))}
          </SurfaceCardGrid>
        </div>
      </div>
    </>
  );
}
