import { createChatApi } from "@elkdonis/chat/routes";
import { getApiEditor, getApiMember, type Viewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/** This site's General Chat API, bound to its org. */
const api = createChatApi<Viewer>({
  orgId: siteConfig.orgId,
  getMember: getApiMember,
  getEditor: getApiEditor,
  logLabel: "amrit-canada",
});

export const { orgId, withMember, withEditor, badRequest } = api;
