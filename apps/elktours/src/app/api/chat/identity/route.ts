import { chatIdentityRoutes } from "@elkdonis/chat/routes";
import { badRequest, orgId, withMember } from "@/lib/chat-api";

/** The name this member posts under, and changing it. */
export const { GET, PUT } = chatIdentityRoutes({ orgId, withMember, badRequest });
