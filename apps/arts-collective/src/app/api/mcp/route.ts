import { getActiveEnrolment, getCourseBySlug, getLearnerOutline, listMyEnrolments, stepTask } from "@elkdonis/lms";
import { ACTION_LINKS } from "@/lib/actions/links";
import { channelNextSource } from "@/lib/channel/next-source";

/**
 * POST /api/mcp: the platform MCP endpoint (packages/mcp; docs/open/mcp-foundations/PLAN.md).
 * Streamable HTTP, stateless, read-only in slice 1. The actor is the grant behind the
 * `Authorization: Bearer eacm_…` key, never the session cookie: the cookie is not read here.
 *
 * Only the canonical host answers (MCP_PUBLIC_ORIGIN, default https://arts-collective.com):
 * the middleware skips /api, so every org subdomain and mapped domain reaches this file,
 * and packages/mcp answers those with 404.
 *
 * Lazy: the MCP code is imported on the first request, so it is a separate server chunk
 * that costs nothing until someone calls the endpoint. It is still compiled at build time.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LINKS = {
  ...ACTION_LINKS,
  nextcloud: (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "") || undefined,
};

// The same readers the dock route passes (app/api/actions/dock/route.ts).
const LMS = { getCourseBySlug, getActiveEnrolment, listMyEnrolments, getLearnerOutline, stepTask };

let handler: Promise<(req: Request) => Promise<Response>> | null = null;

function mcp() {
  handler ??= import("@elkdonis/mcp/server").then(({ mcpHandler }) =>
    mcpHandler({
      publicOrigin: process.env.MCP_PUBLIC_ORIGIN || "https://arts-collective.com",
      links: LINKS,
      // The Akhand Path's day pages (actions status.ts PAATH_BASE).
      linkHosts: ["elkdonis-arts.org"],
      sources: { channelNext: channelNextSource },
      lms: LMS,
    }),
  );
  return handler;
}

const serve = async (req: Request) => (await mcp())(req);

export const POST = serve;
// GET (the 2025 SSE stream) and DELETE (2025 sessions) do not exist here: 405 from the handler.
export const GET = serve;
export const DELETE = serve;
