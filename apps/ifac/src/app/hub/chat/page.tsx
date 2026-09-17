import type { Metadata } from "next";
import { ChatPage, ProvisionChat } from "@elkdonis/chat";
import {
  getOrgChatIdentity,
  getOrgChatNextcloudUrl,
  getOrgChatRoom,
  getProfile,
  listOrgChatMessages,
} from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { getSiteContent } from "@/lib/data";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = { title: "IFAC General Chat" };
export const dynamic = "force-dynamic";

/**
 * The expanded General Chat — the same Talk room the hub card shows, given the
 * height to hold a conversation. A page rather than a surface on purpose: a
 * chat you can link to and come back to is worth more than one that traps you
 * in a dialog.
 */
export default async function HubChatPage() {
  const viewer = await requireOrgMember("/hub/chat");

  const [content, room, profile] = await Promise.all([
    getSiteContent(),
    getOrgChatRoom(siteConfig.orgId),
    getProfile(viewer.userId),
  ]);
  const fallbackName = profile?.displayName?.trim() || viewer.email;

  const [messages, nextcloudUrl, identity] = room
    ? await Promise.all([
        listOrgChatMessages(siteConfig.orgId, viewer.userId, { limit: 100 }),
        getOrgChatNextcloudUrl(siteConfig.orgId),
        getOrgChatIdentity(siteConfig.orgId, viewer.userId, fallbackName),
      ])
    : [[], null, undefined];

  return (
    <div className="site-shell">
      <SiteHeader />

      <main className="hub">
        <div className="hub-welcome">
          <div>
            <p className="kicker">{siteConfig.shortName}</p>
            <h1>General Chat</h1>
            <p className="hub-welcome-sub">
              Everyone in IFAC. Messages go to the group&rsquo;s Nextcloud Talk
              room, so they are there for anyone who joins it from Nextcloud
              too. <a href="/hub">← Back to the hub</a>
            </p>
          </div>
        </div>

        <section className="hub-wide">
          {room ? (
            <ChatPage
              messages={messages}
              canPost={viewer.isMember}
              identity={identity}
              roomName={room.name}
              nextcloudUrl={nextcloudUrl}
            />
          ) : (
            <ProvisionChat canProvision={viewer.canEdit} />
          )}
        </section>
      </main>

      <SiteFooter content={content.footer} />
    </div>
  );
}
