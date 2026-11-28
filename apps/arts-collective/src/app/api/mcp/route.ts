import { getActiveEnrolment, getCourseBySlug, getLearnerOutline, listMyEnrolments, stepTask } from "@elkdonis/lms";
import { defaultHost } from "@elkdonis/content/host";
import { resolveContentRefs, searchContent, suggestContent } from "@elkdonis/content/server";
import type { McpContent } from "@elkdonis/mcp/server";
import { loadPageWithVersion } from "@elkdonis/page-builder/server";
import { ACTION_LINKS } from "@/lib/actions/links";
import { channelNextSource } from "@/lib/channel/next-source";
import { mcpDrafts } from "@/lib/mcp-drafts";

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

// The content cornerstone's two readers (packages/mcp content.search / content.resolve). The viewer is the grant's
// person, passed by the tools; it is never a request parameter. defaultHost() covers org and network scopes.
const CONTENT_HOST = defaultHost();
const CONTENT: McpContent = {
  search: async (userId, q) => {
    // The tool already validated `types` against the schema; the cornerstone narrows them to ContentType.
    const query = { ...q, cursor: q.cursor ?? undefined } as Parameters<typeof searchContent>[1];
    const r = await searchContent(userId ? { userId } : null, query, CONTENT_HOST);
    return { items: r.items, nextCursor: r.nextCursor, missing: r.missing };
  },
  resolve: async (userId, keys) =>
    resolveContentRefs(userId ? { userId } : null, keys, CONTENT_HOST),
  suggest: (userId, q, limit) => suggestContent(userId ? { userId } : null, q, CONTENT_HOST, { limit }),
};

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
      // The page reader for read_page and find_fields (validates each row on the way out).
      pages: { loadPageWithVersion },
      // The draft writer for propose_page_patch and set_field: the step door and the draft store. It cannot publish.
      drafts: mcpDrafts,
      // content.search and content.resolve (read-only).
      content: CONTENT,
    }),
  );
  return handler;
}

const serve = async (req: Request) => (await mcp())(req);

export const POST = serve;
// GET (the 2025 SSE stream) and DELETE (2025 sessions) do not exist here: 405 from the handler.
export const GET = serve;
export const DELETE = serve;
