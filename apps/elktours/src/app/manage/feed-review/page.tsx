import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FeedReviewView, type ReviewPost } from "@/components/mobile/feed-review-view";
import { listFeedPostsToConfirm } from "@/lib/feed";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Posts to confirm", robots: { index: false, follow: false } };

/** Feed posts waiting for the office, as a phone list (reviewFeedPostAction). */
export default async function FeedReviewPage() {
  const viewer = await requireOrgEditor();
  if (viewer.role !== "owner") redirect("/manage"); // the queue is the office's
  const posts = await listFeedPostsToConfirm();
  const rows: ReviewPost[] = posts.map((p) => ({
    id: p.id,
    kind: p.kind,
    title: p.title,
    excerpt: p.excerpt,
    author: p.author.name,
    host: p.link?.host ?? null,
    linkUrl: p.link?.url ?? null,
    createdAt: p.createdAt,
  }));
  return (
    <div className="elk-m">
      <FeedReviewView posts={rows} isOwner={viewer.role === "owner"} />
    </div>
  );
}
