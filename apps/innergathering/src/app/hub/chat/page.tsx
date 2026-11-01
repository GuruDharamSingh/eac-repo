import "@elkdonis/cms-ui/hubsite.css";
import type { Metadata } from "next";
import { ProvisionChat } from "@elkdonis/chat";
import { HubPageFrame, NextcloudFrame } from "@elkdonis/cms-ui/hubsite";
import { getOrgChatNextcloudUrl, getOrgChatRoom, getViewerCloud } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { NEXTCLOUD_SIGN_IN } from "@/lib/hub-links";

export const metadata: Metadata = { title: "General Chat" };
export const dynamic = "force-dynamic";

/**
 * The group's Talk room, framed (owner, 2026-10-08). Replaces the native
 * ChatPage here; the hub's ChatCard still links its "expand" to this page.
 *
 * Framing is allowed for elkdonis-arts.org by the `eac_embed` Nextcloud app.
 * A member with a Nextcloud session appears under their own name; anyone
 * else joins the public (type 3) room as a guest and Talk asks for a name.
 * The bar under the frame signs them in to Nextcloud.
 */
export default async function HubChatPage() {
  const viewer = await requireOrgMember("/hub/chat");
  const [room, cloud] = await Promise.all([
    getOrgChatRoom(siteConfig.orgId).catch(() => null),
    getViewerCloud(viewer.userId, siteConfig.orgId).catch(() => null),
  ]);
  const roomUrl = room ? await getOrgChatNextcloudUrl(siteConfig.orgId).catch(() => null) : null;

  return (
    <HubPageFrame
      wide
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "General chat" }]}
      title="General chat"
      intro={<p>Everyone in {siteConfig.orgName}: messages, calls and shared files, in the group&rsquo;s Talk room.</p>}
    >
      {roomUrl ? (
        <NextcloudFrame
          src={roomUrl}
          title={`${siteConfig.orgName} — Talk room`}
          signInUrl={NEXTCLOUD_SIGN_IN}
          linked={cloud?.linked}
          height="72vh"
          allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
        />
      ) : (
        <ProvisionChat canProvision={viewer.canEdit} />
      )}
    </HubPageFrame>
  );
}
