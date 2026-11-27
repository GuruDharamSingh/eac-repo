// ============================================================================
// @elkdonis/content/server: listContent, the library's original server loader,
// now a thin wrapper over searchContent (CONTRACT.md §3), written 2026-11-26.
//
// `orgId` maps to scope org; `ownerUserId` maps to scope mine, so it must be the
// viewer (both current callers pass the viewer's own id). The items come from
// the one mapping in hydrate.ts, which carries the logic this file had; the old
// loader is kept as list-legacy.ts only as the reference for check-search.mts'
// parity test, and goes in Step 7.
//
// Rights come from the viewer (access.ts), never from the query. This module
// is not marked `server-only`: keep it out of client bundles by importing
// `@elkdonis/content/server` from server code only.
// ============================================================================

import type { ContentListItem, ContentStatus, ContentType } from "../model";
import { defaultHost, type ContentHost } from "../host";
import type { ContentRights, ContentViewer } from "./access";
import { searchContent } from "./search";

export interface ContentListQuery {
  /** List an org's pieces. Exactly one of `orgId` / `ownerUserId`. */
  orgId?: string;
  /** List a person's pieces: the viewer's own, or (person scope) another person's public ones. */
  ownerUserId?: string;
  /** Default: every type. */
  types?: ContentType[];
  /** Default: draft, scheduled, live, published. `archived` is not listed yet. */
  statuses?: ContentStatus[];
  /** Default 40, at most 200. */
  limit?: number;
  /** `nextCursor` of the previous page. */
  cursor?: string | null;
}

export interface ContentListResult {
  items: ContentListItem[];
  nextCursor: string | null;
  /** Sources that were not read or failed; never silently dropped. */
  missing: string[];
}

export async function listContent(
  viewer: ContentViewer,
  query: ContentListQuery,
  preResolved?: ContentRights,
  host: ContentHost = defaultHost()
): Promise<ContentListResult> {
  const { orgId, ownerUserId } = query;
  if (Boolean(orgId) === Boolean(ownerUserId)) throw new Error("listContent: give exactly one of orgId or ownerUserId");
  const res = await searchContent(
    viewer,
    {
      // Someone else's person scope is a stranger's view of their public work (CONTRACT s11.2).
      scope: orgId ? { kind: "org", orgId } : ownerUserId === viewer.userId ? { kind: "mine" } : { kind: "person", userId: ownerUserId! },
      types: query.types,
      statuses: query.statuses,
      limit: query.limit,
      cursor: query.cursor,
    },
    host,
    { maxLimit: 200, rights: preResolved }
  );
  return { items: res.items, nextCursor: res.nextCursor, missing: res.missing };
}
