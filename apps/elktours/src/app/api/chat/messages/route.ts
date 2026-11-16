import { chatMessageRoutes } from "@elkdonis/chat/routes";
import { badRequest, orgId, withMember } from "@/lib/chat-api";

export const { GET, POST } = chatMessageRoutes({ orgId, withMember, badRequest });
