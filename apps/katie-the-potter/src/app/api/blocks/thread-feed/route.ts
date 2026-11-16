import { threadFeedRoutes } from "@elkdonis/blocks/server";
import { currentOrgId } from "@/lib/site-org";

/**
 * Rows for a thread-feed block, for the editor. Ungated by design: the loader
 * returns only this org's published, public threads. The handler is
 * `threadFeedRoutes` in @elkdonis/blocks/server.
 */
export const dynamic = "force-dynamic";

export const { GET } = threadFeedRoutes({ orgId: currentOrgId });
