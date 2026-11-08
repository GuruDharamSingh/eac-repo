import { actionRoutes } from "@elkdonis/actions/server";
import { publicOriginFrom } from "@elkdonis/checkout/booking";
import { getCurrentUser } from "@/lib/session";
import { channelNextSource } from "@/lib/channel/next-source";
import { ACTION_LINKS } from "./links";

/**
 * The registry over HTTP on this host (/api/actions; packages/actions/src/server/routes.ts).
 * One instance, shared by app/api/actions/route.ts and app/api/actions/[id]/route.ts.
 * The actor is the verified session's user; `org` claims are settled by `actionOrgId`,
 * the same rule as `runAction` (./run.ts).
 */

export const actionHttp = actionRoutes({
  who: async () => {
    const user = await getCurrentUser();
    return user ? { userId: user.id, email: user.email } : null;
  },
  links: ACTION_LINKS,
  // Not request.nextUrl.origin, which reports 0.0.0.0:<port> here (CLAUDE.md).
  publicOrigin: (req) => publicOriginFrom(req.headers, process.env.NEXT_PUBLIC_APP_URL),
  // channel-next reads the board through the /channel loader (lib/channel/next-source.ts).
  sources: { channelNext: channelNextSource },
});
