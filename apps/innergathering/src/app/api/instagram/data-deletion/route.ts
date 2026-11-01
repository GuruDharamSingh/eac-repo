import type { NextRequest } from "next/server";
import { createDataDeletionCallback } from "@elkdonis/meta/data-deletion";
import { fulfilMetaDeletion } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { publicOrigin } from "@/lib/public-origin";

/**
 * Instagram Login data deletion callback (the Instagram API with Instagram Login is a separate Meta app with its own secret). Deletes
 * any stored connection for the app-scoped user id, records the request and
 * answers with the status page.
 * Needs INSTAGRAM_APP_SECRET in this container's environment; answers 503 without it.
 */
export async function POST(req: NextRequest) {
  const origin = publicOrigin(req);
  const handler = createDataDeletionCallback({
    appSecret: process.env.INSTAGRAM_APP_SECRET,
    record: async ({ userId }) => {
      const request = await fulfilMetaDeletion({ orgId: siteConfig.orgId, externalUserId: userId, source: "instagram" });
      return {
        confirmationCode: request.confirmationCode,
        statusUrl: `${origin}/data/delete?code=${request.confirmationCode}`,
      };
    },
  });
  return handler(req);
}
