import { listOrgFeeds } from "@elkdonis/services";
import { getThreadById } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { WirePostThread } from "@/blocks/writing-sample";

// ============================================================================
// The post behind "Post" (pt-post), the post-detail template's block (2026-11-14, editing landscape round 2).
//
// Published: app/[feed]/[slug] passes `metadata.threadId` for a post it has already found (published, in its section),
// so every block on the template draws the post being visited, as the event blocks draw the gathering. In the editor,
// `/studio/post-detail?thread=<id>` passes the same key (through /api/blocks, editors only). Without one there is
// nothing to draw, and the editor shows its example.
//
// Only this org's threads (getThreadById is org-scoped), only `kind = 'post'`, and a draft only for its editors.
// ============================================================================

export async function loadPost(ctx: Record<string, unknown>): Promise<{ post: WirePostThread | null }> {
  const id = typeof ctx.threadId === "string" ? ctx.threadId : "";
  if (!id) return { post: null };
  const [thread, viewer] = await Promise.all([getThreadById(id), getViewer().catch(() => null)]);
  if (!thread || thread.kind !== "post") return { post: null };
  if (thread.status !== "published" && !viewer?.canEdit) return { post: null };
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => []);
  const feed = feeds.find((f) => f.slug === thread.feedSlug);
  return {
    post: {
      id: thread.id,
      title: thread.title,
      excerpt: thread.excerpt,
      bodyHtml: thread.description ?? "",
      authorName: thread.authorName,
      publishedAt: thread.publishedAt ? new Date(thread.publishedAt).toISOString() : null,
      coverImageUrl: thread.coverImageUrl,
      feedSlug: thread.feedSlug,
      feedName: feed?.name ?? null,
    },
  };
}
