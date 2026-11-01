import type { NextRequest } from "next/server";
import { createDataDeletionCallback } from "@elkdonis/meta/data-deletion";
import { fulfilMetaDeletion } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { publicOrigin } from "@/lib/public-origin";

/**
 * Meta's data deletion callback for the collective's Facebook app. Deletes
 * any stored connection for the app-scoped user id, records the request and
 * answers with the status page.
 * Needs META_APP_SECRET in this container's environment; answers 503 without it.
 */
export async function POST(req: NextRequest) {
  const origin = publicOrigin(req);
  const handler = createDataDeletionCallback({
    record: async ({ userId }) => {
      const request = await fulfilMetaDeletion({ orgId: siteConfig.orgId, externalUserId: userId });
      return {
        confirmationCode: request.confirmationCode,
        statusUrl: `${origin}/data/delete?code=${request.confirmationCode}`,
      };
    },
  });
  return handler(req);
}
