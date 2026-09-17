import { createChatApi } from "@elkdonis/chat/routes";
import { getApiEditor, getApiMember, type Viewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * This site's General Chat API, bound to the IFAC org.
 *
 * The org id is fixed HERE, server-side, and no route below ever accepts a
 * room token or an org from the caller — the same boundary rule org-chat.ts
 * states for itself, since every Talk call goes out over a service-account
 * credential that can see every org's rooms.
 *
 * Read and post are member-and-up (`getApiMember` excludes `viewer`, who is a
 * follower with read access to the public site only); creating the room is
 * owner/guide.
 */
const api = createChatApi<Viewer>({
  orgId: siteConfig.orgId,
  getMember: getApiMember,
  getEditor: getApiEditor,
  logLabel: "ifac",
});

export const { orgId, withMember, withEditor, badRequest } = api;
