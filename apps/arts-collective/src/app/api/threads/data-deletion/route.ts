import type { NextRequest } from "next/server";
import { createDataDeletionCallback } from "@elkdonis/meta/data-deletion";
import { fulfilMetaDeletion } from "@elkdonis/services";

/**
 * Threads data deletion callback (the Threads API is a separate Meta app with its own secret), on the
 * network host. Deletes any stored connection for the app-scoped user id,
 * records the request and answers with the status page. Needs THREADS_APP_SECRET in this container's environment;
 * answers 503 without it.
 *
 * The origin comes from the forwarded headers, not request.nextUrl.origin,
 * which reports 0.0.0.0:<port> behind the proxy (CLAUDE.md).
 */
function publicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host && !host.startsWith("0.0.0.0")) {
    const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const origin = publicOrigin(req);
  const handler = createDataDeletionCallback({
    appSecret: process.env.THREADS_APP_SECRET,
    record: async ({ userId }) => {
      const request = await fulfilMetaDeletion({ orgId: null, externalUserId: userId, source: "threads" });
      return {
        confirmationCode: request.confirmationCode,
        statusUrl: `${origin}/data/delete?code=${request.confirmationCode}`,
      };
    },
  });
  return handler(req);
}
