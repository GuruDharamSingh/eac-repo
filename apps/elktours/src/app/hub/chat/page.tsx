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

export const metadata: Metadata = { title: "General Chat" };
export const dynamic = "force-dynamic";

export default async function HubChatPage() {
  const viewer = await requireOrgMember("/hub/chat");
  const room = await getOrgChatRoom(siteConfig.orgId);
  const profile = await getProfile(viewer.userId);
  const fallbackName = profile?.displayName?.trim() || viewer.email;
  const [messages, nextcloudUrl, identity] = room
    ? await Promise.all([
        listOrgChatMessages(siteConfig.orgId, viewer.userId, { limit: 100 }),
        getOrgChatNextcloudUrl(siteConfig.orgId),
        getOrgChatIdentity(siteConfig.orgId, viewer.userId, fallbackName),
      ])
    : [[], null, undefined];

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-serif text-3xl">General Chat</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everyone in {siteConfig.orgName}. Messages go to the group&rsquo;s Nextcloud Talk room.
      </p>
      <div className="mt-6">
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
      </div>
    </div>
  );
}
